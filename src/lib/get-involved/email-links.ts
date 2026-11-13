/**
 * Signed one-tap links in Get Involved emails (outreach round 1): stop emails, delete my details,
 * confirm attendance, "maybe later", "ask us to call you".
 *
 * A token is `<action>.<id>.<sig>` where sig = HMAC-SHA256(NEXTAUTH_SECRET, "gi-email:v1:<action>:<id>"),
 * base64url, first 32 chars. Tokens never expire: they are revoked by STATE instead (a deleted prospect,
 * a cancelled or past call, an opt-out already recorded...). The action page under /email/[token]
 * always asks for a button press (POST via a server action), so link scanners that GET every URL in
 * an email never trigger anything.
 *
 * No secret configured = no links (emailActionPath returns null and the footer leaves them out).
 * Pure apart from crypto; safe to import from email templates and tests.
 */
import crypto from 'crypto'

/** `istop` = "Stop" in an "Email them for me" invitation; its id is the OutreachInvite id. */
export const EMAIL_ACTIONS = ['stop', 'delete', 'confirm', 'later', 'callme', 'istop'] as const
export type EmailAction = (typeof EMAIL_ACTIONS)[number]

/** Which id each action carries: a call id for `confirm`, an invitation id for `istop`, a prospect id for the rest. */
export const actionTarget = (a: EmailAction): 'call' | 'prospect' | 'invite' => (a === 'confirm' ? 'call' : a === 'istop' ? 'invite' : 'prospect')

const ID_RE = /^[A-Za-z0-9_-]{8,64}$/

function secret(): string | null {
  const s = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || ''
  return s.length >= 16 ? s : null
}

function sig(action: EmailAction, id: string, key: string): string {
  return crypto.createHmac('sha256', key).update(`gi-email:v1:${action}:${id}`).digest('base64url').slice(0, 32)
}

/** Token for an action on a prospect (or call, for `confirm`). null when no secret is configured or the id is odd. */
export function signEmailToken(action: EmailAction, id: string): string | null {
  const key = secret()
  if (!key || !ID_RE.test(id)) return null
  return `${action}.${id}.${sig(action, id, key)}`
}

/** Verify a token from a URL. Returns the action and id, or null for anything malformed or forged. */
export function verifyEmailToken(token: string | null | undefined): { action: EmailAction; id: string } | null {
  const key = secret()
  if (!key || !token || token.length > 160) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [action, id, given] = parts
  if (!(EMAIL_ACTIONS as readonly string[]).includes(action) || !ID_RE.test(id)) return null
  const want = sig(action as EmailAction, id, key)
  const a = Buffer.from(given), b = Buffer.from(want)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  return { action: action as EmailAction, id }
}

/** Relative path of the action page (`/email/<token>`), or null when links are off. Make it absolute with appUrl(). */
export function emailActionPath(action: EmailAction, id: string | null | undefined): string | null {
  if (!id) return null
  const t = signEmailToken(action, id)
  return t ? `/email/${t}` : null
}
