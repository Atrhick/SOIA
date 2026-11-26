import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, ChevronRight, Users } from 'lucide-react'
import { auth } from '@/lib/auth'
import { getCourseLearners } from '@/lib/actions/lms/exercises'

interface PageProps {
  params: Promise<{ courseId: string }>
}

export default async function AdminCourseLearnersPage({ params }: PageProps) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') redirect('/login')
  const { courseId } = await params
  const result = await getCourseLearners(courseId)

  return (
    <div className="space-y-6">
      <Link href={`/admin/lms/${courseId}`} className="inline-flex min-h-[44px] items-center gap-2 text-gray-700 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" /> Back to the course editor
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Learners{result.course ? `: ${result.course.title}` : ''}</h1>
        <p className="text-gray-700">Everyone who joined, their progress, and their exercise answers.</p>
      </div>
      {result.error ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">{result.error}</div>
      ) : !result.learners?.length ? (
        <div className="rounded-xl border bg-white px-6 py-12 text-center text-gray-700">
          <Users className="mx-auto mb-3 h-10 w-10 text-gray-400" aria-hidden="true" />
          Nobody has joined this course yet.
        </div>
      ) : (
        <ul className="divide-y rounded-xl border bg-white">
          {result.learners.map((l) => (
            <li key={l.userId}>
              <Link
                href={`/admin/lms/${courseId}/learners/${l.userId}`}
                className="flex min-h-[56px] items-center gap-3 p-4 hover:bg-gray-50"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-800" aria-hidden="true">
                  {(l.name?.[0] || '?').toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-gray-900">{l.name}</span>
                  <span className="block text-sm text-gray-700">
                    {l.status === 'COMPLETED' ? 'Completed' : `${l.progressPercentage}%`} · {l.exercisesAnswered} exercises answered
                    {l.lastAccessedAt ? ` · last opened ${new Date(l.lastAccessedAt).toLocaleDateString()}` : ''}
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-gray-500" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
