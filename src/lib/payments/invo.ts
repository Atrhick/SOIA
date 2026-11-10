/**
 * Invo platform commerce client (https://docs.invo.network). Server only, NOT 'use server':
 * nothing here may be callable from the browser, and the secret key never leaves the server.
 *
 * - One-time card sale: POST {base}/api/platform-commerce/purchase -> hosted checkout_url (single use,
 *   expires in about 15 minutes), so a fresh one is created every time the prospect clicks Pay.
 * - Fulfilment happens only on the signed `platform_commerce.purchased` webhook (src/app/api/webhooks/invo).
 * - Keys: ivsdk_test_... -> sandbox (https://sandbox.invo.network/sandbox, the /sandbox prefix is
 *   required); ivsdk_live_... -> https://invo.network. INVO_API_BASE overrides the base URL.
 */
import crypto from 'crypto'

export const INVO_SANDBOX_BASE = 'https://sandbox.invo.network/sandbox'
export const INVO_LIVE_BASE = 'https://invo.network'
/** Invo rejects card sales below this (from 2026-10-27). */
export const INVO_CARD_MINIMUM_CENTS = 299
/** Signed webhooks older or newer than this are rejected. */
export const INVO_SIGNATURE_TOLERANCE_SECONDS = 300

export type InvoMode = 'test' | 'live'

export interface InvoConfig {
  secretKey: string
  webhookSecret: string
  mode: InvoMode
  baseUrl: string
}

/** 'test' for ivsdk_test_ keys, 'live' for ivsdk_live_ keys, null for anything else. */
export function invoModeForKey(key: string | null | undefined): InvoMode | null {
  const k = key?.trim() ?? ''
  if (k.startsWith('ivsdk_test_')) return 'test'
  if (k.startsWith('ivsdk_live_')) return 'live'
  return null
}

/** API base for a key: sandbox for test keys, production for live keys; an override wins. null = unknown key. */
export function invoBaseUrl(key: string | null | undefined, override?: string | null): string | null {
  const o = override?.trim()
  if (o) return o.replace(/\/+$/, '')
  const mode = invoModeForKey(key)
  if (mode === 'test') return INVO_SANDBOX_BASE
  if (mode === 'live') return INVO_LIVE_BASE
  return null
}

/**
 * Invo settings from the environment, or null unless BOTH INVO_SECRET_KEY (a recognised ivsdk_test_ or
 * ivsdk_live_ key) and INVO_WEBHOOK_SECRET are set. Without the webhook secret a payment could never be
 * confirmed, so online payment stays off.
 */
export function invoConfig(env: Record<string, string | undefined> = process.env): InvoConfig | null {
  const secretKey = env.INVO_SECRET_KEY?.trim() ?? ''
  const webhookSecret = env.INVO_WEBHOOK_SECRET?.trim() ?? ''
  const mode = invoModeForKey(secretKey)
  const baseUrl = invoBaseUrl(secretKey, env.INVO_API_BASE)
  if (!secretKey || !webhookSecret || !mode || !baseUrl) return null
  return { secretKey, webhookSecret, mode, baseUrl }
}

/** What the admin payments page shows (never the secrets themselves). */
export function invoEnvStatus(env: Record<string, string | undefined> = process.env) {
  const key = env.INVO_SECRET_KEY?.trim() ?? ''
  return {
    keySet: !!key,
    mode: invoModeForKey(key),
    webhookSecretSet: !!env.INVO_WEBHOOK_SECRET?.trim(),
    baseOverride: env.INVO_API_BASE?.trim() || null,
    enabled: invoConfig(env) !== null,
  }
}

/** 9900 -> "99.00" (Invo wants decimal strings with two places). */
export function centsToUsd(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0) throw new Error('Amount must be a whole number of cents')
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
}

/** "99.00" / "99" / 99 -> 9900. null when it isn't a money amount. */
export function usdToCents(v: unknown): number | null {
  const s = typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim() : ''
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null
  const [whole, frac = ''] = s.split('.')
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'))
}

// ---------- purchase ----------

