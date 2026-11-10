/**
 * Email bodies for the Get Involved journey. Pure functions returning
 * { subject, html }; sending is done by the caller with sendEmail().
 * Every value that came from a person is escaped.
 */
import { formatCallTime } from './core'

import { type Seg, programParentLine, programWelcomeParts } from './program-welcome'

export function appUrl(path = ''): string {
  const base = (process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3001').replace(/\/+$/, '')
  return `${base}${path}`
}

export function esc(v: string | null | undefined): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Paragraph and small-print inline styles; use them in new templates so every email matches. */
export const P = 'color:#374151;font-size:15px;line-height:1.55;margin:0 0 14px'
export const SMALL = 'color:#6b7280;font-size:13px;line-height:1.5;margin:0 0 10px'

/**
 * The NowTransformed email frame: logo, card, optional button, sign-off and footer.
 * `body` is raw HTML: escape every user value in it with esc(). `cta` and `after` are escaped/raw the same way.
 */
export function layout(body: string, cta?: { label: string; url: string }, after = ''): string {
  return `
<div style="background:#f3f4f6;padding:24px 12px;font-family:Inter,Segoe UI,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;padding:28px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px">
      <span style="display:inline-block;width:36px;height:36px;line-height:36px;text-align:center;border-radius:9px;background:#0369a1;color:#fff;font-weight:700;font-size:14px">NT</span>
      <span style="font-weight:600;font-size:15px;color:#111827;margin-left:8px">NowTransformed</span>
    </div>
    ${body}
    ${cta ? `<a href="${esc(cta.url)}" style="display:inline-block;margin:6px 0 16px;padding:13px 22px;background:#0369a1;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px">${esc(cta.label)}</a>` : ''}
    ${after}
    <p style="${SMALL};border-top:1px solid #f3f4f6;padding-top:14px;margin-top:8px">With gratitude,<br>The NowTransformed team</p>
  </div>
  <p style="text-align:center;color:#6b7280;font-size:12px;margin:12px 0 0">Questions? Just reply to this email. NowTransformed · Building community, one person at a time.</p>
</div>`
}

export function callBox(when: Date, tz: string, withWhom: string, meetingUrl?: string | null): string {
  return `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px;margin:0 0 14px">
    <div style="font-weight:700;color:#111827;font-size:15px">${esc(formatCallTime(when, tz))}</div>
    <div style="${SMALL};margin:4px 0 0">Discovery call with ${esc(withWhom)} · 30 minutes${meetingUrl ? ` · <a href="${esc(meetingUrl)}" style="color:#0369a1">Join link</a>` : ''}</div>
  </div>`
}

export const parentNote = (parentFirst: string, childFirst: string) =>
  `<div style="background:#fff7ed;border:1px solid #fdba74;border-radius:12px;padding:12px 14px;margin:0 0 14px;color:#7c2d12;font-size:14px;line-height:1.5"><strong>${esc(parentFirst)}, please join ${esc(childFirst)} on this call.</strong> A parent or guardian must be there, so we can't hold the call without you.</div>`

export interface Mail { subject: string; html: string }

/** Render text segments from program-welcome.ts as escaped HTML. */
const segs = (s: Seg[]) => s.map((x) => (x.bold ? `<strong>${esc(x.text)}</strong>` : esc(x.text))).join('')

/**
 * Welcome email for 18 and over. With an approved program note (the person came in through a
 * program page's share link, or the inviter's latest program), it is about that program.
 */
export function welcomeEmail(p: { firstName: string; inviterName: string | null; bookUrl: string; program?: { name: string; note: string } | null }): Mail {
  if (p.program) {
    const w = programWelcomeParts({ firstName: p.firstName, inviterName: p.inviterName, programName: p.program.name, note: p.program.note })
    return { subject: w.subject, html: layout(w.paragraphs.map((x) => `<p style="${P}">${segs(x)}</p>`).join('\n'), { label: w.cta, url: p.bookUrl }) }
  }
  const by = p.inviterName ? `<strong>${esc(p.inviterName)}</strong> shared NowTransformed with you because they believe you'd add to this community.` : 'Thanks for your interest in NowTransformed.'
  return {
    subject: `Welcome, ${p.firstName}: your next step with NowTransformed`,
    html: layout(
      `<p style="${P}">Hi ${esc(p.firstName)}, ${by}</p>
       <p style="${P}">NowTransformed helps young people and adults grow, lead and build community. People get involved as coaches, mentors and service providers, ambassadors, volunteers, business affiliates and sponsors.</p>
       <p style="${P}">The first step is a free 30-minute discovery call, so we can learn your goals and show you where you'd fit.</p>`,
      { label: 'Book my discovery call', url: p.bookUrl },
    ),
  }
}

export function parentConsentEmail(p: { parentName: string; childFirst: string; inviterName: string | null; consentUrl: string; program?: { name: string; note: string } | null }): Mail {
  return {
    subject: `${p.childFirst} would like to join NowTransformed: your okay is needed`,
    html: layout(
      `<p style="${P}">Hi ${esc(p.parentName)},</p>
       <p style="${P}">${esc(p.childFirst)} filled out our Get Involved form${p.inviterName ? ` after hearing about us from <strong>${esc(p.inviterName)}</strong>` : ''}. Our youth ambassador program helps young people grow as leaders and give back to their community. It's free.</p>
       ${p.program ? `<p style="${P}">${segs(programParentLine(p.program.name, p.program.note))}</p>` : ''}
       <p style="${P}">Before we go any further, we need your consent. It takes about two minutes. <strong>A parent or guardian must also be on ${esc(p.childFirst)}'s discovery call</strong>, so please pick a time that works for you both.</p>`,
      { label: 'Review and give consent', url: p.consentUrl },
      `<p style="${SMALL}">If we don't hear from you within 14 days, we'll delete ${esc(p.childFirst)}'s details.</p>`,
    ),
  }
}

export function thanksAfterConsentEmail(p: { firstName: string; bookUrl: string }): Mail {
  return {
    subject: `Your parent said yes, ${p.firstName}! Book your call`,
    html: layout(
      `<p style="${P}">Hi ${esc(p.firstName)}, great news: your parent or guardian gave consent. Next, book your discovery call. They need to be on the call with you, so pick a time that works for both of you.</p>`,
      { label: 'Book my discovery call', url: p.bookUrl },
    ),
  }
}

interface CallMailBase {
  firstName: string
  startsAt: Date
  tz: string
  hostName: string
  meetingUrl: string | null
  manageUrl: string
  parent?: { first: string } | null
}

const manageLinks = (url: string) => `<p style="${SMALL}"><a href="${esc(url)}" style="color:#0369a1">Reschedule or cancel</a> (up to 2 hours before)</p>`

export function bookedEmail(p: CallMailBase): Mail {
  return {
    subject: `You're booked: discovery call on ${formatCallTime(p.startsAt, p.tz).split(' · ')[0]}`,
    html: layout(
      `${p.parent ? parentNote(p.parent.first, p.firstName) : ''}
       <p style="${P}">Hi ${esc(p.firstName)}, you're all set. We're looking forward to meeting you.</p>
       ${callBox(p.startsAt, p.tz, p.hostName, p.meetingUrl)}
       <p style="${P}"><strong>Before the call:</strong> think about what you'd love to grow in, and what you'd like to give. There are no wrong answers.</p>`,
      p.meetingUrl ? { label: 'Join the call', url: p.meetingUrl } : undefined,
      manageLinks(p.manageUrl),
    ),
  }
}

export function reminderEmail(p: CallMailBase & { soon: boolean }): Mail {
  return {
    subject: p.soon ? 'Starting soon: your NowTransformed discovery call' : 'Tomorrow: your NowTransformed discovery call',
    html: layout(
      `${p.parent ? parentNote(p.parent.first, p.firstName) : ''}
       <p style="${P}">Hi ${esc(p.firstName)}, a quick reminder about your call.</p>
       ${callBox(p.startsAt, p.tz, p.hostName, p.meetingUrl)}`,
      p.meetingUrl ? { label: 'Join the call', url: p.meetingUrl } : undefined,
      p.soon ? '' : manageLinks(p.manageUrl),
    ),
  }
}

export function rescheduledEmail(p: CallMailBase & { oldStartsAt: Date }): Mail {
  return {
    subject: `Your call has moved to ${formatCallTime(p.startsAt, p.tz)}`,
    html: layout(
      `${p.parent ? parentNote(p.parent.first, p.firstName) : ''}
       <p style="${P}">Hi ${esc(p.firstName)}, your discovery call has a new time.</p>
       <p style="${SMALL};text-decoration:line-through">${esc(formatCallTime(p.oldStartsAt, p.tz))}</p>
       ${callBox(p.startsAt, p.tz, p.hostName, p.meetingUrl)}`,
      p.meetingUrl ? { label: 'Join the call', url: p.meetingUrl } : undefined,
      manageLinks(p.manageUrl),
    ),
  }
}

export function cancelledEmail(p: { firstName: string; startsAt: Date; tz: string; bookUrl: string; byHost: boolean; noParent?: boolean }): Mail {
  const lead = p.noParent
    ? `We need a parent or guardian on the call, so we've moved yours off the calendar. Let's find a time that works for you both.`
    : p.byHost
      ? `We're sorry: we had to cancel your call on <strong>${esc(formatCallTime(p.startsAt, p.tz))}</strong>. Please pick a new time below.`
      : `Your call on <strong>${esc(formatCallTime(p.startsAt, p.tz))}</strong> is cancelled. No problem at all: life happens. Whenever you're ready, pick a new time. Your place in the community is still here.`
  return {
    subject: 'Your discovery call is cancelled',
    html: layout(`<p style="${P}">Hi ${esc(p.firstName)}, ${lead}</p>`, { label: 'Book a new time', url: p.bookUrl }),
  }
}

export function noShowEmail(p: { firstName: string; bookUrl: string }): Mail {
  return {
    subject: 'We missed you today. Want to pick a new time?',
    html: layout(
      `<p style="${P}">Hi ${esc(p.firstName)}, we were sorry to miss you on today's call. We know schedules get busy.</p>
       <p style="${P}">If you're still interested, pick a new time below. It only takes a minute.</p>`,
      { label: 'Pick a new time', url: p.bookUrl },
    ),
  }
}

export function continueLinkEmail(p: { firstName: string; url: string }): Mail {
  return {
    subject: 'Your link to continue with NowTransformed',
    html: layout(`<p style="${P}">Hi ${esc(p.firstName)}, here's a fresh link to pick up where you left off.</p>`, { label: 'Continue', url: p.url },
      `<p style="${SMALL}">If you didn't ask for this, you can ignore this email.</p>`),
  }
}

// ---- to the inviter and host ----

export function inviterNewLeadEmail(p: { inviterFirst: string; prospectName: string; ageLabel: string; city: string | null; minor: boolean; streak: number; dashUrl: string }): Mail {
  return {
    subject: `${p.prospectName} just filled out your Get Involved form`,
    html: layout(
      `<p style="${P}">Nice work, ${esc(p.inviterFirst)}. That's your <strong>One-A-Day</strong> for today.</p>
       <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px;margin:0 0 14px"><div style="font-weight:700;color:#111827">${esc(p.prospectName)}</div><div style="${SMALL};margin:4px 0 0">Age range ${esc(p.ageLabel)}${p.city ? ` · ${esc(p.city)}` : ''}</div></div>
       <p style="${P}">${p.minor ? "They're 17 or under, so we've emailed their parent for consent first." : "We've sent them the welcome email and a link to book a discovery call."} A quick personal message from you helps a lot.</p>
       <p style="${SMALL}">Your streak: ${p.streak} day${p.streak === 1 ? '' : 's'}.</p>`,
      { label: 'See them on my dashboard', url: p.dashUrl },
    ),
  }
}

export function inviterCallUpdateEmail(p: { inviterFirst: string; prospectName: string; what: string; dashUrl: string }): Mail {
  return {
    subject: `${p.prospectName}: ${p.what}`,
    html: layout(`<p style="${P}">Hi ${esc(p.inviterFirst)}, an update on someone you invited: <strong>${esc(p.prospectName)}</strong> ${esc(p.what)}.</p>`, { label: 'Open my dashboard', url: p.dashUrl }),
  }
}

export function hostCallEmail(p: {
  kind: 'new' | 'moved' | 'cancelled'
  hostName: string
  prospectName: string
  startsAt: Date
  oldStartsAt?: Date
  ageLabel: string
  inviterName: string | null
  phone: string | null
  parent: { name: string; email: string; phone: string | null } | null
  callsUrl: string
  /** The host's own time zone (DiscoveryHost.timezone). */
  tz?: string | null
}): Mail {
  const tz = p.tz || 'America/Chicago'
  const head = p.kind === 'new' ? 'A new discovery call is on your calendar.' : p.kind === 'moved' ? 'A discovery call has moved.' : 'A discovery call was cancelled.'
  const subj = p.kind === 'new' ? 'New discovery call' : p.kind === 'moved' ? 'Discovery call moved' : 'Discovery call cancelled'
  return {
    subject: `${subj}: ${p.prospectName}, ${formatCallTime(p.startsAt, tz)}`,
    html: layout(
      `<p style="${P}">Hi ${esc(p.hostName)}, ${head}</p>
       ${p.oldStartsAt ? `<p style="${SMALL};text-decoration:line-through">${esc(formatCallTime(p.oldStartsAt, tz))}</p>` : ''}
       ${callBox(p.startsAt, tz, p.prospectName, null)}
       <p style="${SMALL}">Age range: <strong>${esc(p.ageLabel)}</strong>${p.inviterName ? ` · Invited by <strong>${esc(p.inviterName)}</strong>` : ''}${p.phone ? ` · Phone ${esc(p.phone)}` : ''}</p>
       ${p.parent ? `<div style="background:#fff7ed;border:1px solid #fdba74;border-radius:12px;padding:12px 14px;margin:0 0 14px;color:#7c2d12;font-size:14px;line-height:1.5"><strong>Parent must be on the call. Don't start without them.</strong><br>${esc(p.parent.name)} · ${esc(p.parent.email)}${p.parent.phone ? ` · ${esc(p.parent.phone)}` : ''}</div>` : ''}`,
      { label: 'Open Discovery Calls', url: p.callsUrl },
    ),
  }
}

// ---- phase 2/3 (more templates live in ./emails/) ----

/** E9: the interviewer marked "Not a fit". `eventsUrl` null = no button. */
export function notAFitEmail(p: { firstName: string; eventsUrl: string | null }): Mail {
  return {
    subject: 'Thank you for talking with us',
    html: layout(
      `<p style="${P}">Hi ${esc(p.firstName)}, thank you for taking the time to talk with us. After our conversation, we don't think any of our roles is the right fit right now.</p>
       <p style="${P}">That can change. You're always welcome at our free community events, and you can reach out any time if your situation changes.</p>`,
      p.eventsUrl ? { label: 'See upcoming community events', url: p.eventsUrl } : undefined,
    ),
  }
}
