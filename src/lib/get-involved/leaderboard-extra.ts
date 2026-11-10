/**
 * Extra read-only queries for One-A-Day: the admin leaderboard for any month (with team size and the
 * youth-ambassador board) and where each of an inviter's people is in the journey. Server only, not
 * 'use server', so nothing here is a public endpoint; callers check the session first.
 */
import prisma from '@/lib/prisma'
import { computeStreak, rankLeaderboard } from './core'
import { userDisplayName } from './server'
import { AdminBoard, AdminBoardRow, Period, businessDayStart, memberKind, onBoard, streakAsOf } from './leaderboard-period'
import { InviterPersonFacts, inviterPersonStage, PersonStage } from './inviter-people'

const range = (p: Period) => (p.from || p.to ? { ...(p.from ? { gte: p.from } : {}), ...(p.to ? { lt: p.to } : {}) } : undefined)

/** People who reached ACCOUNT_CREATED in the period, by inviter (same rule as queries.joinedByInviter, with an end date). */
async function joinedInPeriod(p: Period): Promise<Map<string, number>> {
  const rows = await prisma.prospectStatusHistory.findMany({
    where: { toStatus: 'ACCOUNT_CREATED', createdAt: range(p), prospect: { invitedById: { not: null }, status: 'ACCOUNT_CREATED' } },
    distinct: ['prospectId'],
    select: { prospect: { select: { invitedById: true } } },
  })
  const m = new Map<string, number>()
  for (const r of rows) { const id = r.prospect.invitedById!; m.set(id, (m.get(id) ?? 0) + 1) }
  return m
}

/** The admin board for a period: rank, joined, forms, calls kept, streak (as of the period's end) and team size (all time). */
export async function adminLeaderboard(opts: { period: Period; board: AdminBoard; now?: Date }): Promise<AdminBoardRow[]> {
  const now = opts.now ?? new Date()
  const p = opts.period
  const created = range(p)
  const [forms, joined] = await Promise.all([
    prisma.prospect.groupBy({ by: ['invitedById'], where: { invitedById: { not: null }, createdAt: created }, _count: true }),
    joinedInPeriod(p),
  ])
  const ids = Array.from(new Set([...forms.map((r) => r.invitedById!), ...Array.from(joined.keys())]))
  if (ids.length === 0) return []
  const users = await prisma.user.findMany({
    where: { id: { in: ids }, status: 'ACTIVE', role: { in: ['COACH', 'AMBASSADOR'] } },
    select: { id: true, role: true, journeyProspect: { select: { journeyRole: true } }, ambassadorProfile: { select: { dateOfBirth: true } } },
  })
  const members = users
    .map((u) => ({ id: u.id, kind: memberKind({ role: u.role, journeyRole: u.journeyProspect?.journeyRole ?? null, dateOfBirth: u.ambassadorProfile?.dateOfBirth ?? null }, now) }))
    .filter((m) => onBoard(opts.board, m.kind))
  if (members.length === 0) return []
  const memberIds = members.map((m) => m.id)
  const asOf = streakAsOf(p, now)

  const [recent, kept, team, names] = await Promise.all([
    prisma.prospect.findMany({
      where: { invitedById: { in: memberIds }, createdAt: { gte: new Date(asOf.getTime() - 120 * 86400_000), lte: asOf } },
      select: { invitedById: true, createdAt: true },
    }),
    prisma.discoveryCall.findMany({
      where: { status: 'KEPT', outcomeAt: created, prospect: { invitedById: { in: memberIds } } },
      distinct: ['prospectId'],
      select: { prospect: { select: { invitedById: true } } },
    }),
    // Team size = everyone this person brought in who finished with a login (as on My Team), all time.
    prisma.prospect.groupBy({ by: ['invitedById'], where: { invitedById: { in: memberIds }, status: 'ACCOUNT_CREATED', userId: { not: null } }, _count: true }),
    Promise.all(memberIds.map(async (id) => [id, (await userDisplayName(id))?.full ?? 'Member'] as const)),
  ])
  const nameOf = new Map(names)
  const keptBy = new Map<string, number>()
  for (const k of kept) { const id = k.prospect.invitedById!; keptBy.set(id, (keptBy.get(id) ?? 0) + 1) }
  const datesBy = new Map<string, Date[]>()
  for (const r of recent) { const l = datesBy.get(r.invitedById!) ?? []; l.push(r.createdAt); datesBy.set(r.invitedById!, l) }

  return rankLeaderboard(members.map((m) => ({
    userId: m.id,
    name: nameOf.get(m.id) ?? 'Member',
    role: m.kind,
    kind: m.kind,
    forms: forms.find((f) => f.invitedById === m.id)?._count ?? 0,
    joined: joined.get(m.id) ?? 0,
    callsKept: keptBy.get(m.id) ?? 0,
    streak: computeStreak(datesBy.get(m.id) ?? [], asOf).streak,
    teamSize: team.find((t) => t.invitedById === m.id)?._count ?? 0,
  }))).map(({ role: _role, ...r }) => r)
}

