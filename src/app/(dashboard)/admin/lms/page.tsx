import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getCourses } from '@/lib/actions/lms/courses'
import { LMSAdminClient } from './lms-admin-client'

export default async function AdminLMSPage() {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  const { courses, error } = await getCourses({ includeEnrollmentCounts: true })

  if (error || !courses) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">{error || 'Failed to load courses'}</p>
      </div>
    )
  }

  // Calculate stats
  const draftCourses = courses.filter((c) => c.status === 'DRAFT')
  const publishedCourses = courses.filter((c) => c.status === 'PUBLISHED')
  const archivedCourses = courses.filter((c) => c.status === 'ARCHIVED')
  const totalEnrollments = courses.reduce((acc, c) => acc + (c.enrollmentCount || 0), 0)

  const stats = {
    totalCourses: courses.length,
    draftCount: draftCourses.length,
    publishedCount: publishedCourses.length,
    archivedCount: archivedCourses.length,
    totalEnrollments,
  }

  return <LMSAdminClient courses={courses} stats={stats} />
}
