import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { DiscoveryTabs } from '@/components/get-involved/discovery-tabs'
import { dayKeyIn } from '@/lib/get-involved/core'
import { bookedCallsOnDays } from '@/lib/get-involved/discovery-slots'
import { AvailabilityClient } from './availability-client'
import { BlockedDatesClient, BlockedDay } from './blocked-dates-client'

export const dynamic = 'force-dynamic'

export default async function AvailabilityPage({ searchParams }: { searchParams: { host?: string } }) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') redirect('/login')
  const hosts = await prisma.discoveryHost.findMany({ orderBy: { displayName: 'asc' }, include: { availability: true } })
  const chosen = hosts.find((h) => h.userId === (searchParams.host ?? session.user.id)) ?? hosts.find((h) => h.userId === session.user.id) ?? hosts[0]
  let blocked: BlockedDay[] = []
  const today = chosen ? dayKeyIn(new Date(), chosen.timezone) : ''
  if (chosen) {
    const rows = await prisma.discoveryBlockedDate.findMany({ where: { hostId: chosen.id, day: { gte: today } }, orderBy: { day: 'asc' }, take: 100 })
    const calls = await bookedCallsOnDays(chosen, rows.map((r) => r.day))
    blocked = rows.map((r) => ({
      day: r.day,
      note: r.note,
      calls: calls.filter((c) => c.day === r.day).map((c) => ({ id: c.id, name: `${c.prospect.firstName} ${c.prospect.lastName}`, startsAt: c.startsAt.toISOString() })),
    }))
  }

  return (
    <div className="space-y-6">
      <DiscoveryTabs active="/admin/discovery-calls/availability" />
      {!chosen ? (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <p className="text-gray-700">No one is set up as a host yet. <Link href="/admin/discovery-calls/hosts" className="text-primary-700 font-semibold hover:underline">Add a host</Link> first, then set their weekly times here.</p>
        </div>
      ) : (
        <>
          {hosts.length > 1 && (
            <nav aria-label="Choose host" className="flex flex-wrap gap-2">
              {hosts.map((h) => (
                <Link key={h.userId} href={`/admin/discovery-calls/availability?host=${h.userId}`} aria-current={h.userId === chosen.userId ? 'true' : undefined}
                  className={`h-9 px-4 rounded-full text-sm font-semibold border inline-flex items-center ${h.userId === chosen.userId ? 'bg-primary-700 border-primary-700 text-white' : 'border-gray-300 text-gray-700'}`}>
                  {h.displayName}{h.userId === session.user.id ? ' (you)' : ''}
                </Link>
              ))}
            </nav>
          )}
          <AvailabilityClient
            key={chosen.userId}
            hostUserId={chosen.userId}
            hostName={chosen.displayName}
            timezone={chosen.timezone}
            windows={chosen.availability.map((w) => ({ dayOfWeek: w.dayOfWeek, startMinute: w.startMinute, endMinute: w.endMinute }))}
          />
          <BlockedDatesClient key={`b-${chosen.userId}`} hostUserId={chosen.userId} hostName={chosen.displayName} timezone={chosen.timezone} today={today} blocked={blocked} />
        </>
      )}
    </div>
  )
}