/** Headline numbers for the admin board's tiles (every inviter, whatever the tab). */
export async function adminBoardTotals(p: Period, now = new Date()) {
  const created = range(p)
  const [forms, joinedMap, kept, activeToday] = await Promise.all([
    prisma.prospect.count({ where: { invitedById: { not: null }, createdAt: created } }),
    joinedInPeriod(p),
    prisma.discoveryCall.count({ where: { status: 'KEPT', outcomeAt: created } }),
    // People active today = coaches and ambassadors with at least one form or added person today (business time).
    prisma.prospect.findMany({
      where: { createdAt: { gte: businessDayStart(now) }, invitedBy: { status: 'ACTIVE', role: { in: ['COACH', 'AMBASSADOR'] } } },
      distinct: ['invitedById'],
      select: { invitedById: true },
    }),
  ])
  const joined = Array.from(joinedMap.values()).reduce((a, b) => a + b, 0)
  return { forms, joined, kept, activeToday: activeToday.length }
}

/** The earliest date anything on the board happened (first invite or first join), for the month picker. */
export async function firstInviteAt(): Promise<Date | null> {
  const [form, join] = await Promise.all([
    prisma.prospect.findFirst({ where: { invitedById: { not: null } }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
    prisma.prospectStatusHistory.findFirst({ where: { toStatus: 'ACCOUNT_CREATED', prospect: { invitedById: { not: null } } }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
  ])
  const dates = [form?.createdAt, join?.createdAt].filter((d): d is Date => !!d)
  return dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null
}

/** The inviter dashboard data with each person's journey stage added (for the "My people" list). */
export async function withJourneyStages<T extends { people: { id: string }[] }>(inviterId: string, data: T): Promise<T & { people: (T['people'][number] & { stage?: PersonStage })[] }> {
  const stages = await inviterPeopleStages(inviterId, data.people.map((p) => p.id))
  return { ...data, people: data.people.map((p) => ({ ...p, stage: stages[p.id] })) }
}

/**
 * Where each of an inviter's people is in the journey, keyed by prospect id. Only this inviter's
 * prospects are read, and only the fields the stage needs (no answers, notes or not-a-fit reasons).
 */
export async function inviterPeopleStages(inviterId: string, ids: string[], now = new Date()): Promise<Record<string, PersonStage>> {
  if (ids.length === 0) return {}
  const rows = await prisma.prospect.findMany({
    where: { id: { in: ids }, invitedById: inviterId },
    select: {
      id: true, status: true, userId: true, noShowCount: true, createdAt: true, inviteSource: true, orientationRemindAt: true, joinedAt: true,
      payment: { select: { status: true } },
      discoveryCalls: { where: { status: { in: ['BOOKED', 'NO_SHOW'] } }, orderBy: { startsAt: 'desc' }, take: 3, select: { status: true, startsAt: true } },
    },
  })
  const out: Record<string, PersonStage> = {}
  for (const r of rows) {
    const booked = r.discoveryCalls.filter((c) => c.status === 'BOOKED').sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0]
    const missed = r.discoveryCalls.find((c) => c.status === 'NO_SHOW')
    const facts: InviterPersonFacts = {
      status: r.status, userId: r.userId, noShowCount: r.noShowCount, createdAt: r.createdAt, added: r.inviteSource === 'INVITER_ADDED',
      bookedCallAt: booked?.startsAt ?? null, missedCallAt: missed?.startsAt ?? null, orientationRemindAt: r.orientationRemindAt,
      paymentStatus: r.payment?.status ?? null, joinedAt: r.joinedAt,
    }
    out[r.id] = inviterPersonStage(facts, now)
  }
  return out
}
