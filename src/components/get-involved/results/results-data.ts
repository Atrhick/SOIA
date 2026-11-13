/**
 * Server-only loader for "Your results" (One-A-Day v2). Not 'use server': pages check the session first.
 * Builds on memberResults() (outreach-stats.ts) and adds what the page needs to suggest a next step:
 * follow-ups due, my recent people with their real step, and my group with names that can't be confused.
 */
import prisma from '@/lib/prisma'
import { memberResults, sortGroup, groupEncouragement, UNKNOWN_CHANNEL, type MemberResults } from '@/lib/get-involved/outreach-stats'
import { getOutreachStreaks } from '@/lib/get-involved/outreach-streak'
import { parsePeriod } from '@/lib/get-involved/leaderboard-period'
import { loadFollowUps } from '@/lib/get-involved/follow-ups'
import { inviterPeopleStages } from '@/lib/get-involved/leaderboard-extra'
import type { PersonStage } from '@/lib/get-involved/inviter-people'
import { groupLabels, nextStep, type NextStep } from './results-rules'

export interface ResultsPerson { id: string; name: string; ageRange: string | null; status: string; createdAt: string; added: boolean; nextCall: string | null; stage?: PersonStage }
export interface ResultsGroupRow { label: string; daysInARow: number; callsBooked: number; me: boolean }

export interface ResultsData {
  monthLabel: string
  streak: MemberResults['streak']
  funnel: MemberResults['funnel']
  /** Channels with data; "unknown" left out. Empty = hide the section. */
  channels: MemberResults['channels']
  takeaway: string | null
  next: NextStep
  followUpsDue: number
  people: ResultsPerson[]
  team: { id: string; name: string }[]
  group: { groupNo: number; rows: ResultsGroupRow[]; encouragement: string } | null
}

async function myGroupRows(userId: string, groupNo: number, monthKey: string, from: Date | null, now: Date): Promise<ResultsGroupRow[]> {
  const members = await prisma.outreachGroupMember.findMany({
    where: { month: monthKey, groupNo, user: { status: 'ACTIVE' } },
    select: { userId: true, user: { select: { email: true, coachProfile: { select: { firstName: true, lastName: true, city: true } }, ambassadorProfile: { select: { firstName: true, lastName: true, city: true } } } } },
  })
  const ids = members.map((m) => m.userId)
  const [streaks, booked] = await Promise.all([
    getOutreachStreaks(ids, now),
    prisma.prospect.findMany({
      where: { invitedById: { in: ids }, ...(from ? { createdAt: { gte: from } } : {}), discoveryCalls: { some: { status: { in: ['BOOKED', 'KEPT', 'NO_SHOW'] } } } },
      select: { invitedById: true },
    }),
  ])
  const labels = groupLabels(members.map((m) => {
    const p = m.user.coachProfile ?? m.user.ambassadorProfile
    return { id: m.userId, first: p?.firstName ?? m.user.email.split('@')[0], last: p?.lastName ?? '', city: p?.city ?? null, me: m.userId === userId }
  }))
  const rows = sortGroup(ids.map((id) => ({
    name: labels.get(id) ?? 'Member',
    streak: streaks.get(id)?.streak ?? 0,
    callsBooked: booked.filter((b) => b.invitedById === id).length,
    me: id === userId,
  })))
  return rows.map((r) => ({ label: r.name, daysInARow: r.streak, callsBooked: r.callsBooked, me: r.me }))
}

export async function loadResults(userId: string, now = new Date()): Promise<ResultsData> {
  const period = parsePeriod(null, now)
  const [base, follow, prospects] = await Promise.all([
    memberResults(userId, now),
    loadFollowUps(userId, now),
    prisma.prospect.findMany({
      where: { invitedById: userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true, firstName: true, lastName: true, ageRange: true, status: true, createdAt: true, inviteSource: true,
        discoveryCalls: { where: { status: 'BOOKED' }, orderBy: { startsAt: 'asc' }, take: 1, select: { startsAt: true } },
      },
    }),
  ])
  const inProgress = prospects.filter((p) => p.status !== 'ACCOUNT_CREATED')
  const stages = await inviterPeopleStages(userId, inProgress.map((p) => p.id), now)

  let group: ResultsData['group'] = null
  if (base.group) {
    const rows = await myGroupRows(userId, base.group.groupNo, period.key, period.from, now)
    // The encouragement names the leader by first name only, so it reads the same with the new labels.
    group = { groupNo: base.group.groupNo, rows, encouragement: groupEncouragement(rows.map((r) => ({ name: r.label, streak: r.daysInARow, callsBooked: r.callsBooked, me: r.me }))) }
  }

  const noCall = follow.filter((f) => f.type === 'FORM').length
  return {
    monthLabel: base.monthLabel,
    streak: base.streak,
    funnel: base.funnel,
    channels: base.channels.filter((c) => c.channel !== UNKNOWN_CHANNEL && (c.sent > 0 || c.forms > 0)),
    takeaway: base.takeaway,
    next: nextStep({ daysInARow: base.streak.streak, doneToday: base.streak.doneToday, followUpsDue: follow.length, noCall, invitedThisMonth: base.funnel.sent + base.funnel.forms }),
    followUpsDue: follow.length,
    people: inProgress.map((p) => ({
      id: p.id, name: `${p.firstName} ${p.lastName}`.trim(), ageRange: p.ageRange, status: p.status, createdAt: p.createdAt.toISOString(),
      added: p.inviteSource === 'INVITER_ADDED', nextCall: p.discoveryCalls[0]?.startsAt.toISOString() ?? null, stage: stages[p.id],
    })),
    team: prospects.filter((p) => p.status === 'ACCOUNT_CREATED').map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}`.trim() })),
    group,
  }
}
