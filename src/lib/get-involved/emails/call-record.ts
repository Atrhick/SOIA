/**
 * Emails sent when a host records the discovery call with a role. See ./index.ts for the rules.
 * - callAssessmentEmail: E8 "3 quick questions". A stand-in used only until B3's
 *   sendAssessmentInvite() (assessment builder) is merged; see ../call-outcome.ts.
 * - giveLinkEmail: the sponsor / donor hand-off (no assessment, no login).
 */
import { AssessmentQuestion } from '../core'
import { Mail, P, SMALL, esc, layout } from '../emails'

export function callAssessmentEmail(p: { firstName: string; roleLabel: string; questions: AssessmentQuestion[]; url: string; hostName: string | null; minor: boolean }): Mail {
  const list = p.questions.map((q) => `<li style="margin:0 0 6px">${esc(q.text)}</li>`).join('')
  return {
    subject: `Great talking with you, ${p.firstName}: 3 quick questions`,
    html: layout(
      `<p style="${P}">Hi ${esc(p.firstName)}, thank you for the conversation today. It sounds like <strong>${esc(p.roleLabel)}</strong> is a great fit for you.</p>
       <p style="${P}">Next, three short questions so we understand your goals. It takes about 5 minutes.</p>
       <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px;margin:0 0 14px">
         <div style="font-weight:700;color:#111827;font-size:14px;margin-bottom:6px">${esc(p.roleLabel)} assessment</div>
         <ol style="margin:0;padding-left:20px;color:#374151;font-size:14px;line-height:1.5">${list}</ol>
       </div>`,
      { label: 'Answer the 3 questions', url: p.url },
      `${p.minor ? `<p style="${SMALL}">We've copied a parent or guardian on this email.</p>` : ''}${p.hostName ? `<p style="${SMALL}">Talk soon, ${esc(p.hostName)}</p>` : ''}`,
    ),
  }
}

export function giveLinkEmail(p: { firstName: string; roleLabel: string; url: string }): Mail {
  return {
    subject: `Thank you, ${p.firstName}: your giving page`,
    html: layout(
      `<p style="${P}">Hi ${esc(p.firstName)}, thank you for talking with us and for wanting to support NowTransformed as a <strong>${esc(p.roleLabel)}</strong>.</p>
       <p style="${P}">Your gift helps young people and adults grow, lead and build community. You can choose a one-time or a recurring gift on the next page.</p>`,
      { label: 'Go to the giving page', url: p.url },
    ),
  }
}
