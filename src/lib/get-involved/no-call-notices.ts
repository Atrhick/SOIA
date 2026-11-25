/**
 * Bell + phone notices to the team when someone filled in the Get Involved form but hasn't booked a call.
 * Run by the cron (src/app/api/cron/discovery-reminders/route.ts). Server only, not 'use server'.
 *
 * - Day 2 to 9 after the form: one notice to the person who invited them (coach or ambassador) and to
 *   every admin.
 * - Day 10 to 13: one more, saying when their booking link stops working, so someone sends a fresh one.
 * Skipped once a call is booked, after "Maybe later" (that has its own check-in), and for any other status.
 * Each stage is sent once per person (an existing notice with that entityType is the record).
 */
import { prisma, withPushTag } from '@/lib/prisma'
import { LINK_VALID_DAYS } from './core'
import { dashboardPathFor } from './server'

const DAY = 86400_000
export const NOTICE_STAGES = [{ stage: 2, from: 2, to: 10 }, { stage: 10, from: 10, to: 14 }] as const
export type NoticeStage = 2 | 10
const entityTypeFor = (s: NoticeStage) => `ProspectNoCall${s}`

/** Which notice is due for someone who signed up at `createdAt` and still has no call (pure). */
export function noCallNoticeStage(createdAt: Date, now: Date): NoticeStage | null {
  const days = (now.getTime() - createdAt.getTime()) / DAY
  for (const s of NOTICE_STAGES) if (days >= s.from && days < s.to) return s.stage
  return null
}

const dayFmt = (d: Date) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday: 'long', month: 'short', day: 'numeric' }).format(d)

/** The words for each notice (pure, tested). */
export function noCallNoticeText(p: {
  stage: NoticeStage; first: string; full: string; days: number; linkEndsAt: Date | null; optedOut: boolean; forInviter: boolean; now?: Date
}): { title: string; message: string } {
  const ends = p.linkEndsAt ? dayFmt(p.linkEndsAt) : null
  // Someone already sent a fresh link recently: don't say it is about to stop working.
  const freshLink = !!p.linkEndsAt && p.now && p.linkEndsAt.getTime() - p.now.getTime() > 4 * DAY
  if (p.forInviter) {
    return p.stage === 2
      ? { title: `${p.first} hasn't booked a call yet`, message: `${p.first} filled in the form from your link ${p.days} days ago but hasn't picked a call time. A quick message from you often helps.` }
      : { title: `${p.first} still hasn't booked a call`, message: `It's been ${p.days} days since ${p.first} filled in the form. A message from you now may help. The NowTransformed team can also send a fresh booking link.` }
  }
  const how = p.optedOut ? 'They asked us to stop emailing them, so a phone call or text is the way to reach them.' : 'Open their record to send the booking link, or call them.'
  return p.stage === 2
    ? { title: `${p.full} hasn't booked a call yet`, message: `Filled in the form ${p.days} days ago. ${how}` }
    : freshLink
      ? { title: `${p.full} still hasn't booked a call`, message: `${p.days} days since the form. A fresh booking link was sent and works until ${ends}. ${p.optedOut ? how : 'A phone call may help.'}` }
      : {
        title: `${p.full}: booking link ${ends ? `stops working ${ends}` : 'is about to stop working'}`,
        message: `Still no call booked, ${p.days} days after the form. ${p.optedOut ? how : 'Open their record and press "Send booking link" to give them a fresh one, or call them.'}`,
      }
}

export async function runNoCallNotices(now = new Date()): Promise<number> {
  const rows = await prisma.prospect.findMany({
    where: {
      status: 'FORM_SUBMITTED', checkInAt: null,
      createdAt: { gt: new Date(now.getTime() - 14 * DAY), lte: new Date(now.getTime() - 2 * DAY) },
      discoveryCalls: { none: { status: 'BOOKED' } },
    },
    select: { id: true, firstName: true, lastName: true, createdAt: true, invitedById: true, emailOptOutAt: true, journeyTokenIssuedAt: true },
    take: 200,
  })
  if (rows.length === 0) return 0
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true } })
  let sent = 0
  for (const p of rows) {
    const stage = noCallNoticeStage(p.createdAt, now)
    if (!stage) continue
    const entityType = entityTypeFor(stage)
    if (await prisma.adminNotification.findFirst({ where: { entityType, entityId: p.id }, select: { id: true } })) continue
    const days = Math.floor((now.getTime() - p.createdAt.getTime()) / DAY)
    const base = {
      stage, first: p.firstName.trim() || 'Someone', full: `${p.firstName} ${p.lastName}`.trim() || 'Someone', days,
      linkEndsAt: p.journeyTokenIssuedAt ? new Date(p.journeyTokenIssuedAt.getTime() + LINK_VALID_DAYS * DAY) : null, optedOut: !!p.emailOptOutAt, now,
    }
    const adminText = noCallNoticeText({ ...base, forInviter: false })
    const data: { userId: string; type: 'PROSPECT_STATUS_CHANGED'; title: string; message: string; entityType: string; entityId: string; actionUrl: string }[] =
      admins.map((a) => ({ userId: a.id, type: 'PROSPECT_STATUS_CHANGED', ...adminText, entityType, entityId: p.id, actionUrl: `/admin/prospects/${p.id}` }))
    if (p.invitedById) {
      const inv = await prisma.user.findUnique({ where: { id: p.invitedById }, select: { id: true, role: true, status: true } })
      if (inv && inv.status === 'ACTIVE' && (inv.role === 'COACH' || inv.role === 'AMBASSADOR')) {
        data.push({ userId: inv.id, type: 'PROSPECT_STATUS_CHANGED', ...noCallNoticeText({ ...base, forInviter: true }), entityType, entityId: p.id, actionUrl: dashboardPathFor(inv.role) })
      }
    }
    if (data.length === 0) continue
    // Created inside withPushTag: the Prisma hook also sends each person a phone notification.
    await withPushTag(`nocall-${p.id}`, () => prisma.adminNotification.createMany({ data }))
    sent++
  }
  return sent
}
