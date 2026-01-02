import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { AdminSponsorshipClient } from './admin-sponsorship-client'

async function getAllRequests() {
  return prisma.sponsorshipRequest.findMany({
    orderBy: [
      { status: 'asc' },
      { urgency: 'asc' },
      { createdAt: 'desc' },
    ],
    include: {
      coach: {
        include: { user: true },
      },
      ambassador: true,
    },
  })
}

export default async function AdminSponsorshipPage() {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  const requests = await getAllRequests()

  // Serialize data for client component
  const serializedRequests = requests.map((r) => ({
    id: r.id,
    requestType: r.requestType,
    beneficiaryType: r.beneficiaryType,
    ambassadorId: r.ambassadorId,
    ambassadorName: r.ambassador
      ? `${r.ambassador.firstName} ${r.ambassador.lastName}`
      : null,
    projectName: r.projectName,
    amountRequested: Number(r.amountRequested),
    amountContributing: r.amountContributing ? Number(r.amountContributing) : null,
    reason: r.reason,
    urgency: r.urgency,
    status: r.status,
    adminNotes: r.adminNotes,
    decidedAt: r.decidedAt?.toISOString() || null,
    createdAt: r.createdAt.toISOString(),
    coach: {
      id: r.coach.id,
      name: `${r.coach.firstName} ${r.coach.lastName}`,
      email: r.coach.user.email,
    },
  }))

  // Stats
  const stats = {
    total: requests.length,
    submitted: requests.filter((r) => r.status === 'SUBMITTED').length,
    underReview: requests.filter((r) => r.status === 'UNDER_REVIEW').length,
    approved: requests.filter((r) =>
      ['APPROVED_FULL', 'APPROVED_PARTIAL', 'PAYMENT_PLAN'].includes(r.status)
    ).length,
    notApproved: requests.filter((r) => r.status === 'NOT_APPROVED').length,
    totalRequested: requests
      .filter((r) => ['SUBMITTED', 'UNDER_REVIEW'].includes(r.status))
      .reduce((sum, r) => sum + Number(r.amountRequested), 0),
    totalApproved: requests
      .filter((r) => ['APPROVED_FULL', 'APPROVED_PARTIAL', 'PAYMENT_PLAN'].includes(r.status))
      .reduce((sum, r) => sum + Number(r.amountRequested), 0),
  }

  return <AdminSponsorshipClient requests={serializedRequests} stats={stats} />
}
