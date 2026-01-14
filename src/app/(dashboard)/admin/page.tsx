import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatsCard } from '@/components/ui/stats-card'
import { AlertBanner } from '@/components/ui/alert-banner'
import { WelcomeHeader, SectionHeader } from '@/components/ui/page-header'
import { EmptyState, InlineEmptyState } from '@/components/ui/empty-state'
import {
  Users,
  UserCheck,
  HandCoins,
  Building2,
  Calendar,
  MessageSquare,
  ArrowRight,
  TrendingUp,
  Plus,
  BarChart3,
} from 'lucide-react'

async function getDashboardStats() {
  const [
    totalCoaches,
    activeCoaches,
    inactiveCoaches,
    onboardingIncomplete,
    totalAmbassadors,
    pendingAmbassadors,
    approvedAmbassadors,
    pendingSponsorships,
    pendingResourceCenters,
    openMessages,
  ] = await Promise.all([
    prisma.coachProfile.count(),
    prisma.coachProfile.count({ where: { coachStatus: 'ACTIVE_COACH' } }),
    prisma.user.count({ where: { role: 'COACH', status: 'INACTIVE' } }),
    prisma.coachProfile.count({ where: { coachStatus: 'ONBOARDING_INCOMPLETE' } }),
    prisma.ambassador.count(),
    prisma.ambassador.count({ where: { status: 'PENDING' } }),
    prisma.ambassador.count({ where: { status: 'APPROVED' } }),
    prisma.sponsorshipRequest.count({ where: { status: 'SUBMITTED' } }),
    prisma.resourceCenterApplication.count({ where: { status: 'UNDER_REVIEW' } }),
    prisma.messageThread.count({ where: { status: 'OPEN' } }),
  ])

  return {
    totalCoaches,
    activeCoaches,
    inactiveCoaches,
    onboardingIncomplete,
    totalAmbassadors,
    pendingAmbassadors,
    approvedAmbassadors,
    pendingSponsorships,
    pendingResourceCenters,
    openMessages,
  }
}

async function getUpcomingEvents() {
  return prisma.event.findMany({
    where: {
      isActive: true,
      startDate: { gte: new Date() },
    },
    orderBy: { startDate: 'asc' },
    take: 5,
    select: {
      id: true,
      name: true,
      location: true,
      startDate: true,
      _count: {
        select: {
          qualifications: { where: { status: 'QUALIFIED' } },
          rsvps: { where: { status: 'YES' } },
        },
      },
    },
  })
}

async function getRecentActivity() {
  const recentCoaches = await prisma.coachProfile.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      coachStatus: true,
      user: {
        select: {
          email: true,
        },
      },
    },
  })

  return { recentCoaches }
}

