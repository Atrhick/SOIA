/**
 * One-A-Day streak with free misses (outreach round 2).
 *
 * A day (Central Time) counts when the member sent at least one share from the share kit
 * (OutreachShare kind FIRST, or a social POST) OR invited at least one prospect (the existing rule).
 * Each calendar month gives 2 free misses: a missed day while a streak is running uses one
 * automatically and the streak carries on (free days don't add to its length); the 3rd miss in the
 * same month resets the streak to 0. Today not done yet never breaks anything.
 *
 * `computeOutreachStreak` is pure (tested in outreach-streak.test.ts). `getOutreachStreak(userId)` /
 * `getOutreachStreaks(userIds)` read the database. Server only, not 'use server'.
 * The older `computeStreak` in core.ts is unchanged (the leaderboard still uses it).
 */
import prisma from '@/lib/prisma'
import { BUSINESS_TZ, businessDay } from './core'

export const FREE_MISSES_PER_MONTH = 2
/** How far back activity is read. Long enough for any realistic streak. */
export const STREAK_LOOKBACK_DAYS = 400

export type StreakDayState = 'sent' | 'free' | 'missed' | 'today'

export interface StreakDay {
  /** yyyy-mm-dd, Central Time. */
  day: string
  /** sent = did something; free = a free miss was used; missed = missed (streak reset or none running); today = today, nothing yet. */
  state: StreakDayState
}

export interface OutreachStreak {
  /** Days with activity in the current run (free days keep the run alive but don't add to it). */
  streak: number
  doneToday: boolean
  /** Free misses still unused this calendar month (Central Time). */
  freeMissesLeft: number
  /** The last 14 days, oldest first, ending today. */
  last14: StreakDay[]
}

function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** Pure: the streak from activity instants (shares and invites mixed), measured at `now`. */
export function computeOutreachStreak(activity: Date[], now: Date, opts: { freePerMonth?: number; tz?: string } = {}): OutreachStreak {
  const tz = opts.tz ?? BUSINESS_TZ
  const freePerMonth = opts.freePerMonth ?? FREE_MISSES_PER_MONTH
  const today = businessDay(now, tz)
  const days = new Set(activity.filter((d) => d.getTime() <= now.getTime()).map((d) => businessDay(d, tz)))
  const doneToday = days.has(today)

  const states = new Map<string, StreakDayState>()
  const freeUsed = new Map<string, number>() // 'YYYY-MM' -> free misses used
  let streak = 0
  const sorted = Array.from(days).sort()
  const first = sorted[0]
  if (first) {
    for (let d = first; d <= today; d = addDays(d, 1)) {
      if (days.has(d)) { streak++; states.set(d, 'sent'); continue }
      if (d === today) { states.set(d, 'today'); continue }
      const month = d.slice(0, 7)
      const used = freeUsed.get(month) ?? 0
      if (streak > 0 && used < freePerMonth) {
        freeUsed.set(month, used + 1)
        states.set(d, 'free')
      } else {
        streak = 0
        states.set(d, 'missed')
      }
    }
  }

  const last14: StreakDay[] = []
  for (let i = 13; i >= 0; i--) {
    const day = addDays(today, -i)
    last14.push({ day, state: states.get(day) ?? (day === today ? 'today' : 'missed') })
  }
  return {
    streak,
    doneToday,
    freeMissesLeft: Math.max(0, freePerMonth - (freeUsed.get(today.slice(0, 7)) ?? 0)),
    last14,
  }
}

/** Activity instants per user (shares that count + invited prospects) since `since`. */
export async function outreachActivity(userIds: string[], since: Date, until?: Date): Promise<Map<string, Date[]>> {
  const out = new Map<string, Date[]>(userIds.map((id) => [id, []]))
  if (userIds.length === 0) return out
  const range = { gte: since, ...(until ? { lte: until } : {}) }
  const [shares, invites] = await Promise.all([
    prisma.outreachShare.findMany({
      where: { userId: { in: userIds }, sentAt: range, OR: [{ kind: 'FIRST' }, { channel: 'POST' }] },
      select: { userId: true, sentAt: true },
    }),
    prisma.prospect.findMany({
      where: { invitedById: { in: userIds }, createdAt: range },
      select: { invitedById: true, createdAt: true },
    }),
  ])
  for (const s of shares) out.get(s.userId)?.push(s.sentAt)
  for (const p of invites) out.get(p.invitedById!)?.push(p.createdAt)
  return out
}

/** Streaks for several members at once. */
export async function getOutreachStreaks(userIds: string[], now = new Date()): Promise<Map<string, OutreachStreak>> {
  const activity = await outreachActivity(userIds, new Date(now.getTime() - STREAK_LOOKBACK_DAYS * 86400_000), now)
  const out = new Map<string, OutreachStreak>()
  for (const id of userIds) out.set(id, computeOutreachStreak(activity.get(id) ?? [], now))
  return out
}

/** One member's streak, free misses left and last 14 days. Call after checking the session. */
export async function getOutreachStreak(userId: string, now = new Date()): Promise<OutreachStreak> {
  return (await getOutreachStreaks([userId], now)).get(userId)!
}
