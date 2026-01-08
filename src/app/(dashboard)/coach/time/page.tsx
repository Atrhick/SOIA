import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { isFeatureEnabled } from '@/lib/actions/feature-config'
import {
  getCurrentClockStatus,
  getTodayClockEntries,
  getWeeklyTimeStats,
  getRunningTimer,
} from '@/lib/actions/time-clock'
import { TimeClockClient } from './time-clock-client'
import { Clock } from 'lucide-react'

export default async function CoachTimePage() {
  const session = await auth()

  if (!session || session.user.role !== 'COACH') {
    redirect('/login')
  }

  // Check if feature is enabled
  const featureEnabled = await isFeatureEnabled('TIME_CLOCK', 'COACH', session.user.id)
  if (!featureEnabled) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">Time Clock</h2>
          <p className="text-gray-500 mt-2">This feature is not currently enabled.</p>
        </div>
      </div>
    )
  }

  const [clockStatus, todayEntries, weeklyStats, runningTimer] = await Promise.all([
    getCurrentClockStatus(session.user.id),
    getTodayClockEntries(session.user.id),
    getWeeklyTimeStats(session.user.id),
    getRunningTimer(session.user.id),
  ])

  const serializedTodayEntries = todayEntries.entries?.map((entry) => ({
    id: entry.id,
    type: entry.type,
    timestamp: entry.timestamp.toISOString(),
    notes: entry.notes,
  })) || []

  const serializedRunningTimer = runningTimer.timer ? {
    id: runningTimer.timer.id,
    startTime: runningTimer.timer.startTime.toISOString(),
    description: runningTimer.timer.description,
    project: runningTimer.timer.project,
    task: runningTimer.timer.task,
  } : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Time Clock</h1>
        <p className="text-gray-600">
          Track your work hours and time spent on projects
        </p>
      </div>

      <TimeClockClient
        initialStatus={clockStatus.status}
        todayEntries={serializedTodayEntries}
        weeklyStats={weeklyStats}
        runningTimer={serializedRunningTimer}
      />
    </div>
  )
}
