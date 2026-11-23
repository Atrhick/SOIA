/** Pure rules and the email for message notices (tested in notify-message-core.test.ts). */
import { P, SMALL, esc, layout } from '@/lib/get-involved/emails'

/** A message still unread this long gets one email (the cron runs every 15 minutes, so 10 to 25 minutes). */
export const UNREAD_EMAIL_AFTER_MS = 10 * 60 * 1000
/** Never email about notices older than this (e.g. after emails were off, or the first run after a deploy). */
export const EMAIL_LOOKBACK_MS = 2 * 24 * 60 * 60 * 1000
const MAX_LISTED = 5

/** Where each role reads their direct messages. */
export function messagesPathFor(role: string): string {
  switch (role) {
    case 'ADMIN': return '/admin/collaboration/messages'
    case 'COACH': return '/coach/collaboration/messages'
    case 'AMBASSADOR': return '/ambassador/collaboration/messages'
    case 'PARENT': return '/parent/messages'
    default: return '/'
  }
}

/** Plain text for the notice: @mentions shown as names, spaces tidied, cut to 160 letters. */
export function messagePreview(content: string, max = 160): string {
  const text = content.replace(/@\[([^\]]+)\]\(user:[^)]+\)/g, '@$1').replace(/\s+/g, ' ').trim()
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`
}

/** The "you have unread messages" email: one per person per cron run, listing up to 5 conversations. */
export function unreadMessagesEmail(p: { first: string; items: { title: string; preview: string }[]; openUrl: string }): { subject: string; html: string } {
  const n = p.items.length
  const subject = n === 1 ? p.items[0].title.replace(/^New message/, 'Unread message') : `You have unread messages in ${n} conversations`
  const shown = p.items.slice(0, MAX_LISTED)
  const list = shown.map((i) =>
    `<div style="margin:0 0 12px;padding:12px 16px;border-left:4px solid #0369a1;background:#f0f9ff">` +
    `<p style="margin:0 0 4px;font-weight:600;color:#111827;font-size:15px">${esc(i.title)}</p>` +
    `<p style="margin:0;color:#374151;font-size:15px;line-height:1.55">${esc(i.preview)}</p></div>`).join('')
  const more = n > MAX_LISTED ? `<p style="${SMALL}">And ${n - MAX_LISTED} more.</p>` : ''
  const body =
    `<p style="${P}">Hi ${esc(p.first || 'there')},</p>` +
    `<p style="${P}">${n === 1 ? 'A message is' : 'Messages are'} waiting for you in the NowTransformed back office:</p>` + list + more
  const after =
    `<p style="${SMALL}">We only email when a message has been unread for a few minutes. ` +
    `To stop these emails, open the back office, tap your name at the top right and choose &ldquo;Emails about unread messages: On&rdquo; to turn them off.</p>`
  return { subject, html: layout(body, { label: n === 1 ? 'Open the message' : 'Open my messages', url: p.openUrl }, after, { audience: 'team' }) }
}
