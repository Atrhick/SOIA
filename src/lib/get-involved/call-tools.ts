/**
 * Pure helpers for discovery calls: the .ics calendar file, the admin Calls page tiles,
 * and the "once per Central-time day" rule for no-open-times alerts. Tested in call-tools.test.ts.
 */
import { TZDate } from '@date-fns/tz'
import { BUSINESS_TZ, businessDay } from './core'

// ---------- .ics ----------

function icsStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** RFC 5545 text escaping: backslash, semicolon, comma and newlines. */
export function icsEscape(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** Lines longer than 75 octets are folded (CRLF + space). Kept simple: we fold on characters. */
function fold(line: string): string {
  if (line.length <= 74) return line
  const parts: string[] = []
  for (let i = 0; i < line.length; i += 73) parts.push((i ? ' ' : '') + line.slice(i, i + 73))
  return parts.join('\r\n')
}

export function buildIcs(e: { uid: string; startsAt: Date; endsAt: Date; title: string; description: string; url?: string | null; now?: Date }): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NowTransformed//Discovery call//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${icsEscape(e.uid)}`,
    `DTSTAMP:${icsStamp(e.now ?? new Date())}`,
    `DTSTART:${icsStamp(e.startsAt)}`,
    `DTEND:${icsStamp(e.endsAt)}`,
    `SUMMARY:${icsEscape(e.title)}`,
    `DESCRIPTION:${icsEscape(e.description)}`,
    ...(e.url ? [`LOCATION:${icsEscape(e.url)}`, `URL:${icsEscape(e.url)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.map(fold).join('\r\n') + '\r\n'
}

// ---------- Calls page tiles ----------

export interface StatCall { startsAt: string | Date; status: string; ageRange?: string | null }

export interface CallStats {
  today: number
  thisWeek: number
  needOutcome: number
  /** KEPT / (KEPT + NO_SHOW) over the last 30 days, 0-100; null when there were none. */
  showUpRate: number | null
}

/** Monday-based week key (the Monday's yyyy-mm-dd) of a business day. */
function weekOf(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const back = (dt.getUTCDay() + 6) % 7
  dt.setUTCDate(dt.getUTCDate() - back)
  return dt.toISOString().slice(0, 10)
}

/**
 * Tiles for the admin Calls page, all in Central time: booked calls today, booked calls this
 * (Monday to Sunday) week, calls that started but have no outcome, and show-up rate for 30 days.
 */
export function callStats(calls: StatCall[], now: Date, tz = BUSINESS_TZ): CallStats {
  const today = businessDay(now, tz)
  const week = weekOf(today)
  const since = now.getTime() - 30 * 86400_000
  let t = 0, w = 0, need = 0, kept = 0, missed = 0
  for (const c of calls) {
    const at = new Date(c.startsAt)
    const day = businessDay(at, tz)
    if (c.status === 'BOOKED') {
      if (day === today) t++
      if (weekOf(day) === week) w++
      if (at.getTime() <= now.getTime()) need++
    } else if (at.getTime() >= since && at.getTime() <= now.getTime()) {
      if (c.status === 'KEPT') kept++
      else if (c.status === 'NO_SHOW') missed++
    }
  }
  return { today: t, thisWeek: w, needOutcome: need, showUpRate: kept + missed ? Math.round((kept / (kept + missed)) * 100) : null }
}

// ---------- once a day ----------

/** Midnight of the current business (Central) day, as an instant. */
export function startOfBusinessDay(now: Date, tz = BUSINESS_TZ): Date {
  const z = new TZDate(now.getTime(), tz)
  return new Date(new TZDate(z.getFullYear(), z.getMonth(), z.getDate(), 0, 0, 0, tz).getTime())
}
