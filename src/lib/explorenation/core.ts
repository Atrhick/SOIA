/**
 * ExploreNation founding-rate codes: the pure parts (signing, parsing, email). No database, no network.
 *
 * Contract (agreed with the ExploreNation session, 2026-11-16):
 * - Every request in either direction carries X-NT-Timestamp (unix seconds) and
 *   X-NT-Signature = hex HMAC-SHA256(secret, `${ts}.${METHOD}.${path}.${rawBody}`), path without query string.
 * - Rejected when the clock is more than 5 minutes off or the signature doesn't match (constant-time).
 * - POST /wp-json/en-nt/v1/codes {requestId, business, requestedBy} -> 201 {code, status, expiresAt}
 *   (same requestId returns the same code), GET /codes/{code}, POST /codes/{code}/revoke (409 when used).
 * - Webhook to us: POST /api/webhooks/explorenation {event, code, requestId, status, package, at}.
 */
import { createHmac, timingSafeEqual } from 'crypto'

export const MAX_SKEW_SECONDS = 300
export const CODE_RE = /^EN-FR-[A-HJ-KM-NP-Z2-9]{4}-[A-HJ-KM-NP-Z2-9]{4}$/
export const API_PREFIX = '/wp-json/en-nt/v1'
export const WEBHOOK_PATH = '/api/webhooks/explorenation'

export type CodeStatus = 'REQUESTED' | 'SENT' | 'HELD' | 'USED' | 'EXPIRED' | 'REVOKED'
const STATUS_MAP: Record<string, CodeStatus> = { sent: 'SENT', held: 'HELD', used: 'USED', expired: 'EXPIRED', revoked: 'REVOKED' }

export function signature(secret: string, ts: number | string, method: string, path: string, rawBody: string): string {
  return createHmac('sha256', secret).update(`${ts}.${method.toUpperCase()}.${path}.${rawBody}`).digest('hex')
}

export function signedHeaders(secret: string, method: string, path: string, rawBody: string, nowSeconds: number): Record<string, string> {
  return { 'X-NT-Timestamp': String(nowSeconds), 'X-NT-Signature': signature(secret, nowSeconds, method, path, rawBody) }
}

/** True only for a fresh, correctly signed request. */
export function verifySignature(
  secret: string, tsHeader: string | null, sigHeader: string | null, method: string, path: string, rawBody: string, nowSeconds: number,
): boolean {
  if (!secret || !tsHeader || !sigHeader || !/^\d{1,12}$/.test(tsHeader) || !/^[0-9a-f]{64}$/i.test(sigHeader)) return false
  if (Math.abs(nowSeconds - Number(tsHeader)) > MAX_SKEW_SECONDS) return false
  const want = Buffer.from(signature(secret, tsHeader, method, path, rawBody), 'hex')
  const got = Buffer.from(sigHeader.toLowerCase(), 'hex')
  return want.length === got.length && timingSafeEqual(want, got)
}

export function mapStatus(s: unknown): CodeStatus | null {
  return typeof s === 'string' ? STATUS_MAP[s.toLowerCase()] ?? null : null
}

/**
 * Whether a webhook may move a code from `from` to `to`. Used and revoked are final; nothing goes back to
 * "sent"; a late "held" can't undo "expired"/"used" (webhooks can arrive out of order).
 */
export function canMove(from: CodeStatus, to: CodeStatus): boolean {
  if (from === to) return false
  if (from === 'USED' || from === 'REVOKED') return false
  if (to === 'SENT' || to === 'REQUESTED') return false
  if (from === 'EXPIRED') return false
  return true
}

export interface WebhookEvent { code: string | null; requestId: string | null; status: CodeStatus; package: string | null; at: Date }

export function parseWebhook(rawBody: string): WebhookEvent | null {
  let j: unknown
  try { j = JSON.parse(rawBody) } catch { return null }
  if (!j || typeof j !== 'object') return null
  const o = j as Record<string, unknown>
  const status = mapStatus(o.status) ?? (typeof o.event === 'string' ? mapStatus(o.event.replace(/^code\./, '')) : null)
  if (!status) return null
  const code = typeof o.code === 'string' && CODE_RE.test(o.code.trim().toUpperCase()) ? o.code.trim().toUpperCase() : null
  const requestId = typeof o.requestId === 'string' && o.requestId.length <= 100 ? o.requestId : null
  if (!code && !requestId) return null
  const at = typeof o.at === 'string' && !Number.isNaN(Date.parse(o.at)) ? new Date(o.at) : new Date()
  const pkg = typeof o.package === 'string' ? o.package.slice(0, 120) : null
  return { code, requestId, status, package: pkg, at }
}

/** Plain words for the call record. */
export function statusLabel(s: string): string {
  switch (s) {
    case 'REQUESTED': return 'Requested from ExploreNation'
    case 'SENT': return 'Not used yet'
    case 'HELD': return 'Entered on an ExploreNation form; founding rate held'
    case 'USED': return 'Used: sponsorship booked'
    case 'EXPIRED': return 'Expired'
    case 'REVOKED': return 'Cancelled'
    default: return s
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

export function longDate(d: Date): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' }).format(d)
}

/** "Wednesday, December 16, 2026" (Las Vegas time). */
export function fullDate(d: Date): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' }).format(d)
}

/** The email the business gets with its code. `siteUrl` is ExploreNation's public address, if known. */
export function codeEmail(o: { firstName: string; code: string; expiresAt: Date | null; hostName: string; siteUrl: string | null }) {
  const first = esc(o.firstName.trim() || 'there')
  const code = esc(o.code)
  const where = o.siteUrl
    ? `<a href="${esc(o.siteUrl)}" style="color:#0369a1">ExploreNation&#39;s Advertise page</a>`
    : 'ExploreNation&#39;s Advertise page'
  const by = o.expiresAt
    ? `<p style="margin:0 0 16px">Send your form by <strong>${esc(fullDate(o.expiresAt))}</strong>. After that, the code stops working. It works one time, and only for your business, so please don&#39;t share it.</p>`
    : '<p style="margin:0 0 16px">It works one time, and only for your business, so please don&#39;t share it.</p>'
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#0f172a;max-width:560px">
<p style="margin:0 0 16px">Hi ${first},</p>
<p style="margin:0 0 16px">Thanks for talking with us. You qualify for a NowTRANSFORMED sponsorship. That means you can get ExploreNation&#39;s founding rate, a lower price that only people with a code can get.</p>
<p style="margin:0 0 6px">Your code (copy and paste it so it&#39;s exact):</p>
<p style="margin:0 0 20px;font-family:Consolas,Menlo,monospace;font-size:24px;font-weight:700;letter-spacing:.06em;background:#f0f7fb;border:1px solid #bae6fd;border-radius:10px;padding:14px 18px;display:inline-block">${code}</p>
<p style="margin:0 0 8px"><strong>How to use it</strong></p>
<ol style="margin:0 0 16px;padding-left:22px">
<li>Go to ${where} and pick the package you want.</li>
<li>In the enquiry form, paste your code in the box called <strong>Founding-rate code (optional)</strong>. The price changes to your founding rate. If it doesn&#39;t, check the code or reply to this email.</li>
<li>Send the form. You don&#39;t pay anything yet. ExploreNation saves your founding rate for 14 days and emails you a link to pay.</li>
</ol>
${by}
<p style="margin:0 0 16px">Questions? Just reply to this email.</p>
<p style="margin:0">${esc(o.hostName)}<br>NowTRANSFORMED</p>
</div>`
  return { subject: 'Your ExploreNation founding-rate code', html }
}
