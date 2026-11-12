/**
 * Join step emails (terms accepted, payment arranged by staff). See ./index.ts for the rules.
 * E11 "Your login is ready" itself lives in ./joined.ts and is sent by completeJourney().
 */
import { Mail, P, SMALL, esc, layout } from '../emails'

/** Paid role, no online payment yet: terms accepted, our team will be in touch about payment. */
export function paymentArrangedEmail(p: { firstName: string; roleLabel: string; amountLabel: string; termsVersion: number; statusUrl: string; prospectId?: string | null }): Mail {
  return {
    subject: `Next step: your ${p.roleLabel} payment`,
    html: layout(
      `<p style="${P}">Thanks, ${esc(p.firstName)}. You've accepted the ${esc(p.roleLabel)} terms (version ${esc(String(p.termsVersion))}).</p>
       <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px;margin:0 0 14px">
         <div style="color:#111827;font-size:14px">${esc(p.roleLabel)} fee: <strong>${esc(p.amountLabel)}</strong></div>
       </div>
       <p style="${P}">Someone from our team will contact you about payment within 2 business days. As soon as your payment is recorded, we'll create your login and email you how to sign in.</p>
       <p style="${SMALL}">You can check where things stand at any time with the button below.</p>`,
      { label: 'Check my status', url: p.statusUrl },
      '',
      { prospectId: p.prospectId },
    ),
  }
}
