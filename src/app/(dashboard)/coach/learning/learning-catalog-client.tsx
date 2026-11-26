'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Award, BookOpen, CheckCircle, Clock, GraduationCap, Layers, Lock, Play, Search, X } from 'lucide-react'
import { formatMinutes } from '@/lib/lms/course-rules'

interface Course {
  id: string
  title: string
  description: string | null
  thumbnail: string | null
  estimatedDuration: number | null
  category: string | null
  tags: string[]
  moduleCount: number
  lessonCount: number
  enrollmentCount: number
  publishedAt: string | null
  prerequisitesMet: boolean
  isEnrolled: boolean
  enrollment: {
    id: string
    status: string
    progressPercentage: number
    completedAt: string | null
    lastAccessedAt: string | null
    completedLessons: number
    nextLessonId: string | null
    nextLessonTitle: string | null
  } | null
}

interface Enrollment {
  id: string
  courseId: string
  courseTitle: string
  courseThumbnail: string | null
  category: string | null
  estimatedDuration: number | null
  lessonCount: number
  completedLessons: number
  nextLessonId: string | null
  nextLessonTitle: string | null
  status: string
  progressPercentage: number
  completedAt: string | null
  lastAccessedAt: string | null
  enrolledAt: string
}

interface LearningCatalogClientProps {
  courses: Course[]
  enrollments: Enrollment[]
  basePath?: string
}

type Tab = 'mine' | 'all'

