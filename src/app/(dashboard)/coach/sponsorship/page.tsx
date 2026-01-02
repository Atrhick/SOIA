import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { SponsorshipClient } from './sponsorship-client'

async function getCoachData() {
  const session = await auth()
  if (!session || session.user.role !== 'COACH') {
    return null
  }

  const coach = await prisma.coachProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      sponsorshipRequests: {
        orderBy: { createdAt: 'desc' },
        include: {
          ambassador: true,
        },
      },
      ambassadors: {
        where: { status: 'APPROVED' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  })

  return coach
}

export default async function SponsorshipPage() {
  const session = await auth()

  if (!session || session.user.role !== 'COACH') {
    redirect('/login')
  }

  const coach = await getCoachData()

  if (!coach) {
    redirect('/login')
  }

  // Serialize data for client component
  const serializedRequests = coach.sponsorshipRequests.map((r) => ({
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
  }))

  const ambassadors = coach.ambassadors.map((a) => ({
    id: a.id,
    name: `${a.firstName} ${a.lastName}`,
  }))

  // Stats
  const stats = {
    total: coach.sponsorshipRequests.length,
    pending: coach.sponsorshipRequests.filter((r) =>
      ['SUBMITTED', 'UNDER_REVIEW'].includes(r.status)
    ).length,
    approved: coach.sponsorshipRequests.filter((r) =>
      ['APPROVED_FULL', 'APPROVED_PARTIAL', 'PAYMENT_PLAN'].includes(r.status)
    ).length,
    totalApprovedAmount: coach.sponsorshipRequests
      .filter((r) => ['APPROVED_FULL', 'APPROVED_PARTIAL', 'PAYMENT_PLAN'].includes(r.status))
      .reduce((sum, r) => sum + Number(r.amountRequested), 0),
  }

  return (
    <SponsorshipClient
      requests={serializedRequests}
      ambassadors={ambassadors}
      stats={stats}
    />
  )
}
