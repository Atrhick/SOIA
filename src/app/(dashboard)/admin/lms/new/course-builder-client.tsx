'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  BookOpen,
  Users,
  Clock,
  Image,
  Save,
  Loader2,
} from 'lucide-react'
import { createCourse } from '@/lib/actions/lms/courses'

export function CourseBuilderClient() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [thumbnail, setThumbnail] = useState('')
  const [allowedRoles, setAllowedRoles] = useState<string[]>(['COACH', 'AMBASSADOR'])
  const [estimatedDuration, setEstimatedDuration] = useState('')

  const handleRoleToggle = (role: string) => {
    setAllowedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!title.trim()) {
      setError('Course title is required')
      return
    }

    if (allowedRoles.length === 0) {
      setError('At least one audience role must be selected')
      return
    }

    setIsSubmitting(true)

    try {
      const formData = new FormData()
      formData.set('title', title.trim())
      formData.set('description', description.trim())
      formData.set('thumbnail', thumbnail.trim())
      formData.set('allowedRoles', JSON.stringify(allowedRoles))
      formData.set('prerequisiteIds', JSON.stringify([]))
      if (estimatedDuration) {
        formData.set('estimatedDuration', estimatedDuration)
      }

      const result = await createCourse(formData)

      if (result.error) {
        setError(result.error)
        setIsSubmitting(false)
        return
      }

      // Redirect to the course editor
      router.push(`/admin/lms/${result.courseId}`)
    } catch (err) {
      setError('An unexpected error occurred')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/lms"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Courses
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Create New Course</h1>
        <p className="text-gray-600">Set up your course details, then add modules and lessons</p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Course Details Card */}
        <div className="bg-white rounded-lg border p-6 space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BookOpen className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Course Details</h2>
              <p className="text-sm text-gray-500">Basic information about your course</p>
            </div>
          </div>

          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Course Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Anti-Human Trafficking Training"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isSubmitting}
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what learners will gain from this course..."
              rows={4}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              disabled={isSubmitting}
            />
          </div>

          {/* Thumbnail */}
          <div>
            <label htmlFor="thumbnail" className="block text-sm font-medium text-gray-700 mb-1">
              <div className="flex items-center gap-2">
                <Image className="h-4 w-4" />
                Thumbnail URL
              </div>
            </label>
            <input
              type="url"
              id="thumbnail"
              value={thumbnail}
              onChange={(e) => setThumbnail(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isSubmitting}
            />
            <p className="mt-1 text-xs text-gray-500">
              Optional. Recommended size: 800x450px (16:9 ratio)
            </p>
          </div>
        </div>

        {/* Audience Card */}
        <div className="bg-white rounded-lg border p-6 space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Audience</h2>
              <p className="text-sm text-gray-500">Who can access this course</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Target Audience <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-3">
              {['COACH', 'AMBASSADOR'].map((role) => (
                <label
                  key={role}
                  className={`flex items-center gap-3 px-4 py-3 border rounded-lg cursor-pointer transition-colors ${
                    allowedRoles.includes(role)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={allowedRoles.includes(role)}
                    onChange={() => handleRoleToggle(role)}
                    className="w-4 h-4 text-blue-600 rounded"
                    disabled={isSubmitting}
                  />
                  <span className="font-medium text-gray-700">
                    {role === 'COACH' ? 'Coaches' : 'Ambassadors'}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Duration Card */}
        <div className="bg-white rounded-lg border p-6 space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b">
            <div className="p-2 bg-green-100 rounded-lg">
              <Clock className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Duration</h2>
              <p className="text-sm text-gray-500">Estimated time to complete</p>
            </div>
          </div>

          <div>
            <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">
              Estimated Duration (minutes)
            </label>
            <input
              type="number"
              id="duration"
              value={estimatedDuration}
              onChange={(e) => setEstimatedDuration(e.target.value)}
              placeholder="e.g., 120"
              min="1"
              className="w-full max-w-xs px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isSubmitting}
            />
            <p className="mt-1 text-xs text-gray-500">
              This will be shown to learners. Leave empty to calculate automatically.
            </p>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <Link
            href="/admin/lms"
            className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Create & Add Content
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
