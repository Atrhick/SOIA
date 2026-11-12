import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { DiscoveryTabs } from '@/components/get-involved/discovery-tabs'
import { HostsClient } from './hosts-client'

export const dynamic = 'force-dynamic'

export default async function HostsPage({ searchParams }: { searchParams: { edit?: string } }) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') redirect('/login')
  // Admins and coaches can host (both have a calls page). Existing hosts stay listed even if their account changed.
  const [people, upcoming] = await Promise.all([prisma.user.findMany({
    where: { OR: [{ role: { in: ['ADMIN', 'COACH'] }, status: 'ACTIVE' }, { discoveryHost: { isNot: null } }] },
    orderBy: [{ role: 'asc' }, { email: 'asc' }],
    select: {
      id: true, email: true, role: true,
      coachProfile: { select: { firstName: true, lastName: true } },
      discoveryHost: { include: { _count: { select: { availability: true } } } },
    },
  }), prisma.discoveryCall.groupBy({ by: ['hostId'], where: { status: 'BOOKED', startsAt: { gt: new Date() }, hostId: { not: null } }, _count: { _all: true } })])
  const upcomingBy = new Map(upcoming.map((u) => [u.hostId, u._count._all]))
  return (
    <div className="space-y-6">
      <DiscoveryTabs active="/admin/discovery-calls/hosts" />
      <HostsClient
        initialOpen={searchParams.edit ?? null}
        people={people.map((a) => ({
          userId: a.id,
          email: a.email,
          role: a.role,
          name: a.coachProfile ? `${a.coachProfile.firstName} ${a.coachProfile.lastName}`.trim() : '',
          host: a.discoveryHost
            ? { displayName: a.discoveryHost.displayName, active: a.discoveryHost.active, ageRanges: a.discoveryHost.ageRanges, meetingUrl: a.discoveryHost.meetingUrl ?? '', timezone: a.discoveryHost.timezone, blocks: a.discoveryHost._count.availability, upcoming: upcomingBy.get(a.id) ?? 0 }
            : null,
        }))}
      />
    </div>
  )
}
