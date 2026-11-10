/**
 * Invo webhook: POST {APP_URL}/api/webhooks/invo, subscribed to platform_commerce.purchased and
 * platform_commerce.refunded (registered once by an admin in Invo; see CLAUDE.md).
 *
 * Verifies X-Invo-Signature against INVO_WEBHOOK_SECRET over the RAW body (401 on failure), dedupes
 * on X-Invo-Idempotency-Key, then hands off to processInvoWebhook (src/lib/payments/invo-webhook.ts).
 * Answers 200 for every validly signed event, including ones it ignores; 500 only when processing
 * crashed, so Invo retries.
 */
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { processInvoWebhook } from '@/lib/payments/invo-webhook'
import { invoWebhookDeps } from '@/lib/payments/invo-webhook-db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY = 256 * 1024

export async function POST(req: Request) {
  const secret = process.env.INVO_WEBHOOK_SECRET?.trim()
  if (!secret) return NextResponse.json({ error: 'not configured' }, { status: 503 })
  const rawBody = await req.text()
  if (rawBody.length > MAX_BODY) return NextResponse.json({ error: 'too large' }, { status: 413 })

  const r = await processInvoWebhook({
    rawBody,
    signature: req.headers.get('x-invo-signature'),
    idempotencyKey: req.headers.get('x-invo-idempotency-key'),
    eventId: req.headers.get('x-invo-event-id'),
    secret,
    nowSeconds: Math.floor(Date.now() / 1000),
  }, invoWebhookDeps)

  if (r.status === 200 && r.body.outcome && r.body.outcome !== 'ignored') {
    try { revalidatePath('/admin/journey-payments') } catch { /* not fatal */ }
  }
  return NextResponse.json(r.body, { status: r.status })
}
