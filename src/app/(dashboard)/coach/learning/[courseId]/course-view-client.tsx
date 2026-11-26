'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Award,
  BookOpen,
  CheckCircle,
  ChevronDown,
  Circle,
  Clock,
  Layers,
  Loader2,
  Lock,
  PenLine,
  Play,
  Target,
  Users,
  X,
} from 'lucide-react'
import { enrollInCourse } from '@/lib/actions/lms/enrollment'
import { formatMinutes } from '@/lib/lms/course-rules'

interface Lesson {
  id: string
  title: string
  description: string | null
  estimatedDuration: number | null
  sortOrder: number
  contentBlockCount: number
  exerciseCount: number
  progress: { status: string; completedAt: string | null }
}

interface Module {
  id: string
  title: string
  description: string | null
  sortOrder: number
  opensAt: string | null
  isOpen: boolean
  lessons: Lesson[]
}

interface Course {
  id: string
  title: string
  description: string | null
  thumbnail: string | null
  estimatedDuration: number | null
  category: string | null
  tags: string[]
  outcomes: string[]
  audience: string | null
  dripDays: number | null
  isPreview: boolean
  prerequisites: { id: string; title: string; completed: boolean }[]
  nextLessonId: string | null
  modules: Module[]
  enrollment: {
    id: string
    status: string
    progressPercentage: number
    completedAt: string | null
    lastAccessedAt: string | null
    enrolledAt: string
    certificateIssuedAt: string | null
  } | null
}

