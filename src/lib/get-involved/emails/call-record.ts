/**
 * Emails sent when a host records the discovery call with a role. See ./index.ts for the rules.
 * (The E8 assessment invite lives in journey-steps.ts: sendAssessmentInvite.)
 *   sendAssessmentInvite() (assessment builder) is merged; see ../call-outcome.ts.
 * - giveLinkEmail: the sponsor / donor hand-off (no assessment, no login).
 */
import { AssessmentQuestion } from '../core'
import { Mail, P, SMALL, esc, layout } from '../emails'

export function giveLinkEmail(p: { firstName: string; roleLabel: string; url: string; prospectId?: string | null }): Mail {
  return {
    subject: `Thank you, ${p.firstName}: your giving page`,
    html: layout(
      `<p style="${P}">Hi ${esc(p.firstName)}, thank you for talking with us and for wanting to support NowTransformed as a <strong>${esc(p.roleLabel)}</strong>.</p>
       <p style="${P}">Your gift helps young people and adults grow, lead and build community. You can choose a one-time or a recurring gift on the next page.</p>`,
      { label: 'Go to the giving page', url: p.url },
      '',
      { prospectId: p.prospectId },
    ),
  }
}
