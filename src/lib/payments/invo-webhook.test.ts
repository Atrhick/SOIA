import crypto from 'crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InvoWebhookDeps, WebhookPayment, processInvoWebhook } from './invo-webhook'

const SECRET = 'whsec_hook'
const NOW = 1_800_000_000

function signed(payload: object, opts: { key?: string | null; secret?: string; t?: number } = {}) {
  const rawBody = JSON.stringify(payload)
  const t = opts.t ?? NOW
  const sig = crypto.createHmac('sha256', opts.secret ?? SECRET).update(`${t}.${rawBody}`).digest('hex')
  return { rawBody, signature: `t=${t},v1=${sig}`, idempotencyKey: opts.key === undefined ? 'idem-1' : opts.key, eventId: 'evt-1', secret: SECRET, nowSeconds: NOW }
}

const purchased = (data: Record<string, unknown> = {}) => ({
  event_id: 'evt-1', idempotency_key: 'idem-1', event_type: 'platform_commerce.purchased', tenant_id: 't1',
  data: { order_id: 555, client_request_id: 'nt_pay1_x', total_price_usd: '99.00', item_price_usd: '99.00', metadata: { prospect_id: 'p1', payment_id: 'pay1' }, ...data },
})

function basePayment(over: Partial<WebhookPayment> = {}): WebhookPayment {
  return { id: 'pay1', prospectId: 'p1', prospectName: 'Ann Lee', prospectStatus: 'PAYMENT_PENDING', status: 'PENDING', amountCents: 9900, currency: 'USD', billing: 'ONE_TIME', journeyRole: 'COACH', invoOrderId: null, ...over }
}

function makeDeps(payment: WebhookPayment | null) {
  const claimed = new Set<string>()
  const state = { payment }
  const deps = {
    claimEvent: vi.fn(async (key: string) => (claimed.has(key) ? 'duplicate' as const : (claimed.add(key), 'new' as const))),
    finishEvent: vi.fn(async () => {}),
    releaseEvent: vi.fn(async (key: string) => { claimed.delete(key) }),
    findPayment: vi.fn(async (q: { paymentId?: string; clientRequestId?: string; orderId?: string }) => {
      const p = state.payment
      if (!p) return null
      if (q.paymentId && q.paymentId === p.id) return p
      if (q.clientRequestId === 'nt_pay1_x') return p
      if (q.orderId && q.orderId === p.invoOrderId) return p
      return null
    }),
    markPaid: vi.fn(async (p: WebhookPayment, orderId: string) => {
      state.payment = { ...p, status: 'COMPLETED', invoOrderId: orderId, prospectStatus: 'ACCOUNT_CREATED' }
      return { recorded: true, loginCreated: true }
    }),
    markRefunded: vi.fn(async (p: WebhookPayment) => { state.payment = { ...p, status: 'REFUNDED' } }),
    notifyAdmins: vi.fn(async () => {}),
    log: vi.fn(),
  } satisfies InvoWebhookDeps
  return { deps, state }
}

