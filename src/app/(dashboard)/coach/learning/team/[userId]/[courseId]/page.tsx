import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getLearnerCourseWork } from '@/lib/actions/lms/exercises'
import { LearnerWorkView } from '@/components/learning/course/learner-work-view'

interface PageProps {
  params: Promise<{ userId: string; courseId: string }>
}

export default async function CoachLearnerWorkPage({ params }: PageProps) {
  const session = await auth()
  if (!session || session.user.role !== 'COACH') redirect('/login')
  const { userId, courseId } = await params
  const result = await getLearnerCourseWork(courseId, userId)
  if (!result.work) {
    return (
      <div className="space-y-4">
        <Link href="/coach/learning/team" className="inline-flex min-h-[44px] items-center text-gray-700 hover:text-gray-900">
          Back to my ambassadors
        </Link>
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">{result.error}</div>
      </div>
    )
  }
  return <LearnerWorkView work={result.work} backHref="/coach/learning/team" backLabel="My ambassadors' learning" />
}
