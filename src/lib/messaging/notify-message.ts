import 'server-only'
import { prisma, withPushTag } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { appUrl } from '@/lib/get-involved/emails'
import { userDisplayName } from '@/lib/get-involved/server'
import { EMAIL_LOOKBACK_MS, UNREAD_EMAIL_AFTER_MS, messagePreview, messagesPathFor, unreadMessagesEmail } from './notify-message-core'

/**
 * Someone sent a direct message: tell everyone else in the conversation, straight away, in the bell and on
 * their phone. One unread bell row per conversation (the newest replaces the older unread one). No email here:
 * the cron sends one if the message is still unread after a while (runUnreadMessageEmails).
 * Never throws; a failed notice never fails the message.
 */
export async function notifyDirectMessage(channelId: string, authorId: string, content: string): Promise<number> {
  try {
    const now = new Date()
    const members = await prisma.channelMember.findMany({
      where: { channelId, userId: { not: authorId } },
      select: { userId: true, mutedUntil: true },
    })
    const ids = members.filter((m) => !m.mutedUntil || m.mutedUntil <= now).map((m) => m.userId)
    if (ids.length === 0) return 0
    const people = await prisma.user.findMany({ where: { id: { in: ids }, status: 'ACTIVE' }, select: { id: true, role: true } })
    if (people.length === 0) return 0
    const peopleIds = people.map((p) => p.id)

    const from = await userDisplayName(authorId)
    const title = `New message from ${from?.full || 'someone on the team'}`
    const preview = messagePreview(content)

    // Still unread from before: replace it, keeping "already emailed" so one unread stretch gets one email.
    const unread = await prisma.adminNotification.findMany({
      where: { userId: { in: peopleIds }, type: 'MESSAGE', entityId: channelId, isRead: false },
      select: { userId: true, emailedAt: true },
    })
    const emailed = new Map(unread.filter((u) => u.emailedAt).map((u) => [u.userId, u.emailedAt]))

    await prisma.adminNotification.deleteMany({ where: { userId: { in: peopleIds }, type: 'MESSAGE', entityId: channelId, isRead: false } })
    // Created inside withPushTag: the Prisma hook sends the phone notification (one per conversation on the phone).
    await withPushTag(`dm-${channelId}`, async () => {
      await prisma.adminNotification.createMany({
        data: people.map((p) => ({
          userId: p.id, type: 'MESSAGE' as const, title, message: preview,
          entityType: 'DirectMessage', entityId: channelId, actionUrl: messagesPathFor(p.role),
          emailedAt: emailed.get(p.id) ?? null,
        })),
      })
    })
    return people.length
  } catch (e) {
    console.error('[MESSAGES] notify failed', e)
    return 0
  }
}

/** They opened the conversation: mark its bell notices read. Never throws. */
export async function markDirectMessageNoticesRead(channelId: string, userId: string): Promise<void> {
  try {
    await prisma.adminNotification.updateMany({
      where: { userId, type: 'MESSAGE', entityId: channelId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    })
  } catch (e) {
    console.error('[MESSAGES] mark read failed', e)
  }
}

/** Conversations with unread messages, for the number beside "Messages" in the menu. */
export async function unreadConversationCount(userId: string): Promise<number> {
  try {
    return await prisma.adminNotification.count({ where: { userId, type: 'MESSAGE', isRead: false } })
  } catch {
    return 0
  }
}

/**
 * Cron (every 15 minutes): one email per person listing the conversations whose newest message has been
 * unread for UNREAD_EMAIL_AFTER_MS and that we haven't emailed about yet. Skips people who turned message
 * emails off and inactive accounts. Each notice is claimed (emailedAt set) before sending, so two cron runs
 * never email the same notice twice. Returns how many emails went out.
 */
export async function runUnreadMessageEmails(now = new Date()): Promise<number> {
  const due = await prisma.adminNotification.findMany({
    where: {
      type: 'MESSAGE', isRead: false, emailedAt: null,
      createdAt: { lte: new Date(now.getTime() - UNREAD_EMAIL_AFTER_MS), gte: new Date(now.getTime() - EMAIL_LOOKBACK_MS) },
    },
    select: { id: true, userId: true, title: true, message: true, actionUrl: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 500,
  })
  if (due.length === 0) return 0

  const byUser = new Map<string, typeof due>()
  for (const n of due) byUser.set(n.userId, [...(byUser.get(n.userId) ?? []), n])
  const users = await prisma.user.findMany({
    where: { id: { in: Array.from(byUser.keys()) } },
    select: { id: true, status: true, role: true, messageEmailsOff: true },
  })

  let sent = 0
  for (const u of users) {
    const items = byUser.get(u.id) ?? []
    // Claim them whether or not we email, so a person who turned emails off isn't re-checked every run.
    const claimed = await prisma.adminNotification.updateMany({
      where: { id: { in: items.map((i) => i.id) }, emailedAt: null, isRead: false },
      data: { emailedAt: now },
    })
    if (claimed.count === 0 || u.status !== 'ACTIVE' || u.messageEmailsOff) continue
    const to = await userDisplayName(u.id)
    if (!to?.email) continue
    const mail = unreadMessagesEmail({
      first: to.first,
      items: items.map((i) => ({ title: i.title, preview: i.message })),
      openUrl: appUrl(messagesPathFor(u.role)),
    })
    const r = await sendEmail({ to: to.email, ...mail })
    if (r.sent) sent++
  }
  return sent
}