describe('processInvoWebhook', () => {
  let ctx: ReturnType<typeof makeDeps>
  beforeEach(() => { ctx = makeDeps(basePayment()) })

  it('401s a bad signature and touches nothing', async () => {
    const r = await processInvoWebhook(signed(purchased(), { secret: 'whsec_wrong' }), ctx.deps)
    expect(r.status).toBe(401)
    expect(ctx.deps.claimEvent).not.toHaveBeenCalled()
    expect(ctx.deps.markPaid).not.toHaveBeenCalled()
  })

  it('401s a stale signature', async () => {
    const r = await processInvoWebhook(signed(purchased(), { t: NOW - 600 }), ctx.deps)
    expect(r.status).toBe(401)
  })

  it('grants a matching purchase once, with the order id', async () => {
    const r = await processInvoWebhook(signed(purchased()), ctx.deps)
    expect(r).toEqual({ status: 200, body: { received: true, outcome: 'paid' } })
    expect(ctx.deps.markPaid).toHaveBeenCalledWith(expect.objectContaining({ id: 'pay1' }), '555')
    expect(ctx.deps.finishEvent).toHaveBeenCalledWith('idem-1', 'paid')
    expect(ctx.deps.notifyAdmins).not.toHaveBeenCalled()
  })

  it('ignores a duplicate idempotency key (Invo retry)', async () => {
    await processInvoWebhook(signed(purchased()), ctx.deps)
    const r = await processInvoWebhook(signed(purchased()), ctx.deps)
    expect(r).toEqual({ status: 200, body: { received: true, duplicate: true } })
    expect(ctx.deps.markPaid).toHaveBeenCalledTimes(1)
  })

  it('treats the same order under a new idempotency key as already processed', async () => {
    await processInvoWebhook(signed(purchased()), ctx.deps)
    const r = await processInvoWebhook(signed(purchased(), { key: 'idem-2' }), ctx.deps)
    expect(r.body.outcome).toBe('already_processed')
    expect(ctx.deps.markPaid).toHaveBeenCalledTimes(1)
    expect(ctx.deps.notifyAdmins).not.toHaveBeenCalled()
  })

  it('never grants on an amount mismatch, and tells admins', async () => {
    const r = await processInvoWebhook(signed(purchased({ total_price_usd: '9.90', item_price_usd: '9.90' })), ctx.deps)
    expect(r.status).toBe(200)
    expect(r.body.outcome).toBe('amount_mismatch')
    expect(ctx.deps.markPaid).not.toHaveBeenCalled()
    expect(ctx.deps.notifyAdmins).toHaveBeenCalledTimes(1)
  })

  it('accepts tax on top when item_price_usd matches', async () => {
    const r = await processInvoWebhook(signed(purchased({ total_price_usd: '107.17', item_price_usd: '99.00' })), ctx.deps)
    expect(r.body.outcome).toBe('paid')
  })

  it('never grants when the prospect is not PAYMENT_PENDING', async () => {
    ctx = makeDeps(basePayment({ prospectStatus: 'NOT_A_FIT', status: 'FAILED' }))
    const r = await processInvoWebhook(signed(purchased()), ctx.deps)
    expect(r.body.outcome).toBe('wrong_status')
    expect(ctx.deps.markPaid).not.toHaveBeenCalled()
    expect(ctx.deps.notifyAdmins).toHaveBeenCalledTimes(1)
  })

  it('flags a second payment for an already-paid row', async () => {
    ctx = makeDeps(basePayment({ status: 'COMPLETED', invoOrderId: '111', prospectStatus: 'ACCOUNT_CREATED' }))
    const r = await processInvoWebhook(signed(purchased()), ctx.deps)
    expect(r.body.outcome).toBe('already_paid')
    expect(ctx.deps.notifyAdmins).toHaveBeenCalledTimes(1)
  })

  it('refuses a recurring-billing row and a prospect mismatch', async () => {
    ctx = makeDeps(basePayment({ billing: 'MONTHLY' }))
    expect((await processInvoWebhook(signed(purchased()), ctx.deps)).body.outcome).toBe('billing_mismatch')
    ctx = makeDeps(basePayment({ prospectId: 'other' }))
    expect((await processInvoWebhook(signed(purchased()), ctx.deps)).body.outcome).toBe('prospect_mismatch')
    expect(ctx.deps.markPaid).not.toHaveBeenCalled()
  })

  it('reports unmatched purchases without granting', async () => {
    ctx = makeDeps(null)
    const r = await processInvoWebhook(signed(purchased()), ctx.deps)
    expect(r.body.outcome).toBe('unmatched')
    expect(ctx.deps.notifyAdmins).toHaveBeenCalledWith('Invo payment not matched', expect.any(String), 'p1')
  })

  it('tells admins when payment is recorded but the login could not be made', async () => {
    ctx.deps.markPaid.mockResolvedValueOnce({ recorded: true, loginCreated: false, error: 'An account with this email already exists.' } as never)
    const r = await processInvoWebhook(signed(purchased()), ctx.deps)
    expect(r.body.outcome).toBe('paid_login_failed')
    expect(ctx.deps.notifyAdmins).toHaveBeenCalledTimes(1)
  })

  it('marks a full refund REFUNDED, notifies admins, and does not remove the login', async () => {
    await processInvoWebhook(signed(purchased()), ctx.deps)
    const refund = { event_type: 'platform_commerce.refunded', data: { order_id: 555, refunded_amount: '99.00', amount_unit: 'usd', metadata: { prospect_id: 'p1', payment_id: 'pay1' } } }
    const r = await processInvoWebhook(signed(refund, { key: 'idem-refund' }), ctx.deps)
    expect(r.body.outcome).toBe('refunded')
    expect(ctx.deps.markRefunded).toHaveBeenCalledTimes(1)
    expect(ctx.deps.notifyAdmins).toHaveBeenCalledWith('Invo refund', expect.stringMatching(/NOT removed/), 'p1')
    const again = await processInvoWebhook(signed(refund, { key: 'idem-refund-2' }), ctx.deps)
    expect(again.body.outcome).toBe('already_refunded')
  })

  it('leaves a partial refund as paid but notifies admins', async () => {
    ctx = makeDeps(basePayment({ status: 'COMPLETED', invoOrderId: '555' }))
    const refund = { event_type: 'platform_commerce.refunded', data: { order_id: 555, refunded_amount: '10.00', partial_refund: true, metadata: {} } }
    const r = await processInvoWebhook(signed(refund, { key: 'idem-p' }), ctx.deps)
    expect(r.body.outcome).toBe('partial_refund')
    expect(ctx.deps.markRefunded).not.toHaveBeenCalled()
    expect(ctx.deps.notifyAdmins).toHaveBeenCalledTimes(1)
  })

  it('answers 200 and ignores unknown events', async () => {
    const r = await processInvoWebhook(signed({ event_type: 'something.else', data: {} }, { key: 'idem-u' }), ctx.deps)
    expect(r).toEqual({ status: 200, body: { received: true, outcome: 'ignored' } })
    expect(ctx.deps.findPayment).not.toHaveBeenCalled()
  })

  it('releases the claim and 500s when processing crashes, so the retry is processed', async () => {
    ctx.deps.markPaid.mockRejectedValueOnce(new Error('db down'))
    const r = await processInvoWebhook(signed(purchased()), ctx.deps)
    expect(r.status).toBe(500)
    expect(ctx.deps.releaseEvent).toHaveBeenCalledWith('idem-1')
    const retry = await processInvoWebhook(signed(purchased()), ctx.deps)
    expect(retry.body.outcome).toBe('paid')
  })

  it('falls back to the payload idempotency_key when the header is missing', async () => {
    const r = await processInvoWebhook(signed(purchased(), { key: null }), ctx.deps)
    expect(r.status).toBe(200)
    expect(ctx.deps.claimEvent).toHaveBeenCalledWith('idem-1', 'platform_commerce.purchased', 'evt-1')
  })
})
