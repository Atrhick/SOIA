import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Users,
  UserCheck,
  UserX,
  HandCoins,
  Building2,
  Calendar,
  MessageSquare,
  ArrowRight,
  TrendingUp,
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
    include: {
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
  const [recentCoaches, recentSponsorships] = await Promise.all([
    prisma.coachProfile.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { user: true },
    }),
    prisma.sponsorshipRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { coach: true },
    }),
  ])

  return { recentCoaches, recentSponsorships }
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600">Overview of the StageOneInAction platform</p>
      </div>

      {/* Alerts */}
      <div className="grid gap-4 md:grid-cols-3">
        {stats.pendingSponsorships > 0 && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <HandCoins className="h-5 w-5 text-yellow-600" />
                <span className="text-yellow-800">
                  <strong>{stats.pendingSponsorships}</strong> pending sponsorship request(s)
                </span>
              </div>
              <Link href="/admin/sponsorship">
                <Button variant="outline" size="sm">Review</Button>
              </Link>
            </CardContent>
          </Card>
        )}
        {stats.pendingResourceCenters > 0 && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-blue-600" />
                <span className="text-blue-800">
                  <strong>{stats.pendingResourceCenters}</strong> Resource Center application(s)
                </span>
              </div>
              <Link href="/admin/resource-centers">
                <Button variant="outline" size="sm">Review</Button>
              </Link>
            </CardContent>
          </Card>
        )}
        {stats.openMessages > 0 && (
          <Card className="border-purple-200 bg-purple-50">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-5 w-5 text-purple-600" />
                <span className="text-purple-800">
                  <strong>{stats.openMessages}</strong> open message thread(s)
                </span>
              </div>
              <Link href="/admin/messages">
                <Button variant="outline" size="sm">View</Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Coaches
            </CardTitle>
            <Users className="h-4 w-4 text-primary-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCoaches}</div>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="success" className="text-xs">
                {stats.activeCoaches} active
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {stats.onboardingIncomplete} onboarding
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Ambassadors
            </CardTitle>
            <UserCheck className="h-4 w-4 text-primary-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAmbassadors}</div>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="success" className="text-xs">
                {stats.approvedAmbassadors} approved
              </Badge>
              <Badge variant="warning" className="text-xs">
                {stats.pendingAmbassadors} pending
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Sponsorship Requests
            </CardTitle>
            <HandCoins className="h-4 w-4 text-primary-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingSponsorships}</div>
            <p className="text-xs text-gray-500 mt-2">
              Awaiting review
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Resource Center Apps
            </CardTitle>
            <Building2 className="h-4 w-4 text-primary-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingResourceCenters}</div>
            <p className="text-xs text-gray-500 mt-2">
              Under review
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Events & Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming Events */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Upcoming Events
              </CardTitle>
              <Link href="/admin/events">
                <Button variant="ghost" size="sm">
                  Manage <ArrowRight className="ml-2 h-4 w-4" />
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
                      <p className="text-xs text-gray-500">
                        {event._count.qualifications} qualified
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

        {/* Recent Coaches */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Recent Coaches
              </CardTitle>
              <Link href="/admin/coaches">
                <Button variant="ghost" size="sm">
                  View All <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentActivity.recentCoaches.length > 0 ? (
              <div className="space-y-4">
                {recentActivity.recentCoaches.map((coach) => (
                  <div
                    key={coach.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary-700">
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
                    >
                      {coach.coachStatus === 'ACTIVE_COACH' ? 'Active' : 'Onboarding'}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                No coaches yet
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
            <Link href="/admin/coaches/new">
              <Button variant="outline" className="w-full justify-start">
                <Users className="mr-2 h-4 w-4" />
                Add New Coach
              </Button>
            </Link>
            <Link href="/admin/events/new">
              <Button variant="outline" className="w-full justify-start">
                <Calendar className="mr-2 h-4 w-4" />
                Create Event
              </Button>
            </Link>
            <Link href="/admin/reports">
              <Button variant="outline" className="w-full justify-start">
                <TrendingUp className="mr-2 h-4 w-4" />
                View Reports
              </Button>
            </Link>
            <Link href="/admin/messages">
              <Button variant="outline" className="w-full justify-start">
                <MessageSquare className="mr-2 h-4 w-4" />
                Message Center
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
