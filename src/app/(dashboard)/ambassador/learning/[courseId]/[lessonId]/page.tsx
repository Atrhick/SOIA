import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getLessonContent } from '@/lib/actions/lms/enrollment'
import { LessonViewerClient } from '../../../../coach/learning/[courseId]/[lessonId]/lesson-viewer-client'

interface PageProps {
  params: Promise<{ courseId: string; lessonId: string }>
}

export default async function AmbassadorLessonViewerPage({ params }: PageProps) {
  const session = await auth()

  if (!session || session.user.role !== 'AMBASSADOR') {
    redirect('/login')
  }

  const { courseId, lessonId } = await params
  const result = await getLessonContent(lessonId)

  if (result.error || !result.lesson) {
    notFound()
  }

  // Verify the lesson belongs to the course
  if (result.lesson.courseId !== courseId) {
    notFound()
  }

  return (
    <LessonViewerClient
      lesson={result.lesson}
      progress={result.progress}
      navigation={result.navigation}
      basePath="/ambassador/learning"
    />
  )
}
