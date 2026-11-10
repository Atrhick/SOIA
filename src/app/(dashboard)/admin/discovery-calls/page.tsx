import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { DiscoveryTabs } from '@/components/get-involved/discovery-tabs'
import { CallsClient } from './calls-client'
import { loadCallRows, staffTimeZone, tzNote } from './call-data'

export const dynamic = 'force-dynamic'

export default async function DiscoveryCallsPage({ searchParams }: { searchParams: { who?: string } }) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') redirect('/login')
  const mine = searchParams.who !== 'all'
  const [rows, tz, host] = await Promise.all([
    loadCallRows(mine ? { hostId: session.user.id } : {}),
    staffTimeZone(session.user.id),
    prisma.discoveryHost.findUnique({ where: { userId: session.user.id }, select: { id: true } }),
  ])
  return (
    <div className="space-y-6">
      <DiscoveryTabs active="/admin/discovery-calls" tzNote={tzNote(tz)} />
      <CallsClient rows={rows} now={new Date().toISOString()} mine={mine} isHost={!!host} view={{ base: '/admin/discovery-calls', tz, admin: true }} />
    </div>
  )
}
