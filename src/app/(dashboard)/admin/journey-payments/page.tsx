import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { billingLabel, formatDollars, roleLabel, type RoleBillingValue } from '@/lib/get-involved/core'
import { userDisplayName } from '@/lib/get-involved/server'
import { paymentProviderStatus } from '@/lib/payments'
import { JourneyPaymentsClient, PaymentRow } from './journey-payments-client'

export const dynamic = 'force-dynamic'

/** Get Involved payments for paid roles: who is waiting to pay, and what was recorded in the last 30 days. */
export default async function JourneyPaymentsPage() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') redirect('/login')
  const since = new Date(Date.now() - 30 * 86400_000)
  const payments = await prisma.prospectPayment.findMany({
    where: {
      journeyRole: { not: null },
      prospect: { journeyToken: { not: null } },
      OR: [{ status: { in: ['PENDING', 'PROCESSING'] } }, { updatedAt: { gte: since } }],
    },
    orderBy: { createdAt: 'asc' },
    take: 300,
    include: { prospect: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true, roleTermsAcceptedAt: true, userId: true, invitedById: true } } },
  })
  const names = new Map<string, string>()
  for (const id of Array.from(new Set(payments.map((x) => x.prospect.invitedById).filter(Boolean) as string[]))) {
    names.set(id, (await userDisplayName(id))?.full ?? 'Unknown')
  }
  const rows: PaymentRow[] = payments.map((x) => ({
    prospectId: x.prospect.id,
    name: `${x.prospect.firstName} ${x.prospect.lastName}`,
    email: x.prospect.email,
    phone: x.prospect.phone,
    role: roleLabel(x.journeyRole),
    amount: `${formatDollars(Math.round(Number(x.amount) * 100))}${x.billing ? ` · ${billingLabel(x.billing as RoleBillingValue)}` : ''}`,
    method: x.method,
    status: x.status,
    prospectStatus: x.prospect.status,
    loginCreated: !!x.prospect.userId,
    acceptedAt: x.prospect.roleTermsAcceptedAt?.toISOString() ?? null,
    paidAt: x.paidAt?.toISOString() ?? null,
    reference: x.manualReference ?? (x.invoOrderId ? `Invo order ${x.invoOrderId}` : null),
    failureReason: x.failureReason,
    inviter: x.prospect.invitedById ? names.get(x.prospect.invitedById) ?? null : null,
  }))
  const ps = paymentProviderStatus()
  const modeLabel = ps.mode === 'live' ? 'Live' : ps.mode === 'test' ? 'Test (sandbox)' : ps.keySet ? 'Key not recognised' : 'Off'
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Get Involved payments</h1>
        <p className="text-gray-600 mt-1">
          {ps.enabled
            ? 'One-time roles pay online by card (Invo) on their Join page, and their login is created when Invo confirms the payment. Monthly and yearly roles are still arranged by staff. Use Mark payment received for anything paid another way.'
            : 'Online payment is off. Contact each person below about payment, then mark it received: that creates their login and emails them.'}
        </p>
      </div>
      <section aria-labelledby="provider-title" className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 id="provider-title" className="font-bold text-gray-900">Online payment (Invo)</h2>
        <dl className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-gray-600">Status</dt>
            <dd className={`font-semibold ${ps.enabled ? (ps.mode === 'live' ? 'text-green-800' : 'text-amber-800') : 'text-gray-900'}`}>{ps.enabled ? `On: ${modeLabel}` : `Off${ps.keySet ? ` (${modeLabel.toLowerCase()})` : ''}`}</dd>
          </div>
          <div>
            <dt className="text-gray-600">Secret key (INVO_SECRET_KEY)</dt>
            <dd className="font-semibold text-gray-900">{ps.keySet ? modeLabel : 'Not set'}</dd>
          </div>
          <div>
            <dt className="text-gray-600">Webhook secret (INVO_WEBHOOK_SECRET)</dt>
            <dd className="font-semibold text-gray-900">{ps.webhookSecretSet ? 'Set' : 'Not set'}</dd>
          </div>
        </dl>
        <p className="text-xs text-gray-600 mt-3">
          Online payment needs both values. It covers one-time fees only; monthly and yearly roles always use Mark payment received.
          {ps.mode === 'test' && ' Test mode: no real money moves (sandbox card 4242 4242 4242 4242).'}
          {ps.baseOverride && ` API base overridden: ${ps.baseOverride}.`}
        </p>
      </section>
      <JourneyPaymentsClient rows={rows} />
    </div>
  )
}