export default async function AdminDashboard() {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  const [stats, upcomingEvents, recentActivity] = await Promise.all([
    getDashboardStats(),
    getUpcomingEvents(),
    getRecentActivity(),
  ])

  // Build alerts array
  const alerts = []
  if (stats.pendingSponsorships > 0) {
    alerts.push({
      variant: 'warning' as const,
      iconName: 'HandCoins',
      message: `${stats.pendingSponsorships} pending sponsorship request${stats.pendingSponsorships > 1 ? 's' : ''} awaiting review`,
      action: { label: 'Review', href: '/admin/sponsorship' },
    })
  }
  if (stats.pendingResourceCenters > 0) {
    alerts.push({
      variant: 'info' as const,
      iconName: 'Building2',
      message: `${stats.pendingResourceCenters} Resource Center application${stats.pendingResourceCenters > 1 ? 's' : ''} under review`,
      action: { label: 'Review', href: '/admin/resource-centers' },
    })
  }
  if (stats.openMessages > 0) {
    alerts.push({
      variant: 'info' as const,
      iconName: 'MessageSquare',
      message: `${stats.openMessages} open message thread${stats.openMessages > 1 ? 's' : ''} need attention`,
      action: { label: 'View', href: '/admin/messages' },
    })
  }

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <WelcomeHeader
        name="Admin"
        message="Here's an overview of your platform"
        actions={
          <Link href="/admin/coaches/new">
            <Button variant="gradient">
              <Plus className="mr-2 h-4 w-4" />
              Add Coach
            </Button>
          </Link>
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
          title="Total Coaches"
          value={stats.totalCoaches}
          icon={Users}
          iconColor="primary"
          footer={{
            label: `${stats.activeCoaches} active`,
            value: stats.onboardingIncomplete > 0 ? `${stats.onboardingIncomplete} onboarding` : undefined,
            variant: 'secondary',
            href: '/admin/coaches',
          }}
        />

        <StatsCard
          title="Total Ambassadors"
          value={stats.totalAmbassadors}
          icon={UserCheck}
          iconColor="green"
          footer={{
            label: `${stats.approvedAmbassadors} approved`,
            value: stats.pendingAmbassadors > 0 ? `${stats.pendingAmbassadors} pending` : undefined,
            variant: stats.pendingAmbassadors > 0 ? 'warning' : 'success',
            href: '/admin/ambassadors',
          }}
        />

        <StatsCard
          title="Sponsorship Requests"
          value={stats.pendingSponsorships}
          icon={HandCoins}
          iconColor="yellow"
          footer={{
            label: 'Awaiting review',
            href: '/admin/sponsorship',
          }}
        />

        <StatsCard
          title="Resource Center Apps"
          value={stats.pendingResourceCenters}
          icon={Building2}
          iconColor="purple"
          footer={{
            label: 'Under review',
            href: '/admin/resource-centers',
          }}
        />
      </div>

      {/* Events & Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming Events */}
        <Card variant="default">
          <CardHeader>
            <SectionHeader
              title="Upcoming Events"
              actions={
                <Link href="/admin/events">
                  <Button variant="ghost" size="sm">
                    Manage <ArrowRight className="ml-2 h-4 w-4" />
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
                    href={`/admin/events/${event.id}`}
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
                      <p className="text-xs text-gray-500">
                        {event._count.qualifications} qualified
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

        {/* Recent Coaches */}
        <Card variant="default">
          <CardHeader>
            <SectionHeader
              title="Recent Coaches"
              actions={
                <Link href="/admin/coaches">
                  <Button variant="ghost" size="sm">
                    View All <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              }
            />
          </CardHeader>
          <CardContent>
            {recentActivity.recentCoaches.length > 0 ? (
              <div className="space-y-3">
                {recentActivity.recentCoaches.map((coach) => (
                  <Link
                    key={coach.id}
                    href={`/admin/coaches/${coach.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all duration-150"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-sm">
                        <span className="text-sm font-semibold text-white">
                          {coach.firstName[0]}{coach.lastName[0]}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {coach.firstName} {coach.lastName}
                        </p>
                        <p className="text-sm text-gray-500">{coach.user.email}</p>
                      </div>
                    </div>
                    <Badge
                      variant={coach.coachStatus === 'ACTIVE_COACH' ? 'success' : 'warning'}
                      dot
                      dotColor={coach.coachStatus === 'ACTIVE_COACH' ? 'green' : 'yellow'}
                    >
                      {coach.coachStatus === 'ACTIVE_COACH' ? 'Active' : 'Onboarding'}
                    </Badge>
                  </Link>
                ))}
              </div>
            ) : (
              <InlineEmptyState
                icon={Users}
                message="No coaches registered yet"
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
            <Link href="/admin/coaches/new" className="quick-action group">
              <Users className="h-6 w-6 text-gray-400 quick-action-icon mb-2" />
              <span className="text-sm font-medium text-gray-700 group-hover:text-primary-700">
                Add New Coach
              </span>
            </Link>
            <Link href="/admin/events/new" className="quick-action group">
              <Calendar className="h-6 w-6 text-gray-400 quick-action-icon mb-2" />
              <span className="text-sm font-medium text-gray-700 group-hover:text-primary-700">
                Create Event
              </span>
            </Link>
            <Link href="/admin/reports" className="quick-action group">
              <BarChart3 className="h-6 w-6 text-gray-400 quick-action-icon mb-2" />
              <span className="text-sm font-medium text-gray-700 group-hover:text-primary-700">
                View Reports
              </span>
            </Link>
            <Link href="/admin/messages" className="quick-action group">
              <MessageSquare className="h-6 w-6 text-gray-400 quick-action-icon mb-2" />
              <span className="text-sm font-medium text-gray-700 group-hover:text-primary-700">
                Message Center
              </span>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
