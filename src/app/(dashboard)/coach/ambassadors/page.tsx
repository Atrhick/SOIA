import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Users, UserPlus, Eye, ChevronRight } from 'lucide-react'
import { AmbassadorFilters } from './ambassador-filters'

const statusVariants = {
  PENDING: 'warning',
  APPROVED: 'success',
  INACTIVE: 'secondary',
  COMPLETED: 'default',
  ON_HOLD: 'destructive',
} as const

async function getAmbassadors(userId: string) {
  const coachProfile = await prisma.coachProfile.findUnique({
    where: { userId },
    include: {
      ambassadors: {
        orderBy: { createdAt: 'desc' },
      },
    },
  })
  return coachProfile?.ambassadors || []
}

export default async function AmbassadorsPage({
  searchParams,
}: {
  searchParams: { status?: string; search?: string }
}) {
  const session = await auth()

  if (!session || session.user.role !== 'COACH') {
    redirect('/login')
  }

  const allAmbassadors = await getAmbassadors(session.user.id)

  // Filter ambassadors based on search params
  let ambassadors = allAmbassadors

  if (searchParams.status && searchParams.status !== 'all') {
    ambassadors = ambassadors.filter((a) => a.status === searchParams.status)
  }

  if (searchParams.search) {
    const search = searchParams.search.toLowerCase()
    ambassadors = ambassadors.filter(
      (a) =>
        a.firstName.toLowerCase().includes(search) ||
        a.lastName.toLowerCase().includes(search) ||
        a.email?.toLowerCase().includes(search) ||
        a.region?.toLowerCase().includes(search)
    )
  }

  // Stats
  const stats = {
    total: allAmbassadors.length,
    pending: allAmbassadors.filter((a) => a.status === 'PENDING').length,
    approved: allAmbassadors.filter((a) => a.status === 'APPROVED').length,
    inactive: allAmbassadors.filter((a) => a.status === 'INACTIVE').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ambassadors</h1>
          <p className="text-gray-600">Manage your assigned ambassadors</p>
        </div>
        <Link href="/coach/ambassadors/new">
          <Button>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Ambassador
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
                <p className="text-sm text-gray-500">Total</p>
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
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-sm text-gray-500">Pending</p>
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
                <p className="text-2xl font-bold">{stats.approved}</p>
                <p className="text-sm text-gray-500">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gray-100 rounded-lg">
                <Users className="h-6 w-6 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.inactive}</p>
                <p className="text-sm text-gray-500">Inactive</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <AmbassadorFilters />

      {/* Ambassador List */}
      <Card>
        <CardHeader>
          <CardTitle>
            Ambassador List
            {searchParams.status && searchParams.status !== 'all' && (
              <Badge variant="secondary" className="ml-2">
                Filtered: {searchParams.status}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ambassadors.length > 0 ? (
            <div className="divide-y">
              {ambassadors.map((ambassador) => (
                <Link
                  key={ambassador.id}
                  href={`/coach/ambassadors/${ambassador.id}`}
                  className="flex items-center justify-between py-4 hover:bg-gray-50 -mx-6 px-6 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary-700">
                        {ambassador.firstName[0]}{ambassador.lastName[0]}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {ambassador.firstName} {ambassador.lastName}
                      </p>
                      <p className="text-sm text-gray-500">
                        {ambassador.region || ambassador.email || 'No contact info'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <Badge variant={statusVariants[ambassador.status]}>
                        {ambassador.status}
                      </Badge>
                      <p className="text-xs text-gray-400 mt-1">
                        {ambassador.assessmentStatus.replace('_', ' ')}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-4 text-gray-500">
                {searchParams.status || searchParams.search
                  ? 'No ambassadors match your filters'
                  : 'No ambassadors yet'}
              </p>
              {!searchParams.status && !searchParams.search && (
                <Link href="/coach/ambassadors/new">
                  <Button className="mt-4">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add Your First Ambassador
                  </Button>
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
