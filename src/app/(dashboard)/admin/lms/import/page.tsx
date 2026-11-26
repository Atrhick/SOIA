import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { CourseImportClient } from './course-import-client'

export default async function AdminCourseImportPage() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') redirect('/login')
  return <CourseImportClient />
}
