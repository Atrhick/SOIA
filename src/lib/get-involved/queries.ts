/** Read-only queries for the One-A-Day dashboards and leaderboard. Server only. */
import { TZDate } from '@date-fns/tz'
import prisma from '@/lib/prisma'
import { BUSINESS_TZ, computeStreak, rankLeaderboard } from './core'
import { ensureInviteSlug, userDisplayName } from './server'
import { appUrl } from './emails'

export type BoardRole = 'ALL' | 'COACH' | 'AMBASSADOR'

export function monthStart(now = new Date()): Date {
  const z = new TZDate(now.getTime(), BUSINESS_TZ)
  return new Date(new TZDate(z.getFullYear(), z.getMonth(), 1, 0, 0, 0, BUSINESS_TZ).getTime())
}

/** People who reached ACCOUNT_CREATED since a date, by inviter. Uses the status-history date, which later edits don't move. */
export async function joinedByInviter(since: Date | null): Promise<Map<string, number>> {
  const rows = await prisma.prospectStatusHistory.findMany({
    where: { toStatus: 'ACCOUNT_CREATED', createdAt: since ? { gte: since } : undefined, prospect: { invitedById: { not: null }, status: 'ACCOUNT_CREATED' } },
    distinct: ['prospectId'],
    select: { prospect: { select: { invitedById: true } } },
  })
  const m = new Map<string, number>()
  for (const r of rows) { const id = r.prospect.invitedById!; m.set(id, (m.get(id) ?? 0) + 1) }
  return m
}

export async function leaderboard(opts: { since: Date | null; role: BoardRole; now?: Date }) {
  const now = opts.now ?? new Date()
  const since = opts.since
  const created = since ? { gte: since } : undefined
  const [forms, joined] = await Promise.all([
    prisma.prospect.groupBy({ by: ['invitedById'], where: { invitedById: { not: null }, createdAt: created }, _count: true }),
    joinedByInviter(since),
  ])
  const ids = Array.from(new Set([...forms.map((r) => r.invitedById!), ...Array.from(joined.keys())]))
  if (ids.length === 0) return []
  const users = await prisma.user.findMany({ where: { id: { in: ids }, status: 'ACTIVE', ...(opts.role === 'ALL' ? { role: { in: ['COACH', 'AMBASSADOR'] } } : { role: opts.role }) }, select: { id: true, role: true } })
  const recent = await prisma.prospect.findMany({ where: { invitedById: { in: users.map((u) => u.id) }, createdAt: { gte: new Date(now.getTime() - 120 * 86400_000) } }, select: { invitedById: true, createdAt: true } })
  const kept = await prisma.discoveryCall.groupBy({ by: ['prospectId'], where: { status: 'KEPT', prospect: { invitedById: { in: users.map((u) => u.id) } }, outcomeAt: created }, _count: true })
  const keptByProspect = kept.length ? await prisma.prospect.findMany({ where: { id: { in: kept.map((k) => k.prospectId) } }, select: { invitedById: true } }) : []

  const rows = await Promise.all(users.map(async (u) => {
    const name = await userDisplayName(u.id)
    return {
      userId: u.id,
      name: name?.full ?? 'Member',
      role: u.role,
      forms: forms.find((f) => f.invitedById === u.id)?._count ?? 0,
      joined: joined.get(u.id) ?? 0,
      callsKept: keptByProspect.filter((k) => k.invitedById === u.id).length,
      streak: computeStreak(recent.filter((r) => r.invitedById === u.id).map((r) => r.createdAt), now).streak,
    }
  }))
  return rankLeaderboard(rows)
}

export async function inviterDashboard(userId: string, role: 'COACH' | 'AMBASSADOR') {
  const now = new Date()
  const since = monthStart(now)
  const slug = await ensureInviteSlug(userId)
  const [people, recent, board, overall] = await Promise.all([
    prisma.prospect.findMany({
      where: { invitedById: userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true, firstName: true, lastName: true, ageRange: true, status: true, createdAt: true, inviteSource: true,
        discoveryCalls: { where: { status: 'BOOKED' }, orderBy: { startsAt: 'asc' }, take: 1, select: { startsAt: true } },
      },
    }),
    prisma.prospect.findMany({ where: { invitedById: userId, createdAt: { gte: new Date(now.getTime() - 400 * 86400_000) } }, select: { createdAt: true } }),
    leaderboard({ since, role }),
    leaderboard({ since, role: 'ALL' }),
  ])
  const { streak, doneToday } = computeStreak(recent.map((r) => r.createdAt), now)
  const me = overall.find((r) => r.userId === userId)
  return {
    shareUrl: appUrl(`/join/${slug}`),
    streak,
    doneToday,
    formsThisMonth: me?.forms ?? recent.filter((r) => r.createdAt >= since).length,
    joinedThisMonth: me?.joined ?? 0,
    myRank: me?.rank ?? null,
    people: people.map((p) => ({
      id: p.id,
      name: `${p.firstName} ${p.lastName}`,
      ageRange: p.ageRange,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      added: p.inviteSource === 'INVITER_ADDED',
      nextCall: p.discoveryCalls[0]?.startsAt.toISOString() ?? null,
    })),
    roleBoard: board.slice(0, 10),
    overallBoard: overall.slice(0, 10),
  }
}
