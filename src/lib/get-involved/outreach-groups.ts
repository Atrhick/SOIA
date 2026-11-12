/**
 * Monthly One-A-Day groups of 5 (outreach round 2). Members only ever see their own group.
 *
 * Who: every ACTIVE user who can invite (COACH, AMBASSADOR; `canInvite`).
 * How: shuffled, then dealt round-robin with experienced members first, so each group gets a fair
 * share of them. Experienced = anyone they invited has ever joined (joinedAt / ACCOUNT_CREATED), or a
 * streak is running now. Sizes: groups of 5; leftovers are absorbed so every group has 4 to 6 people
 * (only 1-3 members in total, or exactly 7, gives one group).
 *
 * `planGroups` / `groupSizes` are pure (outreach-groups.test.ts). `assignGroups(month)` writes the month
 * (idempotent unless `force`), `ensureMonthGroups(month)` creates it lazily on first read. Writes take
 * a Postgres advisory lock per month, and (month, userId) is unique, so two first readers can't both
 * create groups. Server only, not 'use server'.
 */
import prisma from '@/lib/prisma'
import { INVITER_ROLES } from './core'
import { getOutreachStreaks } from './outreach-streak'

export const GROUP_SIZE = 5

/** Group sizes for n members: mostly 5, every group 4-6 whenever that's possible. */
export function groupSizes(n: number): number[] {
  if (n <= 0) return []
  if (n <= 7) return [n] // 7 can't split into 4-6s
  const g = Math.floor(n / GROUP_SIZE)
  const r = n % GROUP_SIZE
  const sizes = Array(g).fill(GROUP_SIZE) as number[]
  if (r === 1) sizes[g - 1] = 6
  else if (r === 2) { sizes[g - 1] = 6; sizes[g - 2] = 6 } // n >= 12 here
  else if (r === 3) { sizes[g - 1] = 4; sizes.push(4) } // 5(g-1) + 4 + 4
  else if (r === 4) sizes.push(4)
  return sizes
}

/** Fisher-Yates with an injectable random source (tests pass a seeded one). */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Pure: shuffle experienced and new members separately, then deal experienced first, round-robin
 * across groups that still have room, so experience is spread evenly. Returns user ids per group.
 */
export function planGroups(members: readonly { userId: string; experienced: boolean }[], random: () => number = Math.random): string[][] {
  const sizes = groupSizes(members.length)
  const groups: string[][] = sizes.map(() => [])
  const order = [
    ...shuffle(members.filter((m) => m.experienced), random),
    ...shuffle(members.filter((m) => !m.experienced), random),
  ]
  let g = 0
  for (const m of order) {
    while (groups[g].length >= sizes[g]) g = (g + 1) % groups.length
    groups[g].push(m.userId)
    g = (g + 1) % groups.length
  }
  return groups
}

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/
export const isMonthKey = (v: string) => MONTH_KEY.test(v)

/** Everyone who belongs in groups, flagged experienced or new. */
async function eligibleMembers(now: Date): Promise<{ userId: string; experienced: boolean }[]> {
  const users = await prisma.user.findMany({
    where: { status: 'ACTIVE', role: { in: INVITER_ROLES as ('COACH' | 'AMBASSADOR')[] } },
    select: { id: true },
  })
  const ids = users.map((u) => u.id)
  if (ids.length === 0) return []
  const [joined, streaks] = await Promise.all([
    prisma.prospect.groupBy({
      by: ['invitedById'],
      where: { invitedById: { in: ids }, OR: [{ joinedAt: { not: null } }, { status: 'ACCOUNT_CREATED' }] },
      _count: true,
    }),
    getOutreachStreaks(ids, now),
  ])
  const hasJoined = new Set(joined.map((j) => j.invitedById))
  return ids.map((id) => ({ userId: id, experienced: hasJoined.has(id) || (streaks.get(id)?.streak ?? 0) > 0 }))
}