export interface PurchaseInput {
  clientRequestId: string
  email: string
  name: string
  itemId: string
  itemName: string
  itemDescription?: string
  amountCents: number
  successUrl: string
  cancelUrl: string
  metadata: Record<string, string>
}

export interface PurchaseSession {
  sessionId: string
  checkoutUrl: string
  /** Unix seconds, when Invo sent it. */
  expiresAt: number | null
  amountUsd: string | null
}

/** The JSON body for POST /api/platform-commerce/purchase (card, one item, no coins). */
export function buildPurchaseBody(input: PurchaseInput) {
  const price = centsToUsd(input.amountCents)
  return {
    client_request_id: input.clientRequestId,
    funding_source: 'card' as const,
    player_email: input.email,
    player_name: input.name.slice(0, 255),
    item_id: input.itemId.slice(0, 255),
    item_name: input.itemName.slice(0, 255),
    ...(input.itemDescription ? { item_description: input.itemDescription } : {}),
    item_quantity: 1,
    unit_price: price,
    total_price: price,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    metadata: input.metadata,
  }
}

/** A new idempotency key per checkout attempt. Invo reserves the `sub_` prefix. */
export function newClientRequestId(paymentId: string): string {
  return `nt_${paymentId}_${crypto.randomBytes(8).toString('hex')}`
}

export type InvoErrorKind = 'NOT_CONFIGURED' | 'NETWORK' | 'UNAVAILABLE' | 'AUTH' | 'NOT_PLATFORM' | 'AMOUNT' | 'DUPLICATE' | 'RATE_LIMITED' | 'INVALID' | 'BAD_RESPONSE'

/** Messages safe to show a prospect. Details go to the server log only. */
const SAFE_MESSAGES: Record<InvoErrorKind, string> = {
  NOT_CONFIGURED: 'Online payment is not available right now. Our team will contact you about payment.',
  NETWORK: 'We could not reach the payment service. Please try again in a minute.',
  UNAVAILABLE: 'The payment service is busy right now. Please try again in a few minutes.',
  AUTH: 'Online payment is not available right now. Our team has been told and will contact you about payment.',
  NOT_PLATFORM: 'Online payment is not available right now. Our team has been told and will contact you about payment.',
  AMOUNT: 'This amount cannot be paid by card online. Our team will contact you about payment.',
  DUPLICATE: 'A payment for this is already in progress. Please wait a minute and reload the page.',
  RATE_LIMITED: 'Too many payment attempts. Please wait a minute and try again.',
  INVALID: 'We could not start the payment. Please try again, or wait and our team will contact you.',
  BAD_RESPONSE: 'We could not start the payment. Please try again in a minute.',
}

export class InvoError extends Error {
  readonly kind: InvoErrorKind
  readonly httpStatus: number | null
  readonly code: string | null
  readonly safeMessage: string
  constructor(kind: InvoErrorKind, detail: string, httpStatus: number | null = null, code: string | null = null) {
    super(`Invo ${kind}${httpStatus ? ` (${httpStatus})` : ''}${code ? ` ${code}` : ''}: ${detail}`)
    this.name = 'InvoError'
    this.kind = kind
    this.httpStatus = httpStatus
    this.code = code
    this.safeMessage = SAFE_MESSAGES[kind]
  }
}

/** Map an Invo error response to a kind. Matches on `error_code_public`, `error_code`, `code` and `error`. */
export function classifyInvoError(status: number, body: unknown): InvoError {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const code = [b.error_code_public, b.error_code, b.code, b.error].find((x): x is string => typeof x === 'string') ?? null
  const msg = typeof b.message === 'string' ? b.message : typeof b.error === 'string' ? b.error : 'no message'
  let kind: InvoErrorKind
  if (status === 401) kind = 'AUTH'
  else if (status === 403) kind = code === 'NOT_A_PLATFORM_TENANT' ? 'NOT_PLATFORM' : 'AUTH'
  else if (status === 409) kind = 'DUPLICATE'
  else if (status === 429) kind = 'RATE_LIMITED'
  else if (status >= 500) kind = 'UNAVAILABLE'
  else if (code && /MINIMUM|MAXIMUM/.test(code)) kind = 'AMOUNT'
  else kind = 'INVALID'
  return new InvoError(kind, msg, status, code)
}

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{ status: number; text(): Promise<string> }>

