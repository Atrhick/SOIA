import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { DiscoveryTabs } from '@/components/get-involved/discovery-tabs'
import { AvailabilityClient } from './availability-client'
import { BlockedDatesClient } from './blocked-dates-client'
import { loadBlockedDays } from '../call-data'

export const dynamic = 'force-dynamic'

export default async function AvailabilityPage({ searchParams }: { searchParams: { host?: string } }) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') redirect('/login')
  const hosts = await prisma.discoveryHost.findMany({ orderBy: { displayName: 'asc' }, include: { availability: true, user: { select: { role: true } } } })
  const chosen = hosts.find((h) => h.userId === (searchParams.host ?? session.user.id)) ?? hosts.find((h) => h.userId === session.user.id) ?? hosts[0]
  const days = chosen ? await loadBlockedDays(chosen) : null

  return (
    <div className="space-y-6">
      <DiscoveryTabs active="/admin/discovery-calls/availability" />
      {!chosen || !days ? (
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
                  {h.displayName}{h.userId === session.user.id ? ' (you)' : h.user.role === 'COACH' ? ' (coach)' : ''}
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
          <BlockedDatesClient key={`b-${chosen.userId}`} hostUserId={chosen.userId} hostName={chosen.displayName} timezone={chosen.timezone} today={days.today} blocked={days.blocked} />
        </>
      )}
    </div>
  )
}
