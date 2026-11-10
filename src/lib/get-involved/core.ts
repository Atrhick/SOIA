/**
 * Pure logic for the Get Involved journey: age ranges, discovery-call slots,
 * host picking, and One-A-Day streaks. No database access here, so it can be
 * unit tested (see core.test.ts).
 */
import { TZDate } from '@date-fns/tz'

export type AgeRangeValue = 'UNDER_18' | 'AGE_18_24' | 'AGE_25_55' | 'AGE_56_PLUS'

export const AGE_RANGES: { value: AgeRangeValue; label: string }[] = [
  { value: 'UNDER_18', label: '17 and under' },
  { value: 'AGE_18_24', label: '18–24' },
  { value: 'AGE_25_55', label: '25–55' },
  { value: 'AGE_56_PLUS', label: '56+' },
]

export function ageRangeLabel(v: string | null | undefined): string {
  return AGE_RANGES.find((a) => a.value === v)?.label ?? 'Not given'
}

export const CALL_MINUTES = 30
export const BOOKING_WINDOW_DAYS = 21
export const MIN_NOTICE_HOURS = 12
/** Prospects can change or cancel up to this long before the call. */
export const CHANGE_CUTOFF_HOURS = 2
/** Links in emails work this long. */
export const LINK_VALID_DAYS = 14
/** After this many missed calls the prospect is paused. */
export const MAX_NO_SHOWS = 2
/** Business timezone for streaks and "today". */
export const BUSINESS_TZ = 'America/Chicago'

export interface HostWindow {
  dayOfWeek: number // 0 = Sunday, in the host's timezone
  startMinute: number
  endMinute: number
}

export interface HostForSlots {
  id: string // user id
  timezone: string
  availability: HostWindow[]
}

export interface BusyBlock {
  hostId: string
  startsAt: Date
  endsAt: Date
}

export interface Slot {
  startsAt: Date
  hostIds: string[]
}

/**
 * All open 30-minute slots across the given hosts. A slot is open for a host
 * when it falls inside one of their weekly windows (in their own timezone),
 * is at least MIN_NOTICE_HOURS away, within the booking window, and does not
 * overlap a busy block for that host.
 */
export function generateSlots(
  hosts: HostForSlots[],
  busy: BusyBlock[],
  now: Date,
  opts: { days?: number; minNoticeHours?: number; minutes?: number } = {},
): Slot[] {
  const days = opts.days ?? BOOKING_WINDOW_DAYS
  const minutes = opts.minutes ?? CALL_MINUTES
  const earliest = now.getTime() + (opts.minNoticeHours ?? MIN_NOTICE_HOURS) * 3600_000
  const latest = now.getTime() + days * 86400_000
  const byStart = new Map<number, Set<string>>()

  for (const host of hosts) {
    const hostBusy = busy.filter((b) => b.hostId === host.id)
    const today = new TZDate(now.getTime(), host.timezone)
    for (let d = 0; d <= days; d++) {
      const day = new TZDate(today.getFullYear(), today.getMonth(), today.getDate() + d, 0, 0, 0, host.timezone)
      const dow = day.getDay()
      for (const w of host.availability) {
        if (w.dayOfWeek !== dow) continue
        for (let m = w.startMinute; m + minutes <= w.endMinute; m += minutes) {
          const start = new TZDate(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(m / 60), m % 60, 0, host.timezone)
          const t = start.getTime()
          if (t < earliest || t > latest) continue
          const end = t + minutes * 60_000
          if (hostBusy.some((b) => b.startsAt.getTime() < end && b.endsAt.getTime() > t)) continue
          if (!byStart.has(t)) byStart.set(t, new Set())
          byStart.get(t)!.add(host.id)
        }
      }
    }
  }

  return Array.from(byStart.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([t, ids]) => ({ startsAt: new Date(t), hostIds: Array.from(ids).sort() }))
}

/** Pick the host with the fewest upcoming calls; ties go to the lowest id so it is stable. */
export function pickHost(hostIds: string[], upcomingCounts: Record<string, number>): string | null {
  if (hostIds.length === 0) return null
  return [...hostIds].sort((a, b) => (upcomingCounts[a] ?? 0) - (upcomingCounts[b] ?? 0) || a.localeCompare(b))[0]
}

/** yyyy-mm-dd of an instant in the business timezone. */
export function businessDay(d: Date, tz = BUSINESS_TZ): string {
  const z = new TZDate(d.getTime(), tz)
  return `${z.getFullYear()}-${String(z.getMonth() + 1).padStart(2, '0')}-${String(z.getDate()).padStart(2, '0')}`
}

function prevDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d - 1))
  return dt.toISOString().slice(0, 10)
}

/**
 * Days in a row with at least one invite. A streak still counts if today has
 * nothing yet but yesterday did (the person has until midnight).
 */
export function computeStreak(inviteDates: Date[], now: Date, tz = BUSINESS_TZ): { streak: number; doneToday: boolean } {
  const days = new Set(inviteDates.map((d) => businessDay(d, tz)))
  const today = businessDay(now, tz)
  const doneToday = days.has(today)
  let cursor = doneToday ? today : prevDay(today)
  let streak = 0
  while (days.has(cursor)) {
    streak++
    cursor = prevDay(cursor)
  }
  return { streak, doneToday }
}

export interface LeaderRow {
  userId: string
  name: string
  role: string
  forms: number
  joined: number
}

/** Ranked by people who joined, then forms, then name. */
export function rankLeaderboard<T extends LeaderRow>(rows: T[]): (T & { rank: number })[] {
  return [...rows]
    .sort((a, b) => b.joined - a.joined || b.forms - a.forms || a.name.localeCompare(b.name))
    .map((r, i) => ({ ...r, rank: i + 1 }))
}

/** True while a token issued at `issuedAt` is still valid. */
/** Only these statuses can book, move or cancel a call, or be sent a new journey link. */
export const JOURNEY_OPEN_STATUSES: readonly string[] = ['FORM_SUBMITTED', 'DISCOVERY_BOOKED']
export function journeyOpen(status: string): boolean {
  return JOURNEY_OPEN_STATUSES.includes(status)
}

export function linkStillValid(issuedAt: Date | null | undefined, now: Date): boolean {
  if (!issuedAt) return false
  return now.getTime() - issuedAt.getTime() <= LINK_VALID_DAYS * 86400_000
}

/** Whether a booked call can still be changed or cancelled by the prospect. */
export function canProspectChange(startsAt: Date, now: Date): boolean {
  return startsAt.getTime() - now.getTime() >= CHANGE_CUTOFF_HOURS * 3600_000
}

/** A short, url-safe invite slug from a name, e.g. "daniella-munene". */
export function slugifyName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'member'
}

/** Format an instant for emails/pages, e.g. "Thu, Nov 12 · 2:00 PM CST". */
export function formatCallTime(d: Date, tz: string): string {
  const date = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: tz }).format(d)
  const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short', timeZone: tz }).format(d)
  return `${date} · ${time}`
}
