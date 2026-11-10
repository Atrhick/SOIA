/**
 * Database side of the Invo webhook (see invo-webhook.ts). Server only, NOT 'use server'.
 */
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { notifyAdmins } from '@/lib/get-involved/server'
import { markJourneyPaid } from '@/lib/get-involved/payment'
import { afterLoginExtras } from '@/lib/get-involved/after-login'
import type { InvoWebhookDeps, WebhookPayment } from './invo-webhook'

const paymentInclude = { prospect: { select: { status: true, firstName: true, lastName: true } } } as const

function toWebhookPayment(row: Prisma.ProspectPaymentGetPayload<{ include: typeof paymentInclude }>): WebhookPayment {
  return {
    id: row.id,
    prospectId: row.prospectId,
    prospectName: `${row.prospect.firstName} ${row.prospect.lastName}`.trim(),
    prospectStatus: row.prospect.status,
    status: row.status,
    amountCents: Math.round(Number(row.amount) * 100),
    currency: row.currency,
    billing: row.billing,
    journeyRole: row.journeyRole,
    invoOrderId: row.invoOrderId,
  }
}

export const invoWebhookDeps: InvoWebhookDeps = {
  async claimEvent(key, eventType, eventId) {
    try {
      await prisma.invoWebhookEvent.create({ data: { idempotencyKey: key.slice(0, 300), eventType: eventType.slice(0, 100), eventId: eventId?.slice(0, 300) ?? null } })
      return 'new'
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return 'duplicate'
      throw e
    }
  },
  async finishEvent(key, outcome) {
    await prisma.invoWebhookEvent.update({ where: { idempotencyKey: key.slice(0, 300) }, data: { processedAt: new Date(), outcome } })
  },
  async releaseEvent(key) {
    await prisma.invoWebhookEvent.deleteMany({ where: { idempotencyKey: key.slice(0, 300), processedAt: null } })
  },
  async findPayment(q) {
    const where: Prisma.ProspectPaymentWhereInput | null =
      q.paymentId ? { id: q.paymentId } : q.clientRequestId ? { invoClientRequestId: q.clientRequestId } : q.orderId ? { invoOrderId: q.orderId } : null
    if (!where) return null
    const row = await prisma.prospectPayment.findFirst({ where, include: paymentInclude })
    return row ? toWebhookPayment(row) : null
  },
  async markPaid(p, orderId) {
    const r = await markJourneyPaid(p.prospectId, { method: 'INVO', invoOrderId: orderId })
    const now = await prisma.prospectPayment.findUnique({ where: { id: p.id }, select: { status: true, invoOrderId: true } })
    const recorded = now?.status === 'COMPLETED' && now.invoOrderId === orderId
    if (r.ok) await afterLoginExtras(p.prospectId)
    await prisma.auditLog.create({
      data: { userId: null, action: 'JOURNEY_PAYMENT_RECEIVED', entityType: 'Prospect', entityId: p.prospectId, details: JSON.stringify({ via: 'INVO', orderId, loginCreated: r.ok }) },
    }).catch(() => {})
    return { recorded, loginCreated: r.ok, error: r.ok ? undefined : r.error }
  },
  async markRefunded(p, info) {
    await prisma.prospectPayment.update({ where: { id: p.id }, data: { status: 'REFUNDED', failureReason: `Refunded in Invo (order ${info.orderId}, ${info.amountLabel})`.slice(0, 500) } })
  },
  async notifyAdmins(title, message, prospectId) {
    await notifyAdmins(title, message, prospectId).catch((e) => console.error('[INVO-WEBHOOK] admin notification failed', e))
  },
  log(message, details) {
    console.error(`[INVO-WEBHOOK] ${message}`, details ?? {})
  },
}
