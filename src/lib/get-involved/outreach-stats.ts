/**
 * One-A-Day results (outreach round 2): a member's "My results" page and the admin program view.
 *
 * Definitions (one place):
 * - Messages sent = OutreachShare kind FIRST sent in the month.
 * - Said yes = shares in the month with outcome YES, or kind AFTER_YES.
 * - Forms = prospects invited in the month (Prospect.invitedById, createdAt).
 * - The later steps follow THOSE people (a cohort), so every step is a subset of the one before:
 *   Booked a call = has a call BOOKED, KEPT or NO_SHOW (cancelled-only doesn't count);
 *   Came to the call = has a KEPT call; Joined = joinedAt set.
 * - Channel = Prospect.inviteChannel (?via= on the link); null = "Unknown / before tracking".
 *
 * Pure helpers at the top are tested in outreach-stats.test.ts. Server only, not 'use server':
 * callers check the session. Members only ever get their own group (first name + last initial,
 * streak, calls booked).
 */
import prisma from '@/lib/prisma'
import { INVITER_ROLES } from './core'
import { Period, monthKey, monthLabel, parsePeriod } from './leaderboard-period'
import { OutreachStreak, getOutreachStreak, getOutreachStreaks } from './outreach-streak'
import { ensureMonthGroups, monthHasGroups } from './outreach-groups'

// ---------- pure ----------

export const OUTREACH_CHANNELS = ['TEXT', 'WHATSAPP', 'EMAIL', 'DM', 'POST', 'PARENT'] as const
const LABELS: Record<string, [string, string]> = {
  TEXT: ['Text', 'Texts'],
  WHATSAPP: ['WhatsApp', 'WhatsApp messages'],
  EMAIL: ['Email', 'Emails'],
  DM: ['DM', 'DMs'],
  POST: ['Social post', 'Social posts'],
  PARENT: ['Via a parent', 'Messages to parents'],
}
export const UNKNOWN_CHANNEL = 'UNKNOWN'
export function channelLabel(c: string): string {
  if (c === UNKNOWN_CHANNEL) return 'Unknown / before tracking'
  return LABELS[c]?.[0] ?? c
}
function channelPlural(c: string): string {
  return LABELS[c]?.[1] ?? `${channelLabel(c)} messages`
}

/** "Andre P." */
export function shortName(first: string | null | undefined, last: string | null | undefined): string {
  const f = (first ?? '').trim() || 'Member'
  const l = (last ?? '').trim()
  return l ? `${f} ${l[0].toUpperCase()}.` : f
}

export interface FunnelStep { label: string; value: number }

/**
 * The step with the largest relative drop from the step before it, only where the earlier step has
 * at least `min` people (small numbers say nothing). Steps that grow are skipped.
 */
export function biggestDrop(steps: FunnelStep[], min = 5): { from: string; to: string; pct: number } | null {
  let best: { from: string; to: string; pct: number } | null = null
  for (let i = 1; i < steps.length; i++) {
    const a = steps[i - 1], b = steps[i]
    if (a.value < min || b.value > a.value) continue
    const pct = Math.round((1 - b.value / a.value) * 100)
    if (!best || pct > best.pct) best = { from: a.label, to: b.label, pct }
  }
  return best
}

export interface ChannelRow { channel: string; sent: number; forms: number; calls: number; joined: number }

export const callsPer10 = (r: { sent: number; calls: number }) => (r.sent > 0 ? Math.round((r.calls / r.sent) * 100) / 10 : null)

/** One honest line about the best channel, or null when there isn't enough data (best needs 5+ sent and a call). */
export function channelTakeaway(rows: ChannelRow[], minSent = 5): string | null {
  const ranked = rows
    .filter((r) => r.channel !== UNKNOWN_CHANNEL && r.sent >= minSent && r.calls > 0)
    .sort((a, b) => b.calls / b.sent - a.calls / a.sent || b.calls - a.calls)
  const best = ranked[0]
  if (!best) return null
  const others = rows.filter((r) => r.channel !== UNKNOWN_CHANNEL && r.channel !== best.channel && r.sent > 0)
  return others.length > 0
    ? `${channelPlural(best.channel)} are working best for you this month.`
    : `${channelPlural(best.channel)} are bringing you calls this month.`
}

