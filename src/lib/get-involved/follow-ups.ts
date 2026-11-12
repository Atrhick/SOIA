/**
 * Follow-ups due (outreach round 2). Server only (reads the database); the rules themselves are the pure
 * `followUpsDue()` below, tested in follow-ups.test.ts.
 *
 * - Nudge: a first message (not a post) with no outcome, sent 3–4 calendar days ago (Central), not nudged yet.
 * - Close: the same, 10–14 days ago, not closed yet. After day 14 nothing more is suggested.
 * - Filled the form, no call yet: the user's invited prospects in FORM_SUBMITTED with no booked or kept call,
 *   signed up 2–14 days ago, not marked Done. Under 18: listed under the parent's name only (skipped if none).
 *
 * "Done" on a form row is stored without a schema change as an OutreachShare with kind 'FORM_DONE',
 * outcome 'DONE' and firstName = the PROSPECT ID (not a name). Anything counting shares must only count
 * kind FIRST / AFTER_YES.
 */
import prisma from '@/lib/prisma'
import { BUSINESS_TZ, businessDay } from './core'

export const NUDGE_DAYS = [3, 4] as const
export const CLOSE_DAYS = [10, 14] as const
export const FORM_MIN_DAYS = 2
export const FORM_MAX_DAYS = 14
export const FORM_DONE_KIND = 'FORM_DONE'

export interface ShareFacts {
  id: string
  firstName: string | null
  channel: string
  kind: string
  programId: string | null
  sentAt: Date
  outcome: string | null
  nudgedAt: Date | null
  closedAt: Date | null
}

export interface FormFacts {
  id: string
  firstName: string
  ageRange: string | null
  parentName: string | null
  programId: string | null
  inviteChannel: string | null
  createdAt: Date
  status: string
  hasCall: boolean
  done: boolean
}

export type FollowUp =
  | { type: 'NUDGE' | 'CLOSE'; shareId: string; name: string; channel: string; programId: string | null; day: number; sentAt: Date; nudgedAt: Date | null }
  | { type: 'FORM'; prospectId: string; name: string; channel: string; programId: string | null; day: number; createdAt: Date; parent: boolean }

/** Whole calendar days between two instants in the business time zone. */
export function calendarDaysBetween(from: Date, to: Date, tz = BUSINESS_TZ): number {
  const a = Date.parse(`${businessDay(from, tz)}T00:00:00Z`)
  const b = Date.parse(`${businessDay(to, tz)}T00:00:00Z`)
  return Math.round((b - a) / 86400_000)
}

const inRange = (d: number, [lo, hi]: readonly [number, number]) => d >= lo && d <= hi

export function followUpsDue(shares: ShareFacts[], forms: FormFacts[], now: Date): FollowUp[] {
  const out: FollowUp[] = []
  for (const s of shares) {
    if (s.kind !== 'FIRST' || s.channel === 'POST' || s.outcome || !s.firstName?.trim()) continue
    const day = calendarDaysBetween(s.sentAt, now)
    if (inRange(day, NUDGE_DAYS) && !s.nudgedAt) out.push({ type: 'NUDGE', shareId: s.id, name: s.firstName.trim(), channel: s.channel, programId: s.programId, day, sentAt: s.sentAt, nudgedAt: s.nudgedAt })
    else if (inRange(day, CLOSE_DAYS) && !s.closedAt) out.push({ type: 'CLOSE', shareId: s.id, name: s.firstName.trim(), channel: s.channel, programId: s.programId, day, sentAt: s.sentAt, nudgedAt: s.nudgedAt })
  }
  for (const f of forms) {
    if (f.status !== 'FORM_SUBMITTED' || f.hasCall || f.done) continue
    const day = calendarDaysBetween(f.createdAt, now)
    if (day < FORM_MIN_DAYS || day > FORM_MAX_DAYS) continue
    const minor = f.ageRange === 'UNDER_18'
    const name = minor ? f.parentName?.trim().split(/\s+/)[0] ?? '' : f.firstName.trim()
    if (!name) continue
    out.push({ type: 'FORM', prospectId: f.id, name, channel: minor ? 'PARENT' : f.inviteChannel ?? 'TEXT', programId: f.programId, day, createdAt: f.createdAt, parent: minor })
  }
  const order = { NUDGE: 0, FORM: 1, CLOSE: 2 }
  return out.sort((a, b) => order[a.type] - order[b.type] || b.day - a.day)
}

/** Everything the follow-ups page needs for one user (their own shares and prospects only). */
export async function loadFollowUps(userId: string, now = new Date()): Promise<FollowUp[]> {
  const since = new Date(now.getTime() - 16 * 86400_000)
  const [shares, prospects, done] = await Promise.all([
    prisma.outreachShare.findMany({
      where: { userId, kind: 'FIRST', outcome: null, sentAt: { gte: since } },
      orderBy: { sentAt: 'asc' },
      take: 500,
      select: { id: true, firstName: true, channel: true, kind: true, programId: true, sentAt: true, outcome: true, nudgedAt: true, closedAt: true },
    }),
    prisma.prospect.findMany({
      where: { invitedById: userId, status: 'FORM_SUBMITTED', createdAt: { gte: since } },
      take: 200,
      select: {
        id: true, firstName: true, ageRange: true, parentName: true, programId: true, inviteChannel: true, createdAt: true, status: true,
        discoveryCalls: { where: { status: { in: ['BOOKED', 'KEPT'] } }, take: 1, select: { id: true } },
      },
    }),
    prisma.outreachShare.findMany({ where: { userId, kind: FORM_DONE_KIND }, select: { firstName: true }, take: 2000 }),
  ])
  const doneIds = new Set(done.map((d) => d.firstName))
  return followUpsDue(
    shares,
    prospects.map((p) => ({ ...p, hasCall: p.discoveryCalls.length > 0, done: doneIds.has(p.id) })),
    now,
  )
}

/** For the "Follow-ups due" badge. */
export async function followUpsDueCount(userId: string, now = new Date()): Promise<number> {
  return (await loadFollowUps(userId, now)).length
}
