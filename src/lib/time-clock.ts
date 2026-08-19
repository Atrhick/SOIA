/**
 * Pure time-clock logic, shared by the server actions and the client screens.
 *
 * Nothing here touches the database or the session, so both sides derive the
 * same shifts and the same totals from the same event list.
 */

export type ClockPunch = 'CLOCK_IN' | 'CLOCK_OUT' | 'BREAK_START' | 'BREAK_END'
export type ClockStatus = 'CLOCKED_OUT' | 'CLOCKED_IN' | 'ON_BREAK'

/** A shift longer than this was almost certainly a missed clock-out. */
export const MAX_SHIFT_MINUTES = 16 * 60

/** 0 = Sunday. Kept at Sunday to match how the week was previously counted. */
export const WEEK_STARTS_ON = 0

export const STATUS_LABELS: Record<ClockStatus, string> = {
  CLOCKED_OUT: 'Clocked out',
  CLOCKED_IN: 'Clocked in',
  ON_BREAK: 'On break',
}

export const PUNCH_LABELS: Record<ClockPunch, string> = {
  CLOCK_IN: 'Clocked in',
  CLOCK_OUT: 'Clocked out',
  BREAK_START: 'Break started',
  BREAK_END: 'Break ended',
}

/**
 * Which punches are legal from a given state. Enforced on the server, not just
 * by hiding buttons - a stale tab or a double submit posts whatever it likes.
 */
export const ALLOWED_PUNCHES: Record<ClockStatus, ClockPunch[]> = {
  CLOCKED_OUT: ['CLOCK_IN'],
  CLOCKED_IN: ['BREAK_START', 'CLOCK_OUT'],
  ON_BREAK: ['BREAK_END', 'CLOCK_OUT'],
}

/**
 * The state after a punch. The previous implementation read only the newest row
 * and mapped anything that was not CLOCK_IN or BREAK_START to CLOCKED_OUT, so
 * ending a break silently clocked the person out.
 */
export function statusAfter(punch: ClockPunch): ClockStatus {
  switch (punch) {
    case 'CLOCK_IN':
    case 'BREAK_END':
      return 'CLOCKED_IN'
    case 'BREAK_START':
      return 'ON_BREAK'
    case 'CLOCK_OUT':
      return 'CLOCKED_OUT'
  }
}

export function statusFromLatest(latest: ClockPunch | null | undefined): ClockStatus {
  return latest ? statusAfter(latest) : 'CLOCKED_OUT'
}

export function punchRejection(status: ClockStatus, punch: ClockPunch): string | null {
  if (ALLOWED_PUNCHES[status].includes(punch)) return null
  switch (punch) {
    case 'CLOCK_IN':
      return 'You are already clocked in.'
    case 'CLOCK_OUT':
      return 'You are not clocked in.'
    case 'BREAK_START':
      return status === 'ON_BREAK'
        ? 'You are already on a break.'
        : 'Clock in before starting a break.'
    case 'BREAK_END':
      return 'You are not on a break.'
  }
}

// ============================================
// Time zones
// ============================================

export const DEFAULT_TIME_ZONE = 'UTC'

export function isValidTimeZone(tz: string | undefined | null): tz is string {
  if (!tz) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

function civilParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
    .formatToParts(instant)
    .reduce<Record<string, string>>((acc, p) => {
      acc[p.type] = p.value
      return acc
    }, {})

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    // Some engines render midnight as hour 24 when hour12 is false.
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
  }
}

function offsetMs(instant: Date, timeZone: string): number {
  const c = civilParts(instant, timeZone)
  return Date.UTC(c.year, c.month - 1, c.day, c.hour, c.minute, c.second) - instant.getTime()
}

/**
 * The instant at which the civil day containing `instant` began in `timeZone`.
 *
 * Boundaries have to be computed in the viewer's zone: on Cloud Run the server
 * runs in UTC, so a coach in Nairobi asking for "today" was previously handed a
 * window that ended at 3am local.
 */
export function startOfDayInZone(instant: Date, timeZone: string): Date {
  const c = civilParts(instant, timeZone)
  const localMidnightAsUTC = Date.UTC(c.year, c.month - 1, c.day)
  // Two passes: the first offset may belong to the wrong side of a DST change.
  const first = new Date(localMidnightAsUTC - offsetMs(instant, timeZone))
  return new Date(localMidnightAsUTC - offsetMs(first, timeZone))
}

