/**
 * Pure rules for the orientation step (client-safe, tested in orientation-rules.test.ts):
 * turning a recording link into an embeddable player, and the "Remind me later" date/time choice.
 */
import { TZDate } from '@date-fns/tz'
import { ORIENTATION_LATER_MAX_DAYS } from './core'

// ---------- recording links ----------

export type Recording =
  | { kind: 'embed'; src: string; provider: 'YouTube' | 'Vimeo' | 'Loom' }
  | { kind: 'link'; href: string }

const ID = /^[A-Za-z0-9_-]{6,64}$/

/**
 * YouTube, Vimeo and Loom links become an embed URL; any other https link is shown as a link out.
 * Returns null for an empty or non-https value.
 */
export function recordingFor(url: string | null | undefined): Recording | null {
  if (!url) return null
  let u: URL
  try { u = new URL(url.trim()) } catch { return null }
  if (u.protocol !== 'https:') return null
  const host = u.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '')
  const parts = u.pathname.split('/').filter(Boolean)

  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const id = u.searchParams.get('v') ?? (['embed', 'shorts', 'live'].includes(parts[0]) ? parts[1] : null)
    if (id && ID.test(id)) return { kind: 'embed', provider: 'YouTube', src: `https://www.youtube-nocookie.com/embed/${id}?rel=0` }
  }
  if (host === 'youtu.be' && parts[0] && ID.test(parts[0])) {
    return { kind: 'embed', provider: 'YouTube', src: `https://www.youtube-nocookie.com/embed/${parts[0]}?rel=0` }
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const nums = parts.filter((p) => /^\d{5,12}$/.test(p))
    const id = nums[0]
    if (id) {
      // Private links look like vimeo.com/123456/abcdef or carry ?h=abcdef.
      const after = parts[parts.indexOf(id) + 1]
      const hash = u.searchParams.get('h') ?? (after && /^[a-f0-9]{6,20}$/i.test(after) ? after : null)
      return { kind: 'embed', provider: 'Vimeo', src: `https://player.vimeo.com/video/${id}${hash && /^[a-f0-9]{6,20}$/i.test(hash) ? `?h=${hash}` : ''}` }
    }
  }
  if (host === 'loom.com' && (parts[0] === 'share' || parts[0] === 'embed') && parts[1] && /^[a-f0-9]{16,64}$/i.test(parts[1])) {
    return { kind: 'embed', provider: 'Loom', src: `https://www.loom.com/embed/${parts[1]}` }
  }
  return { kind: 'link', href: u.toString() }
}

// ---------- remind me later ----------

export type DayPart = 'MORNING' | 'AFTERNOON' | 'EVENING'
export const DAY_PARTS: { value: DayPart; label: string; hour: number }[] = [
  { value: 'MORNING', label: 'Morning', hour: 9 },
  { value: 'AFTERNOON', label: 'Afternoon', hour: 13 },
  { value: 'EVENING', label: 'Evening', hour: 19 },
]
/** Chips shown on the page; further days up to ORIENTATION_LATER_MAX_DAYS use the date field. */
export const QUICK_DAYS = 7
/** A reminder must be at least this far ahead. */
export const MIN_LEAD_MINUTES = 15

export function isTimeZone(tz: string): boolean {
  if (!tz || tz.length > 64) return false
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true } catch { return false }
}

/** "YYYY-MM-DD" of `d` in the time zone. */
export function ymdIn(d: Date, tz: string): string {
  const z = new TZDate(d.getTime(), tz)
  return `${z.getFullYear()}-${String(z.getMonth() + 1).padStart(2, '0')}-${String(z.getDate()).padStart(2, '0')}`
}

/** The day `n` days after today in the zone, as "YYYY-MM-DD". */
export function addDaysYmd(now: Date, n: number, tz: string): string {
  const z = new TZDate(now.getTime(), tz)
  const day = new TZDate(z.getFullYear(), z.getMonth(), z.getDate() + n, 12, 0, 0, tz)
  return ymdIn(day, tz)
}

/** The instant for a day ("YYYY-MM-DD") and part of day in the zone. null for a malformed date. */
export function remindInstant(ymd: string, part: DayPart, tz: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  const p = DAY_PARTS.find((x) => x.value === part)
  if (!m || !p || !isTimeZone(tz)) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const t = new TZDate(y, mo - 1, d, p.hour, 0, 0, tz)
  if (t.getFullYear() !== y || t.getMonth() !== mo - 1 || t.getDate() !== d) return null // e.g. Feb 30
  return new Date(t.getTime())
}

/** Check a "remind me later" choice: not in the past, at most ORIENTATION_LATER_MAX_DAYS ahead. */
export function checkRemindChoice(ymd: string, part: DayPart, tz: string, now: Date):
  { ok: true; at: Date } | { ok: false; field: 'date' | 'part'; error: string } {
  const at = remindInstant(ymd, part, tz)
  if (!at) return { ok: false, field: 'date', error: 'Please pick a day' }
  const last = addDaysYmd(now, ORIENTATION_LATER_MAX_DAYS, tz)
  if (ymd < ymdIn(now, tz)) return { ok: false, field: 'date', error: 'That day has already passed' }
  if (ymd > last) return { ok: false, field: 'date', error: `Please pick a day within the next ${ORIENTATION_LATER_MAX_DAYS} days` }
  if (at.getTime() < now.getTime() + MIN_LEAD_MINUTES * 60_000) return { ok: false, field: 'part', error: 'That time has already passed. Please pick a later time' }
  return { ok: true, at }
}