export interface GroupRow { name: string; streak: number; callsBooked: number; me: boolean }

/** Group table order: calls booked, then streak, then name. */
export function sortGroup<T extends GroupRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.callsBooked - a.callsBooked || b.streak - a.streak || a.name.localeCompare(b.name))
}

/** One encouraging line from the group's numbers. */
export function groupEncouragement(rows: GroupRow[]): string {
  const me = rows.find((r) => r.me)
  if (!me || rows.length === 0) return ''
  const top = Math.max(...rows.map((r) => r.callsBooked))
  if (top === 0) return 'No calls booked in your group yet this month. The first one sets the pace.'
  const leaders = rows.filter((r) => r.callsBooked === top && !r.me)
  if (me.callsBooked === top) {
    return leaders.length === 0
      ? 'You have the most booked calls in your group this month. Keep it going.'
      : 'You are level for first in your group on booked calls. One more puts you ahead.'
  }
  const diff = top - me.callsBooked
  const leader = sortGroup(leaders)[0]
  const first = leader.name.split(' ')[0]
  return `${diff} more booked call${diff === 1 ? '' : 's'} puts you level with ${first} for first in your group.`
}

// ---------- server ----------

const rangeOf = (p: Period) => (p.from || p.to ? { ...(p.from ? { gte: p.from } : {}), ...(p.to ? { lt: p.to } : {}) } : undefined)

interface CohortPerson { invitedById: string; channel: string; booked: boolean; attended: boolean; joined: boolean }

/** People invited in the period (optionally only by some users) and how far each got. */
async function cohort(p: Period, userIds?: string[]): Promise<CohortPerson[]> {
  const rows = await prisma.prospect.findMany({
    where: { invitedById: userIds ? { in: userIds } : { not: null }, createdAt: rangeOf(p) },
    select: {
      invitedById: true, inviteChannel: true, joinedAt: true,
      discoveryCalls: { where: { status: { in: ['BOOKED', 'KEPT', 'NO_SHOW'] } }, select: { status: true } },
    },
  })
  return rows.map((r) => ({
    invitedById: r.invitedById!,
    channel: r.inviteChannel || UNKNOWN_CHANNEL,
    booked: r.discoveryCalls.length > 0,
    attended: r.discoveryCalls.some((c) => c.status === 'KEPT'),
    joined: !!r.joinedAt,
  }))
}

async function sharesIn(p: Period, userIds?: string[]) {
  return prisma.outreachShare.findMany({
    where: { sentAt: rangeOf(p), kind: { in: ['FIRST', 'AFTER_YES'] }, ...(userIds ? { userId: { in: userIds } } : {}) },
    select: { userId: true, channel: true, kind: true, outcome: true },
  })
}

type Share = Awaited<ReturnType<typeof sharesIn>>[number]
const isSent = (s: Share) => s.kind === 'FIRST'
const isYes = (s: Share) => s.outcome === 'YES' || s.kind === 'AFTER_YES'

function channelRows(shares: Share[], people: CohortPerson[]): ChannelRow[] {
  const m = new Map<string, ChannelRow>()
  const row = (c: string) => { let r = m.get(c); if (!r) { r = { channel: c, sent: 0, forms: 0, calls: 0, joined: 0 }; m.set(c, r) } return r }
  for (const s of shares) if (isSent(s)) row(s.channel).sent++
  for (const p of people) { const r = row(p.channel); r.forms++; if (p.booked) r.calls++; if (p.joined) r.joined++ }
  const order = (c: string) => { const i = (OUTREACH_CHANNELS as readonly string[]).indexOf(c); return c === UNKNOWN_CHANNEL ? 99 : i < 0 ? 50 : i }
  const unknownLast = (c: string) => (c === UNKNOWN_CHANNEL ? 1 : 0)
  return Array.from(m.values()).sort((a, b) => unknownLast(a.channel) - unknownLast(b.channel) || b.sent - a.sent || b.forms - a.forms || order(a.channel) - order(b.channel))
}

function funnelOf(shares: Share[], people: CohortPerson[]) {
  return {
    sent: shares.filter(isSent).length,
    saidYes: shares.filter(isYes).length,
    forms: people.length,
    booked: people.filter((p) => p.booked).length,
    attended: people.filter((p) => p.attended).length,
    joined: people.filter((p) => p.joined).length,
  }
}
export type Funnel = ReturnType<typeof funnelOf>

