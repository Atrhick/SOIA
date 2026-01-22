'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  GraduationCap,
  Users,
  CheckCircle,
  TrendingUp,
  Clock,
  Activity,
  BookOpen,
  Trophy,
  BarChart3,
  ChevronRight,
} from 'lucide-react'

interface OverviewStats {
  totalCourses: number
  publishedCourses: number
  totalEnrollments: number
  completedEnrollments: number
  overallCompletionRate: number
  activeLearnersThisWeek: number
  avgCompletionTime: number
}

interface CourseAnalytics {
  id: string
  title: string
  status: string
  totalEnrollments: number
  completedEnrollments: number
  inProgressEnrollments: number
  notStartedEnrollments: number
  completionRate: number
  avgProgressPercentage: number
  totalTimeSpent: number
  moduleCount: number
  lessonCount: number
  publishedAt: string | null
}

interface EnrollmentDetail {
  id: string
  courseId: string
  courseTitle: string
  userId: string
  userEmail: string
  userName: string | null
  userRole: string
  status: string
  progressPercentage: number
  completedAt: string | null
  enrolledAt: string
  lastAccessedAt: string | null
  totalTimeSpent: number
}

interface ActivityItem {
  type: string
  userId: string
  userEmail: string
  userName: string | null
  courseTitle: string
  lessonTitle?: string
  timestamp: string
}

interface LMSAnalyticsClientProps {
  stats: OverviewStats
  courses: CourseAnalytics[]
  recentActivity: ActivityItem[]
  enrollments: EnrollmentDetail[]
}

export function LMSAnalyticsClient({
  stats,
  courses,
  recentActivity,
  enrollments,
}: LMSAnalyticsClientProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'courses' | 'enrollments'>('overview')

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '--'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
            Completed
          </span>
        )
      case 'IN_PROGRESS':
        return (
          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
            In Progress
          </span>
        )
      case 'NOT_STARTED':
        return (
          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium">
            Not Started
          </span>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin/lms"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to LMS
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">LMS Analytics</h1>
          <p className="text-gray-600">Track course performance and learner progress</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <GraduationCap className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Courses</p>
              <p className="text-2xl font-bold">{stats.totalCourses}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Enrollments</p>
              <p className="text-2xl font-bold">{stats.totalEnrollments}</p>
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
              <p className="text-2xl font-bold">{stats.completedEnrollments}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Completion Rate</p>
              <p className="text-2xl font-bold">{stats.overallCompletionRate}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Activity className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active This Week</p>
              <p className="text-2xl font-bold">{stats.activeLearnersThisWeek}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-100 rounded-lg">
              <Clock className="h-5 w-5 text-cyan-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Avg. Completion</p>
              <p className="text-2xl font-bold">{formatDuration(stats.avgCompletionTime)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-6">
          {(['overview', 'courses', 'enrollments'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 px-1 font-medium border-b-2 transition-colors capitalize ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Recent Activity */}
          <div className="bg-white rounded-lg border">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Recent Activity</h2>
            </div>
            <div className="divide-y max-h-[400px] overflow-y-auto">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity, index) => (
                  <div key={index} className="p-4 flex items-start gap-3">
                    <div
                      className={`p-2 rounded-full ${
                        activity.type === 'COURSE_COMPLETED'
                          ? 'bg-green-100'
                          : 'bg-blue-100'
                      }`}
                    >
                      {activity.type === 'COURSE_COMPLETED' ? (
                        <Trophy className="h-4 w-4 text-green-600" />
                      ) : (
                        <CheckCircle className="h-4 w-4 text-blue-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">
                        <span className="font-medium">
                          {activity.userName || activity.userEmail}
                        </span>{' '}
                        {activity.type === 'COURSE_COMPLETED' ? (
                          <>completed course</>
                        ) : (
                          <>completed lesson "{activity.lessonTitle}"</>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">{activity.courseTitle}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatTime(activity.timestamp)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <Activity className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p>No recent activity</p>
                </div>
              )}
            </div>
          </div>

          {/* Top Courses */}
          <div className="bg-white rounded-lg border">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Course Performance</h2>
              <button
                onClick={() => setActiveTab('courses')}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                View all
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="divide-y">
              {courses
                .filter((c) => c.status === 'PUBLISHED')
                .slice(0, 5)
                .map((course) => (
                  <Link
                    key={course.id}
                    href={`/admin/lms/${course.id}`}
                    className="p-4 flex items-center justify-between hover:bg-gray-50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{course.title}</p>
                      <p className="text-sm text-gray-500">
                        {course.totalEnrollments} enrollments · {course.completionRate}%
                        completion
                      </p>
                    </div>
                    <div className="ml-4">
                      <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500"
                          style={{ width: `${course.completionRate}%` }}
                        />
                      </div>
                    </div>
                  </Link>
                ))}
              {courses.filter((c) => c.status === 'PUBLISHED').length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  <BookOpen className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p>No published courses yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'courses' && (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                  Course
                </th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">
                  Status
                </th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">
                  Enrollments
                </th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">
                  Completed
                </th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">
                  Completion Rate
                </th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">
                  Avg Progress
                </th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">
                  Total Time
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {courses.map((course) => (
                <tr key={course.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/lms/${course.id}`}
                      className="font-medium text-gray-900 hover:text-blue-600"
                    >
                      {course.title}
                    </Link>
                    <p className="text-xs text-gray-500">
                      {course.moduleCount} modules · {course.lessonCount} lessons
                    </p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        course.status === 'PUBLISHED'
                          ? 'bg-green-100 text-green-700'
                          : course.status === 'DRAFT'
                          ? 'bg-gray-100 text-gray-600'
                          : 'bg-red-100 text-red-600'
                      }`}
                    >
                      {course.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">{course.totalEnrollments}</td>
                  <td className="px-4 py-3 text-center">{course.completedEnrollments}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500"
                          style={{ width: `${course.completionRate}%` }}
                        />
                      </div>
                      <span className="text-sm">{course.completionRate}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${course.avgProgressPercentage}%` }}
                        />
                      </div>
                      <span className="text-sm">{course.avgProgressPercentage}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600">
                    {formatDuration(course.totalTimeSpent)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'enrollments' && (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                  Learner
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                  Course
                </th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">
                  Status
                </th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">
                  Progress
                </th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">
                  Time Spent
                </th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">
                  Last Active
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {enrollments.map((enrollment) => (
                <tr key={enrollment.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">
                      {enrollment.userName || enrollment.userEmail}
                    </p>
                    <p className="text-xs text-gray-500">{enrollment.userRole}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/lms/${enrollment.courseId}`}
                      className="text-gray-900 hover:text-blue-600"
                    >
                      {enrollment.courseTitle}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {getStatusBadge(enrollment.status)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            enrollment.status === 'COMPLETED' ? 'bg-green-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${enrollment.progressPercentage}%` }}
                        />
                      </div>
                      <span className="text-sm">{enrollment.progressPercentage}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-600">
                    {formatDuration(enrollment.totalTimeSpent)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-500">
                    {formatDate(enrollment.lastAccessedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
