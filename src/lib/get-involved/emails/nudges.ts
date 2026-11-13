/**
 * E11 nudges (outreach round 1): day 2 and day 7 after the form when no call is booked, plus the one
 * check-in email after "Maybe later". Sent by ../nudges.ts. See ./index.ts for the rules.
 */
import { Mail, P, SMALL, button, esc, layout } from '../emails'
import type { SeatOffer } from './welcome'
import { SPONSOR_LINE } from '../scripts'

const stack = (html: string) => `<div style="margin:0 0 6px">${html}</div>`

/** Nudge 1, day 2: "Still interested?" */
export function nudge1Email(p: {
  firstName: string
  /** Program name, or null for NowTransformed in general. */
  programName: string | null
  /** When they filled in the form, and their zone for the weekday ("on Monday"). */
  formAt: Date
  tz: string
  bookUrl: string
  /** "Ask us to call you instead" (signed link), or null to leave the line out. */
  callMeUrl: string | null
  prospectId?: string | null
}): Mail {
  const day = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: p.tz }).format(p.formAt)
  return {
    subject: `Still interested, ${p.firstName}?`,
    html: layout(
      `<p style="${P}">Hi ${esc(p.firstName)},</p>
       <p style="${P}">You asked about ${esc(p.programName ?? 'NowTransformed')} on ${esc(day)} but didn't pick a call time. No pressure. Here's the quickest way:</p>
       ${button({ label: 'See times this week', url: p.bookUrl })}
       ${p.callMeUrl ? `<p style="${P}">Not a good time? <a href="${esc(p.callMeUrl)}" style="color:#0369a1">Ask us to call you instead</a>.</p>` : ''}`,
      undefined,
      '',
      { prospectId: p.prospectId },
    ),
  }
}

/** Nudge 2, day 7: the last automatic email. The "may qualify" line only while the program has seats this month. */
export function nudge2Email(p: {
  firstName: string
  offer: SeatOffer | null
  bookUrl: string
  laterUrl: string | null
  stopUrl: string | null
  prospectId?: string | null
}): Mail {
  // No seat counts or prices before the call (no promises, no fake scarcity): only "may qualify".
  const seats = !!p.offer && p.offer.seatsLeft > 0
  const lead = seats
    ? `We'd still love to talk with you. ${esc(SPONSOR_LINE)} We'll talk about it on the free call. If now isn't the right time, that's fine. Just tell us:`
    : "We'd still love to talk with you. If now isn't the right time, that's fine. Just tell us:"
  return {
    subject: `${p.firstName}, should we keep a call time for you?`,
    html: layout(
      `<p style="${P}">Hi ${esc(p.firstName)},</p>
       <p style="${P}">${lead}</p>
       ${stack(button({ label: "Yes, let's book a call", url: p.bookUrl }))}
       ${p.laterUrl ? stack(button({ label: 'Maybe later: check in next month', url: p.laterUrl }, true)) : ''}
       ${p.stopUrl ? stack(button({ label: 'No thanks: stop emails', url: p.stopUrl }, true)) : ''}`,
      undefined,
      '',
      { prospectId: p.prospectId },
    ),
  }
}

/** The one check-in after "Maybe later: check in next month". */
export function checkInEmail(p: { firstName: string; bookUrl: string; stopUrl: string | null; prospectId?: string | null }): Mail {
  return {
    subject: `Checking in, ${p.firstName}`,
    html: layout(
      `<p style="${P}">Hi ${esc(p.firstName)}, last month you asked us to check in. Are you still interested in a free 15-minute call? Pick a time whenever you're ready.</p>
       ${button({ label: 'Pick a call time', url: p.bookUrl })}
       ${p.stopUrl ? `<p style="${SMALL}">Not for you right now? <a href="${esc(p.stopUrl)}" style="color:#6b7280">Stop emails about this</a>.</p>` : ''}`,
      undefined,
      '',
      { prospectId: p.prospectId },
    ),
  }
}
