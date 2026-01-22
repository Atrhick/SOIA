import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getCourseForLearner } from '@/lib/actions/lms/enrollment'
import { CourseViewClient } from './course-view-client'

interface PageProps {
  params: Promise<{ courseId: string }>
}

export default async function CoachCourseViewPage({ params }: PageProps) {
  const session = await auth()

  if (!session || session.user.role !== 'COACH') {
    redirect('/login')
  }

  const { courseId } = await params
  const result = await getCourseForLearner(courseId)

  if (result.error || !result.course) {
    notFound()
  }

  return <CourseViewClient course={result.course} />
}
