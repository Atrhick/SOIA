import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Users, UserPlus, ChevronRight } from 'lucide-react'

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
  return prisma.coachProfile.findMany({
    include: {
      user: true,
      ambassadors: true,
      recruiter: true,
      recruitedCoaches: true,
    },
    orderBy: { createdAt: 'desc' },
  })
}

export default async function CoachesPage() {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  const coaches = await getCoaches()

  // Stats
  const stats = {
    total: coaches.length,
    active: coaches.filter((c) => c.coachStatus === 'ACTIVE_COACH').length,
    onboarding: coaches.filter((c) => c.coachStatus === 'ONBOARDING_INCOMPLETE').length,
    suspended: coaches.filter((c) => c.user.status === 'SUSPENDED').length,
  }

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

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
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
        <Card>
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
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Users className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.onboarding}</p>
                <p className="text-sm text-gray-500">Onboarding</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
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
      </div>

      {/* Coach List */}
      <Card>
        <CardHeader>
          <CardTitle>All Coaches</CardTitle>
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

                    <div className="hidden sm:flex flex-col items-end gap-1">
                      <Badge variant={coachStatusVariants[coach.coachStatus]}>
                        {coach.coachStatus === 'ACTIVE_COACH' ? 'Active' : 'Onboarding'}
                      </Badge>
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