async function names(userIds: string[]): Promise<Map<string, { first: string; last: string }>> {
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true, coachProfile: { select: { firstName: true, lastName: true } }, ambassadorProfile: { select: { firstName: true, lastName: true } } },
  })
  return new Map(users.map((u) => {
    const p = u.coachProfile ?? u.ambassadorProfile
    return [u.id, { first: p?.firstName ?? u.email.split('@')[0], last: p?.lastName ?? '' }]
  }))
}

/** Calls booked in the period's cohort, per inviter. */
function bookedBy(people: CohortPerson[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const p of people) if (p.booked) m.set(p.invitedById, (m.get(p.invitedById) ?? 0) + 1)
  return m
}

export interface MyGroup { groupNo: number; rows: GroupRow[]; encouragement: string }

/** The member's own group this month (lazily created), or null if they aren't in one. */
async function myGroup(userId: string, p: Period, now: Date): Promise<MyGroup | null> {
  await ensureMonthGroups(p.key, now)
  const mine = await prisma.outreachGroupMember.findUnique({ where: { month_userId: { month: p.key, userId } }, select: { groupNo: true } })
  if (!mine) return null
  const members = await prisma.outreachGroupMember.findMany({
    where: { month: p.key, groupNo: mine.groupNo, user: { status: 'ACTIVE' } },
    select: { userId: true },
  })
  const ids = members.map((m) => m.userId)
  const [nm, streaks, people] = await Promise.all([names(ids), getOutreachStreaks(ids, now), cohort(p, ids)])
  const booked = bookedBy(people)
  const rows = sortGroup(ids.map((id) => ({
    name: id === userId ? 'You' : shortName(nm.get(id)?.first, nm.get(id)?.last),
    streak: streaks.get(id)?.streak ?? 0,
    callsBooked: booked.get(id) ?? 0,
    me: id === userId,
  })))
  return { groupNo: mine.groupNo, rows, encouragement: groupEncouragement(rows) }
}

export interface MemberResults {
  monthLabel: string
  streak: OutreachStreak
  funnel: Funnel
  channels: (ChannelRow & { per10: number | null })[]
  takeaway: string | null
  group: MyGroup | null
}

/** Everything on "My results" for one member, this month (Central Time). */
export async function memberResults(userId: string, now = new Date()): Promise<MemberResults> {
  const p = parsePeriod(null, now)
  const [streak, shares, people, group] = await Promise.all([
    getOutreachStreak(userId, now),
    sharesIn(p, [userId]),
    cohort(p, [userId]),
    myGroup(userId, p, now),
  ])
  const rows = channelRows(shares, people)
  return {
    monthLabel: p.label,
    streak,
    funnel: funnelOf(shares, people),
    channels: rows.map((r) => ({ ...r, per10: callsPer10(r) })),
    takeaway: channelTakeaway(rows),
    group,
  }
}

// ---------- admin ----------

async function memberIds(): Promise<string[]> {
  const users = await prisma.user.findMany({ where: { status: 'ACTIVE', role: { in: INVITER_ROLES as ('COACH' | 'AMBASSADOR')[] } }, select: { id: true } })
  return users.map((u) => u.id)
}

export interface ProgramStats {
  members: number
  active: number
  funnel: Funnel
  drop: { from: string; to: string; pct: number } | null
  channels: ChannelRow[]
}

/** Whole-program numbers for a period (admin). */
export async function programStats(p: Period): Promise<ProgramStats> {
  const [ids, shares, people] = await Promise.all([memberIds(), sharesIn(p), cohort(p)])
  const idSet = new Set(ids)
  const active = new Set<string>()
  for (const s of shares) if (idSet.has(s.userId)) active.add(s.userId)
  for (const x of people) if (idSet.has(x.invitedById)) active.add(x.invitedById)
  const funnel = funnelOf(shares, people)
  const drop = biggestDrop([
    { label: 'message sent', value: funnel.sent },
    { label: 'form filled', value: funnel.forms },
    { label: 'call booked', value: funnel.booked },
    { label: 'came to the call', value: funnel.attended },
    { label: 'joined', value: funnel.joined },
  ])
  return { members: ids.length, active: active.size, funnel, drop, channels: channelRows(shares, people) }
}