interface CourseViewClientProps {
  course: Course
  basePath?: string
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

export function CourseViewClient({ course, basePath = '/coach/learning' }: CourseViewClientProps) {
  const router = useRouter()
  const [isEnrolling, setIsEnrolling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openModules, setOpenModules] = useState<Set<string>>(() => {
    // Open the week holding the next lesson (or the first week).
    const withNext = course.modules.find((m) => m.lessons.some((l) => l.id === course.nextLessonId))
    return new Set([withNext?.id ?? course.modules[0]?.id].filter(Boolean) as string[])
  })

  const preview = course.isPreview
  const enrollment = course.enrollment
  const allLessons = course.modules.flatMap((m) => m.lessons)
  const totalLessons = allLessons.length
  const completedLessons = allLessons.filter((l) => l.progress.status === 'COMPLETED').length
  const exerciseCount = allLessons.reduce((a, l) => a + l.exerciseCount, 0)
  const nextLesson = allLessons.find((l) => l.id === course.nextLessonId) ?? null
  const prereqsMissing = course.prerequisites.filter((p) => !p.completed)
  const completed = enrollment?.status === 'COMPLETED'
  const lessonHref = (id: string) => `${basePath}/${course.id}/${id}`

  const toggle = (id: string) =>
    setOpenModules((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const handleEnroll = async () => {
    setIsEnrolling(true)
    setError(null)
    try {
      const result = await enrollInCourse(course.id)
      if (result.error) {
        setError(result.error)
      } else {
        const first = course.modules[0]?.lessons[0]
        if (first) router.push(lessonHref(first.id))
        else router.refresh()
      }
    } catch {
      setError('Could not join the course. Check your connection and try again.')
    } finally {
      setIsEnrolling(false)
    }
  }

  const primaryBtn =
    'inline-flex min-h-[48px] w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-blue-700 px-6 py-3 font-semibold text-white hover:bg-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 disabled:opacity-60'

  return (
    <div className="space-y-6">
      <Link
        href={preview ? `/admin/lms/${course.id}` : basePath}
        className="inline-flex min-h-[44px] items-center gap-2 text-gray-700 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        {preview ? 'Back to editor' : 'All courses'}
      </Link>

      {preview && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Preview: this is the course page learners see{course.modules.length ? '' : ' (add a week to see the curriculum)'}. Joining is turned off here.
        </div>
      )}

      {/* Hero */}
      <section className="overflow-hidden rounded-xl border bg-white">
        <div className="md:flex">
          {course.thumbnail && (
            <div className="relative h-40 bg-gray-100 sm:h-52 md:h-auto md:w-1/3">
              <Image src={course.thumbnail} alt="" fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />
            </div>
          )}
          <div className="min-w-0 p-5 sm:p-6 md:flex-1">
            {course.category && (
              <p className="mb-2 inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-800">
                {course.category}
              </p>
            )}
            <h1 className="mb-2 text-2xl font-bold text-gray-900 sm:text-3xl">{course.title}</h1>
            {course.description && <p className="mb-4 whitespace-pre-line text-gray-700">{course.description}</p>}

            <ul className="mb-5 flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-700">
              <li className="flex items-center gap-1">
                <Layers className="h-4 w-4" aria-hidden="true" />
                {(() => {
                  // Count real weeks ("Week 1: ..."); a "Getting started" part isn't a week. Other courses say sections.
                  const weeks = course.modules.filter((m) => /^\s*week\s+\d+/i.test(m.title)).length
                  const n = weeks || course.modules.length
                  return `${n} ${weeks ? (n === 1 ? 'week' : 'weeks') : n === 1 ? 'section' : 'sections'}`
                })()}
              </li>
              <li className="flex items-center gap-1">
                <BookOpen className="h-4 w-4" aria-hidden="true" />
                {totalLessons} lessons
              </li>
              {exerciseCount > 0 && (
                <li className="flex items-center gap-1">
                  <PenLine className="h-4 w-4" aria-hidden="true" />
                  {exerciseCount} exercises
                </li>
              )}
              {formatMinutes(course.estimatedDuration) && (
                <li className="flex items-center gap-1">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                  {formatMinutes(course.estimatedDuration)} in total
                </li>
              )}
            </ul>

            {error && (
              <div role="alert" className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
                <span>{error}</span>
                <button type="button" onClick={() => setError(null)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded hover:bg-red-100" aria-label="Dismiss">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {preview ? (
              course.modules[0]?.lessons[0] && (
                <Link href={lessonHref(course.modules[0].lessons[0].id)} className={primaryBtn}>
                  <Play className="h-5 w-5" /> Preview the first lesson
                </Link>
              )
            ) : enrollment ? (
              <div className="space-y-4">
                <div>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-gray-700">Your progress</span>
                    <span className="font-semibold text-gray-900">
                      {completedLessons} of {totalLessons} lessons
                    </span>
                  </div>
                  <div
                    className="h-3 w-full overflow-hidden rounded-full bg-gray-200"
                    role="progressbar"
                    aria-label="Your progress"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={enrollment.progressPercentage}
                  >
                    <div
                      className={`h-full rounded-full ${completed ? 'bg-green-600' : 'bg-blue-600'}`}
                      style={{ width: `${enrollment.progressPercentage}%` }}
                    />
                  </div>
                </div>
                {completed ? (
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                    <Link href={`${basePath}/${course.id}/certificate`} className={primaryBtn.replace('bg-blue-700', 'bg-green-700').replace('hover:bg-blue-800', 'hover:bg-green-800')}>
                      <Award className="h-5 w-5" /> View your certificate
                    </Link>
                    {nextLesson && (
                      <Link href={lessonHref(nextLesson.id)} className="inline-flex min-h-[44px] items-center justify-center px-3 font-medium text-blue-800 hover:underline">
                        Review the course
                      </Link>
                    )}
                  </div>
                ) : nextLesson ? (
                  <Link href={lessonHref(nextLesson.id)} className={primaryBtn}>
                    <Play className="h-5 w-5 shrink-0" />
                    <span className="min-w-0 truncate">
                      {completedLessons === 0 ? 'Start the course' : `Continue: ${nextLesson.title}`}
                    </span>
                  </Link>
                ) : null}
              </div>
            ) : prereqsMissing.length ? (
              <div className="rounded-lg border bg-gray-50 p-4">
                <p className="mb-2 flex items-center gap-2 font-semibold text-gray-900">
                  <Lock className="h-4 w-4" /> Before you start
                </p>
                <p className="mb-2 text-sm text-gray-700">Finish these courses first:</p>
                <ul className="space-y-1">
                  {course.prerequisites.map((p) => (
                    <li key={p.id} className="flex items-center gap-2 text-sm">
                      {p.completed ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Circle className="h-4 w-4 text-gray-500" />}
                      <Link href={`${basePath}/${p.id}`} className="text-blue-800 underline">
                        {p.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <button onClick={handleEnroll} disabled={isEnrolling || totalLessons === 0} className={primaryBtn}>
                {isEnrolling ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
                {isEnrolling ? 'Joining...' : 'Join the course and start'}
              </button>
            )}
          </div>
        </div>
      </section>

      {(course.outcomes.length > 0 || course.audience) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {course.outcomes.length > 0 && (
            <section className="rounded-xl border bg-white p-5 sm:p-6 lg:col-span-2">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                <Target className="h-5 w-5 text-blue-700" aria-hidden="true" /> What you&apos;ll learn
              </h2>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {course.outcomes.map((o, i) => (
                  <li key={i} className="flex items-start gap-2 text-gray-800">
                    <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-600" aria-hidden="true" />
                    <span>{o}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {course.audience && (
            <section className={`rounded-xl border bg-white p-5 sm:p-6 ${course.outcomes.length ? '' : 'lg:col-span-3'}`}>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gray-900">
                <Users className="h-5 w-5 text-blue-700" aria-hidden="true" /> Who it&apos;s for
              </h2>
              <p className="whitespace-pre-line text-gray-800">{course.audience}</p>
            </section>
          )}
        </div>
      )}

      {/* Curriculum */}
      <section className="rounded-xl border bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
          <h2 className="text-lg font-semibold text-gray-900">Course content</h2>
          {course.dripDays && (
            <p className="text-sm text-gray-700">
              A new week opens every {course.dripDays} {course.dripDays === 1 ? 'day' : 'days'} after you join.
            </p>
          )}
        </div>
        {course.modules.length === 0 ? (
          <p className="p-6 text-center text-gray-700">Lessons are being added. Check back soon.</p>
        ) : (
          <ol className="divide-y">
            {course.modules.map((m, mi) => {
              const done = m.lessons.filter((l) => l.progress.status === 'COMPLETED').length
              const open = openModules.has(m.id)
              const minutes = m.lessons.reduce((a, l) => a + (l.estimatedDuration ?? 0), 0)
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => toggle(m.id)}
                    aria-expanded={open}
                    className="flex min-h-[56px] w-full items-start gap-3 p-4 text-left hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600"
                  >
                    <ChevronDown className={`mt-1 h-5 w-5 shrink-0 text-gray-600 transition-transform ${open ? '' : '-rotate-90'}`} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-gray-900">{m.title || `Week ${mi + 1}`}</span>
                      {m.description && <span className="mt-1 block text-sm text-gray-700">{m.description}</span>}
                      <span className="mt-1 block text-sm text-gray-600">
                        {m.lessons.length} lessons{minutes ? ` · ${formatMinutes(minutes)}` : ''}
                        {enrollment ? ` · ${done} done` : ''}
                        {!m.isOpen && m.opensAt ? ` · opens ${shortDate(m.opensAt)}` : ''}
                      </span>
                    </span>
                    {!m.isOpen && <Lock className="mt-1 h-5 w-5 shrink-0 text-gray-500" aria-label="Not open yet" />}
                  </button>
                  {open && (
                    <ol className="border-t bg-gray-50">
                      {m.lessons.map((l, li) => {
                        const isDone = l.progress.status === 'COMPLETED'
                        const canOpen = preview || (!!enrollment && m.isOpen)
                        const row = (
                          <>
                            {canOpen ? (
                              isDone ? (
                                <CheckCircle className="h-5 w-5 shrink-0 text-green-600" aria-hidden="true" />
                              ) : (
                                <Circle className="h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
                              )
                            ) : (
                              <Lock className="h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block text-gray-900">
                                {li + 1}. {l.title}
                              </span>
                              <span className="flex flex-wrap gap-x-3 text-xs text-gray-600">
                                {l.estimatedDuration ? <span>{l.estimatedDuration} min</span> : null}
                                {l.exerciseCount > 0 && (
                                  <span className="flex items-center gap-1">
                                    <PenLine className="h-3 w-3" aria-hidden="true" />
                                    {l.exerciseCount} {l.exerciseCount === 1 ? 'exercise' : 'exercises'}
                                  </span>
                                )}
                                {isDone && <span className="sr-only">Completed</span>}
                              </span>
                            </span>
                            {l.id === course.nextLessonId && !completed && enrollment && (
                              <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">Up next</span>
                            )}
                          </>
                        )
                        return (
                          <li key={l.id} className="border-b last:border-b-0">
                            {canOpen ? (
                              <Link
                                href={lessonHref(l.id)}
                                className="flex min-h-[52px] items-center gap-3 px-4 py-2 pl-6 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 sm:pl-12"
                              >
                                {row}
                              </Link>
                            ) : (
                              <div className="flex min-h-[52px] items-center gap-3 px-4 py-2 pl-6 sm:pl-12">{row}</div>
                            )}
                          </li>
                        )
                      })}
                    </ol>
                  )}
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </div>
  )
}
