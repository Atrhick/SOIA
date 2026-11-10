import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { ageRangeLabel } from '@/lib/get-involved/core'
import { DiscoveryTabs } from '@/components/get-involved/discovery-tabs'
import { MyHostSettings } from '@/components/get-involved/my-host-settings'
import { AvailabilityClient } from '../../../admin/discovery-calls/availability/availability-client'
import { BlockedDatesClient } from '../../../admin/discovery-calls/availability/blocked-dates-client'
import { loadBlockedDays, tzNote } from '../../../admin/discovery-calls/call-data'

export const dynamic = 'force-dynamic'

const BASE = '/coach/discovery-calls'

/** A coach host's own weekly times, days off, time zone and meeting link. */
export default async function CoachAvailabilityPage() {
  const session = await auth()
  if (!session || session.user.role !== 'COACH') redirect('/login')
  const host = await prisma.discoveryHost.findUnique({ where: { userId: session.user.id }, include: { availability: true } })
  if (!host) {
    return (
      <div className="space-y-6">
        <DiscoveryTabs active={`${BASE}/availability`} base={BASE} admin={false} />
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <p className="text-gray-700">You&apos;re not set up as a discovery-call host yet. Ask an admin to add you, then set your times here.</p>
        </div>
      </div>
    )
  }
  const days = await loadBlockedDays(host)
  return (
    <div className="space-y-6">
      <DiscoveryTabs active={`${BASE}/availability`} base={BASE} admin={false} tzNote={tzNote(host.timezone)} />
      <MyHostSettings timezone={host.timezone} meetingUrl={host.meetingUrl ?? ''} ageLabels={host.ageRanges.map((a) => ageRangeLabel(a))} active={host.active} />
      <AvailabilityClient
        key={`${host.userId}-${host.timezone}`}
        hostUserId={host.userId}
        hostName={host.displayName}
        timezone={host.timezone}
        windows={host.availability.map((w) => ({ dayOfWeek: w.dayOfWeek, startMinute: w.startMinute, endMinute: w.endMinute }))}
      />
      <BlockedDatesClient key={`b-${host.userId}`} hostUserId={host.userId} hostName={host.displayName} timezone={host.timezone} today={days.today} blocked={days.blocked} base={BASE} canMove={false} />
    </div>
  )
}
