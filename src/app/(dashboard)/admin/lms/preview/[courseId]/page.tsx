import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getCourseForLearner } from '@/lib/actions/lms/enrollment'
import { CourseViewClient } from '../../../../coach/learning/[courseId]/course-view-client'

interface PageProps {
  params: Promise<{ courseId: string }>
}

/** Admin "Preview as learner": the course landing page as learners see it (drafts too). */
export default async function AdminCoursePreviewPage({ params }: PageProps) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') redirect('/login')
  const { courseId } = await params
  const result = await getCourseForLearner(courseId, { preview: true })
  if (result.error || !result.course) notFound()
  return <CourseViewClient course={result.course} basePath="/admin/lms/preview" />
}
