/**
 * Invo webhook logic, kept free of Prisma/Next so it can be unit tested (invo-webhook.test.ts).
 * The route (src/app/api/webhooks/invo/route.ts) passes the raw body + headers and the database
 * dependencies from invo-webhook-db.ts. Server only, NOT 'use server'.
 *
 * Grants ONLY on `platform_commerce.purchased`, and only when the payment row, prospect, amount and
 * status all line up; anything else is logged and admins are notified, never granted.
 * `platform_commerce.refunded` marks the payment REFUNDED and notifies admins; the login is NOT removed.
 */
import { usdToCents, verifyInvoSignature } from './invo'

export interface WebhookPayment {
  id: string
  prospectId: string
  prospectName: string
  prospectStatus: string
  status: string
  amountCents: number
  currency: string
  billing: string | null
  journeyRole: string | null
  invoOrderId: string | null
}

export interface MarkPaidResult {
  /** The payment is now COMPLETED with this order id. */
  recorded: boolean
  loginCreated: boolean
  error?: string
}

export interface InvoWebhookDeps {
  /** Insert the dedupe row. 'duplicate' when this idempotency key was already received. */
  claimEvent(key: string, eventType: string, eventId: string | null): Promise<'new' | 'duplicate'>
  finishEvent(key: string, outcome: string): Promise<void>
  /** Undo a claim after a crash so Invo's retry is processed. */
  releaseEvent(key: string): Promise<void>
  findPayment(q: { paymentId?: string; clientRequestId?: string; orderId?: string }): Promise<WebhookPayment | null>
  markPaid(p: WebhookPayment, orderId: string): Promise<MarkPaidResult>
  markRefunded(p: WebhookPayment, info: { orderId: string; amountLabel: string }): Promise<void>
  notifyAdmins(title: string, message: string, prospectId: string): Promise<void>
  log(message: string, details?: Record<string, unknown>): void
}

export interface WebhookRequest {
  rawBody: string
  signature: string | null
  idempotencyKey: string | null
  eventId: string | null
  secret: string
  nowSeconds: number
}

