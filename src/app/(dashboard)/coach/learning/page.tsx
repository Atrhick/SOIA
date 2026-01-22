import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getAvailableCourses, getMyEnrollments } from '@/lib/actions/lms/enrollment'
import { LearningCatalogClient } from './learning-catalog-client'

export default async function CoachLearningPage() {
  const session = await auth()

  if (!session || session.user.role !== 'COACH') {
    redirect('/login')
  }

  const [coursesResult, enrollmentsResult] = await Promise.all([
    getAvailableCourses(),
    getMyEnrollments(),
  ])

  if (coursesResult.error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">{coursesResult.error}</p>
      </div>
    )
  }

  return (
    <LearningCatalogClient
      courses={coursesResult.courses || []}
      enrollments={enrollmentsResult.enrollments || []}
    />
  )
}
