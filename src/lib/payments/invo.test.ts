import crypto from 'crypto'
import { describe, expect, it, vi } from 'vitest'
import {
  INVO_LIVE_BASE, INVO_SANDBOX_BASE, InvoError, buildPurchaseBody, centsToUsd, classifyInvoError, createPlatformPurchase,
  invoBaseUrl, invoConfig, invoModeForKey, newClientRequestId, usdToCents, verifyInvoSignature,
} from './invo'

const SECRET = 'whsec_test_abc123'
const sign = (body: string, t: number, secret = SECRET) => crypto.createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')

describe('verifyInvoSignature', () => {
  const body = '{"event_type":"platform_commerce.purchased","data":{"order_id":1}}'
  const now = 1_800_000_000

  it('accepts a valid signature keyed with the full whsec_ secret', () => {
    expect(verifyInvoSignature(body, `t=${now},v1=${sign(body, now)}`, SECRET, now)).toBe(true)
  })
  it('rejects a signature keyed without the whsec_ prefix', () => {
    expect(verifyInvoSignature(body, `t=${now},v1=${sign(body, now, 'test_abc123')}`, SECRET, now)).toBe(false)
  })
  it('rejects the wrong secret', () => {
    expect(verifyInvoSignature(body, `t=${now},v1=${sign(body, now, 'whsec_other')}`, SECRET, now)).toBe(false)
  })
  it('rejects a tampered body', () => {
    expect(verifyInvoSignature(body.replace('1}', '2}'), `t=${now},v1=${sign(body, now)}`, SECRET, now)).toBe(false)
  })
  it('rejects a stale or future timestamp (more than 300 s off)', () => {
    const t = now - 301
    expect(verifyInvoSignature(body, `t=${t},v1=${sign(body, t)}`, SECRET, now)).toBe(false)
    const f = now + 301
    expect(verifyInvoSignature(body, `t=${f},v1=${sign(body, f)}`, SECRET, now)).toBe(false)
    const ok = now - 300
    expect(verifyInvoSignature(body, `t=${ok},v1=${sign(body, ok)}`, SECRET, now)).toBe(true)
  })
  it('accepts when any of several v1 values matches (secret rotation)', () => {
    const header = `t=${now},v1=${sign(body, now, 'whsec_old')},v1=${sign(body, now)}`
    expect(verifyInvoSignature(body, header, SECRET, now)).toBe(true)
    expect(verifyInvoSignature(body, `t=${now},v1=${sign(body, now, 'whsec_a')},v1=${sign(body, now, 'whsec_b')}`, SECRET, now)).toBe(false)
  })
  it('rejects missing or malformed headers', () => {
    expect(verifyInvoSignature(body, null, SECRET, now)).toBe(false)
    expect(verifyInvoSignature(body, '', SECRET, now)).toBe(false)
    expect(verifyInvoSignature(body, `v1=${sign(body, now)}`, SECRET, now)).toBe(false)
    expect(verifyInvoSignature(body, `t=${now}`, SECRET, now)).toBe(false)
    expect(verifyInvoSignature(body, `t=${now},v1=nothex`, SECRET, now)).toBe(false)
    expect(verifyInvoSignature(body, `t=${now},v1=${sign(body, now)}`, '', now)).toBe(false)
  })
})

describe('keys and base URL', () => {
  it('picks the base URL by key prefix', () => {
    expect(invoModeForKey('ivsdk_test_123')).toBe('test')
    expect(invoModeForKey('ivsdk_live_123')).toBe('live')
    expect(invoModeForKey('sk_live_123')).toBeNull()
    expect(invoBaseUrl('ivsdk_test_123')).toBe(INVO_SANDBOX_BASE)
    expect(INVO_SANDBOX_BASE).toBe('https://sandbox.invo.network/sandbox')
    expect(invoBaseUrl('ivsdk_live_123')).toBe(INVO_LIVE_BASE)
    expect(invoBaseUrl('nope')).toBeNull()
    expect(invoBaseUrl('ivsdk_live_123', 'https://example.test/x/')).toBe('https://example.test/x')
  })
  it('is configured only with a recognised key AND a webhook secret', () => {
    expect(invoConfig({})).toBeNull()
    expect(invoConfig({ INVO_SECRET_KEY: 'ivsdk_test_1' })).toBeNull()
    expect(invoConfig({ INVO_WEBHOOK_SECRET: 'whsec_1' })).toBeNull()
    expect(invoConfig({ INVO_SECRET_KEY: 'bogus', INVO_WEBHOOK_SECRET: 'whsec_1' })).toBeNull()
    expect(invoConfig({ INVO_SECRET_KEY: ' ivsdk_test_1 ', INVO_WEBHOOK_SECRET: 'whsec_1' })).toEqual({ secretKey: 'ivsdk_test_1', webhookSecret: 'whsec_1', mode: 'test', baseUrl: INVO_SANDBOX_BASE })
  })
})

