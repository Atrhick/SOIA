/**
 * Follow-ups due (outreach round 2, regrouped in One-A-Day v2). Server only (reads the database); the
 * rules themselves are the pure functions below, tested in follow-ups.test.ts.
 *
 * - "Haven't replied" (NUDGE, message FOLLOW_UP): a first message (not a post) with no outcome, sent 3–4
 *   calendar days ago (Central), not followed up yet.
 * - "Last check-in" (CLOSE, message LAST): the same, 10–14 days ago, not closed yet. After day 14 nothing
 *   more is suggested.
 * - "Signed up but didn't book a call" (FORM, message NO_CALL): the user's invited prospects in
 *   FORM_SUBMITTED with no booked or kept call, signed up 2–14 days ago, not marked done. Under 18: listed
 *   under the parent's name only (skipped if none). The message carries the person's own booking link.
 * - v2: anyone who asked us to stop (EmailSuppression / Prospect.emailOptOutAt) is never listed, and an
 *   "Email them for me" invite whose person already signed up is not followed up.
 *
 * "Done" on a form row is stored without a schema change as an OutreachShare with kind 'FORM_DONE',
 * outcome 'DONE' and firstName = the PROSPECT ID (not a name). Anything counting shares must only count
 * kind FIRST / AFTER_YES.
 *
 * "Email them for me" (OutreachInvite) creates an EMAIL OutreachShare at the same moment; the two are
 * paired by user + first name + send time within INVITE_MATCH_MS, which gives the follow-up an address.
 */
import prisma from '@/lib/prisma'
import { BUSINESS_TZ, businessDay } from './core'

export const NUDGE_DAYS = [3, 4] as const
export const CLOSE_DAYS = [10, 14] as const
export const FORM_MIN_DAYS = 2
export const FORM_MAX_DAYS = 14
export const FORM_DONE_KIND = 'FORM_DONE'
export const INVITE_MATCH_MS = 10 * 60_000

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
  /** Address from the paired "Email them for me" invite, if any. */
  email?: string | null
  /** The person asked us to stop (Stop link / opted out). Never followed up. */
  stopped?: boolean
  /** The person already signed up from the emailed invite. */
  signedUp?: boolean
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
  email?: string | null
  phone?: string | null
  parentEmail?: string | null
  parentPhone?: string | null
  /** INVITER_ADDED = the member typed this person in themselves (only then do they see contact details). */
  inviteSource?: string | null
  /** Clicked "Stop emails about this". */
  optedOut?: boolean
}

export type FollowUp =
  | { type: 'NUDGE' | 'CLOSE'; shareId: string; name: string; channel: string; programId: string | null; day: number; sentAt: Date; nudgedAt: Date | null; email: string | null }
  | {
      type: 'FORM'; prospectId: string; name: string; channel: string; programId: string | null; day: number; createdAt: Date; parent: boolean
      /** The teen's first name when the row is for their parent. */
      teenName: string | null
      email: string | null
      phone: string | null
    }

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
    if (s.kind !== 'FIRST' || s.channel === 'POST' || s.outcome || !s.firstName?.trim() || s.stopped || s.signedUp) continue
    const day = calendarDaysBetween(s.sentAt, now)
    const base = { shareId: s.id, name: s.firstName.trim(), channel: s.channel, programId: s.programId, day, sentAt: s.sentAt, nudgedAt: s.nudgedAt, email: s.email ?? null }
    if (inRange(day, NUDGE_DAYS) && !s.nudgedAt) out.push({ type: 'NUDGE', ...base })
    else if (inRange(day, CLOSE_DAYS) && !s.closedAt) out.push({ type: 'CLOSE', ...base })
  }
  for (const f of forms) {
    if (f.status !== 'FORM_SUBMITTED' || f.hasCall || f.done || f.optedOut) continue
    const day = calendarDaysBetween(f.createdAt, now)
    if (day < FORM_MIN_DAYS || day > FORM_MAX_DAYS) continue
    const minor = f.ageRange === 'UNDER_18'
    const name = minor ? f.parentName?.trim().split(/\s+/)[0] ?? '' : f.firstName.trim()
    if (!name) continue
    out.push({
      type: 'FORM', prospectId: f.id, name, channel: minor ? 'PARENT' : f.inviteChannel ?? 'TEXT', programId: f.programId, day, createdAt: f.createdAt, parent: minor,
      teenName: minor ? f.firstName.trim() || null : null,
      // Contact details only for people the member added by hand; self sign-ups stay private.
      email: f.inviteSource === 'INVITER_ADDED' ? (minor ? f.parentEmail : f.email)?.trim() || null : null,
      phone: f.inviteSource === 'INVITER_ADDED' ? (minor ? f.parentPhone : f.phone)?.trim() || null : null,
    })
  }
  const order = { NUDGE: 0, FORM: 1, CLOSE: 2 }
  return out.sort((a, b) => order[a.type] - order[b.type] || b.day - a.day)
}

