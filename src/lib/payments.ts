/**
 * Payment provider seam for the Get Involved journey. Server only, not 'use server'.
 *
 * No provider is connected yet, so getPaymentProvider() returns null and every paid role takes the
 * manual path: the Join page says "We'll contact you about payment", a PENDING MANUAL ProspectPayment
 * is created, and an admin marks it paid at /admin/journey-payments (markJourneyPaid in
 * src/lib/get-involved/payment.ts then creates the login).
 *
 * To connect Stripe later: implement PaymentProvider (a Checkout Session for ONE_TIME, a subscription
 * for MONTHLY/YEARLY), return it from getPaymentProvider() when STRIPE_SECRET_KEY is set, and add a
 * webhook that calls markJourneyPaid(prospectId, { method: 'STRIPE', stripeSessionId, ... }).
 * Online payment switches on only when BOTH the key is set and a provider is returned.
 */
import type { RoleBillingValue } from '@/lib/get-involved/core'

export interface CheckoutRequest {
  prospectId: string
  email: string
  /** What the prospect sees on the provider's page, e.g. "Coach program". */
  description: string
  amountCents: number
  currency: 'USD'
  billing: RoleBillingValue
  /** Absolute URLs the provider sends the prospect back to. */
  successUrl: string
  cancelUrl: string
}

export interface CheckoutSession {
  /** The provider's hosted payment page. */
  url: string
  /** Stored on ProspectPayment.stripeSessionId so the webhook can find the row. */
  sessionId: string
}

export interface PaymentProvider {
  name: 'STRIPE'
  createCheckout(req: CheckoutRequest): Promise<CheckoutSession>
}

/** The connected provider, or null while none is wired up (today). */
export function getPaymentProvider(): PaymentProvider | null {
  return null
}

/** True when prospects can pay online on the Join page. False today: payment is arranged by staff. */
export function isOnlinePaymentEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim()) && getPaymentProvider() !== null
}
