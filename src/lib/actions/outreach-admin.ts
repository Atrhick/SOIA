'use server'

/**
 * Admin actions for One-A-Day groups (outreach round 2): send a member a check-in email, and
 * reshuffle next month's groups. ADMIN only, never while impersonating. Both are audit-logged;
 * check-ins are limited to one per member per 3 days (read from the audit log).
 */
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { canInvite } from '@/lib/get-involved/core'
import { P, appUrl, esc, layout } from '@/lib/get-involved/emails'
import { userDisplayName } from '@/lib/get-involved/server'
import { assignGroups, isMonthKey } from '@/lib/get-involved/outreach-groups'
import { monthKey, monthLabel, parsePeriod } from '@/lib/get-involved/leaderboard-period'

type Result = { ok: true; message: string } | { error: string }

const CHECK_IN_ACTION = 'OUTREACH_CHECK_IN'
const CHECK_IN_EVERY_DAYS = 3

async function requireAdmin() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') return null
  if (session.user.isImpersonating) return null
  return session
}

export async function sendOutreachCheckIn(userId: string): Promise<Result> {
  const session = await requireAdmin()
  if (!session) return { error: 'Only admins can send check-ins (and not while viewing as someone else).' }
  const parsed = z.string().min(1).max(64).safeParse(userId)
  if (!parsed.success) return { error: 'Unknown member.' }

  const user = await prisma.user.findUnique({ where: { id: parsed.data }, select: { id: true, role: true, status: true } })
  if (!user || user.status !== 'ACTIVE' || !canInvite(user.role)) return { error: 'That member can\'t be reached here.' }

  const since = new Date(Date.now() - CHECK_IN_EVERY_DAYS * 86400_000)
  const recent = await prisma.auditLog.findFirst({ where: { action: CHECK_IN_ACTION, entityId: user.id, createdAt: { gte: since } }, select: { createdAt: true } })
  if (recent) return { error: `A check-in was sent in the last ${CHECK_IN_EVERY_DAYS} days. Give them a little time.` }

  const name = await userDisplayName(user.id)
  if (!name) return { error: 'Unknown member.' }
  const path = user.role === 'COACH' ? '/coach/one-a-day' : '/ambassador/one-a-day'
  const html = layout(
    `<p style="${P}">Hi ${esc(name.first)},</p>
     <p style="${P}">Just checking in. We noticed it's been a few days since your last One-A-Day message, and that's completely okay. Busy weeks happen.</p>
     <p style="${P}">When you have a minute, one short message to one person is all it takes. Your share kit has the words ready.</p>
     <p style="${P}">If something is getting in the way, just reply. We'd love to help.</p>`,
    { label: 'Open One-A-Day', url: appUrl(path) },
    '',
    { audience: 'team' },
  )
  const sent = await sendEmail({ to: name.email, subject: 'Checking in on your One-A-Day', html })
  if (!sent.sent) return { error: 'The email could not be sent. Please try again later.' }

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: CHECK_IN_ACTION, entityType: 'User', entityId: user.id, details: JSON.stringify({ to: 'member' }) },
  })
  revalidatePath('/admin/one-a-day')
  return { ok: true, message: `Check-in sent to ${name.first}.` }
}

/** Assigns (or reshuffles) the groups for next month. Only next month can be reshuffled, so this month's groups never move under people. */
export async function reshuffleOutreachGroups(month: string): Promise<Result> {
  const session = await requireAdmin()
  if (!session) return { error: 'Only admins can reshuffle groups (and not while viewing as someone else).' }
  if (typeof month !== 'string' || !isMonthKey(month)) return { error: 'Unknown month.' }
  const cur = parsePeriod(null, new Date()).key
  const [y, m] = cur.split('-').map(Number)
  const next = monthKey(y, m)
  if (month !== next) return { error: 'Only next month\'s groups can be reshuffled.' }
  try {
    const count = await assignGroups(month, { force: true })
    await prisma.auditLog.create({
      data: { userId: session.user.id, action: 'OUTREACH_GROUPS_RESHUFFLE', entityType: 'OutreachGroup', entityId: month, details: JSON.stringify({ groups: count }) },
    })
    revalidatePath('/admin/one-a-day')
    return { ok: true, message: count === 0 ? 'No members to group yet.' : `${count} group${count === 1 ? '' : 's'} set for ${monthLabel(y, m)}.` }
  } catch (e) {
    console.error('reshuffleOutreachGroups', e)
    return { error: 'Could not reshuffle the groups. Please try again.' }
  }
}
