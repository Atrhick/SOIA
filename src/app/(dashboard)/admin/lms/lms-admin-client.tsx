'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  GraduationCap,
  Plus,
  Trash2,
  Eye,
  Users,
  CheckCircle,
  Clock,
  Archive,
  Play,
  Pause,
  Pencil,
  BookOpen,
  Layers,
  MoreVertical,
  BarChart3,
} from 'lucide-react'
import {
  deleteCourse,
  publishCourse,
  unpublishCourse,
  archiveCourse,
} from '@/lib/actions/lms/courses'

interface Course {
  id: string
  title: string
  description: string | null
  thumbnail: string | null
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  allowedRoles: string[]
  estimatedDuration: number | null
  sortOrder: number
  createdAt: string
  publishedAt: string | null
  moduleCount: number
  enrollmentCount: number
}

interface Stats {
  totalCourses: number
  draftCount: number
  publishedCount: number
  archivedCount: number
  totalEnrollments: number
}

interface LMSAdminClientProps {
  courses: Course[]
  stats: Stats
}

export function LMSAdminClient({ courses, stats }: LMSAdminClientProps) {
  const router = useRouter()
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'>('ALL')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  const filteredCourses =
    activeFilter === 'ALL' ? courses : courses.filter((c) => c.status === activeFilter)

  const handleDelete = async (courseId: string, title: string) => {
    if (
      !confirm(
        `Are you sure you want to delete "${title}"? This will also delete all modules, lessons, and content.`
      )
    ) {
      return
    }

    setIsSubmitting(true)
    setOpenMenu(null)
    try {
      const result = await deleteCourse(courseId)
      if (result.error) {
        setError(result.error)
      }
    } catch {
      setError('An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePublish = async (courseId: string) => {
    setIsSubmitting(true)
    setOpenMenu(null)
    try {
      const result = await publishCourse(courseId)
      if (result.error) {
        setError(result.error)
      }
    } catch {
      setError('An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUnpublish = async (courseId: string) => {
    setIsSubmitting(true)
    setOpenMenu(null)
    try {
      const result = await unpublishCourse(courseId)
      if (result.error) {
        setError(result.error)
      }
    } catch {
      setError('An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleArchive = async (courseId: string) => {
    setIsSubmitting(true)
    setOpenMenu(null)
    try {
      const result = await archiveCourse(courseId)
      if (result.error) {
        setError(result.error)
      }
    } catch {
      setError('An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PUBLISHED':
        return (
          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
            Published
          </span>
        )
      case 'DRAFT':
        return (
          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium">
            Draft
          </span>
        )
      case 'ARCHIVED':
        return (
          <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded text-xs font-medium">
            Archived
          </span>
        )
      default:
        return null
    }
  }

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '--'
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">LMS Courses</h1>
          <p className="text-gray-600">Create and manage learning courses for coaches and ambassadors</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/lms/analytics"
            className="flex items-center gap-2 px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50"
          >
            <BarChart3 className="h-4 w-4" />
            Analytics
          </Link>
          <Link
            href="/admin/lms/new"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Create Course
          </Link>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
          <button onClick={() => setError('')} className="ml-4 text-sm underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
            <div className="p-2 bg-gray-100 rounded-lg">
              <Clock className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Draft</p>
              <p className="text-2xl font-bold">{stats.draftCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Published</p>
              <p className="text-2xl font-bold">{stats.publishedCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Archive className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Archived</p>
              <p className="text-2xl font-bold">{stats.archivedCount}</p>
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
      </div>

      {/* Filter Tabs */}
      <div className="border-b">
        <div className="flex gap-4">
          {(['ALL', 'DRAFT', 'PUBLISHED', 'ARCHIVED'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`pb-3 px-1 font-medium border-b-2 transition-colors ${
                activeFilter === filter
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {filter === 'ALL' ? 'All' : filter.charAt(0) + filter.slice(1).toLowerCase()} (
              {filter === 'ALL'
                ? courses.length
                : courses.filter((c) => c.status === filter).length}
              )
            </button>
          ))}
        </div>
      </div>

      {/* Course List */}
      {filteredCourses.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border">
          <GraduationCap className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No courses yet</h3>
          <p className="text-gray-500 mb-4">Get started by creating your first course</p>
          <Link
            href="/admin/lms/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Create Course
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Course</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Audience</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">Modules</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">Duration</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">Enrollments</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredCourses.map((course) => (
                <tr key={course.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/lms/${course.id}`}
                      className="flex items-center gap-3 hover:text-blue-600"
                    >
                      {course.thumbnail ? (
                        <img
                          src={course.thumbnail}
                          alt=""
                          className="w-12 h-12 rounded object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center">
                          <BookOpen className="h-6 w-6 text-gray-400" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{course.title}</p>
                        {course.description && (
                          <p className="text-sm text-gray-500 line-clamp-1">{course.description}</p>
                        )}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3">{getStatusBadge(course.status)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {course.allowedRoles.map((role) => (
                        <span
                          key={role}
                          className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs"
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1 text-gray-600">
                      <Layers className="h-4 w-4" />
                      <span>{course.moduleCount}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">
                    {formatDuration(course.estimatedDuration)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 text-gray-600">
                      <Users className="h-4 w-4" />
                      {course.enrollmentCount}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1 relative">
                      <Link
                        href={`/admin/lms/${course.id}`}
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => setOpenMenu(openMenu === course.id ? null : course.id)}
                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                        disabled={isSubmitting}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>

                      {/* Dropdown Menu */}
                      {openMenu === course.id && (
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border py-1 z-10">
                          {course.status === 'DRAFT' && (
                            <button
                              onClick={() => handlePublish(course.id)}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                              disabled={isSubmitting}
                            >
                              <Play className="h-4 w-4 text-green-600" />
                              Publish
                            </button>
                          )}
                          {course.status === 'PUBLISHED' && (
                            <button
                              onClick={() => handleUnpublish(course.id)}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                              disabled={isSubmitting}
                            >
                              <Pause className="h-4 w-4 text-yellow-600" />
                              Unpublish
                            </button>
                          )}
                          {course.status !== 'ARCHIVED' && (
                            <button
                              onClick={() => handleArchive(course.id)}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                              disabled={isSubmitting}
                            >
                              <Archive className="h-4 w-4 text-orange-600" />
                              Archive
                            </button>
                          )}
                          <hr className="my-1" />
                          <button
                            onClick={() => handleDelete(course.id, course.title)}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                            disabled={isSubmitting}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Click outside to close menu */}
      {openMenu && (
        <div className="fixed inset-0 z-0" onClick={() => setOpenMenu(null)} />
      )}
    </div>
  )
}
