import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import {
  getLMSOverviewStats,
  getCourseAnalytics,
  getRecentActivity,
  getAllEnrollments,
} from '@/lib/actions/lms/analytics'
import { LMSAnalyticsClient } from './lms-analytics-client'

export default async function LMSAnalyticsPage() {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  const [statsResult, coursesResult, activityResult, enrollmentsResult] = await Promise.all([
    getLMSOverviewStats(),
    getCourseAnalytics(),
    getRecentActivity(15),
    getAllEnrollments({ limit: 50 }),
  ])

  if (statsResult.error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">{statsResult.error}</p>
      </div>
    )
  }

  return (
    <LMSAnalyticsClient
      stats={statsResult.stats!}
      courses={coursesResult.courses || []}
      recentActivity={activityResult.activities || []}
      enrollments={enrollmentsResult.enrollments || []}
    />
  )
}