/** Messages sent / said yes per member in a period (for the CSV). */
export async function shareCountsByUser(p: Period): Promise<Map<string, { sent: number; saidYes: number }>> {
  const m = new Map<string, { sent: number; saidYes: number }>()
  for (const s of await sharesIn(p)) {
    const r = m.get(s.userId) ?? { sent: 0, saidYes: 0 }
    if (isSent(s)) r.sent++
    if (isYes(s)) r.saidYes++
    m.set(s.userId, r)
  }
  return m
}

export const NEEDS_HELP_DAYS = 7

export interface AdminGroupMember { userId: string; name: string; active: boolean; callsBooked: number; daysQuiet: number | null; needsHelp: boolean }
export interface AdminGroup { groupNo: number; members: AdminGroupMember[]; active: number; callsBooked: number }

export interface AdminGroupsData {
  month: string
  monthLabel: string
  /** Needs help is only meaningful for the current month. */
  current: boolean
  groups: AdminGroup[]
  nextMonth: string
  nextMonthLabel: string
  nextMonthHasGroups: boolean
}

/** Groups for a month with activity, calls booked and who needs help (admin). Creates the current month's groups if missing. */
export async function adminGroups(p: Period, now = new Date()): Promise<AdminGroupsData> {
  const current = p.key === 'all' ? parsePeriod(null, now) : p
  const [y, mo] = current.key.split('-').map(Number)
  const next = { key: monthKey(y, mo), label: monthLabel(y, mo) } // mo is 1-based = next month's 0-based index
  if (current.current) await ensureMonthGroups(current.key, now)
  const rows = await prisma.outreachGroupMember.findMany({
    where: { month: current.key, user: { status: 'ACTIVE' } },
    orderBy: [{ groupNo: 'asc' }],
    select: { groupNo: true, userId: true },
  })
  const ids = rows.map((r) => r.userId)
  const [nm, shares, people, lastShares, lastInvites, nextHas] = await Promise.all([
    names(ids),
    sharesIn(current, ids),
    cohort(current, ids),
    ids.length ? prisma.outreachShare.groupBy({ by: ['userId'], where: { userId: { in: ids }, kind: { in: ['FIRST', 'AFTER_YES'] } }, _max: { sentAt: true } }) : Promise.resolve([]),
    ids.length ? prisma.prospect.groupBy({ by: ['invitedById'], where: { invitedById: { in: ids } }, _max: { createdAt: true } }) : Promise.resolve([]),
    monthHasGroups(next.key),
  ])
  const activeIds = new Set<string>([...shares.map((s) => s.userId), ...people.map((x) => x.invitedById)])
  const booked = bookedBy(people)
  const last = new Map<string, number>()
  for (const s of lastShares) if (s._max.sentAt) last.set(s.userId, s._max.sentAt.getTime())
  for (const i of lastInvites) if (i._max.createdAt && i.invitedById) last.set(i.invitedById, Math.max(last.get(i.invitedById) ?? 0, i._max.createdAt.getTime()))

  const byGroup = new Map<number, AdminGroupMember[]>()
  for (const r of rows) {
    const n = nm.get(r.userId)
    const lastAt = last.get(r.userId)
    const daysQuiet = lastAt ? Math.floor((now.getTime() - lastAt) / 86400_000) : null
    const list = byGroup.get(r.groupNo) ?? []
    list.push({
      userId: r.userId,
      name: n ? `${n.first} ${n.last}`.trim() : 'Member',
      active: activeIds.has(r.userId),
      callsBooked: booked.get(r.userId) ?? 0,
      daysQuiet,
      needsHelp: current.current && (daysQuiet === null || daysQuiet >= NEEDS_HELP_DAYS),
    })
    byGroup.set(r.groupNo, list)
  }
  const groups = Array.from(byGroup.entries()).sort((a, b) => a[0] - b[0]).map(([groupNo, members]) => ({
    groupNo,
    members: members.sort((a, b) => a.name.localeCompare(b.name)),
    active: members.filter((m) => m.active).length,
    callsBooked: members.reduce((s, m) => s + m.callsBooked, 0),
  }))
  return { month: current.key, monthLabel: current.label, current: current.current, groups, nextMonth: next.key, nextMonthLabel: next.label, nextMonthHasGroups: nextHas }
}
