import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Clock } from 'lucide-react'
import { auth } from '@/lib/auth'
import { isFeatureEnabled } from '@/lib/actions/feature-config'
import { FeatureDisabled } from '@/components/ui/feature-disabled'
import { getMyTime } from '@/lib/actions/time'
import { TimeScreen } from '@/components/time/time-screen'
import { TimeZoneSync } from '@/components/time/time-zone-sync'

export default async function CoachTimePage() {
  const session = await auth()
  if (!session || session.user.role !== 'COACH') {
    redirect('/login')
  }

  const featureEnabled = await isFeatureEnabled('TIME_CLOCK', 'COACH', session.user.id)
  if (!featureEnabled) {
    return <FeatureDisabled title="Time" icon={Clock} />
  }

  // Set by TimeZoneSync on the first visit; "today" and "this week" depend on it.
  const result = await getMyTime(cookies().get('tz')?.value)

  return (
    <div className="space-y-6">
      <TimeZoneSync />
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Time</h1>
        <p className="text-gray-600">Start a timer when you begin, stop it when you&apos;re done.</p>
      </div>

      {'error' in result ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{result.error}</div>
      ) : (
        <TimeScreen data={result} />
      )}
    </div>
  )
}