export function LearningCatalogClient({ courses, enrollments, basePath = '/coach/learning' }: LearningCatalogClientProps) {
  const [tab, setTab] = useState<Tab>(enrollments.length ? 'mine' : 'all')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string | null>(null)

  const inProgress = enrollments.filter((e) => e.status !== 'COMPLETED')
  const completed = enrollments.filter((e) => e.status === 'COMPLETED')
  // Most recently opened first (the server already sorts by last opened).
  const resume = inProgress.filter((e) => e.nextLessonId).slice(0, 3)

  const categories = useMemo(
    () => Array.from(new Set(courses.map((c) => c.category).filter((c): c is string => !!c))).sort(),
    [courses]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return courses.filter((c) => {
      if (category && c.category !== category) return false
      if (!q) return true
      return [c.title, c.description ?? '', c.category ?? '', ...c.tags].some((s) => s.toLowerCase().includes(q))
    })
  }, [courses, query, category])

  const nothingPublished = courses.length === 0 && enrollments.length === 0

  const tabBtn = (t: Tab, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === t}
      onClick={() => setTab(t)}
      className={`min-h-[44px] border-b-2 px-1 pb-2 font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
        tab === t ? 'border-blue-700 text-blue-800' : 'border-transparent text-gray-600 hover:text-gray-900'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Learning</h1>
        <p className="text-gray-700">Your courses, in your own time. Pick up exactly where you left off.</p>
      </div>

      {nothingPublished ? (
        <div className="rounded-xl border bg-white px-6 py-12 text-center">
          <GraduationCap className="mx-auto mb-4 h-12 w-12 text-gray-400" aria-hidden="true" />
          <h2 className="mb-2 text-lg font-semibold text-gray-900">No courses yet</h2>
          <p className="mx-auto max-w-md text-gray-700">
            When the NowTransformed team publishes a course for you, it will show up here.
          </p>
        </div>
      ) : (
        <>
          {resume.length > 0 && (
            <section aria-labelledby="continue-heading">
              <h2 id="continue-heading" className="mb-3 text-lg font-semibold text-gray-900">
                Continue learning
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {resume.map((e) => (
                  <Link
                    key={e.id}
                    href={`${basePath}/${e.courseId}/${e.nextLessonId}`}
                    className="group flex flex-col rounded-xl border-2 border-blue-100 bg-white p-4 hover:border-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  >
                    <p className="text-sm text-gray-600">{e.courseTitle}</p>
                    <p className="mt-1 line-clamp-2 font-semibold text-gray-900">{e.nextLessonTitle}</p>
                    <div className="mt-3">
                      <ProgressBar value={e.progressPercentage} label={`${e.courseTitle} progress`} />
                      <p className="mt-1 text-xs text-gray-600">
                        {e.completedLessons} of {e.lessonCount} lessons done
                      </p>
                    </div>
                    <span className="mt-3 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 font-semibold text-white group-hover:bg-blue-800">
                      <Play className="h-4 w-4" /> {e.completedLessons === 0 ? 'Start' : 'Continue'}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <div className="flex gap-6 border-b" role="tablist" aria-label="Courses">
            {tabBtn('mine', `My courses (${enrollments.length})`)}
            {tabBtn('all', `All courses (${courses.length})`)}
          </div>

          {tab === 'mine' ? (
            enrollments.length === 0 ? (
              <div className="rounded-xl border bg-white px-6 py-12 text-center">
                <BookOpen className="mx-auto mb-4 h-12 w-12 text-gray-400" aria-hidden="true" />
                <h2 className="mb-2 text-lg font-semibold text-gray-900">You haven&apos;t joined a course yet</h2>
                <p className="mb-4 text-gray-700">Have a look at what&apos;s available and start when you&apos;re ready.</p>
                <button
                  type="button"
                  onClick={() => setTab('all')}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-700 px-4 font-semibold text-white hover:bg-blue-800"
                >
                  See all courses <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {inProgress.length > 0 && (
                  <EnrollmentGroup title="In progress" items={inProgress} basePath={basePath} />
                )}
                {completed.length > 0 && <EnrollmentGroup title="Completed" items={completed} basePath={basePath} />}
              </div>
            )
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="relative block sm:max-w-xs sm:flex-1">
                  <span className="sr-only">Search courses</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" aria-hidden="true" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search courses"
                    className="min-h-[44px] w-full rounded-lg border border-gray-300 pl-9 pr-3 text-gray-900 placeholder:text-gray-500 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                  />
                </label>
                {categories.length > 0 && (
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
                    {[null, ...categories].map((c) => (
                      <button
                        key={c ?? 'all'}
                        type="button"
                        aria-pressed={category === c}
                        onClick={() => setCategory(c)}
                        className={`min-h-[44px] rounded-full border px-4 text-sm font-medium ${
                          category === c ? 'border-blue-700 bg-blue-700 text-white' : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50'
                        }`}
                      >
                        {c ?? 'All'}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {courses.length === 0 ? (
                <div className="rounded-xl border bg-white px-6 py-12 text-center text-gray-700">
                  No other courses are open to you right now.
                </div>
              ) : filtered.length === 0 ? (
                <div className="rounded-xl border bg-white px-6 py-12 text-center">
                  <p className="mb-3 text-gray-700">No courses match that.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('')
                      setCategory(null)
                    }}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-gray-300 px-4 font-medium text-gray-900 hover:bg-gray-50"
                  >
                    <X className="h-4 w-4" /> Clear search and filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((c) => (
                    <CourseCard key={c.id} course={c} basePath={basePath} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ProgressBar({ value, label, done }: { value: number; label: string; done?: boolean }) {
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-gray-200"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
    >
      <div className={`h-full rounded-full ${done ? 'bg-green-600' : 'bg-blue-600'}`} style={{ width: `${value}%` }} />
    </div>
  )
}

function Thumb({ src, alt }: { src: string | null; alt: string }) {
  return (
    <div className="relative h-32 overflow-hidden rounded-t-xl bg-gradient-to-br from-blue-50 to-indigo-100">
      {src ? (
        <Image src={src} alt={alt} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <GraduationCap className="h-10 w-10 text-blue-300" aria-hidden="true" />
        </div>
      )}
    </div>
  )
}

function EnrollmentGroup({ title, items, basePath }: { title: string; items: Enrollment[]; basePath: string }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-gray-900">{title}</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((e) => {
          const done = e.status === 'COMPLETED'
          return (
            <div key={e.id} className="flex flex-col rounded-xl border bg-white">
              <Link href={`${basePath}/${e.courseId}`} className="block rounded-t-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
                <Thumb src={e.courseThumbnail} alt="" />
              </Link>
              <div className="flex flex-1 flex-col p-4">
                {e.category && <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">{e.category}</p>}
                <Link href={`${basePath}/${e.courseId}`} className="mt-1 line-clamp-2 font-semibold text-gray-900 hover:underline">
                  {e.courseTitle}
                </Link>
                <div className="mt-3">
                  <ProgressBar value={e.progressPercentage} label={`${e.courseTitle} progress`} done={done} />
                  <p className="mt-1 text-xs text-gray-600">
                    {e.completedLessons} of {e.lessonCount} lessons{done && e.completedAt ? ` · finished ${new Date(e.completedAt).toLocaleDateString()}` : ''}
                  </p>
                </div>
                <div className="mt-auto pt-3">
                  {done ? (
                    <Link
                      href={`${basePath}/${e.courseId}/certificate`}
                      className="inline-flex min-h-[44px] items-center gap-2 font-semibold text-green-800 hover:underline"
                    >
                      <Award className="h-4 w-4" /> Certificate
                    </Link>
                  ) : e.nextLessonId ? (
                    <Link
                      href={`${basePath}/${e.courseId}/${e.nextLessonId}`}
                      className="inline-flex min-h-[44px] items-center gap-2 font-semibold text-blue-800 hover:underline"
                    >
                      <Play className="h-4 w-4" /> {e.completedLessons === 0 ? 'Start' : 'Continue'}
                    </Link>
                  ) : (
                    <Link href={`${basePath}/${e.courseId}`} className="inline-flex min-h-[44px] items-center gap-2 font-semibold text-blue-800 hover:underline">
                      Open course
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function CourseCard({ course, basePath }: { course: Course; basePath: string }) {
  const e = course.enrollment
  const done = e?.status === 'COMPLETED'
  return (
    <Link
      href={`${basePath}/${course.id}`}
      className="flex flex-col rounded-xl border bg-white transition-shadow hover:border-blue-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
    >
      <Thumb src={course.thumbnail} alt="" />
      <div className="flex flex-1 flex-col p-4">
        {course.category && <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">{course.category}</p>}
        <h3 className="mt-1 line-clamp-2 font-semibold text-gray-900">{course.title}</h3>
        {course.description && <p className="mt-1 line-clamp-2 text-sm text-gray-700">{course.description}</p>}
        <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-700">
          <li className="flex items-center gap-1">
            <Layers className="h-4 w-4" aria-hidden="true" />
            {course.lessonCount} lessons
          </li>
          {formatMinutes(course.estimatedDuration) && (
            <li className="flex items-center gap-1">
              <Clock className="h-4 w-4" aria-hidden="true" />
              {formatMinutes(course.estimatedDuration)}
            </li>
          )}
        </ul>
        <div className="mt-auto pt-3">
          {e ? (
            <>
              <ProgressBar value={e.progressPercentage} label={`${course.title} progress`} done={done} />
              <p className="mt-2 flex items-center gap-1 text-sm font-medium text-gray-800">
                {done ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-600" /> Completed
                  </>
                ) : (
                  `${e.progressPercentage}% done`
                )}
              </p>
            </>
          ) : !course.prerequisitesMet ? (
            <p className="flex items-center gap-1 text-sm text-gray-700">
              <Lock className="h-4 w-4" /> Finish another course first
            </p>
          ) : (
            <p className="flex items-center gap-1 text-sm font-semibold text-blue-800">
              See what&apos;s inside <ArrowRight className="h-4 w-4" />
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}
