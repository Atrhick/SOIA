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

type CheckInOutcome = 'sent' | 'recent' | 'unreachable' | 'failed'

/** Sends one check-in (no auth check: callers do it). Skips people checked in on in the last few days. */
async function checkInOne(adminId: string, userId: string): Promise<CheckInOutcome> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, status: true } })
  if (!user || user.status !== 'ACTIVE' || !canInvite(user.role)) return 'unreachable'
  const since = new Date(Date.now() - CHECK_IN_EVERY_DAYS * 86400_000)
  const recent = await prisma.auditLog.findFirst({ where: { action: CHECK_IN_ACTION, entityId: user.id, createdAt: { gte: since } }, select: { createdAt: true } })
  if (recent) return 'recent'
  const name = await userDisplayName(user.id)
  if (!name) return 'unreachable'
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
  if (!sent.sent) return 'failed'
  await prisma.auditLog.create({
    data: { userId: adminId, action: CHECK_IN_ACTION, entityType: 'User', entityId: user.id, details: JSON.stringify({ to: 'member' }) },
  })
  return 'sent'
}

export async function sendOutreachCheckIn(userId: string): Promise<Result> {
  const session = await requireAdmin()
  if (!session) return { error: 'Only admins can send check-ins (and not while viewing as someone else).' }
  const parsed = z.string().min(1).max(64).safeParse(userId)
  if (!parsed.success) return { error: 'Unknown member.' }
  const r = await checkInOne(session.user.id, parsed.data)
  if (r === 'recent') return { error: `A check-in was sent in the last ${CHECK_IN_EVERY_DAYS} days. Give them a little time.` }
  if (r === 'unreachable') return { error: "That member can't be reached here." }
  if (r === 'failed') return { error: 'The email could not be sent. Please try again later.' }
  revalidatePath('/admin/one-a-day')
  const name = await userDisplayName(parsed.data)
  return { ok: true, message: `Check-in sent to ${name?.first ?? 'them'}.` }
}

/** Most check-ins one click sends; the email provider allows only a few per second. */
const BULK_CHECK_IN_MAX = 50

export type BulkCheckInResult = { ok: true; sentIds: string[]; skipped: number; failed: number; remaining: number; message: string } | { error: string }

/** Check in on many members at once (people checked in on recently are skipped). Sends at most BULK_CHECK_IN_MAX per call. */
export async function sendOutreachCheckInBulk(userIds: string[]): Promise<BulkCheckInResult> {
  const session = await requireAdmin()
  if (!session) return { error: 'Only admins can send check-ins (and not while viewing as someone else).' }
  const parsed = z.array(z.string().min(1).max(64)).max(5000).safeParse(userIds)
  if (!parsed.success) return { error: 'Unknown members.' }
  const ids = Array.from(new Set(parsed.data))
  const sentIds: string[] = []
  let skipped = 0, failed = 0, i = 0
  for (; i < ids.length && sentIds.length < BULK_CHECK_IN_MAX; i++) {
    const r = await checkInOne(session.user.id, ids[i])
    if (r === 'sent') { sentIds.push(ids[i]); await new Promise((ok) => setTimeout(ok, 550)) }
    else if (r === 'failed') failed++
    else skipped++
  }
  const remaining = ids.length - i
  revalidatePath('/admin/one-a-day')
  const parts = [`${sentIds.length} check-in${sentIds.length === 1 ? '' : 's'} sent`]
  if (skipped) parts.push(`${skipped} skipped (checked in on recently)`)
  if (failed) parts.push(`${failed} couldn't be sent`)
  if (remaining) parts.push(`${remaining} still to go: click again to continue`)
  return { ok: true, sentIds, skipped, failed, remaining, message: parts.join(' · ') + '.' }
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
