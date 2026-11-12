/** E8 "Your 3 questions" (sent when a role is chosen) and its one reminder. See ./index.ts for the rules. */
import { Mail, P, SMALL, esc, layout } from '../emails'

interface AssessmentMailInput {
  firstName: string
  roleLabel: string
  questions: string[]
  url: string
  /** Set when this copy goes to a parent of someone 17 and under. */
  parentFirst?: string | null
  /** For the footer's stop/delete links. */
  prospectId?: string | null
}

function questionBox(roleLabel: string, questions: string[]): string {
  return `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px;margin:0 0 14px">
    <div style="font-weight:700;color:#075985;font-size:12px;letter-spacing:.04em;text-transform:uppercase;margin:0 0 6px">${esc(roleLabel)} assessment</div>
    <ol style="margin:0;padding-left:20px;color:#374151;font-size:14px;line-height:1.6">${questions.map((q) => `<li>${esc(q)}</li>`).join('')}</ol>
  </div>`
}

function parentLine(parentFirst: string | null | undefined, childFirst: string): string {
  if (!parentFirst) return ''
  return `<div style="background:#fff7ed;border:1px solid #fdba74;border-radius:12px;padding:12px 14px;margin:0 0 14px;color:#7c2d12;font-size:14px;line-height:1.5">Hi ${esc(parentFirst)}, we're copying you because ${esc(childFirst)} is 17 or under. Feel free to look over the questions together.</div>`
}

export function assessmentInviteEmail(p: AssessmentMailInput): Mail {
  return {
    subject: `Great talking with you, ${p.firstName}: 3 quick questions`,
    html: layout(
      `${parentLine(p.parentFirst, p.firstName)}
       <p style="${P}">Hi ${esc(p.firstName)}, thank you for the conversation today. It sounds like <strong>${esc(p.roleLabel)}</strong> is a great fit for you.</p>
       <p style="${P}">Next, three short questions so we understand your goals. It takes about 5 minutes.</p>
       ${questionBox(p.roleLabel, p.questions)}`,
      { label: 'Answer the 3 questions', url: p.url },
      `<p style="${SMALL}">This link works for 14 days. If it expires, open it anyway and we'll send you a fresh one.</p>`,
      { prospectId: p.prospectId },
    ),
  }
}

export function assessmentReminderEmail(p: AssessmentMailInput): Mail {
  return {
    subject: `${p.firstName}, your 3 questions are still waiting`,
    html: layout(
      `${parentLine(p.parentFirst, p.firstName)}
       <p style="${P}">Hi ${esc(p.firstName)}, a friendly nudge: your <strong>${esc(p.roleLabel)}</strong> questions take about 5 minutes, and they help us prepare your orientation.</p>
       ${questionBox(p.roleLabel, p.questions)}`,
      { label: 'Answer the 3 questions', url: p.url },
      '',
      { prospectId: p.prospectId },
    ),
  }
}
