import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { CourseBuilderClient } from './course-builder-client'

export default async function NewCoursePage() {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  return <CourseBuilderClient />
}
