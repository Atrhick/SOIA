import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import {
  Users,
  CheckSquare,
  Target,
  DollarSign,
  Calendar,
  MessageSquare,
  ArrowRight,
  Briefcase,
} from 'lucide-react'

async function getCoachData(userId: string) {
  const coachProfile = await prisma.coachProfile.findUnique({
    where: { userId },
    include: {
      ambassadors: true,
      onboardingProgress: {
        include: { task: true },
      },
      weeklyGoals: {
        where: {
          weekStart: {
            gte: new Date(new Date().setDate(new Date().getDate() - 7)),
          },
        },
      },
      incomeEntries: {
        where: {
          date: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      },
      businessExcellenceCRM: true,
      websiteContentStatus: true,
    },
  })

  return coachProfile
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

  // Calculate onboarding progress
  const completedTasks = coachData.onboardingProgress.filter(
    (p) => p.status === 'APPROVED'
  ).length
  const totalTasks = onboardingTasks.filter((t) => t.isRequired).length
  const onboardingPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0

  // Calculate ambassador stats
  const pendingAmbassadors = coachData.ambassadors.filter(
    (a) => a.status === 'PENDING'
  ).length
  const approvedAmbassadors = coachData.ambassadors.filter(
    (a) => a.status === 'APPROVED'
  ).length

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

  return (
    <div className="space-y-6">
      {/* Welcome & Status */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome, {coachData.firstName}!
          </h1>
          <p className="text-gray-600">Here&apos;s your dashboard overview</p>
        </div>
        <Badge
          variant={coachData.coachStatus === 'ACTIVE_COACH' ? 'success' : 'warning'}
          className="text-sm px-3 py-1"
        >
          {coachData.coachStatus === 'ACTIVE_COACH' ? 'Active Coach' : 'Onboarding Incomplete'}
        </Badge>
      </div>

      {/* Pending Ambassadors Alert */}
      {pendingAmbassadors > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-yellow-600" />
              <span className="text-yellow-800">
                You have <strong>{pendingAmbassadors}</strong> pending ambassador(s)
              </span>
            </div>
            <Link href="/coach/ambassadors">
              <Button variant="outline" size="sm">
                View Pending <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Onboarding Progress
            </CardTitle>
            <CheckSquare className="h-4 w-4 text-primary-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(onboardingPercentage)}%</div>
            <Progress value={onboardingPercentage} className="mt-2" />
            <p className="text-xs text-gray-500 mt-2">
              {completedTasks} of {totalTasks} tasks completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Ambassadors
            </CardTitle>
            <Users className="h-4 w-4 text-primary-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedAmbassadors}</div>
            <p className="text-xs text-gray-500 mt-2">
              {pendingAmbassadors} pending approval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Weekly Goals
            </CardTitle>
            <Target className="h-4 w-4 text-primary-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {completedGoals}/{totalGoals}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Goals completed this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Monthly Income
            </CardTitle>
            <DollarSign className="h-4 w-4 text-primary-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${monthlyIncome.toLocaleString()}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              This month&apos;s tracked income
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Business Excellence & Events */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Business Excellence Summary */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Business Excellence
              </CardTitle>
              <Link href="/coach/business-excellence">
                <Button variant="ghost" size="sm">
                  View Details <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* CRM Status */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">CRM Activated</span>
              <Badge variant={coachData.businessExcellenceCRM?.crmActivated ? 'success' : 'secondary'}>
                {coachData.businessExcellenceCRM?.crmActivated ? 'Yes' : 'No'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">CRM Subscription</span>
              <Badge variant={coachData.businessExcellenceCRM?.crmSubscriptionActive ? 'success' : 'secondary'}>
                {coachData.businessExcellenceCRM?.crmSubscriptionActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            {/* Website Content */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Website Content</span>
                <span className="text-sm font-medium">{websiteItems}/9 items</span>
              </div>
              <Progress value={(websiteItems / 9) * 100} />
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Upcoming Events
              </CardTitle>
              <Link href="/coach/events">
                <Button variant="ghost" size="sm">
                  View All <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {upcomingEvents.length > 0 ? (
              <div className="space-y-4">
                {upcomingEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{event.name}</p>
                      <p className="text-sm text-gray-500">{event.location}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-primary-600">
                        {new Date(event.startDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                No upcoming events
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link href="/coach/weekly-goals">
              <Button variant="outline" className="w-full justify-start">
                <Target className="mr-2 h-4 w-4" />
                Set Weekly Goals
              </Button>
            </Link>
            <Link href="/coach/income">
              <Button variant="outline" className="w-full justify-start">
                <DollarSign className="mr-2 h-4 w-4" />
                Log Income
              </Button>
            </Link>
            <Link href="/coach/sponsorship">
              <Button variant="outline" className="w-full justify-start">
                <Users className="mr-2 h-4 w-4" />
                Request Sponsorship
              </Button>
            </Link>
            <Link href="/coach/messages">
              <Button variant="outline" className="w-full justify-start">
                <MessageSquare className="mr-2 h-4 w-4" />
                Contact Admin
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