/**
 * Create a hosted card checkout. Times out after `timeoutMs`; on a network error, timeout or 5xx it
 * retries ONCE with the same client_request_id (Invo replays the same session). Throws InvoError.
 */
export async function createPlatformPurchase(
  cfg: Pick<InvoConfig, 'secretKey' | 'baseUrl'>,
  input: PurchaseInput,
  opts: { fetchImpl?: FetchLike; timeoutMs?: number } = {},
): Promise<PurchaseSession> {
  if (input.amountCents < INVO_CARD_MINIMUM_CENTS) throw new InvoError('AMOUNT', `amount ${input.amountCents} below card minimum`)
  const doFetch: FetchLike = opts.fetchImpl ?? ((url, init) => fetch(url, init))
  const body = JSON.stringify(buildPurchaseBody(input))
  const url = `${cfg.baseUrl}/api/platform-commerce/purchase`

  let last: InvoError | null = null
  for (let attempt = 0; attempt < 2; attempt++) {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), opts.timeoutMs ?? 10_000)
    let res: { status: number; text(): Promise<string> }
    let text: string
    try {
      res = await doFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Game-Secret-Key': cfg.secretKey },
        body,
        signal: ac.signal,
      })
      text = await res.text()
    } catch (e) {
      last = new InvoError('NETWORK', e instanceof Error ? e.message : String(e))
      continue
    } finally {
      clearTimeout(timer)
    }
    let json: unknown = null
    try { json = text ? JSON.parse(text) : null } catch { json = null }
    if (res.status >= 500) { last = classifyInvoError(res.status, json); continue }
    if (res.status !== 200) throw classifyInvoError(res.status, json)
    const j = (json ?? {}) as Record<string, unknown>
    const checkoutUrl = typeof j.checkout_url === 'string' ? j.checkout_url : ''
    const sessionId = typeof j.session_id === 'string' || typeof j.session_id === 'number' ? String(j.session_id) : ''
    if (!/^https:\/\//.test(checkoutUrl) || !sessionId) throw new InvoError('BAD_RESPONSE', `unexpected purchase response: ${text.slice(0, 200)}`, res.status)
    return {
      sessionId,
      checkoutUrl,
      expiresAt: typeof j.expires_at === 'number' ? j.expires_at : null,
      amountUsd: typeof j.amount_usd === 'string' ? j.amount_usd : null,
    }
  }
  throw last ?? new InvoError('NETWORK', 'no response')
}

// ---------- webhook signature ----------

/**
 * Check `X-Invo-Signature: t=<unix>,v1=<hex>[,v1=<hex>...]`. The signature is hex HMAC-SHA256 over
 * `${t}.${rawBody}`, keyed with the FULL secret including its `whsec_` prefix. Any v1 may match
 * (several are sent while a secret rotates). Rejects timestamps more than 300 s from `nowSeconds`.
 * Pure: pass the raw request text exactly as received.
 */
export function verifyInvoSignature(rawBody: string, header: string | null | undefined, secret: string, nowSeconds: number, toleranceSeconds = INVO_SIGNATURE_TOLERANCE_SECONDS): boolean {
  if (!header || !secret) return false
  let t: number | null = null
  const sigs: string[] = []
  for (const part of header.split(',')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    const k = part.slice(0, i).trim()
    const v = part.slice(i + 1).trim()
    if (k === 't' && /^\d+$/.test(v)) t = Number(v)
    else if (k === 'v1' && /^[0-9a-fA-F]+$/.test(v)) sigs.push(v.toLowerCase())
  }
  if (t === null || sigs.length === 0) return false
  if (Math.abs(nowSeconds - t) > toleranceSeconds) return false
  const expected = Buffer.from(crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`, 'utf8').digest('hex'), 'utf8')
  let ok = false
  for (const s of sigs) {
    const got = Buffer.from(s, 'utf8')
    if (got.length === expected.length && crypto.timingSafeEqual(got, expected)) ok = true
  }
  return ok
}
