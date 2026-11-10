import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { DiscoveryTabs } from '@/components/get-involved/discovery-tabs'
import { CallsClient } from '../../admin/discovery-calls/calls-client'
import { loadCallRows, staffTimeZone, tzNote } from '../../admin/discovery-calls/call-data'

export const dynamic = 'force-dynamic'

const BASE = '/coach/discovery-calls'

/** A coach host's own discovery calls. Coaches who are not hosts see how to become one. */
export default async function CoachDiscoveryCallsPage() {
  const session = await auth()
  if (!session || session.user.role !== 'COACH') redirect('/login')
  const userId = session.user.id
  const [host, rows, tz] = await Promise.all([
    prisma.discoveryHost.findUnique({ where: { userId }, select: { id: true } }),
    loadCallRows({ hostId: userId }),
    staffTimeZone(userId),
  ])
  if (!host && rows.length === 0) {
    return (
      <div className="space-y-6">
        <DiscoveryTabs active={BASE} base={BASE} admin={false} />
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-2">
          <h2 className="font-bold text-gray-900">You&apos;re not hosting discovery calls yet</h2>
          <p className="text-gray-700">Discovery calls are the first conversation with people who join through a share link. If you&apos;d like to host them, ask an admin to add you as a host. Once you&apos;re added, set your weekly times on the My times tab.</p>
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-6">
      <DiscoveryTabs active={BASE} base={BASE} admin={false} tzNote={tzNote(tz)} />
      <CallsClient rows={rows} now={new Date().toISOString()} mine isHost={!!host} view={{ base: BASE, tz, admin: false }} />
    </div>
  )
}
