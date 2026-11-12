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
}

/** Whether a month has groups yet (no side effects). */
export async function monthHasGroups(month: string): Promise<boolean> {
  return !!(await prisma.outreachGroupMember.findFirst({ where: { month }, select: { id: true } }))
}
