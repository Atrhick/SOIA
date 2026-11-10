/**
 * Emails an admin triggers from the prospect record (Resend questions, Change role).
 * See ./index.ts for the rules. The first assessment email after the call (E8) belongs to the
 * call-outcome / assessment builders; these are the staff-initiated versions.
 */
import { Mail, P, SMALL, esc, layout } from '../emails'

/** E8 again: the role's 3 questions, sent when staff resend them or change the role. */
export function assessmentLinkEmail(p: { firstName: string; roleLabel: string; url: string; questions: string[]; reason: 'resend' | 'role-changed' }): Mail {
  const intro = p.reason === 'role-changed'
    ? `Hi ${esc(p.firstName)}, after talking it over, we think <strong>${esc(p.roleLabel)}</strong> is the best fit for you.`
    : `Hi ${esc(p.firstName)}, here are your ${esc(p.roleLabel)} questions again, in case the first email got lost.`
  const list = p.questions.length
    ? `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px;margin:0 0 14px">
         <div style="font-weight:700;color:#111827;font-size:14px;margin-bottom:6px">${esc(p.roleLabel)} assessment</div>
         <ol style="margin:0;padding-left:20px;color:#374151;font-size:14px;line-height:1.6">${p.questions.map((q) => `<li>${esc(q)}</li>`).join('')}</ol>
       </div>`
    : ''
  return {
    subject: p.reason === 'role-changed' ? `Your next step with NowTransformed: 3 quick questions` : `Your 3 questions from NowTransformed`,
    html: layout(
      `<p style="${P}">${intro}</p>
       <p style="${P}">Next, three short questions so we understand your goals. It takes about 5 minutes.</p>
       ${list}`,
      { label: 'Answer the 3 questions', url: p.url },
      `<p style="${SMALL}">This link works for 14 days.</p>`,
    ),
  }
}

/** Sent when staff change someone's role to Sponsor / donor: their next step is the donation page. */
export function giveLinkEmail(p: { firstName: string; roleLabel: string; url: string }): Mail {
  return {
    subject: 'Thank you for wanting to support NowTransformed',
    html: layout(
      `<p style="${P}">Hi ${esc(p.firstName)}, thank you for the conversation. We think supporting the work as a <strong>${esc(p.roleLabel)}</strong> is the best fit for you.</p>
       <p style="${P}">The link below explains how your gift helps and takes you to the donation page.</p>`,
      { label: 'See how to give', url: p.url },
      `<p style="${SMALL}">This link works for 14 days.</p>`,
    ),
  }
}
