'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  GraduationCap,
  BookOpen,
  Clock,
  Layers,
  Users,
  Play,
  CheckCircle,
  ArrowRight,
  Trophy,
} from 'lucide-react'

interface Course {
  id: string
  title: string
  description: string | null
  thumbnail: string | null
  estimatedDuration: number | null
  moduleCount: number
  lessonCount: number
  enrollmentCount: number
  publishedAt: string | null
  isEnrolled: boolean
  enrollment: {
    id: string
    status: string
    progressPercentage: number
    completedAt: string | null
  } | null
}

interface Enrollment {
  id: string
  courseId: string
  courseTitle: string
  courseThumbnail: string | null
  estimatedDuration: number | null
  lessonCount: number
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

export function LearningCatalogClient({ courses, enrollments, basePath = '/coach/learning' }: LearningCatalogClientProps) {
  const [activeTab, setActiveTab] = useState<'my-courses' | 'catalog'>('my-courses')

  const inProgressEnrollments = enrollments.filter((e) => e.status === 'IN_PROGRESS')
  const completedEnrollments = enrollments.filter((e) => e.status === 'COMPLETED')
  const notStartedEnrollments = enrollments.filter((e) => e.status === 'NOT_STARTED')
  const availableCourses = courses.filter((c) => !c.isEnrolled)

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return null
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Learning</h1>
        <p className="text-gray-600">Continue your learning journey</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BookOpen className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">In Progress</p>
              <p className="text-2xl font-bold">{inProgressEnrollments.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold">{completedEnrollments.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Clock className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Not Started</p>
              <p className="text-2xl font-bold">{notStartedEnrollments.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <GraduationCap className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Available</p>
              <p className="text-2xl font-bold">{availableCourses.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('my-courses')}
            className={`pb-3 px-1 font-medium border-b-2 transition-colors ${
              activeTab === 'my-courses'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            My Courses ({enrollments.length})
          </button>
          <button
            onClick={() => setActiveTab('catalog')}
            className={`pb-3 px-1 font-medium border-b-2 transition-colors ${
              activeTab === 'catalog'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Browse Catalog ({availableCourses.length})
          </button>
        </div>
      </div>

      {/* Content */}
      {activeTab === 'my-courses' ? (
        <div className="space-y-6">
          {/* Continue Learning */}
          {inProgressEnrollments.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Continue Learning</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {inProgressEnrollments.map((enrollment) => (
                  <EnrollmentCard key={enrollment.id} enrollment={enrollment} basePath={basePath} />
                ))}
              </div>
            </div>
          )}

          {/* Not Started */}
          {notStartedEnrollments.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Ready to Start</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {notStartedEnrollments.map((enrollment) => (
                  <EnrollmentCard key={enrollment.id} enrollment={enrollment} basePath={basePath} />
                ))}
              </div>
            </div>
          )}

          {/* Completed */}
          {completedEnrollments.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Completed</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {completedEnrollments.map((enrollment) => (
                  <EnrollmentCard key={enrollment.id} enrollment={enrollment} basePath={basePath} />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {enrollments.length === 0 && (
            <div className="text-center py-12 bg-white rounded-lg border">
              <BookOpen className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No courses yet</h3>
              <p className="text-gray-500 mb-4">Browse the catalog to find courses to enroll in</p>
              <button
                onClick={() => setActiveTab('catalog')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Browse Catalog
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div>
          {availableCourses.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableCourses.map((course) => (
                <CourseCard key={course.id} course={course} basePath={basePath} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-lg border">
              <CheckCircle className="h-12 w-12 mx-auto text-green-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">All caught up!</h3>
              <p className="text-gray-500">You're enrolled in all available courses</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function EnrollmentCard({ enrollment, basePath }: { enrollment: Enrollment; basePath: string }) {
  const formatDuration = (minutes: number | null) => {
    if (!minutes) return null
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  return (
    <Link
      href={`${basePath}/${enrollment.courseId}`}
      className="block bg-white rounded-lg border hover:border-blue-300 hover:shadow-md transition-all"
    >
      {/* Thumbnail */}
      <div className="h-36 bg-gray-100 rounded-t-lg overflow-hidden">
        {enrollment.courseThumbnail ? (
          <img
            src={enrollment.courseThumbnail}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen className="h-12 w-12 text-gray-300" />
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
          {enrollment.courseTitle}
        </h3>

        {/* Progress */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-600">Progress</span>
            <span className="font-medium text-gray-900">{enrollment.progressPercentage}%</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                enrollment.status === 'COMPLETED' ? 'bg-green-500' : 'bg-blue-500'
              }`}
              style={{ width: `${enrollment.progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <Layers className="h-4 w-4" />
            {enrollment.lessonCount} lessons
          </span>
          {enrollment.estimatedDuration && (
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {formatDuration(enrollment.estimatedDuration)}
            </span>
          )}
        </div>

        {/* Status */}
        <div className="mt-3 pt-3 border-t">
          {enrollment.status === 'COMPLETED' ? (
            <div className="flex items-center gap-2 text-green-600">
              <Trophy className="h-4 w-4" />
              <span className="text-sm font-medium">Completed</span>
            </div>
          ) : enrollment.status === 'IN_PROGRESS' ? (
            <div className="flex items-center gap-2 text-blue-600">
              <Play className="h-4 w-4" />
              <span className="text-sm font-medium">Continue Learning</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-gray-600">
              <Play className="h-4 w-4" />
              <span className="text-sm font-medium">Start Course</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

function CourseCard({ course, basePath }: { course: Course; basePath: string }) {
  const formatDuration = (minutes: number | null) => {
    if (!minutes) return null
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  return (
    <Link
      href={`${basePath}/${course.id}`}
      className="block bg-white rounded-lg border hover:border-blue-300 hover:shadow-md transition-all"
    >
      {/* Thumbnail */}
      <div className="h-36 bg-gray-100 rounded-t-lg overflow-hidden">
        {course.thumbnail ? (
          <img src={course.thumbnail} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <GraduationCap className="h-12 w-12 text-gray-300" />
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{course.title}</h3>
        {course.description && (
          <p className="text-sm text-gray-500 mb-3 line-clamp-2">{course.description}</p>
        )}

        {/* Meta */}
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <Layers className="h-4 w-4" />
            {course.lessonCount} lessons
          </span>
          {course.estimatedDuration && (
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {formatDuration(course.estimatedDuration)}
            </span>
          )}
        </div>

        {/* Enroll CTA */}
        <div className="mt-3 pt-3 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 flex items-center gap-1">
              <Users className="h-4 w-4" />
              {course.enrollmentCount} enrolled
            </span>
            <span className="text-sm font-medium text-blue-600 flex items-center gap-1">
              View Course
              <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