export interface WebhookResponse {
  status: number
  body: Record<string, unknown>
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : null)
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`

export async function processInvoWebhook(req: WebhookRequest, deps: InvoWebhookDeps): Promise<WebhookResponse> {
  if (!verifyInvoSignature(req.rawBody, req.signature, req.secret, req.nowSeconds)) {
    return { status: 401, body: { error: 'invalid signature' } }
  }
  let payload: Record<string, unknown>
  try {
    payload = obj(JSON.parse(req.rawBody))
  } catch {
    return { status: 400, body: { error: 'invalid json' } }
  }
  const eventType = str(payload.event_type) ?? 'unknown'
  const eventId = req.eventId ?? str(payload.event_id)
  // Dedupe on the idempotency key (stable across Invo's retries); X-Invo-Event-Id changes on replay.
  const key = req.idempotencyKey?.trim() || str(payload.idempotency_key) || (eventId ? `event:${eventId}` : null)
  if (!key) return { status: 400, body: { error: 'missing idempotency key' } }

  if ((await deps.claimEvent(key, eventType, eventId)) === 'duplicate') {
    return { status: 200, body: { received: true, duplicate: true } }
  }
  try {
    const data = obj(payload.data)
    let outcome: string
    if (eventType === 'platform_commerce.purchased') outcome = await handlePurchased(data, deps)
    else if (eventType === 'platform_commerce.refunded') outcome = await handleRefunded(data, deps)
    else outcome = 'ignored'
    await deps.finishEvent(key, outcome)
    return { status: 200, body: { received: true, outcome } }
  } catch (e) {
    deps.log('webhook processing failed', { key, eventType, error: e instanceof Error ? e.message : String(e) })
    await deps.releaseEvent(key).catch(() => {})
    return { status: 500, body: { error: 'processing failed' } }
  }
}

async function handlePurchased(data: Record<string, unknown>, deps: InvoWebhookDeps): Promise<string> {
  const meta = obj(data.metadata)
  const paymentId = str(meta.payment_id)
  const prospectId = str(meta.prospect_id)
  const orderId = str(data.order_id)
  const clientRequestId = str(data.client_request_id)
  if (!orderId) {
    deps.log('purchased event without order_id', { paymentId, prospectId })
    return 'ignored_no_order'
  }

  const payment = (paymentId ? await deps.findPayment({ paymentId }) : null) ?? (clientRequestId ? await deps.findPayment({ clientRequestId }) : null)
  const totalCents = usdToCents(data.total_price_usd)
  const itemCents = usdToCents(data.item_price_usd)
  const paidLabel = totalCents !== null ? dollars(totalCents) : String(data.total_price_usd ?? 'unknown amount')

  if (!payment) {
    deps.log('purchased event matches no payment', { orderId, paymentId, prospectId, clientRequestId })
    if (prospectId) await deps.notifyAdmins('Invo payment not matched', `Invo order ${orderId} (${paidLabel}) could not be matched to a waiting payment. Nothing was granted. Please check it in Invo.`, prospectId)
    return 'unmatched'
  }
  const alert = async (outcome: string, why: string) => {
    deps.log(`purchased event not granted: ${outcome}`, { orderId, paymentId: payment.id, prospectId: payment.prospectId })
    await deps.notifyAdmins('Invo payment needs a look', `Invo order ${orderId} (${paidLabel}) for ${payment.prospectName} was not applied: ${why} No login was created by it. Check the order in Invo and refund or mark paid by hand.`, payment.prospectId)
    return outcome
  }

  if (prospectId && prospectId !== payment.prospectId) return alert('prospect_mismatch', 'the order belongs to a different prospect than the payment it names.')
  if (payment.invoOrderId === orderId) return 'already_processed'
  if (payment.status === 'COMPLETED') return alert('already_paid', 'this payment was already recorded, so this may be a second payment.')
  if (!payment.journeyRole || payment.billing !== 'ONE_TIME') return alert('billing_mismatch', 'this is not a one-time Get Involved payment.')
  // Invo may add tax on top: total_price_usd is what the buyer paid, item_price_usd the sale less tax.
  const amountOk = payment.currency === 'USD' && (totalCents === payment.amountCents || itemCents === payment.amountCents)
  if (!amountOk) return alert('amount_mismatch', `the amount paid does not match the ${dollars(payment.amountCents)} due.`)
  if (payment.prospectStatus !== 'PAYMENT_PENDING') return alert('wrong_status', `the prospect is not waiting for payment (status ${payment.prospectStatus}).`)

  const r = await deps.markPaid(payment, orderId)
  if (!r.recorded) return alert('not_recorded', `it could not be recorded (${r.error ?? 'unknown reason'}).`)
  if (!r.loginCreated) {
    await deps.notifyAdmins('Paid, but the login was not created', `${payment.prospectName} paid ${paidLabel} (Invo order ${orderId}), but the login could not be created: ${r.error ?? 'unknown reason'} They can finish from their Join link.`, payment.prospectId)
    return 'paid_login_failed'
  }
  return 'paid'
}

async function handleRefunded(data: Record<string, unknown>, deps: InvoWebhookDeps): Promise<string> {
  const meta = obj(data.metadata)
  const orderId = str(data.order_id)
  const paymentId = str(meta.payment_id)
  const payment = (orderId ? await deps.findPayment({ orderId }) : null) ?? (paymentId ? await deps.findPayment({ paymentId }) : null)
  const refundCents = usdToCents(data.refunded_amount)
  const amountLabel = refundCents !== null ? dollars(refundCents) : String(data.refunded_amount ?? 'unknown amount')
  if (!payment) {
    deps.log('refunded event matches no payment', { orderId, paymentId })
    return 'unmatched'
  }
  if (data.partial_refund === true) {
    await deps.notifyAdmins('Invo partial refund', `Invo order ${orderId ?? '?'} for ${payment.prospectName} was partly refunded (${amountLabel}). The payment stays marked paid and the login is unchanged.`, payment.prospectId)
    return 'partial_refund'
  }
  if (payment.status === 'REFUNDED') return 'already_refunded'
  await deps.markRefunded(payment, { orderId: orderId ?? '?', amountLabel })
  await deps.notifyAdmins('Invo refund', `Invo order ${orderId ?? '?'} for ${payment.prospectName} was refunded (${amountLabel}). The payment is now marked Refunded. Their login was NOT removed: deactivate it in User Management if they should lose access.`, payment.prospectId)
  return 'refunded'
}
