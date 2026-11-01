/**
 * Time tracking helpers shared by the server actions and the client screens.
 * Nothing here touches the database, so both sides format and total the same
 * entries the same way.
 */
import { tz, TZDate } from '@date-fns/tz'
import { addDays, addWeeks, format, startOfWeek } from 'date-fns'

/** A timer still running after this long was almost certainly forgotten. */
export const RUNAWAY_HOURS = 12
/** No single entry may be longer than this. */
export const MAX_ENTRY_HOURS = 24

export interface EntryView {
  id: string
  description: string | null
  projectId: string | null
  projectName: string | null
  startTime: string
  /** Null while the timer is running. */
  endTime: string | null
  isManual: boolean
}

export interface ProjectOption {
  id: string
  name: string
}

// ============================================
// Durations
// ============================================

export function entryMs(entry: Pick<EntryView, 'startTime' | 'endTime'>, now = Date.now()) {
  const end = entry.endTime ? new Date(entry.endTime).getTime() : now
  return Math.max(0, end - new Date(entry.startTime).getTime())
}

export function isRunaway(entry: Pick<EntryView, 'startTime' | 'endTime'>, now = Date.now()) {
  return !entry.endTime && entryMs(entry, now) > RUNAWAY_HOURS * 3600_000
}

/** Minutes that count toward totals. A forgotten timer counts for nothing until it is fixed. */
export function countedMinutes(entries: EntryView[], now = Date.now()) {
  return entries.reduce(
    (sum, e) => (isRunaway(e, now) ? sum : sum + Math.round(entryMs(e, now) / 60000)),
    0
  )
}

/**
 * The rules every saved entry must meet, whoever saves it. Overlap with the
 * person's other entries needs the database, so it is checked separately.
 */
export function entryRangeError(start: Date, end: Date | null, now = Date.now()): string | null {
  if (Number.isNaN(start.getTime()) || (end && Number.isNaN(end.getTime()))) {
    return 'Enter a valid date and time.'
  }
  // A minute of slack so a form submitted "now" is not rejected by clock skew.
  if (start.getTime() > now + 60_000) return 'Time cannot start in the future.'
  if (!end) return null
  if (end.getTime() <= start.getTime()) return 'The end time must be after the start time.'
  if (end.getTime() > now + 60_000) return 'Time cannot end in the future.'
  if (end.getTime() - start.getTime() > MAX_ENTRY_HOURS * 3600_000) {
    return `An entry cannot be longer than ${MAX_ENTRY_HOURS} hours. Enter when you actually stopped.`
  }
  return null
}

// ============================================
// Time zones and weeks
// ============================================

export const DEFAULT_TIME_ZONE = 'UTC'

export function resolveZone(zone: string | undefined | null): string {
  if (!zone) return DEFAULT_TIME_ZONE
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
    return zone
  } catch {
    return DEFAULT_TIME_ZONE
  }
}

/** The seven days of a Sunday-to-Saturday week in `zone`; offset -1 is last week. */
export function weekDays(zone: string, offset = 0, now = new Date()): Date[] {
  const start = addWeeks(startOfWeek(now, { in: tz(zone) }), offset)
  // Plain Dates: the zoned type serializes with an offset rather than Z.
  return Array.from({ length: 7 }, (_, i) => new Date(addDays(start, i, { in: tz(zone) }).getTime()))
}

/** Calendar day of an instant in `zone`, as yyyy-MM-dd, for grouping. */
export function dayKey(iso: string | Date, zone: string) {
  return format(new Date(iso), 'yyyy-MM-dd', { in: tz(zone) })
}

/** The instant for a wall-clock date ("2026-10-29") and time ("18:30") in `zone`. */
export function zonedInstant(date: string, time: string, zone: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  const [h, min] = time.split(':').map(Number)
  return new Date(new TZDate(y, m - 1, d, h, min, zone).getTime())
}

// ============================================
// Formatting
// ============================================

export function formatIn(iso: string | Date, pattern: string, zone: string) {
  return format(new Date(iso), pattern, { in: tz(zone) })
}

/** 00:47:12, for a running timer. */
export function formatClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

/** 3h 05m */
export function formatMinutes(minutes: number) {
  const safe = Math.max(0, Math.round(minutes))
  const h = Math.floor(safe / 60)
  const m = safe % 60
  return h === 0 ? `${m}m` : `${h}h ${String(m).padStart(2, '0')}m`
}

/** 3:05, for tables. */
export function formatHM(minutes: number) {
  const safe = Math.max(0, Math.round(minutes))
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`
}
