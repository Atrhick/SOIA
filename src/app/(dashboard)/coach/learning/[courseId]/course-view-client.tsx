'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Layers,
  Play,
  CheckCircle,
  Circle,
  ChevronDown,
  ChevronRight,
  Lock,
  Video,
  FileText,
  FileQuestion,
  File,
  Trophy,
  Loader2,
} from 'lucide-react'
import { enrollInCourse } from '@/lib/actions/lms/enrollment'

interface ContentBlock {
  id: string
  title: string | null
  type: 'VIDEO' | 'TEXT' | 'QUIZ' | 'DOCUMENT'
  sortOrder: number
}

interface Lesson {
  id: string
  title: string
  description: string | null
  estimatedDuration: number | null
  sortOrder: number
  contentBlockCount: number
  contentBlocks: ContentBlock[]
  progress: {
    status: string
    completedAt: string | null
  }
}

interface Module {
  id: string
  title: string
  description: string | null
  sortOrder: number
  lessons: Lesson[]
}

interface Course {
  id: string
  title: string
  description: string | null
  thumbnail: string | null
  estimatedDuration: number | null
  modules: Module[]
  enrollment: {
    id: string
    status: string
    progressPercentage: number
    completedAt: string | null
    lastAccessedAt: string | null
    totalTimeSpent: number
  } | null
}

interface CourseViewClientProps {
  course: Course
  basePath?: string
}

const contentTypeIcons = {
  VIDEO: Video,
  TEXT: FileText,
  QUIZ: FileQuestion,
  DOCUMENT: File,
}

