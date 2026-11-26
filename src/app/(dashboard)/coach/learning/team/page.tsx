import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, ChevronRight, GraduationCap, PenLine } from 'lucide-react'
import { auth } from '@/lib/auth'
import { getMyTeamLearning } from '@/lib/actions/lms/exercises'

export default async function CoachTeamLearningPage() {
  const session = await auth()
  if (!session || session.user.role !== 'COACH') redirect('/login')
  const result = await getMyTeamLearning()

  return (
    <div className="space-y-6">
      <Link href="/coach/learning" className="inline-flex min-h-[44px] items-center gap-2 text-gray-700 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" /> Learning
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My ambassadors&apos; learning</h1>
        <p className="text-gray-700">Progress in each course, and their exercise answers. Open a course to read answers and leave a comment.</p>
      </div>

      {result.error ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">{result.error}</div>
      ) : !result.team?.length ? (
        <div className="rounded-xl border bg-white px-6 py-12 text-center text-gray-700">
          <GraduationCap className="mx-auto mb-3 h-10 w-10 text-gray-400" aria-hidden="true" />
          None of your ambassadors has a login yet, so there is no course progress to show.
        </div>
      ) : (
        <ul className="space-y-4">
          {result.team.map((a) => (
            <li key={a.userId} className="rounded-xl border bg-white">
              <div className="flex flex-wrap items-center gap-3 border-b p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-800" aria-hidden="true">
                  {(a.name?.[0] || '?').toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-gray-900">{a.name}</p>
                  <p className="flex items-center gap-1 text-sm text-gray-600">
                    <PenLine className="h-3 w-3" aria-hidden="true" /> {a.exercisesAnswered} exercises answered
                  </p>
                </div>
              </div>
              {a.courses.length === 0 ? (
                <p className="p-4 text-sm text-gray-700">Has not joined a course yet.</p>
              ) : (
                <ul className="divide-y">
                  {a.courses.map((c) => (
                    <li key={c.courseId}>
                      <Link
                        href={`/coach/learning/team/${a.userId}/${c.courseId}`}
                        className="flex min-h-[56px] items-center gap-3 p-4 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-gray-900">{c.title}</span>
                          <span className="mt-1 flex items-center gap-2">
                            <span
                              className="h-2 w-28 overflow-hidden rounded-full bg-gray-200"
                              role="progressbar"
                              aria-label={`${c.title} progress`}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={c.progressPercentage}
                            >
                              <span
                                className={`block h-full ${c.status === 'COMPLETED' ? 'bg-green-600' : 'bg-blue-600'}`}
                                style={{ width: `${c.progressPercentage}%` }}
                              />
                            </span>
                            <span className="text-sm text-gray-700">
                              {c.status === 'COMPLETED' ? 'Completed' : `${c.progressPercentage}%`}
                              {c.lastAccessedAt ? ` · last opened ${new Date(c.lastAccessedAt).toLocaleDateString()}` : ''}
                            </span>
                          </span>
                        </span>
                        <ChevronRight className="h-5 w-5 shrink-0 text-gray-500" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
