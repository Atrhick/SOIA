/**
 * Payment hand-off for paid roles. Server only, not 'use server'. Reuses the ProspectPayment row
 * (one per prospect) with journeyRole/billing set, so the old coach pipeline's rows (journeyRole null)
 * are untouched. The payment provider integration itself belongs to the payment builder.
 */
import { PaymentMethod, Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { RoleConfig, isPaidRole } from './core'
import { setStatus } from './server'
import { completeJourney } from './login'

/**
 * After a paid role's terms are accepted: create or reset the PENDING payment for the role's price
 * (from the prospect's snapshot config) and move ORIENTATION_COMPLETED -> PAYMENT_PENDING.
 * Run inside the same transaction that records the terms acceptance.
 */
export async function openJourneyPayment(tx: Prisma.TransactionClient, prospectId: string, cfg: RoleConfig, method: PaymentMethod = 'STRIPE', changedBy: string | null = null) {
  if (!isPaidRole(cfg)) throw new Error('openJourneyPayment called for a free role')
  const p = await tx.prospect.findUnique({ where: { id: prospectId }, select: { status: true } })
  if (!p) throw new Error('Prospect not found')
  const data = { method, status: 'PENDING' as const, amount: new Prisma.Decimal(cfg.priceCents).div(100), currency: 'USD', journeyRole: cfg.role, billing: cfg.billing, failedAt: null, failureReason: null }
  const payment = await tx.prospectPayment.upsert({ where: { prospectId }, create: { prospectId, ...data }, update: data })
  if (p.status !== 'PAYMENT_PENDING') await setStatus(tx, prospectId, p.status, 'PAYMENT_PENDING', changedBy, 'Terms accepted: waiting for payment')
  return payment
}

/**
 * The provider (webhook / return page / admin "mark paid") confirmed payment. Idempotent: a second
 * call for an already-completed payment does nothing. Moves PAYMENT_PENDING -> PAYMENT_COMPLETED, then
 * completeJourney() creates the login and sends the welcome emails.
 */
export async function markJourneyPaid(prospectId: string, opts: { method?: PaymentMethod; reference?: string | null; stripePaymentIntentId?: string | null; stripeSessionId?: string | null; stripeSubscriptionId?: string | null; byUserId?: string | null } = {}) {
  const changed = await prisma.$transaction(async (tx) => {
    const p = await tx.prospect.findUnique({ where: { id: prospectId }, select: { status: true, payment: { select: { status: true } } } })
    if (!p || !p.payment || p.payment.status === 'COMPLETED' || p.status !== 'PAYMENT_PENDING') return false
    await tx.prospectPayment.update({
      where: { prospectId },
      data: {
        status: 'COMPLETED', paidAt: new Date(),
        ...(opts.method ? { method: opts.method } : {}),
        ...(opts.reference ? { manualReference: opts.reference, manualApprovedBy: opts.byUserId ?? null, manualApprovedAt: new Date() } : {}),
        ...(opts.stripePaymentIntentId ? { stripePaymentIntentId: opts.stripePaymentIntentId } : {}),
        ...(opts.stripeSessionId ? { stripeSessionId: opts.stripeSessionId } : {}),
        ...(opts.stripeSubscriptionId ? { stripeSubscriptionId: opts.stripeSubscriptionId } : {}),
      },
    })
    await setStatus(tx, prospectId, p.status, 'PAYMENT_COMPLETED', opts.byUserId ?? null, 'Payment received')
    return true
  })
  if (!changed) return { ok: false as const, error: 'This payment is not waiting to be completed.' }
  return completeJourney(prospectId, { byUserId: opts.byUserId ?? null })
}
