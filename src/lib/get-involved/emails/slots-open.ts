/**
 * "Times are open" email: the prospect hit "No open times" and asked to be told when times open.
 * See ./index.ts for the rules (escape every value, copy the parent for 17 and under).
 */
import { Mail, P, SMALL, esc, layout } from '../emails'

export function timesOpenEmail(p: { firstName: string; bookUrl: string; parent?: { first: string } | null; prospectId?: string | null }): Mail {
  return {
    subject: 'Discovery call times are open',
    html: layout(
      `${p.parent ? `<p style="${P}">Hi ${esc(p.parent.first)}, we're copying you because ${esc(p.firstName)} is 17 or under. A parent or guardian must be on the call.</p>` : ''}
       <p style="${P}">Hi ${esc(p.firstName)}, good news: new times just opened for your free 15-minute discovery call.</p>
       <p style="${SMALL}">Times go fast, so pick one that works for you soon.</p>`,
      { label: 'Pick a time', url: p.bookUrl },
      '',
      { prospectId: p.prospectId },
    ),
  }
}
