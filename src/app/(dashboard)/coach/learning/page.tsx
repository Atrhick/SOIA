import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getAvailableCourses, getMyEnrollments } from '@/lib/actions/lms/enrollment'
import Link from 'next/link'
import { Users } from 'lucide-react'
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
    <div className="space-y-4">
      <Link
        href="/coach/learning/team"
        className="flex min-h-[56px] items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-blue-900 hover:bg-blue-100"
      >
        <Users className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">My ambassadors&apos; learning</span>
          <span className="block text-sm text-blue-900/80">See their progress and exercise answers, and leave comments.</span>
        </span>
      </Link>
      <LearningCatalogClient
        courses={coursesResult.courses || []}
        enrollments={enrollmentsResult.enrollments || []}
      />
    </div>
  )
}
