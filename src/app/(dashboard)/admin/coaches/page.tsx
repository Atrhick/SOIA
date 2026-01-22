import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Users, UserPlus, ChevronRight, Clock } from 'lucide-react'

const userStatusVariants = {
  ACTIVE: 'success',
  INACTIVE: 'secondary',
  SUSPENDED: 'destructive',
} as const

const coachStatusVariants = {
  ACTIVE_COACH: 'success',
  ONBOARDING_INCOMPLETE: 'warning',
} as const

async function getCoaches() {
  const [coaches, requiredTasksCount] = await Promise.all([
    prisma.coachProfile.findMany({
      include: {
        user: true,
        ambassadors: true,
        recruiter: true,
        recruitedCoaches: true,
        onboardingProgress: {
          where: { status: 'APPROVED' },
          include: { task: { select: { isRequired: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.onboardingTask.count({
      where: { isActive: true, isRequired: true },
    }),
  ])

  // Calculate onboarding progress for each coach
  return coaches.map((coach) => {
    const completedRequired = coach.onboardingProgress.filter(
      (p) => p.task.isRequired
    ).length
    const onboardingPercentage = requiredTasksCount > 0
      ? Math.round((completedRequired / requiredTasksCount) * 100)
      : 0

    return {
      ...coach,
      onboardingPercentage,
      completedTasks: completedRequired,
      totalRequiredTasks: requiredTasksCount,
    }
  })
}

interface PageProps {
  searchParams: Promise<{ filter?: string }>
}

export default async function CoachesPage({ searchParams }: PageProps) {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  const params = await searchParams
  const filter = params.filter || 'all'

  const allCoaches = await getCoaches()

  // Stats (always calculated from all coaches)
  const stats = {
    total: allCoaches.length,
    active: allCoaches.filter((c) => c.coachStatus === 'ACTIVE_COACH').length,
    onboarding: allCoaches.filter((c) => c.coachStatus === 'ONBOARDING_INCOMPLETE').length,
    suspended: allCoaches.filter((c) => c.user.status === 'SUSPENDED').length,
  }

  // Filter coaches based on URL param
  const coaches = filter === 'all'
    ? allCoaches
    : filter === 'active'
      ? allCoaches.filter((c) => c.coachStatus === 'ACTIVE_COACH')
      : filter === 'onboarding'
        ? allCoaches.filter((c) => c.coachStatus === 'ONBOARDING_INCOMPLETE')
        : filter === 'suspended'
          ? allCoaches.filter((c) => c.user.status === 'SUSPENDED')
          : allCoaches

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Coaches</h1>
          <p className="text-gray-600">Manage all coaches in the platform</p>
        </div>
        <Link href="/admin/coaches/new">
          <Button>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Coach
          </Button>
        </Link>
      </div>

      {/* Stats - Clickable Filters */}
      <div className="grid gap-4 md:grid-cols-4">
        <Link href="/admin/coaches">
          <Card className={`cursor-pointer transition-all hover:shadow-md ${filter === 'all' ? 'ring-2 ring-primary-500' : ''}`}>
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary-100 rounded-lg">
                  <Users className="h-6 w-6 text-primary-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm text-gray-500">Total Coaches</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/coaches?filter=active">
          <Card className={`cursor-pointer transition-all hover:shadow-md ${filter === 'active' ? 'ring-2 ring-green-500' : ''}`}>
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <Users className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.active}</p>
                  <p className="text-sm text-gray-500">Active Coaches</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/coaches?filter=onboarding">
          <Card className={`cursor-pointer transition-all hover:shadow-md ${filter === 'onboarding' ? 'ring-2 ring-amber-500' : ''}`}>
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.onboarding}</p>
                  <p className="text-sm text-gray-500">Onboarding</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/coaches?filter=suspended">
          <Card className={`cursor-pointer transition-all hover:shadow-md ${filter === 'suspended' ? 'ring-2 ring-red-500' : ''}`}>
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-100 rounded-lg">
                  <Users className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.suspended}</p>
                  <p className="text-sm text-gray-500">Suspended</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Coach List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {filter === 'all' ? 'All Coaches' :
               filter === 'active' ? 'Active Coaches' :
               filter === 'onboarding' ? 'Coaches in Onboarding' :
               filter === 'suspended' ? 'Suspended Coaches' : 'All Coaches'}
            </CardTitle>
            {filter !== 'all' && (
              <Link
                href="/admin/coaches"
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                Clear filter
              </Link>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {coaches.length > 0 ? (
            <div className="divide-y">
              {coaches.map((coach) => (
                <Link
                  key={coach.id}
                  href={`/admin/coaches/${coach.id}`}
                  className="flex items-center justify-between py-4 hover:bg-gray-50 -mx-6 px-6 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center">
                      <span className="text-lg font-medium text-primary-700">
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

                  <div className="flex items-center gap-6">
                    <div className="hidden md:block text-center">
                      <p className="text-lg font-semibold">{coach.ambassadors.length}</p>
                      <p className="text-xs text-gray-500">Ambassadors</p>
                    </div>

                    <div className="hidden lg:block text-center">
                      <p className="text-lg font-semibold">{coach.recruitedCoaches.length}</p>
                      <p className="text-xs text-gray-500">Recruited</p>
                    </div>

                    <div className="hidden sm:flex flex-col items-end gap-1.5">
                      {coach.coachStatus === 'ACTIVE_COACH' ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 text-amber-500" />
                            <span className="text-xs font-semibold text-amber-700">
                              Onboarding
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-500">
                              {coach.completedTasks}/{coach.totalRequiredTasks} tasks
                            </span>
                            <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-amber-500 rounded-full transition-all"
                                style={{ width: `${coach.onboardingPercentage}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                      <Badge variant={userStatusVariants[coach.user.status]} className="text-xs">
                        {coach.user.status}
                      </Badge>
                    </div>

                    <div className="hidden lg:block text-sm text-gray-500">
                      {coach.region || coach.country || '-'}
                    </div>

                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-4 text-gray-500">No coaches yet</p>
              <Link href="/admin/coaches/new">
                <Button className="mt-4">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add First Coach
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
