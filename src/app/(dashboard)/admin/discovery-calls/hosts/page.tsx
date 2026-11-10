import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { DiscoveryTabs } from '@/components/get-involved/discovery-tabs'
import { HostsClient } from './hosts-client'

export const dynamic = 'force-dynamic'

export default async function HostsPage() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') redirect('/login')
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', status: 'ACTIVE' },
    orderBy: { email: 'asc' },
    select: { id: true, email: true, role: true, discoveryHost: { include: { _count: { select: { availability: true } } } } },
  })
  return (
    <div className="space-y-6">
      <DiscoveryTabs active="/admin/discovery-calls/hosts" />
      <HostsClient
        people={admins.map((a) => ({
          userId: a.id,
          email: a.email,
          role: a.role,
          host: a.discoveryHost
            ? { displayName: a.discoveryHost.displayName, active: a.discoveryHost.active, ageRanges: a.discoveryHost.ageRanges, meetingUrl: a.discoveryHost.meetingUrl ?? '', timezone: a.discoveryHost.timezone, blocks: a.discoveryHost._count.availability }
            : null,
        }))}
      />
    </div>
  )
}
