import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { CallRecordClient } from '../../../admin/discovery-calls/[id]/call-record-client'
import { loadCallRecord, staffTimeZone } from '../../../admin/discovery-calls/call-data'

export const dynamic = 'force-dynamic'

/** Call record for a coach host. Only calls they host; moving a call is left to admins. */
export default async function CoachCallRecordPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session || session.user.role !== 'COACH') redirect('/login')
  const tz = await staffTimeZone(session.user.id)
  const data = await loadCallRecord(params.id, { tz, admin: false })
  if (!data || data.hostId !== session.user.id) notFound()
  const { hostId: _hostId, ...record } = data

  return (
    <div className="space-y-5 max-w-6xl">
      <nav aria-label="Breadcrumb" className="text-sm">
        <ol className="flex flex-wrap items-center gap-1.5 text-gray-600">
          <li><Link href="/coach/discovery-calls" className="font-semibold text-primary-700 hover:underline">Discovery Calls</Link></li>
          <li aria-hidden>/</li>
          <li aria-current="page" className="font-semibold text-gray-900">{record.prospect.name}</li>
        </ol>
      </nav>
      {record.call.status === 'BOOKED' && new Date(record.call.startsAt) > new Date() && (
        <p className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700">Can&apos;t make this time? Ask an admin to move the call, or choose &quot;Reschedule&quot; below so {record.prospect.firstName} can pick a new time.</p>
      )}
      <CallRecordClient data={record} now={new Date().toISOString()} />
    </div>
  )
}
