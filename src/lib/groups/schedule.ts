/**
 * Weekly group meeting times. Pure functions, no DB.
 * A meeting is set as a local weekday + "HH:MM" in an IANA time zone; we store UTC.
 * DST-safe: the UTC time is worked out separately for each week's local date.
 */

/** Offset (minutes, local minus UTC) of `tz` at the instant `utcMs`. */
function tzOffsetMinutes(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs))
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'))
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60000)
}

/** The UTC instant of a wall-clock time in `tz`. In a DST gap the time moves forward by the gap. */
export function zonedTimeToUtc(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  tz: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute)
  let offset = tzOffsetMinutes(guess, tz)
  let utc = guess - offset * 60000
  const offset2 = tzOffsetMinutes(utc, tz)
  if (offset2 !== offset) {
    offset = offset2
    utc = guess - offset * 60000
  }
  return new Date(utc)
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export function parseHHMM(s: string): { hour: number; minute: number } | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(s)
  if (!m) return null
  return { hour: Number(m[1]), minute: Number(m[2]) }
}

export interface ScheduleInput {
  /** First possible meeting date as "YYYY-MM-DD" (a local calendar date). */
  startDate: string
  /** 0 = Sunday ... 6 = Saturday, local. */
  weekday: number
  /** "HH:MM" 24-hour, local. */
  time: string
  timezone: string
  durationMin: number
  weeks: number
}

export interface ScheduledMeeting {
  weekNo: number
  startsAt: Date
  endsAt: Date
}

/** One meeting per week, starting on the first `weekday` on or after `startDate`. */
export function buildWeeklySchedule(input: ScheduleInput): ScheduledMeeting[] {
  const t = parseHHMM(input.time)
  if (!t) throw new Error('Time must be HH:MM')
  if (!isValidTimeZone(input.timezone)) throw new Error('Unknown time zone')
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.startDate)
  if (!d) throw new Error('Start date must be YYYY-MM-DD')
  // Work on calendar dates with a UTC-noon anchor so adding days never slips.
  const base = new Date(Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), 12))
  const shift = (input.weekday - base.getUTCDay() + 7) % 7
  const out: ScheduledMeeting[] = []
  for (let w = 0; w < input.weeks; w++) {
    const day = new Date(base.getTime() + (shift + w * 7) * 86400000)
    const startsAt = zonedTimeToUtc(
      day.getUTCFullYear(),
      day.getUTCMonth() + 1,
      day.getUTCDate(),
      t.hour,
      t.minute,
      input.timezone,
    )
    out.push({ weekNo: w + 1, startsAt, endsAt: new Date(startsAt.getTime() + input.durationMin * 60000) })
  }
  return out
}

/** "YYYY-MM-DD" for a Date, read as a UTC calendar date. */
export function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}
