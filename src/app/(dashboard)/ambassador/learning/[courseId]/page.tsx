import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getCourseForLearner } from '@/lib/actions/lms/enrollment'
import { CourseViewClient } from '../../../coach/learning/[courseId]/course-view-client'

interface PageProps {
  params: Promise<{ courseId: string }>
}

export default async function AmbassadorCourseViewPage({ params }: PageProps) {
  const session = await auth()

  if (!session || session.user.role !== 'AMBASSADOR') {
    redirect('/login')
  }

  const { courseId } = await params
  const result = await getCourseForLearner(courseId)

  if (result.error || !result.course) {
    notFound()
  }

  return <CourseViewClient course={result.course} basePath="/ambassador/learning" />
}
