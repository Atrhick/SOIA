import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Clock } from 'lucide-react'
import { auth } from '@/lib/auth'
import { isFeatureEnabled } from '@/lib/actions/feature-config'
import { FeatureDisabled } from '@/components/ui/feature-disabled'
import { getMyTimeClock } from '@/lib/actions/time-clock'
import { TimeClockScreen } from '@/components/time/time-clock-screen'
import { TimeZoneSync } from '@/components/time/time-zone-sync'

export default async function AmbassadorTimePage() {
  const session = await auth()
  if (!session || session.user.role !== 'AMBASSADOR') {
    redirect('/login')
  }

  const featureEnabled = await isFeatureEnabled('TIME_CLOCK', 'AMBASSADOR', session.user.id)
  if (!featureEnabled) {
    return <FeatureDisabled title="Time Clock" icon={Clock} />
  }

  const result = await getMyTimeClock(cookies().get('tz')?.value)
  if ('error' in result) {
    return (
      <>
        <TimeZoneSync />
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {result.error}
        </div>
      </>
    )
  }

  return (
    <div className="space-y-6">
      <TimeZoneSync />
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Time Clock</h1>
        <p className="text-gray-600">Track your hours</p>
      </div>

      {/* Ambassadors have no projects to bill against, so no project timer. */}
      <TimeClockScreen data={result} showProjectTimer={false} />
    </div>
  )
}
