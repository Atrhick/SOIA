/** E11 "Your login is ready" and the inviter's "joined your team" note. See ./index.ts for the rules. */
import { Mail, P, SMALL, esc, layout } from '../emails'

export function accountReadyEmail(p: {
  firstName: string
  roleLabel: string
  email: string
  signInUrl: string
  /** e.g. "Coach program, $99.00 (one time) · Nov 14, 2026"; null for free roles. */
  receipt: string | null
}): Mail {
  return {
    subject: `Welcome to the NowTransformed team, ${p.firstName}`,
    html: layout(
      `<p style="${P}">Hi ${esc(p.firstName)}, you're officially a NowTransformed <strong>${esc(p.roleLabel)}</strong>. Welcome to the community.</p>
       <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px;margin:0 0 14px">
         <div style="color:#111827;font-size:14px">Sign in with <strong>${esc(p.email)}</strong></div>
         ${p.receipt ? `<div style="${SMALL};margin:6px 0 0">Receipt: ${esc(p.receipt)}</div>` : ''}
       </div>
       <p style="${P}">Your first step: share your own Get Involved link with one person today. That's One-A-Day.</p>`,
      { label: 'Sign in', url: p.signInUrl },
    ),
  }
}

export function inviterJoinedEmail(p: { inviterFirst: string; prospectName: string; roleLabel: string; teamUrl: string }): Mail {
  return {
    subject: `${p.prospectName} joined your team`,
    html: layout(
      `<p style="${P}">Great news, ${esc(p.inviterFirst)}: <strong>${esc(p.prospectName)}</strong> just joined NowTransformed as a ${esc(p.roleLabel)}. They're on your team now, and it counts on the One-A-Day leaderboard.</p>
       <p style="${P}">A quick welcome from you means a lot in the first week.</p>`,
      { label: 'See my team', url: p.teamUrl },
    ),
  }
}
