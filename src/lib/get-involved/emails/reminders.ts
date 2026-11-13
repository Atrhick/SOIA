/**
 * E10 call reminders for the prospect (outreach round 1): 3 days before (with "Yes, I'll be there" /
 * "I need another time") and the day before. The 1-hour reminder and the host copies still use
 * reminderEmail() in ../emails.ts. Parent copies for 17 and under pass `parent`. See ./index.ts.
 */
import { dayKeyIn } from '../core'
import { Mail, P, SMALL, button, esc, layout, parentNote } from '../emails'

interface ReminderBase {
  firstName: string
  startsAt: Date
  endsAt: Date
  /** The prospect's time zone (DiscoveryCall.timezone). */
  tz: string
  hostFirst: string | null
  meetingUrl: string | null
  /** The booking page: change or cancel ("I need another time"). */
  manageUrl: string
  parent?: { first: string } | null
  prospectId?: string | null
}

const fmt = (d: Date, tz: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', { ...o, timeZone: tz }).format(d)

/** "Thursday, Nov 12 · 11:00 – 11:30 AM CST" in the prospect's zone. */
export function callRange(start: Date, end: Date, tz: string): string {
  const day = fmt(start, tz, { weekday: 'long', month: 'short', day: 'numeric' })
  const from = fmt(start, tz, { hour: 'numeric', minute: '2-digit' })
  const to = fmt(end, tz, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
  // Drop the first AM/PM when both match: "11:00 – 11:30 AM".
  const fromAmPm = from.slice(-2), toAmPm = to.match(/(AM|PM)/)?.[1]
  return `${day} · ${fromAmPm === toAmPm ? from.slice(0, -3) : from} – ${to}`
}

/** "Today" / "Tomorrow" / "Thursday", relative to `now` in the prospect's zone. */
export function dayWord(start: Date, tz: string, now = new Date()): string {
  const k = dayKeyIn(start, tz)
  if (k === dayKeyIn(now, tz)) return 'Today'
  if (k === dayKeyIn(new Date(now.getTime() + 86400_000), tz)) return 'Tomorrow'
  return fmt(start, tz, { weekday: 'long' })
}

const box = (inner: string) => `<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:14px 16px;margin:0 0 14px;font-size:15px;line-height:1.5;color:#111827">${inner}</div>`

export function threeDayReminderEmail(p: ReminderBase & { confirmUrl: string | null; calendarUrl: string }): Mail {
  const weekday = fmt(p.startsAt, p.tz, { weekday: 'long' })
  const who = p.hostFirst ? `Call with ${esc(p.hostFirst)}, a NowTransformed host` : 'Call with a NowTransformed host'
  return {
    subject: `Your call with NowTransformed is on ${weekday}`,
    html: layout(
      `${p.parent ? parentNote(p.parent.first, p.firstName) : ''}
       <p style="${P}">Hi ${esc(p.firstName)}, a quick reminder of your free call.</p>
       ${box(`<strong>${esc(callRange(p.startsAt, p.endsAt, p.tz))}</strong><br>${who}`)}
       <p style="${P}">Can you still make it? One tap tells us:</p>
       <div>${p.confirmUrl ? button({ label: "Yes, I'll be there", url: p.confirmUrl }) : ''}${button({ label: 'I need another time', url: p.manageUrl }, true)}</div>
       <p style="${SMALL};font-size:14px;color:#4b5563"><a href="${esc(p.calendarUrl)}" style="color:#0369a1">Add to my calendar</a></p>`,
      undefined,
      '',
      { prospectId: p.prospectId },
    ),
  }
}

export function dayBeforeReminderEmail(p: ReminderBase, now = new Date()): Mail {
  const word = dayWord(p.startsAt, p.tz, now)
  const time = fmt(p.startsAt, p.tz, { hour: 'numeric', minute: '2-digit' })
  const greet = word === 'Tomorrow' ? 'see you tomorrow.' : word === 'Today' ? 'see you today.' : `see you on ${esc(word)}.`
  return {
    subject: `${word} ${time}: your call with ${p.hostFirst ?? 'NowTransformed'}`,
    html: layout(
      `${p.parent ? parentNote(p.parent.first, p.firstName) : ''}
       <p style="${P}">Hi ${esc(p.firstName)}, ${greet}</p>
       ${box(`<strong>${esc(callRange(p.startsAt, p.endsAt, p.tz))}</strong>${p.meetingUrl ? `<br>Join here: <a href="${esc(p.meetingUrl)}" style="color:#0369a1">${esc(p.meetingUrl.replace(/^https?:\/\//, ''))}</a>` : ''}`)}
       <p style="${P}">To get the most from 15 minutes, think about one thing you'd like help with. That's all you need to prepare.</p>
       <p style="${SMALL};font-size:14px;color:#4b5563">Can't make it? <a href="${esc(p.manageUrl)}" style="color:#0369a1">Pick another time</a> so someone else can have this one.</p>`,
      undefined,
      '',
      { prospectId: p.prospectId },
    ),
  }
}