export function CourseViewClient({ course, basePath = '/coach/learning' }: CourseViewClientProps) {
  const router = useRouter()
  const [isEnrolling, setIsEnrolling] = useState(false)
  const [error, setError] = useState('')
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    new Set(course.modules.map((m) => m.id))
  )

  const isEnrolled = !!course.enrollment
  const totalLessons = course.modules.reduce((acc, m) => acc + m.lessons.length, 0)
  const completedLessons = course.modules.reduce(
    (acc, m) => acc + m.lessons.filter((l) => l.progress.status === 'COMPLETED').length,
    0
  )

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev)
      if (next.has(moduleId)) {
        next.delete(moduleId)
      } else {
        next.add(moduleId)
      }
      return next
    })
  }

  const handleEnroll = async () => {
    setIsEnrolling(true)
    setError('')

    try {
      const result = await enrollInCourse(course.id)
      if (result.error) {
        setError(result.error)
      } else {
        router.refresh()
      }
    } catch {
      setError('Failed to enroll')
    } finally {
      setIsEnrolling(false)
    }
  }

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return null
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  // Find the first incomplete lesson for "Continue" button
  const findNextLesson = (): Lesson | null => {
    for (const module of course.modules) {
      for (const lesson of module.lessons) {
        if (lesson.progress.status !== 'COMPLETED') {
          return lesson
        }
      }
    }
    return course.modules[0]?.lessons[0] || null
  }

  const nextLesson = findNextLesson()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href={basePath}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Learning
        </Link>
      </div>

      {/* Course Hero */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="md:flex">
          {/* Thumbnail */}
          <div className="md:w-1/3 h-48 md:h-auto bg-gray-100">
            {course.thumbnail ? (
              <img
                src={course.thumbnail}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <BookOpen className="h-16 w-16 text-gray-300" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="md:w-2/3 p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{course.title}</h1>
            {course.description && (
              <p className="text-gray-600 mb-4">{course.description}</p>
            )}

            {/* Stats */}
            <div className="flex flex-wrap gap-4 mb-6 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Layers className="h-4 w-4" />
                {course.modules.length} modules
              </span>
              <span className="flex items-center gap-1">
                <BookOpen className="h-4 w-4" />
                {totalLessons} lessons
              </span>
              {course.estimatedDuration && (
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {formatDuration(course.estimatedDuration)}
                </span>
              )}
            </div>

            {/* Progress or Enroll */}
            {isEnrolled ? (
              <div className="space-y-4">
                {/* Progress Bar */}
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-gray-600">Your Progress</span>
                    <span className="font-semibold text-gray-900">
                      {course.enrollment!.progressPercentage}% ({completedLessons}/{totalLessons} lessons)
                    </span>
                  </div>
                  <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        course.enrollment!.status === 'COMPLETED' ? 'bg-green-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${course.enrollment!.progressPercentage}%` }}
                    />
                  </div>
                </div>

                {/* Action Button */}
                {course.enrollment!.status === 'COMPLETED' ? (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-green-600">
                      <Trophy className="h-5 w-5" />
                      <span className="font-semibold">Course Completed!</span>
                    </div>
                    {nextLesson && (
                      <Link
                        href={`${basePath}/${course.id}/${nextLesson.id}`}
                        className="text-blue-600 hover:text-blue-700 text-sm"
                      >
                        Review Course
                      </Link>
                    )}
                  </div>
                ) : nextLesson ? (
                  <Link
                    href={`${basePath}/${course.id}/${nextLesson.id}`}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                  >
                    <Play className="h-5 w-5" />
                    {course.enrollment!.status === 'NOT_STARTED' ? 'Start Course' : 'Continue Learning'}
                  </Link>
                ) : null}
              </div>
            ) : (
              <div>
                {error && (
                  <p className="text-red-600 text-sm mb-3">{error}</p>
                )}
                <button
                  onClick={handleEnroll}
                  disabled={isEnrolling}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
                >
                  {isEnrolling ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Enrolling...
                    </>
                  ) : (
                    <>
                      <Play className="h-5 w-5" />
                      Enroll Now - Free
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Course Content */}
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-gray-900">Course Content</h2>
        </div>

        <div className="divide-y">
          {course.modules.map((module, moduleIndex) => {
            const moduleLessons = module.lessons.length
            const moduleCompleted = module.lessons.filter(
              (l) => l.progress.status === 'COMPLETED'
            ).length

            return (
              <div key={module.id}>
                {/* Module Header */}
                <button
                  onClick={() => toggleModule(module.id)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 text-left"
                >
                  {expandedModules.has(module.id) ? (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                        Module {moduleIndex + 1}
                      </span>
                      <span className="font-medium text-gray-900">{module.title}</span>
                    </div>
                    {module.description && (
                      <p className="text-sm text-gray-500 mt-1">{module.description}</p>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    {moduleCompleted}/{moduleLessons} lessons
                  </div>
                </button>

                {/* Lessons */}
                {expandedModules.has(module.id) && (
                  <div className="border-t bg-gray-50">
                    {module.lessons.map((lesson, lessonIndex) => {
                      const isCompleted = lesson.progress.status === 'COMPLETED'
                      const isLocked = !isEnrolled

                      return (
                        <div
                          key={lesson.id}
                          className={`flex items-center gap-3 px-4 py-3 pl-12 border-b last:border-b-0 ${
                            isLocked ? 'opacity-60' : ''
                          }`}
                        >
                          {/* Status Icon */}
                          <div className="flex-shrink-0">
                            {isLocked ? (
                              <Lock className="h-5 w-5 text-gray-400" />
                            ) : isCompleted ? (
                              <CheckCircle className="h-5 w-5 text-green-500" />
                            ) : (
                              <Circle className="h-5 w-5 text-gray-300" />
                            )}
                          </div>

                          {/* Lesson Info */}
                          <div className="flex-1 min-w-0">
                            {isLocked ? (
                              <span className="text-gray-600">
                                {lessonIndex + 1}. {lesson.title}
                              </span>
                            ) : (
                              <Link
                                href={`${basePath}/${course.id}/${lesson.id}`}
                                className="text-gray-900 hover:text-blue-600"
                              >
                                {lessonIndex + 1}. {lesson.title}
                              </Link>
                            )}
                            {/* Content type indicators */}
                            <div className="flex items-center gap-2 mt-1">
                              {lesson.contentBlocks.map((block) => {
                                const Icon = contentTypeIcons[block.type]
                                return (
                                  <span
                                    key={block.id}
                                    className="text-xs text-gray-400 flex items-center gap-1"
                                  >
                                    <Icon className="h-3 w-3" />
                                  </span>
                                )
                              })}
                            </div>
                          </div>

                          {/* Duration */}
                          {lesson.estimatedDuration && (
                            <span className="text-sm text-gray-400 flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {lesson.estimatedDuration}m
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
