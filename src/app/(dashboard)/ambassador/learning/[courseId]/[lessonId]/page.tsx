import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getLessonContent } from '@/lib/actions/lms/enrollment'
import { loadLessonAudioView } from '@/lib/lessons/audio-view'
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

  // Not joined yet, or a week that has not opened: the course page explains why.
  if (result.error === 'Locked' || result.error === 'Not enrolled in this course') {
    redirect(`/ambassador/learning/${courseId}`)
  }
  if (result.error || !result.lesson) {
    notFound()
  }

  // Verify the lesson belongs to the course
  if (result.lesson.courseId !== courseId) {
    notFound()
  }

  const audioView = await loadLessonAudioView(lessonId, session.user.id)

  return (
    <LessonViewerClient
      lesson={result.lesson}
      progress={result.progress}
      navigation={result.navigation}
      basePath="/ambassador/learning"
      audio={audioView.audio}
      listen={audioView.listen}
      curriculum={result.curriculum}
      exercises={result.exercises}
      readOnly={result.readOnly}
    />
  )
}