export function addDaysInZone(instant: Date, days: number, timeZone: string): Date {
  const c = civilParts(instant, timeZone)
  const shifted = Date.UTC(c.year, c.month - 1, c.day + days)
  const first = new Date(shifted - offsetMs(instant, timeZone))
  return new Date(shifted - offsetMs(first, timeZone))
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function startOfWeekInZone(instant: Date, timeZone: string): Date {
  const label = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(instant)
  const dayOfWeek = Math.max(0, WEEKDAYS.indexOf(label))
  const back = (dayOfWeek - WEEK_STARTS_ON + 7) % 7
  return addDaysInZone(startOfDayInZone(instant, timeZone), -back, timeZone)
}

// ============================================
// Shifts
// ============================================

export interface ClockEvent {
  id: string
  type: ClockPunch
  timestamp: string
  notes?: string | null
}

export interface Shift {
  start: string
  end: string | null
  breakMinutes: number
  /** Time on the clock minus breaks. Counts up to `asOf` while still open. */
  workedMinutes: number
  open: boolean
  /** True when the shift cannot be trusted, so it is kept out of totals. */
  needsReview: boolean
  reviewReason: string | null
}

function minutesBetween(a: number, b: number) {
  return Math.max(0, Math.round((b - a) / 60000))
}

/**
 * Fold a stream of punches into shifts.
 *
 * The punch log is append-only and, for rows written before transitions were
 * validated, not necessarily well formed: it contains clock-ins with no matching
 * clock-out and shifts spanning days. Rather than discarding those, or letting
 * an 84-hour phantom inflate someone's week, they are paired as best they can be
 * and flagged for review.
 *
 * `events` must be ascending by timestamp.
 */
export function buildShifts(events: ClockEvent[], asOf: Date = new Date()): Shift[] {
  const shifts: Shift[] = []
  const now = asOf.getTime()

  let start: number | null = null
  let breakStart: number | null = null
  let breakMinutes = 0

  const close = (end: number | null, reason: string | null) => {
    if (start === null) return
    let breaks = breakMinutes
    if (breakStart !== null) {
      // Closed while still on break: count the break up to the closing instant.
      breaks += minutesBetween(breakStart, end ?? now)
    }
    const elapsed = minutesBetween(start, end ?? now)
    const worked = Math.max(0, elapsed - breaks)
    const tooLong = elapsed > MAX_SHIFT_MINUTES
    shifts.push({
      start: new Date(start).toISOString(),
      end: end === null ? null : new Date(end).toISOString(),
      breakMinutes: breaks,
      workedMinutes: worked,
      open: end === null,
      needsReview: Boolean(reason) || tooLong,
      reviewReason:
        reason ??
        (tooLong ? 'Longer than a working day - the clock-out was probably missed' : null),
    })
    start = null
    breakStart = null
    breakMinutes = 0
  }

  for (const event of events) {
    const at = new Date(event.timestamp).getTime()
    if (Number.isNaN(at)) continue

    switch (event.type) {
      case 'CLOCK_IN':
        // A second clock-in without a clock-out: close the old one as broken.
        if (start !== null) close(null, 'No clock-out was recorded')
        start = at
        break
      case 'BREAK_START':
        if (start !== null && breakStart === null) breakStart = at
        break
      case 'BREAK_END':
        if (breakStart !== null) {
          breakMinutes += minutesBetween(breakStart, at)
          breakStart = null
        }
        break
      case 'CLOCK_OUT':
        if (start !== null) close(at, null)
        break
    }
  }

  if (start !== null) close(null, null)
  return shifts
}

export interface ShiftTotals {
  workedMinutes: number
  breakMinutes: number
  shiftCount: number
  needsReviewCount: number
}

/** Shifts flagged for review are excluded, so one bad row cannot skew a total. */
export function totalShiftMinutes(shifts: Shift[]): ShiftTotals {
  const counted = shifts.filter((s) => !s.needsReview)
  return {
    workedMinutes: counted.reduce((sum, s) => sum + s.workedMinutes, 0),
    breakMinutes: counted.reduce((sum, s) => sum + s.breakMinutes, 0),
    shiftCount: counted.length,
    needsReviewCount: shifts.length - counted.length,
  }
}

export function formatMinutes(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes))
  const h = Math.floor(safe / 60)
  const m = safe % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function formatHours(minutes: number): string {
  return `${Math.round((Math.max(0, minutes) / 60) * 10) / 10}h`
}
