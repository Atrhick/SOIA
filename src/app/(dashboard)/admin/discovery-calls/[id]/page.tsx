import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { CallRecordClient } from './call-record-client'
import { MoveCall } from '../move-call'
import { loadCallOrigin, loadCallRecord, staffTimeZone } from '../call-data'
import { CallOriginCards } from './call-origin'

export const dynamic = 'force-dynamic'

export default async function CallRecordPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') redirect('/login')
  const tz = await staffTimeZone(session.user.id)
  const [data, origin] = await Promise.all([loadCallRecord(params.id, { tz, admin: true }), loadCallOrigin(params.id, tz)])
  if (!data) notFound()

  return (
    <div className="space-y-5 max-w-6xl">
      <nav aria-label="Breadcrumb" className="text-sm">
        <ol className="flex flex-wrap items-center gap-1.5 text-gray-600">
          <li><Link href="/admin/discovery-calls" className="font-semibold text-primary-700 hover:underline">Discovery Calls</Link></li>
          <li aria-hidden>/</li>
          <li aria-current="page" className="font-semibold text-gray-900">{data.prospect.name}</li>
        </ol>
      </nav>
      {data.call.status === 'BOOKED' && new Date(data.call.startsAt) > new Date() && (
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-700 pt-1.5">Need a different time? Move the call instead of cancelling it. Everyone gets the usual &quot;call moved&quot; email.</p>
          <MoveCall callId={data.call.id} name={data.prospect.name} tz={tz} />
        </div>
      )}
      <CallRecordClient data={data} now={new Date().toISOString()}>
        {origin && <CallOriginCards o={origin} />}
      </CallRecordClient>
    </div>
  )
}
