/**
 * "Email them for me" (One-A-Day v2): the invitation a member asks us to send to someone they know.
 * Pure: the words come from buildInviteText() (outreach-invites.ts), which the Invite page also uses for
 * its live preview, so what the member sees is what is sent.
 *
 * Its own frame rather than layout(): layout()'s footer says "you asked about a NowTransformed program"
 * and "reply to this email", neither of which is true for an invitation sent from a no-reply address.
 * Footer (US commercial email rules): who sent it and why, our mailing address, and a Stop link
 * (/email/<istop token>, needs a button press) that adds the address to EmailSuppression.
 */
import { P, SMALL, appUrl, button, emailFooterAddress, esc, type Mail } from '../emails'
import { emailActionPath } from '../email-links'
import type { InviteText } from '../outreach-invites'

export function inviteEmail(p: { text: InviteText; joinUrl: string; inviteId: string; senderFirst: string; photoUrl: string | null }): Mail {
  const { text } = p
  const addr = emailFooterAddress()
  const stop = emailActionPath('istop', p.inviteId)
  const line = 'text-align:center;color:#6b7280;font-size:12px;line-height:1.6;margin:4px 0 0'
  const photo = p.photoUrl
    ? `<img src="${esc(p.photoUrl)}" width="48" height="48" alt="" style="display:block;width:48px;height:48px;border-radius:24px;object-fit:cover;border:0" />`
    : `<div style="width:48px;height:48px;border-radius:24px;background:#e0f2fe;color:#0369a1;font-weight:700;font-size:20px;line-height:48px;text-align:center">${esc((p.senderFirst?.[0] || '?').toUpperCase())}</div>`
  const html = `
<div style="background:#f3f4f6;padding:24px 12px;font-family:Inter,Segoe UI,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;padding:28px">
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px"><tr>
      <td style="padding-right:12px;vertical-align:middle">${photo}</td>
      <td style="vertical-align:middle"><div style="font-weight:700;color:#111827;font-size:16px">${esc(text.from)}</div><div style="${SMALL};margin:0">sent you this through NowTransformed</div></td>
    </tr></table>
    ${text.paragraphs.map((x) => `<p style="${P}">${esc(x)}</p>`).join('\n    ')}
    ${button({ label: text.button, url: p.joinUrl })}
    <p style="${SMALL}">The call is free and there's no obligation.</p>
  </div>
  <p style="${line};margin-top:12px">${esc(text.from)} asked us to send you this invitation because they know you.</p>
  <p style="${line}">NowTransformed${addr ? ` · ${esc(addr)}` : ''}</p>
  ${stop ? `<p style="${line}"><a href="${esc(appUrl(stop))}" style="color:#6b7280">Don't send me invitations like this</a></p>` : ''}
</div>`
  return { subject: text.subject, html }
}
