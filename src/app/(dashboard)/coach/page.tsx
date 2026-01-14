import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { StatsCard } from '@/components/ui/stats-card'
import { AlertBanner } from '@/components/ui/alert-banner'
import { WelcomeHeader, SectionHeader } from '@/components/ui/page-header'
import { InlineEmptyState } from '@/components/ui/empty-state'
import {
  Users,
  CheckSquare,
  Target,
  DollarSign,
  Calendar,
  MessageSquare,
  ArrowRight,
  Briefcase,
  TrendingUp,
  HandCoins,
} from 'lucide-react'

async function getCoachData(userId: string) {
  const coachProfile = await prisma.coachProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      coachStatus: true,
      // Use counts instead of loading all ambassadors
      _count: {
        select: {
          ambassadors: true,
        },
      },
      onboardingProgress: {
        select: {
          status: true,
          task: {
            select: {
              isRequired: true,
            },
          },
        },
      },
      weeklyGoals: {
        where: {
          weekStart: {
            gte: new Date(new Date().setDate(new Date().getDate() - 7)),
          },
        },
        select: {
          status: true,
        },
      },
      incomeEntries: {
        where: {
          date: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
        select: {
          amount: true,
        },
      },
      businessExcellenceCRM: {
        select: {
          crmActivated: true,
          crmSubscriptionActive: true,
        },
      },
      websiteContentStatus: {
        select: {
          logoSubmitted: true,
          servicesSubmitted: true,
          productsSubmitted: true,
          pricingSubmitted: true,
          targetAudienceSubmitted: true,
          contactSubmitted: true,
          aboutSubmitted: true,
          visionMissionSubmitted: true,
          bioSubmitted: true,
        },
      },
    },
  })

  return coachProfile
}

// Get ambassador counts separately for better efficiency
async function getAmbassadorCounts(coachId: string) {
  const [pendingCount, approvedCount] = await Promise.all([
    prisma.ambassador.count({ where: { coachId, status: 'PENDING' } }),
    prisma.ambassador.count({ where: { coachId, status: 'APPROVED' } }),
  ])
  return { pendingCount, approvedCount }
}

async function getOnboardingTasks() {
  return prisma.onboardingTask.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  })
}

async function getUpcomingEvents() {
  return prisma.event.findMany({
    where: {
      isActive: true,
      startDate: { gte: new Date() },
    },
    orderBy: { startDate: 'asc' },
    take: 3,
    select: {
      id: true,
      name: true,
      location: true,
      startDate: true,
    },
  })
}

