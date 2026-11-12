import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlertTriangle, Globe2, Settings2 } from 'lucide-react'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { DiscoveryTabs } from '@/components/get-involved/discovery-tabs'
import { HOST_STATUS_LABEL, hostStatus, meetingLinkWarning } from '@/lib/get-involved/host-status'
import { zoneLabel, zoneOffset } from '@/lib/get-involved/time-zones'
import { weekSummary } from '@/lib/get-involved/weekly-times'
import { AvailabilityClient } from './availability-client'
import { BlockedDatesClient } from './blocked-dates-client'
import { HostPicker, type PickerHost } from './host-picker'
import { loadBlockedDays } from '../call-data'

export const dynamic = 'force-dynamic'

const STATUS_PILL = { BOOKABLE: 'bg-green-100 text-green-800', NEEDS_TIMES: 'bg-amber-100 text-amber-900', NEEDS_AGES: 'bg-amber-100 text-amber-900', PAUSED: 'bg-gray-100 text-gray-700' } as const
// Hosts that need something first, then by name: the ones to act on are at the top of a long list.
const STATUS_ORDER = { NEEDS_TIMES: 0, NEEDS_AGES: 1, BOOKABLE: 2, PAUSED: 3 } as const

export default async function AvailabilityPage({ searchParams }: { searchParams: { host?: string } }) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') redirect('/login')
  const hosts = await prisma.discoveryHost.findMany({ orderBy: { displayName: 'asc' }, include: { availability: true, user: { select: { role: true, email: true } } } })
  const chosen = hosts.find((h) => h.userId === (searchParams.host ?? session.user.id)) ?? hosts.find((h) => h.userId === session.user.id) ?? hosts[0]
  const days = chosen ? await loadBlockedDays(chosen) : null

  const status = (h: (typeof hosts)[number]) => hostStatus({ active: h.active, ageRanges: h.ageRanges, blocks: h.availability.length, meetingUrl: h.meetingUrl ?? '' })
  const picker: PickerHost[] = hosts
    .map((h) => ({
      userId: h.userId,
      name: h.displayName,
      email: h.user.email,
      tag: h.userId === session.user.id ? 'You' : h.user.role === 'COACH' ? 'Coach' : null,
      status: status(h),
      summary: weekSummary(h.availability),
    }))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name))

  if (!chosen || !days) {
    return (
      <div className="space-y-6">
        <DiscoveryTabs active="/admin/discovery-calls/availability" />
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <p className="text-gray-700">No one is set up as a host yet. <Link href="/admin/discovery-calls/hosts" className="text-primary-700 font-semibold hover:underline">Add a host</Link> first, then set their weekly times here.</p>
        </div>
      </div>
    )
  }

  const st = status(chosen)
  const linkWarn = meetingLinkWarning(chosen.meetingUrl ?? '')
  const settings = `/admin/discovery-calls/hosts?edit=${chosen.userId}`
  // Things to fix in host settings (weekly times are fixed right here, so they're shown in the editor).
  const notes = [
    ...(st === 'NEEDS_AGES' ? [`No age ranges chosen, so no prospect is matched to ${chosen.displayName.split(' ')[0]}. Choose them in host settings.`] : []),
    ...(linkWarn && st !== 'PAUSED' ? [linkWarn] : []),
  ]

  return (
    <div className="space-y-6">
      <DiscoveryTabs active="/admin/discovery-calls/availability" />
      <div className={hosts.length > 1 ? 'grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)] items-start' : ''}>
        {hosts.length > 1 && <HostPicker hosts={picker} currentId={chosen.userId} />}

        <div className="space-y-6 min-w-0 max-w-4xl">
          <header className="space-y-3">
            <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-gray-900">{chosen.displayName}</h2>
                <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${STATUS_PILL[st]}`}>{HOST_STATUS_LABEL[st]}</span>
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600">
                <span className="inline-flex items-center gap-1.5"><Globe2 className="h-4 w-4 text-gray-500" aria-hidden />{zoneLabel(chosen.timezone)} ({zoneOffset(chosen.timezone)})</span>
                <span>{chosen.user.email}</span>
              </p>
            </div>
            <Link href={settings} className="h-10 px-3 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-800 hover:bg-gray-50 inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2">
              <Settings2 className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">Host settings</span><span className="sm:hidden">Settings</span>
            </Link>
            </div>
            {notes.length > 0 && (
              <ul className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 space-y-1">
                {notes.map((n) => <li key={n} className="flex items-start gap-2 text-sm text-amber-900"><AlertTriangle className="h-4 w-4 flex-none mt-0.5" aria-hidden />{n}</li>)}
              </ul>
            )}
            {st === 'PAUSED' && <p className="text-sm text-gray-700">Paused: not taking new calls. You can still set times for when they&apos;re back.</p>}
          </header>

          <AvailabilityClient
            key={chosen.userId}
            hostUserId={chosen.userId}
            hostName={chosen.displayName}
            timezone={chosen.timezone}
            showZone={false}
            windows={chosen.availability.map((w) => ({ dayOfWeek: w.dayOfWeek, startMinute: w.startMinute, endMinute: w.endMinute }))}
          />
          <BlockedDatesClient key={`b-${chosen.userId}`} hostUserId={chosen.userId} hostName={chosen.displayName} timezone={chosen.timezone} today={days.today} blocked={days.blocked} />
        </div>
      </div>
    </div>
  )
}
