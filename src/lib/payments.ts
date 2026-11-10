/**
 * Payment provider seam for the Get Involved journey. Server only, not 'use server'.
 *
 * Invo (src/lib/payments/invo.ts) is the provider. It switches on only when BOTH INVO_SECRET_KEY
 * (ivsdk_test_... = sandbox, ivsdk_live_... = production) and INVO_WEBHOOK_SECRET are set.
 *
 * - Online payment covers ONE_TIME roles only. MONTHLY/YEARLY roles always take the manual path
 *   (Invo subscriptions need a card-setup session and a live title; not built).
 * - When online: the Join page's Pay button calls startJourneyCheckout (src/lib/actions/journey-join.ts),
 *   which creates a FRESH checkout per click (Invo links expire in about 15 minutes and are single use)
 *   and sends the prospect to it. The signed webhook (src/app/api/webhooks/invo/route.ts) confirms the
 *   payment and calls markJourneyPaid, which creates the login.
 * - When off (or for recurring roles): the Join page says "We'll contact you about payment", a PENDING
 *   MANUAL ProspectPayment is created, and an admin marks it paid at /admin/journey-payments.
 *   Manual mark-paid works for every payment, online or not.
 */
import type { RoleBillingValue } from '@/lib/get-involved/core'
import { InvoError, createPlatformPurchase, invoConfig, invoEnvStatus } from '@/lib/payments/invo'

export interface CheckoutRequest {
  paymentId: string
  prospectId: string
  /** Idempotency key for this attempt; a new one per Pay click. */
  clientRequestId: string
  email: string
  name: string
  /** What the prospect sees on the provider's page, e.g. "Coach program". */
  description: string
  /** Stable item id, e.g. "get-involved-COACH". */
  itemId: string
  amountCents: number
  currency: 'USD'
  billing: RoleBillingValue
  /** Absolute URLs the provider sends the prospect back to. */
  successUrl: string
  cancelUrl: string
}

export interface CheckoutSession {
  /** The provider's hosted payment page (single use). */
  url: string
  sessionId: string
  expiresAt: Date | null
}

/** Thrown by createCheckout; `safeMessage` can be shown to the prospect. */
export class CheckoutError extends Error {
  /** True when staff must act (bad key, account not platform-tagged, amount refused): not worth retrying. */
  readonly needsStaff: boolean
  constructor(message: string, readonly safeMessage: string, needsStaff = false) {
    super(message)
    this.name = 'CheckoutError'
    this.needsStaff = needsStaff
  }
}

export interface PaymentProvider {
  name: 'INVO'
  mode: 'test' | 'live'
  /** Which billing types this provider can take online. */
  supports(billing: RoleBillingValue): boolean
  createCheckout(req: CheckoutRequest): Promise<CheckoutSession>
}

/** The connected provider, or null when Invo isn't configured (manual path). */
export function getPaymentProvider(): PaymentProvider | null {
  const cfg = invoConfig()
  if (!cfg) return null
  return {
    name: 'INVO',
    mode: cfg.mode,
    supports: (billing) => billing === 'ONE_TIME',
    async createCheckout(req) {
      if (req.billing !== 'ONE_TIME') throw new CheckoutError('Invo: recurring billing is not supported', 'Our team will contact you about payment.', true)
      try {
        const s = await createPlatformPurchase(cfg, {
          clientRequestId: req.clientRequestId,
          email: req.email,
          name: req.name,
          itemId: req.itemId,
          itemName: req.description,
          amountCents: req.amountCents,
          successUrl: req.successUrl,
          cancelUrl: req.cancelUrl,
          metadata: { prospect_id: req.prospectId, payment_id: req.paymentId, source: 'get-involved' },
        })
        return { url: s.checkoutUrl, sessionId: s.sessionId, expiresAt: s.expiresAt ? new Date(s.expiresAt * 1000) : null }
      } catch (e) {
        if (e instanceof InvoError) throw new CheckoutError(e.message, e.safeMessage, ['AUTH', 'NOT_PLATFORM', 'AMOUNT', 'INVALID', 'NOT_CONFIGURED'].includes(e.kind))
        throw e
      }
    },
  }
}

/** True when a provider is connected (some roles can pay online). */
export function isOnlinePaymentEnabled(): boolean {
  return getPaymentProvider() !== null
}

/** True when a role with this billing can pay online right now. MONTHLY/YEARLY: always false. */
export function onlinePaymentAvailableFor(billing: RoleBillingValue): boolean {
  return getPaymentProvider()?.supports(billing) ?? false
}

/** For the admin payments page. Never includes the secrets. */
export function paymentProviderStatus() {
  return { provider: 'INVO' as const, ...invoEnvStatus() }
}
