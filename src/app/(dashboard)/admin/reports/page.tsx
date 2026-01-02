import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { AdminReportsClient } from './admin-reports-client'

async function getReportData() {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    // Coach stats
    totalCoaches,
    activeCoaches,
    pendingCoaches,
    newCoachesThisMonth,

    // Ambassador stats
    totalAmbassadors,
    approvedAmbassadors,
    pendingAmbassadors,
    newAmbassadorsThisMonth,

    // Sponsorship stats
    totalSponsorships,
    pendingSponsorships,
    approvedSponsorships,
    totalApprovedAmount,

    // Event stats
    totalEvents,
    upcomingEvents,
    totalRSVPs,

    // Course stats
    totalCourses,
    totalQuizAttempts,
    passedQuizAttempts,

    // Income stats
    totalIncomeEntries,
    thisMonthIncome,

    // Resource center stats
    totalResourceCenters,
    pendingApplications,
  ] = await Promise.all([
    // Coach counts
    prisma.coachProfile.count(),
    prisma.coachProfile.count({ where: { coachStatus: 'ACTIVE_COACH' } }),
    prisma.coachProfile.count({ where: { coachStatus: 'ONBOARDING_INCOMPLETE' } }),
    prisma.coachProfile.count({ where: { createdAt: { gte: startOfMonth } } }),

    // Ambassador counts
    prisma.ambassador.count(),
    prisma.ambassador.count({ where: { status: 'APPROVED' } }),
    prisma.ambassador.count({ where: { status: 'PENDING' } }),
    prisma.ambassador.count({ where: { createdAt: { gte: startOfMonth } } }),

    // Sponsorship counts
    prisma.sponsorshipRequest.count(),
    prisma.sponsorshipRequest.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
    prisma.sponsorshipRequest.count({ where: { status: { in: ['APPROVED_FULL', 'APPROVED_PARTIAL', 'PAYMENT_PLAN'] } } }),
    prisma.sponsorshipRequest.aggregate({
      where: { status: { in: ['APPROVED_FULL', 'APPROVED_PARTIAL', 'PAYMENT_PLAN'] } },
      _sum: { amountRequested: true },
    }),

    // Event counts
    prisma.event.count(),
    prisma.event.count({ where: { startDate: { gte: now } } }),
    prisma.eventRSVP.count({ where: { status: 'YES' } }),

    // Course counts
    prisma.course.count({ where: { isActive: true } }),
    prisma.quizResult.count(),
    prisma.quizResult.count({ where: { passed: true } }),

    // Income entries
    prisma.incomeEntry.count(),
    prisma.incomeEntry.aggregate({
      where: { date: { gte: startOfMonth } },
      _sum: { amount: true },
    }),

    // Resource center counts
    prisma.resourceCenter.count(),
    prisma.resourceCenterApplication.count({ where: { status: 'UNDER_REVIEW' } }),
  ])

  return {
    coaches: {
      total: totalCoaches,
      active: activeCoaches,
      pending: pendingCoaches,
      newThisMonth: newCoachesThisMonth,
    },
    ambassadors: {
      total: totalAmbassadors,
      approved: approvedAmbassadors,
      pending: pendingAmbassadors,
      newThisMonth: newAmbassadorsThisMonth,
    },
    sponsorships: {
      total: totalSponsorships,
      pending: pendingSponsorships,
      approved: approvedSponsorships,
      totalApprovedAmount: totalApprovedAmount._sum.amountRequested?.toNumber() || 0,
    },
    events: {
      total: totalEvents,
      upcoming: upcomingEvents,
      totalRSVPs: totalRSVPs,
    },
    courses: {
      total: totalCourses,
      quizAttempts: totalQuizAttempts,
      passedAttempts: passedQuizAttempts,
      passRate: totalQuizAttempts > 0 ? Math.round((passedQuizAttempts / totalQuizAttempts) * 100) : 0,
    },
    income: {
      totalEntries: totalIncomeEntries,
      thisMonth: thisMonthIncome._sum.amount?.toNumber() || 0,
    },
    resourceCenters: {
      total: totalResourceCenters,
      pendingApplications: pendingApplications,
    },
  }
}

async function getDetailedReports() {
  const [coaches, ambassadors, sponsorships, events] = await Promise.all([
    // Coaches detail
    prisma.coachProfile.findMany({
      include: {
        user: true,
        ambassadors: true,
        recruitedCoaches: true,
        incomeEntries: {
          where: {
            date: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            },
          },
        },
        quizResults: {
          where: { passed: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),

    // Ambassadors detail
    prisma.ambassador.findMany({
      include: {
        coach: {
          include: { user: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),

    // Sponsorships detail
    prisma.sponsorshipRequest.findMany({
      include: {
        coach: {
          include: { user: true },
        },
        ambassador: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),

    // Events detail
    prisma.event.findMany({
      include: {
        rsvps: true,
      },
      orderBy: { startDate: 'desc' },
      take: 50,
    }),
  ])

  return {
    coaches: coaches.map((c) => ({
      id: c.id,
      name: `${c.firstName} ${c.lastName}`,
      email: c.user.email,
      status: c.coachStatus,
      ambassadorCount: c.ambassadors.length,
      recruitedCount: c.recruitedCoaches.length,
      monthlyIncome: c.incomeEntries.reduce((sum, e) => sum + e.amount.toNumber(), 0),
      coursesCompleted: c.quizResults.length,
      createdAt: c.createdAt.toISOString(),
    })),
    ambassadors: ambassadors.map((a) => ({
      id: a.id,
      name: `${a.firstName} ${a.lastName}`,
      email: a.email || 'N/A',
      status: a.status,
      coachName: `${a.coach.firstName} ${a.coach.lastName}`,
      createdAt: a.createdAt.toISOString(),
    })),
    sponsorships: sponsorships.map((s) => ({
      id: s.id,
      type: s.requestType,
      coachName: `${s.coach.firstName} ${s.coach.lastName}`,
      requestedAmount: s.amountRequested.toNumber(),
      approvedAmount: null, // No approved amount field in current schema
      status: s.status,
      createdAt: s.createdAt.toISOString(),
    })),
    events: events.map((e) => ({
      id: e.id,
      name: e.name,
      startDate: e.startDate.toISOString(),
      location: e.location,
      yesCount: e.rsvps.filter((r) => r.status === 'YES').length,
      maybeCount: e.rsvps.filter((r) => r.status === 'MAYBE').length,
    })),
  }
}

export default async function AdminReportsPage() {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  const [stats, reports] = await Promise.all([
    getReportData(),
    getDetailedReports(),
  ])

  return <AdminReportsClient stats={stats} reports={reports} />
}