export default async function CoachDashboard() {
  const session = await auth()

  if (!session || session.user.role !== 'COACH') {
    redirect('/login')
  }

  const [coachData, onboardingTasks, upcomingEvents] = await Promise.all([
    getCoachData(session.user.id),
    getOnboardingTasks(),
    getUpcomingEvents(),
  ])

  if (!coachData) {
    redirect('/login')
  }

  // Fetch ambassador counts in parallel (only after we have coachData.id)
  const ambassadorCounts = await getAmbassadorCounts(coachData.id)

  // Calculate onboarding progress
  const completedTasks = coachData.onboardingProgress.filter(
    (p) => p.status === 'APPROVED'
  ).length
  const totalTasks = onboardingTasks.filter((t) => t.isRequired).length
  const onboardingPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0

  // Ambassador stats from database counts
  const pendingAmbassadors = ambassadorCounts.pendingCount
  const approvedAmbassadors = ambassadorCounts.approvedCount

  // Calculate income stats
  const monthlyIncome = coachData.incomeEntries.reduce(
    (sum, entry) => sum + Number(entry.amount),
    0
  )

  // Calculate weekly goals
  const completedGoals = coachData.weeklyGoals.filter(
    (g) => g.status === 'COMPLETED'
  ).length
  const totalGoals = coachData.weeklyGoals.length

  // Website content progress
  const websiteStatus = coachData.websiteContentStatus
  const websiteItems = websiteStatus
    ? [
        websiteStatus.logoSubmitted,
        websiteStatus.servicesSubmitted,
        websiteStatus.productsSubmitted,
        websiteStatus.pricingSubmitted,
        websiteStatus.targetAudienceSubmitted,
        websiteStatus.contactSubmitted,
        websiteStatus.aboutSubmitted,
        websiteStatus.visionMissionSubmitted,
        websiteStatus.bioSubmitted,
      ].filter(Boolean).length
    : 0

  // Build alerts array
  const alerts = []
  if (pendingAmbassadors > 0) {
    alerts.push({
      variant: 'warning' as const,
      iconName: 'Users',
      message: `You have ${pendingAmbassadors} pending ambassador${pendingAmbassadors > 1 ? 's' : ''} awaiting approval`,
      action: { label: 'Review', href: '/coach/ambassadors' },
    })
  }
  if (coachData.coachStatus === 'ONBOARDING_INCOMPLETE' && onboardingPercentage < 100) {
    alerts.push({
      variant: 'info' as const,
      iconName: 'CheckSquare',
      message: `Complete your onboarding to become an active coach (${Math.round(onboardingPercentage)}% complete)`,
      action: { label: 'Continue', href: '/coach/onboarding' },
    })
  }

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <WelcomeHeader
        name={coachData.firstName}
        message="Here's your dashboard overview"
        actions={
          <Badge
            variant={coachData.coachStatus === 'ACTIVE_COACH' ? 'success' : 'warning'}
            size="lg"
            dot
            dotColor={coachData.coachStatus === 'ACTIVE_COACH' ? 'green' : 'yellow'}
          >
            {coachData.coachStatus === 'ACTIVE_COACH' ? 'Active Coach' : 'Onboarding'}
          </Badge>
        }
      />

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-3">
          {alerts.map((alert, index) => (
            <AlertBanner key={index} {...alert} />
          ))}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Onboarding Progress"
          value={`${Math.round(onboardingPercentage)}%`}
          icon={CheckSquare}
          iconColor="primary"
          footer={{
            label: `${completedTasks} of ${totalTasks} tasks`,
            href: '/coach/onboarding',
          }}
        >
          <Progress value={onboardingPercentage} className="mt-2" />
        </StatsCard>

        <StatsCard
          title="Ambassadors"
          value={approvedAmbassadors}
          icon={Users}
          iconColor="green"
          footer={{
            label: `${approvedAmbassadors} approved`,
            value: pendingAmbassadors > 0 ? `${pendingAmbassadors} pending` : undefined,
            variant: pendingAmbassadors > 0 ? 'warning' : 'success',
            href: '/coach/ambassadors',
          }}
        />

        <StatsCard
          title="Weekly Goals"
          value={`${completedGoals}/${totalGoals}`}
          icon={Target}
          iconColor="yellow"
          trend={
            totalGoals > 0
              ? {
                  value: Math.round((completedGoals / totalGoals) * 100),
                  label: 'completed',
                  direction: completedGoals === totalGoals ? 'up' : undefined,
                }
              : undefined
          }
          footer={{
            label: 'Goals completed this week',
            href: '/coach/income-goals',
          }}
        />

        <StatsCard
          title="Monthly Income"
          value={`$${monthlyIncome.toLocaleString()}`}
          icon={DollarSign}
          iconColor="green"
          footer={{
            label: 'Tracked this month',
            href: '/coach/income-goals',
          }}
        />
      </div>

      {/* Business Excellence & Events */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Business Excellence Summary */}
        <Card variant="default">
          <CardHeader>
            <SectionHeader
              title="Business Excellence"
              icon={Briefcase}
              actions={
                <Link href="/coach/business-excellence">
                  <Button variant="ghost" size="sm">
                    View Details <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              }
            />
          </CardHeader>
          <CardContent className="space-y-4">
            {/* CRM Status */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
              <span className="text-sm font-medium text-gray-700">CRM Activated</span>
              <Badge variant={coachData.businessExcellenceCRM?.crmActivated ? 'success' : 'secondary'}>
                {coachData.businessExcellenceCRM?.crmActivated ? 'Yes' : 'No'}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
              <span className="text-sm font-medium text-gray-700">CRM Subscription</span>
              <Badge variant={coachData.businessExcellenceCRM?.crmSubscriptionActive ? 'success' : 'secondary'}>
                {coachData.businessExcellenceCRM?.crmSubscriptionActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            {/* Website Content */}
            <div className="p-3 rounded-lg bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Website Content</span>
                <span className="text-sm font-semibold text-primary-600">{websiteItems}/9 items</span>
              </div>
              <Progress value={(websiteItems / 9) * 100} />
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card variant="default">
          <CardHeader>
            <SectionHeader
              title="Upcoming Events"
              icon={Calendar}
              actions={
                <Link href="/coach/events">
                  <Button variant="ghost" size="sm">
                    View All <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              }
            />
          </CardHeader>
          <CardContent>
            {upcomingEvents.length > 0 ? (
              <div className="space-y-3">
                {upcomingEvents.map((event) => (
                  <Link
                    key={event.id}
                    href={`/coach/events/${event.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all duration-150"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary-50 flex items-center justify-center">
                        <Calendar className="h-5 w-5 text-primary-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{event.name}</p>
                        <p className="text-sm text-gray-500">{event.location}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-primary-600">
                        {new Date(event.startDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <InlineEmptyState
                icon={Calendar}
                message="No upcoming events scheduled"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card variant="default">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-gray-400" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link href="/coach/income-goals" className="quick-action group">
              <Target className="h-6 w-6 text-gray-400 quick-action-icon mb-2" />
              <span className="text-sm font-medium text-gray-700 group-hover:text-primary-700">
                Set Weekly Goals
              </span>
            </Link>
            <Link href="/coach/income-goals" className="quick-action group">
              <DollarSign className="h-6 w-6 text-gray-400 quick-action-icon mb-2" />
              <span className="text-sm font-medium text-gray-700 group-hover:text-primary-700">
                Log Income
              </span>
            </Link>
            <Link href="/coach/sponsorship" className="quick-action group">
              <HandCoins className="h-6 w-6 text-gray-400 quick-action-icon mb-2" />
              <span className="text-sm font-medium text-gray-700 group-hover:text-primary-700">
                Request Sponsorship
              </span>
            </Link>
            <Link href="/coach/messages" className="quick-action group">
              <MessageSquare className="h-6 w-6 text-gray-400 quick-action-icon mb-2" />
              <span className="text-sm font-medium text-gray-700 group-hover:text-primary-700">
                Contact Admin
              </span>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
