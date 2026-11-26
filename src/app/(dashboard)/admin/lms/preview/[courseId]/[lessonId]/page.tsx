import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getLessonContent } from '@/lib/actions/lms/enrollment'
import { loadLessonAudioView } from '@/lib/lessons/audio-view'
import { LessonViewerClient } from '../../../../../coach/learning/[courseId]/[lessonId]/lesson-viewer-client'

interface PageProps {
  params: Promise<{ courseId: string; lessonId: string }>
}

/** Admin "Preview as learner": the real lesson page, read-only, works for drafts too. */
export default async function AdminLessonPreviewPage({ params }: PageProps) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') redirect('/login')

  const { courseId, lessonId } = await params
  const result = await getLessonContent(lessonId, { preview: true })
  if (result.error || !result.lesson || result.lesson.courseId !== courseId) notFound()

  const audioView = await loadLessonAudioView(lessonId, session.user.id)

  return (
    <LessonViewerClient
      lesson={result.lesson}
      progress={result.progress}
      navigation={result.navigation}
      basePath="/admin/lms/preview"
      audio={audioView.audio}
      listen={audioView.listen}
      curriculum={result.curriculum}
      exercises={result.exercises}
      readOnly
      isPreview
    />
  )
}