describe('money and purchase body', () => {
  it('formats cents as two-decimal strings', () => {
    expect(centsToUsd(9900)).toBe('99.00')
    expect(centsToUsd(2950)).toBe('29.50')
    expect(centsToUsd(299)).toBe('2.99')
    expect(centsToUsd(125000)).toBe('1250.00')
    expect(() => centsToUsd(1.5)).toThrow()
  })
  it('parses USD amounts', () => {
    expect(usdToCents('99.00')).toBe(9900)
    expect(usdToCents('99')).toBe(9900)
    expect(usdToCents('29.5')).toBe(2950)
    expect(usdToCents(99)).toBe(9900)
    expect(usdToCents('9.999')).toBeNull()
    expect(usdToCents('-1')).toBeNull()
    expect(usdToCents(undefined)).toBeNull()
  })
  it('builds the card purchase body', () => {
    const b = buildPurchaseBody({
      clientRequestId: 'nt_pay1_abc', email: 'a@b.co', name: 'Ann Lee', itemId: 'get-involved-COACH', itemName: 'Coach program',
      amountCents: 9900, successUrl: 'https://x/ok', cancelUrl: 'https://x/no', metadata: { prospect_id: 'p1', payment_id: 'pay1' },
    })
    expect(b).toEqual({
      client_request_id: 'nt_pay1_abc', funding_source: 'card', player_email: 'a@b.co', player_name: 'Ann Lee',
      item_id: 'get-involved-COACH', item_name: 'Coach program', item_quantity: 1, unit_price: '99.00', total_price: '99.00',
      success_url: 'https://x/ok', cancel_url: 'https://x/no', metadata: { prospect_id: 'p1', payment_id: 'pay1' },
    })
  })
  it('makes a new client_request_id per attempt, never starting with sub_', () => {
    const a = newClientRequestId('pay1')
    const b = newClientRequestId('pay1')
    expect(a).not.toBe(b)
    expect(a.startsWith('nt_pay1_')).toBe(true)
  })
})

describe('createPlatformPurchase', () => {
  const cfg = { secretKey: 'ivsdk_test_k', baseUrl: INVO_SANDBOX_BASE }
  const input = {
    clientRequestId: 'nt_pay1_abc', email: 'a@b.co', name: 'Ann', itemId: 'i', itemName: 'Coach program',
    amountCents: 9900, successUrl: 'https://x/ok', cancelUrl: 'https://x/no', metadata: { prospect_id: 'p1', payment_id: 'pay1' },
  }
  const ok = { status: 200, text: async () => JSON.stringify({ status: 'requires_payment', funding_source: 'card', session_id: 'cs_1', checkout_url: 'https://sandbox.invo.network/checkout?session=t', expires_at: 1690000000, amount_usd: '99.00' }) }

  it('posts to the purchase endpoint with the secret header and returns the session', async () => {
    const f = vi.fn().mockResolvedValue(ok)
    const s = await createPlatformPurchase(cfg, input, { fetchImpl: f })
    expect(s).toEqual({ sessionId: 'cs_1', checkoutUrl: 'https://sandbox.invo.network/checkout?session=t', expiresAt: 1690000000, amountUsd: '99.00' })
    const [url, init] = f.mock.calls[0]
    expect(url).toBe('https://sandbox.invo.network/sandbox/api/platform-commerce/purchase')
    expect(init.headers['X-Game-Secret-Key']).toBe('ivsdk_test_k')
    expect(JSON.parse(init.body).total_price).toBe('99.00')
  })
  it('retries once with the SAME client_request_id on a 5xx', async () => {
    const f = vi.fn().mockResolvedValueOnce({ status: 503, text: async () => '{"error":"service_unavailable"}' }).mockResolvedValueOnce(ok)
    await createPlatformPurchase(cfg, input, { fetchImpl: f })
    expect(f).toHaveBeenCalledTimes(2)
    expect(JSON.parse(f.mock.calls[0][1].body).client_request_id).toBe(JSON.parse(f.mock.calls[1][1].body).client_request_id)
  })
  it('retries once on a network error, then gives up with a safe message', async () => {
    const f = vi.fn().mockRejectedValue(new Error('ECONNRESET'))
    const e = await createPlatformPurchase(cfg, input, { fetchImpl: f }).catch((x) => x)
    expect(f).toHaveBeenCalledTimes(2)
    expect(e).toBeInstanceOf(InvoError)
    expect(e.kind).toBe('NETWORK')
    expect(e.safeMessage).not.toMatch(/ECONNRESET/)
  })
  it('does not retry 4xx errors and maps them', async () => {
    const f = vi.fn().mockResolvedValue({ status: 403, text: async () => '{"error":"forbidden","error_code":"NOT_A_PLATFORM_TENANT"}' })
    const e = await createPlatformPurchase(cfg, input, { fetchImpl: f }).catch((x) => x)
    expect(f).toHaveBeenCalledTimes(1)
    expect(e.kind).toBe('NOT_PLATFORM')
  })
  it('refuses amounts under the card minimum without calling Invo', async () => {
    const f = vi.fn()
    const e = await createPlatformPurchase(cfg, { ...input, amountCents: 100 }, { fetchImpl: f }).catch((x) => x)
    expect(f).not.toHaveBeenCalled()
    expect(e.kind).toBe('AMOUNT')
  })
  it('rejects a 200 without a usable checkout_url', async () => {
    const f = vi.fn().mockResolvedValue({ status: 200, text: async () => '{"session_id":"x","checkout_url":"javascript:alert(1)"}' })
    const e = await createPlatformPurchase(cfg, input, { fetchImpl: f }).catch((x) => x)
    expect(e.kind).toBe('BAD_RESPONSE')
  })
  it('classifies errors', () => {
    expect(classifyInvoError(401, {}).kind).toBe('AUTH')
    expect(classifyInvoError(400, { error_code_public: 'BELOW_CARD_MINIMUM' }).kind).toBe('AMOUNT')
    expect(classifyInvoError(409, { error_code: 'DUPLICATE_CLIENT_REQUEST_ID' }).kind).toBe('DUPLICATE')
    expect(classifyInvoError(429, null).kind).toBe('RATE_LIMITED')
    expect(classifyInvoError(400, { message: 'bad email' }).kind).toBe('INVALID')
  })
})