/**
 * Create the groups for a month. Without `force` an existing month is left as is (returns its group
 * count); with `force` the month is reshuffled. Returns the number of groups.
 */
export async function assignGroups(month: string, opts: { force?: boolean; now?: Date } = {}): Promise<number> {
  if (!isMonthKey(month)) throw new Error('Bad month')
  const now = opts.now ?? new Date()
  const members = await eligibleMembers(now)
  const plan = planGroups(members)
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'outreach-groups:' + month}))`
    const existing = await tx.outreachGroupMember.findMany({ where: { month }, select: { groupNo: true }, distinct: ['groupNo'] })
    if (existing.length > 0 && !opts.force) return existing.length
    if (existing.length > 0) await tx.outreachGroupMember.deleteMany({ where: { month } })
    const rows = plan.flatMap((ids, i) => ids.map((userId) => ({ month, groupNo: i + 1, userId })))
    if (rows.length) await tx.outreachGroupMember.createMany({ data: rows, skipDuplicates: true })
    return plan.length
  }, { timeout: 20_000 })
}

/** Lazily creates the month's groups the first time anyone reads them. */
export async function ensureMonthGroups(month: string, now = new Date()): Promise<void> {
  const any = await prisma.outreachGroupMember.findFirst({ where: { month }, select: { id: true } })
  if (!any) await assignGroups(month, { now })
  else await placeNewcomers(month)
}

/** Pure: put each newcomer in the smallest group under 6; when every group is full, start a new one. */
export function planNewcomers(sizes: Map<number, number>, newcomers: readonly string[]): { userId: string; groupNo: number }[] {
  const s = new Map(sizes)
  const out: { userId: string; groupNo: number }[] = []
  for (const userId of newcomers) {
    let best: number | null = null
    for (const [g, n] of Array.from(s.entries())) if (n < GROUP_SIZE + 1 && (best === null || n < (s.get(best) ?? 0) || (n === s.get(best) && g < best))) best = g
    if (best === null) best = Math.max(0, ...Array.from(s.keys())) + 1
    s.set(best, (s.get(best) ?? 0) + 1)
    out.push({ userId, groupNo: best })
  }
  return out
}

/**
 * Coaches and ambassadors who joined after the month's groups were made get a group straight away
 * (otherwise they'd wait until next month and be missing from the admin's nudge list).
 */
export async function placeNewcomers(month: string): Promise<number> {
  if (!isMonthKey(month)) return 0
  const [eligible, placed] = await Promise.all([
    prisma.user.findMany({ where: { status: 'ACTIVE', role: { in: INVITER_ROLES as ('COACH' | 'AMBASSADOR')[] } }, select: { id: true }, orderBy: { createdAt: 'asc' } }),
    prisma.outreachGroupMember.findMany({ where: { month }, select: { userId: true } }),
  ])
  const have = new Set(placed.map((p) => p.userId))
  const newcomers = eligible.map((u) => u.id).filter((id) => !have.has(id))
  if (newcomers.length === 0) return 0
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'outreach-groups:' + month}))`
    const rows = await tx.outreachGroupMember.groupBy({ by: ['groupNo'], where: { month, user: { status: 'ACTIVE' } }, _count: { _all: true } })
    const taken = new Set((await tx.outreachGroupMember.findMany({ where: { month, userId: { in: newcomers } }, select: { userId: true } })).map((r) => r.userId))
    const plan = planNewcomers(new Map(rows.map((r) => [r.groupNo, r._count._all])), newcomers.filter((id) => !taken.has(id)))
    if (plan.length) await tx.outreachGroupMember.createMany({ data: plan.map((p) => ({ month, ...p })), skipDuplicates: true })
    return plan.length
  }, { timeout: 20_000 })
}

/** Whether a month has groups yet (no side effects). */
export async function monthHasGroups(month: string): Promise<boolean> {
  return !!(await prisma.outreachGroupMember.findFirst({ where: { month }, select: { id: true } }))
}
