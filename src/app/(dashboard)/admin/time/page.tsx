import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getTimesheet } from '@/lib/actions/admin-time'
import { TimeZoneSync } from '@/components/time/time-zone-sync'
import { AdminTimeClient } from './admin-time-client'

export default async function AdminTimePage({ searchParams }: { searchParams: { week?: string } }) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  const parsed = Number(searchParams.week)
  // Clamped so a hand-edited URL cannot ask for the future or years back.
  const weekOffset = Number.isFinite(parsed) ? Math.max(-104, Math.min(0, Math.trunc(parsed))) : 0

  const result = await getTimesheet(weekOffset, cookies().get('tz')?.value)

  return (
    <div className="space-y-6">
      <TimeZoneSync />
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Timesheets</h1>
        <p className="text-gray-600">Hours recorded by coaches and ambassadors</p>
      </div>

      {'error' in result ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{result.error}</div>
      ) : (
        <AdminTimeClient data={result} />
      )}
    </div>
  )
}
