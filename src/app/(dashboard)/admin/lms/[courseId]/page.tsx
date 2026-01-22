import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getCourse } from '@/lib/actions/lms/courses'
import { getAvailableSurveys } from '@/lib/actions/lms/content-blocks'
import { CourseEditorClient } from './course-editor-client'

interface PageProps {
  params: Promise<{ courseId: string }>
}

export default async function CourseEditorPage({ params }: PageProps) {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  const { courseId } = await params
  const [courseResult, surveysResult] = await Promise.all([
    getCourse(courseId),
    getAvailableSurveys(),
  ])

  if (courseResult.error || !courseResult.course) {
    notFound()
  }

  return (
    <CourseEditorClient
      course={courseResult.course}
      availableSurveys={surveysResult.surveys || []}
    />
  )
}
