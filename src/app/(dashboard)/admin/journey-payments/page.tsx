import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { billingLabel, formatDollars, roleLabel, type RoleBillingValue } from '@/lib/get-involved/core'
import { userDisplayName } from '@/lib/get-involved/server'
import { isOnlinePaymentEnabled } from '@/lib/payments'
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
    reference: x.manualReference,
    failureReason: x.failureReason,
    inviter: x.prospect.invitedById ? names.get(x.prospect.invitedById) ?? null : null,
  }))
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Get Involved payments</h1>
        <p className="text-gray-600 mt-1">
          {isOnlinePaymentEnabled()
            ? 'Prospects pay online on their Join page. Use this list for anything paid another way.'
            : 'Online payment is not connected yet. Contact each person below about payment, then mark it received: that creates their login and emails them.'}
        </p>
      </div>
      <JourneyPaymentsClient rows={rows} />
    </div>
  )
}
