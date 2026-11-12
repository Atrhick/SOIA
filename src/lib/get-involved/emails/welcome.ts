/**
 * E9 welcome (outreach round 1). Sent by the cron about 20 minutes after an adult's sign-up, only if
 * they left the page without booking (see ../nudges.ts). See ./index.ts for the rules.
 * The program paragraph is the approved CoachProgram.welcomeNote (program-welcome.ts rules): pass
 * `note` only while it is approved.
 */
import { companyFor } from '../program-welcome'
import { Mail, P, SMALL, button, esc, layout } from '../emails'

export interface WelcomeInviter {
  name: string
  /** e.g. "NowTransformed coach". */
  roleLabel: string
  /** Absolute photo URL, or null for initials. */
  photoUrl: string | null
}

export interface SeatOffer {
  sponsoredPrice: string | null
  fullPrice: string | null
  seatsLeft: number
}

export const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => (w?.[0] || '').toUpperCase()).join('') || '?'

/** Photo (or initials) + name + role, as in the mockup header. */
export function inviterHeader(i: WelcomeInviter): string {
  const pic = i.photoUrl
    ? `<img src="${esc(i.photoUrl)}" width="48" height="48" alt="Photo of ${esc(i.name)}" style="width:48px;height:48px;border-radius:24px;object-fit:cover;display:block">`
    : `<div role="img" aria-label="${esc(i.name)}" style="width:48px;height:48px;line-height:48px;border-radius:24px;background:#e0f2fe;color:#075985;font-weight:700;text-align:center;font-size:15px">${esc(initials(i.name))}</div>`
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px"><tr>
    <td style="vertical-align:middle;padding-right:12px">${pic}</td>
    <td style="vertical-align:middle;font-size:14px;line-height:1.4;color:#111827"><strong>${esc(i.name)}</strong><br><span style="color:#4b5563">${esc(i.roleLabel)}</span></td>
  </tr></table>`
}

/** "Your sponsored seat: $X instead of $Y. 3 seats left this month." Empty unless seats are left. */
export function seatLine(offer: SeatOffer | null | undefined): string {
  if (!offer || offer.seatsLeft <= 0) return ''
  const seats = `${offer.seatsLeft} seat${offer.seatsLeft === 1 ? '' : 's'} left this month.`
  const price = offer.sponsoredPrice
    ? `Your sponsored seat: <strong>${esc(offer.sponsoredPrice)}</strong>${offer.fullPrice ? ` instead of ${esc(offer.fullPrice)}` : ''}. `
    : 'Sponsored seats are available. '
  return `<p style="${SMALL};font-size:14px;color:#4b5563">${price}${seats}</p>`
}

export function welcomeCallEmail(p: {
  firstName: string
  bookUrl: string
  inviter: WelcomeInviter | null
  /** The program they came through. `note` = approved paragraph, else null (no box). */
  program?: { name: string; company?: string | null; note: string | null } | null
  offer?: SeatOffer | null
  prospectId?: string | null
}): Mail {
  const inviterFirst = p.inviter ? p.inviter.name.trim().split(/\s+/)[0] : null
  const company = p.program ? companyFor(p.program.name, p.program.company) : null
  const what = p.program
    ? `<strong>${esc(p.program.name)}</strong>${company ? ` from <strong>${esc(company)}</strong>` : ''}`
    : '<strong>NowTransformed</strong>'
  const shared = inviterFirst ? ` ${esc(inviterFirst)} shared it with you because they thought it could help.` : ''
  const note = p.program?.note
    ? `<p style="${P};padding:14px 16px;background:#f8fafc;border-radius:10px">${esc(p.program.note.trim())}</p>`
    : ''
  return {
    subject: `${p.firstName}, pick a time for your free call with NowTransformed`,
    html: layout(
      `${p.inviter ? inviterHeader(p.inviter) : ''}
       <p style="${P}">Hi ${esc(p.firstName)},</p>
       <p style="${P}">Thanks for your interest in ${what}.${shared}</p>
       ${note}
       <p style="${P}">The next step is a free 30-minute call. Times start as soon as tomorrow.</p>
       ${button({ label: 'Pick a call time', url: p.bookUrl })}
       ${seatLine(p.offer)}`,
      undefined,
      '',
      { prospectId: p.prospectId, signOff: 'See you soon,' },
    ),
  }
}