export interface InviteFacts { id: string; firstName: string; email: string; sentAt: Date }

/** Pairs each EMAIL share with the "Email them for me" invite sent at the same moment to the same first name. */
export function pairInvites<T extends { id: string; channel: string; firstName: string | null; sentAt: Date }>(shares: T[], invites: InviteFacts[]): Map<string, InviteFacts> {
  const out = new Map<string, InviteFacts>()
  const used = new Set<string>()
  for (const s of shares) {
    if (s.channel !== 'EMAIL' || !s.firstName) continue
    const name = s.firstName.trim().toLowerCase()
    let best: InviteFacts | null = null
    for (const i of invites) {
      if (used.has(i.id) || i.firstName.trim().toLowerCase() !== name) continue
      const gap = Math.abs(i.sentAt.getTime() - s.sentAt.getTime())
      if (gap > INVITE_MATCH_MS) continue
      if (!best || gap < Math.abs(best.sentAt.getTime() - s.sentAt.getTime())) best = i
    }
    if (best) { used.add(best.id); out.set(s.id, best) }
  }
  return out
}

/** Everything the follow-ups page needs for one user (their own shares and prospects only). */
export async function loadFollowUps(userId: string, now = new Date()): Promise<FollowUp[]> {
  const since = new Date(now.getTime() - 16 * 86400_000)
  const [shares, prospects, done, invites] = await Promise.all([
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
        email: true, phone: true, parentEmail: true, parentPhone: true, journeyToken: true, emailOptOutAt: true,
        discoveryCalls: { where: { status: { in: ['BOOKED', 'KEPT'] } }, take: 1, select: { id: true } },
      },
    }),
    prisma.outreachShare.findMany({ where: { userId, kind: FORM_DONE_KIND }, select: { firstName: true }, take: 2000 }),
    prisma.outreachInvite.findMany({
      where: { userId, status: 'SENT', sentAt: { gte: new Date(since.getTime() - INVITE_MATCH_MS) } },
      take: 1000,
      select: { id: true, firstName: true, email: true, sentAt: true },
    }),
  ])
  const paired = pairInvites(shares, invites)
  const emails = Array.from(new Set(Array.from(paired.values()).map((i) => i.email.toLowerCase())))
  const inviteIds = Array.from(paired.values()).map((i) => i.id)
  const [suppressed, optedOut, signedUp] = emails.length
    ? await Promise.all([
        prisma.emailSuppression.findMany({ where: { email: { in: emails } }, select: { email: true } }),
        prisma.prospect.findMany({ where: { email: { in: emails, mode: 'insensitive' }, emailOptOutAt: { not: null } }, select: { email: true } }),
        prisma.prospect.findMany({ where: { outreachInviteId: { in: inviteIds } }, select: { outreachInviteId: true } }),
      ])
    : [[], [], []]
  const stopped = new Set([...suppressed.map((s) => s.email.toLowerCase()), ...optedOut.map((p) => p.email.toLowerCase())])
  const joinedFrom = new Set(signedUp.map((p) => p.outreachInviteId))
  const doneIds = new Set(done.map((d) => d.firstName))
  return followUpsDue(
    shares.map((s) => {
      const inv = paired.get(s.id)
      return { ...s, email: inv?.email ?? null, stopped: !!inv && stopped.has(inv.email.toLowerCase()), signedUp: !!inv && joinedFrom.has(inv.id) }
    }),
    prospects.map(({ discoveryCalls, emailOptOutAt, ...p }) => ({ ...p, hasCall: discoveryCalls.length > 0, done: doneIds.has(p.id), optedOut: !!emailOptOutAt })),
    now,
  )
}

/** For the "Follow-ups" badge. */
export async function followUpsDueCount(userId: string, now = new Date()): Promise<number> {
  return (await loadFollowUps(userId, now)).length
}
