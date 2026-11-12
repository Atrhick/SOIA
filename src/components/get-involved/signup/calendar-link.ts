/** Pure helpers for the booked screen (screen 7). Client-safe. */

const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

/** A Google Calendar "add event" link (calendar.google.com/calendar/render?action=TEMPLATE). */
export function googleCalendarUrl(e: { title: string; startsAt: string; endsAt: string; details?: string; location?: string | null }): string {
  const q = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates: `${stamp(e.startsAt)}/${stamp(e.endsAt)}` })
  if (e.details) q.set('details', e.details)
  if (e.location) q.set('location', e.location)
  return `https://calendar.google.com/calendar/render?${q.toString()}`
}

/** "Pacific Time (Los Angeles)" for an IANA zone; falls back to the short name or the id. */
export function zoneLabel(tz: string, at = new Date()): string {
  const city = (tz.split('/').pop() ?? tz).replace(/_/g, ' ')
  const part = (style: 'longGeneric' | 'short') => {
    try {
      return new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: style }).formatToParts(at).find((p) => p.type === 'timeZoneName')?.value ?? null
    } catch {
      return null
    }
  }
  const name = part('longGeneric') ?? part('short')
  if (!name) return tz
  return name.includes(city) || tz === 'UTC' ? name : `${name} (${city})`
}
