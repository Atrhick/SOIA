'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  BookOpen,
  Plus,
  Trash2,
  Pencil,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Layers,
  FileText,
  Video,
  FileQuestion,
  File,
  Save,
  Loader2,
  Settings,
  Eye,
  Play,
  MoreVertical,
  X,
  Check,
  Clock,
} from 'lucide-react'
import { updateCourse, publishCourse, unpublishCourse } from '@/lib/actions/lms/courses'
import { createModule, updateModule, deleteModule } from '@/lib/actions/lms/modules'
import { createLesson, updateLesson, deleteLesson } from '@/lib/actions/lms/lessons'
import {
  createContentBlock,
  updateContentBlock,
  deleteContentBlock,
} from '@/lib/actions/lms/content-blocks'

// Types
interface ContentBlock {
  id: string
  title: string | null
  type: 'VIDEO' | 'TEXT' | 'QUIZ' | 'DOCUMENT'
  content: Record<string, unknown>
  completionThreshold: number | null
  sortOrder: number
}

interface Lesson {
  id: string
  title: string
  description: string | null
  estimatedDuration: number | null
  sortOrder: number
  contentBlocks: ContentBlock[]
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
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  allowedRoles: string[]
  estimatedDuration: number | null
  modules: Module[]
  enrollmentCount: number
}

interface AvailableSurvey {
  id: string
  title: string
  passingScore: number | null
  questionCount: number
}

interface CourseEditorClientProps {
  course: Course
  availableSurveys: AvailableSurvey[]
}

const contentTypeIcons = {
  VIDEO: Video,
  TEXT: FileText,
  QUIZ: FileQuestion,
  DOCUMENT: File,
}

const contentTypeLabels = {
  VIDEO: 'Video',
  TEXT: 'Text',
  QUIZ: 'Quiz',
  DOCUMENT: 'Document',
}

export function CourseEditorClient({ course, availableSurveys }: CourseEditorClientProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // UI state
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    new Set(course.modules.map((m) => m.id))
  )
  const [expandedLessons, setExpandedLessons] = useState<Set<string>>(new Set())
  const [showSettings, setShowSettings] = useState(false)

  // Edit states
  const [editingModule, setEditingModule] = useState<string | null>(null)
  const [editingLesson, setEditingLesson] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState<string | null>(null)

  // Form states for inline editing
  const [moduleForm, setModuleForm] = useState({ title: '', description: '' })
  const [lessonForm, setLessonForm] = useState({ title: '', description: '', duration: '' })
  const [contentForm, setContentForm] = useState<{
    type: 'VIDEO' | 'TEXT' | 'QUIZ' | 'DOCUMENT'
    title: string
    content: Record<string, unknown>
    threshold: string
  }>({ type: 'TEXT', title: '', content: {}, threshold: '' })

  // New item states
  const [addingModuleTo, setAddingModuleTo] = useState(false)
  const [addingLessonTo, setAddingLessonTo] = useState<string | null>(null)
  const [addingContentTo, setAddingContentTo] = useState<string | null>(null)

  // Settings form
  const [settingsForm, setSettingsForm] = useState({
    title: course.title,
    description: course.description || '',
    thumbnail: course.thumbnail || '',
    allowedRoles: course.allowedRoles,
    estimatedDuration: course.estimatedDuration?.toString() || '',
  })

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

  const toggleLesson = (lessonId: string) => {
    setExpandedLessons((prev) => {
      const next = new Set(prev)
      if (next.has(lessonId)) {
        next.delete(lessonId)
      } else {
        next.add(lessonId)
      }
      return next
    })
  }

  const showSuccess = (message: string) => {
    setSuccessMessage(message)
    setTimeout(() => setSuccessMessage(''), 3000)
  }

  // ============================================
  // COURSE SETTINGS
  // ============================================

  const handleSaveSettings = async () => {
    setIsSubmitting(true)
    setError('')

    try {
      const formData = new FormData()
      formData.set('title', settingsForm.title)
      formData.set('description', settingsForm.description)
      formData.set('thumbnail', settingsForm.thumbnail)
      formData.set('allowedRoles', JSON.stringify(settingsForm.allowedRoles))
      if (settingsForm.estimatedDuration) {
        formData.set('estimatedDuration', settingsForm.estimatedDuration)
      }

      const result = await updateCourse(course.id, formData)
      if (result.error) {
        setError(result.error)
      } else {
        showSuccess('Course settings saved')
        setShowSettings(false)
        router.refresh()
      }
    } catch {
      setError('Failed to save settings')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePublish = async () => {
    setIsSubmitting(true)
    setError('')

    try {
      const result = await publishCourse(course.id)
      if (result.error) {
        setError(result.error)
      } else {
        showSuccess('Course published')
        router.refresh()
      }
    } catch {
      setError('Failed to publish course')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUnpublish = async () => {
    setIsSubmitting(true)
    setError('')

    try {
      const result = await unpublishCourse(course.id)
      if (result.error) {
        setError(result.error)
      } else {
        showSuccess('Course unpublished')
        router.refresh()
      }
    } catch {
      setError('Failed to unpublish course')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ============================================
  // MODULE HANDLERS
  // ============================================

  const handleAddModule = async () => {
    if (!moduleForm.title.trim()) {
      setError('Module title is required')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const formData = new FormData()
      formData.set('courseId', course.id)
      formData.set('title', moduleForm.title)
      formData.set('description', moduleForm.description)

      const result = await createModule(formData)
      if (result.error) {
        setError(result.error)
      } else {
        showSuccess('Module added')
        setModuleForm({ title: '', description: '' })
        setAddingModuleTo(false)
        router.refresh()
      }
    } catch {
      setError('Failed to add module')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateModule = async (moduleId: string) => {
    if (!moduleForm.title.trim()) {
      setError('Module title is required')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const formData = new FormData()
      formData.set('title', moduleForm.title)
      formData.set('description', moduleForm.description)

      const result = await updateModule(moduleId, formData)
      if (result.error) {
        setError(result.error)
      } else {
        showSuccess('Module updated')
        setEditingModule(null)
        router.refresh()
      }
    } catch {
      setError('Failed to update module')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteModule = async (moduleId: string, title: string) => {
    if (!confirm(`Delete module "${title}" and all its lessons?`)) return

    setIsSubmitting(true)
    setError('')

    try {
      const result = await deleteModule(moduleId)
      if (result.error) {
        setError(result.error)
      } else {
        showSuccess('Module deleted')
        router.refresh()
      }
    } catch {
      setError('Failed to delete module')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ============================================
  // LESSON HANDLERS
  // ============================================

  const handleAddLesson = async (moduleId: string) => {
    if (!lessonForm.title.trim()) {
      setError('Lesson title is required')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const formData = new FormData()
      formData.set('moduleId', moduleId)
      formData.set('title', lessonForm.title)
      formData.set('description', lessonForm.description)
      if (lessonForm.duration) {
        formData.set('estimatedDuration', lessonForm.duration)
      }

      const result = await createLesson(formData)
      if (result.error) {
        setError(result.error)
      } else {
        showSuccess('Lesson added')
        setLessonForm({ title: '', description: '', duration: '' })
        setAddingLessonTo(null)
        router.refresh()
      }
    } catch {
      setError('Failed to add lesson')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateLesson = async (lessonId: string) => {
    if (!lessonForm.title.trim()) {
      setError('Lesson title is required')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const formData = new FormData()
      formData.set('title', lessonForm.title)
      formData.set('description', lessonForm.description)
      if (lessonForm.duration) {
        formData.set('estimatedDuration', lessonForm.duration)
      }

      const result = await updateLesson(lessonId, formData)
      if (result.error) {
        setError(result.error)
      } else {
        showSuccess('Lesson updated')
        setEditingLesson(null)
        router.refresh()
      }
    } catch {
      setError('Failed to update lesson')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteLesson = async (lessonId: string, title: string) => {
    if (!confirm(`Delete lesson "${title}" and all its content?`)) return

    setIsSubmitting(true)
    setError('')

    try {
      const result = await deleteLesson(lessonId)
      if (result.error) {
        setError(result.error)
      } else {
        showSuccess('Lesson deleted')
        router.refresh()
      }
    } catch {
      setError('Failed to delete lesson')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ============================================
  // CONTENT BLOCK HANDLERS
  // ============================================

  const handleAddContent = async (lessonId: string) => {
    setIsSubmitting(true)
    setError('')

    try {
      const formData = new FormData()
      formData.set('lessonId', lessonId)
      formData.set('type', contentForm.type)
      formData.set('title', contentForm.title)
      formData.set('content', JSON.stringify(contentForm.content))
      if (contentForm.threshold) {
        formData.set('completionThreshold', contentForm.threshold)
      }

      const result = await createContentBlock(formData)
      if (result.error) {
        setError(result.error)
      } else {
        showSuccess('Content added')
        setContentForm({ type: 'TEXT', title: '', content: {}, threshold: '' })
        setAddingContentTo(null)
        router.refresh()
      }
    } catch {
      setError('Failed to add content')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateContent = async (contentId: string) => {
    setIsSubmitting(true)
    setError('')

    try {
      const formData = new FormData()
      formData.set('title', contentForm.title)
      formData.set('content', JSON.stringify(contentForm.content))
      if (contentForm.threshold) {
        formData.set('completionThreshold', contentForm.threshold)
      }

      const result = await updateContentBlock(contentId, formData)
      if (result.error) {
        setError(result.error)
      } else {
        showSuccess('Content updated')
        setEditingContent(null)
        router.refresh()
      }
    } catch {
      setError('Failed to update content')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteContent = async (contentId: string) => {
    if (!confirm('Delete this content block?')) return

    setIsSubmitting(true)
    setError('')

    try {
      const result = await deleteContentBlock(contentId)
      if (result.error) {
        setError(result.error)
      } else {
        showSuccess('Content deleted')
        router.refresh()
      }
    } catch {
      setError('Failed to delete content')
    } finally {
      setIsSubmitting(false)
    }
  }

  const startEditingModule = (module: Module) => {
    setModuleForm({ title: module.title, description: module.description || '' })
    setEditingModule(module.id)
  }

  const startEditingLesson = (lesson: Lesson) => {
    setLessonForm({
      title: lesson.title,
      description: lesson.description || '',
      duration: lesson.estimatedDuration?.toString() || '',
    })
    setEditingLesson(lesson.id)
  }

  const startEditingContent = (content: ContentBlock) => {
    setContentForm({
      type: content.type,
      title: content.title || '',
      content: content.content as Record<string, unknown>,
      threshold: content.completionThreshold?.toString() || '',
    })
    setEditingContent(content.id)
  }

  const getStatusBadge = () => {
    switch (course.status) {
      case 'PUBLISHED':
        return (
          <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-sm font-medium">
            Published
          </span>
        )
      case 'DRAFT':
        return (
          <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-sm font-medium">
            Draft
          </span>
        )
      case 'ARCHIVED':
        return (
          <span className="px-2 py-1 bg-red-100 text-red-600 rounded text-sm font-medium">
            Archived
          </span>
        )
    }
  }

  // Calculate stats
  const totalLessons = course.modules.reduce((acc, m) => acc + m.lessons.length, 0)
  const totalContent = course.modules.reduce(
    (acc, m) => acc + m.lessons.reduce((a, l) => a + l.contentBlocks.length, 0),
    0
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/admin/lms"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Courses
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{course.title}</h1>
            {getStatusBadge()}
          </div>
          <p className="text-gray-600 mt-1">
            {course.modules.length} modules · {totalLessons} lessons · {totalContent} content blocks
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 px-3 py-2 text-gray-700 border rounded-lg hover:bg-gray-50"
          >
            <Settings className="h-4 w-4" />
            Settings
          </button>
          {course.status === 'DRAFT' ? (
            <button
              onClick={handlePublish}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              Publish
            </button>
          ) : course.status === 'PUBLISHED' ? (
            <button
              onClick={handleUnpublish}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
            >
              Unpublish
            </button>
          ) : null}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center justify-between">
          {error}
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 flex items-center gap-2">
          <Check className="h-4 w-4" />
          {successMessage}
        </div>
      )}

      {/* Course Structure */}
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Course Structure</h2>
          <button
            onClick={() => {
              setModuleForm({ title: '', description: '' })
              setAddingModuleTo(true)
            }}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add Module
          </button>
        </div>

        {/* Add Module Form */}
        {addingModuleTo && (
          <div className="p-4 border-b bg-blue-50">
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Module title"
                value={moduleForm.title}
                onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                autoFocus
              />
              <textarea
                placeholder="Description (optional)"
                value={moduleForm.description}
                onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg resize-none"
                rows={2}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddModule}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Adding...' : 'Add Module'}
                </button>
                <button
                  onClick={() => setAddingModuleTo(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modules List */}
        {course.modules.length === 0 && !addingModuleTo ? (
          <div className="p-8 text-center text-gray-500">
            <Layers className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>No modules yet. Add your first module to start building the course.</p>
          </div>
        ) : (
          <div className="divide-y">
            {course.modules.map((module, moduleIndex) => (
              <div key={module.id} className="group">
                {/* Module Header */}
                <div className="flex items-center gap-3 p-4 hover:bg-gray-50">
                  <button
                    onClick={() => toggleModule(module.id)}
                    className="p-1 hover:bg-gray-200 rounded"
                  >
                    {expandedModules.has(module.id) ? (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-500" />
                    )}
                  </button>
                  <div className="flex-1">
                    {editingModule === module.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={moduleForm.title}
                          onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
                          className="w-full px-3 py-1 border rounded"
                          autoFocus
                        />
                        <textarea
                          value={moduleForm.description}
                          onChange={(e) =>
                            setModuleForm({ ...moduleForm, description: e.target.value })
                          }
                          className="w-full px-3 py-1 border rounded resize-none"
                          rows={2}
                          placeholder="Description"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdateModule(module.id)}
                            disabled={isSubmitting}
                            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingModule(null)}
                            className="px-3 py-1 text-gray-600 text-sm hover:text-gray-900"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                            Module {moduleIndex + 1}
                          </span>
                          <span className="font-medium text-gray-900">{module.title}</span>
                          <span className="text-sm text-gray-500">
                            ({module.lessons.length} lesson
                            {module.lessons.length !== 1 ? 's' : ''})
                          </span>
                        </div>
                        {module.description && (
                          <p className="text-sm text-gray-500 mt-1">{module.description}</p>
                        )}
                      </>
                    )}
                  </div>
                  {editingModule !== module.id && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEditingModule(module)}
                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="Edit module"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteModule(module.id, module.title)}
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Delete module"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Expanded Module Content */}
                {expandedModules.has(module.id) && (
                  <div className="pl-12 pr-4 pb-4 space-y-2">
                    {/* Lessons */}
                    {module.lessons.map((lesson, lessonIndex) => (
                      <div key={lesson.id} className="border rounded-lg">
                        {/* Lesson Header */}
                        <div className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 group/lesson">
                          <button
                            onClick={() => toggleLesson(lesson.id)}
                            className="p-1 hover:bg-gray-200 rounded"
                          >
                            {expandedLessons.has(lesson.id) ? (
                              <ChevronDown className="h-4 w-4 text-gray-500" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-gray-500" />
                            )}
                          </button>
                          <BookOpen className="h-4 w-4 text-gray-400" />
                          <div className="flex-1">
                            {editingLesson === lesson.id ? (
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  value={lessonForm.title}
                                  onChange={(e) =>
                                    setLessonForm({ ...lessonForm, title: e.target.value })
                                  }
                                  className="w-full px-3 py-1 border rounded"
                                  autoFocus
                                />
                                <div className="flex gap-2">
                                  <textarea
                                    value={lessonForm.description}
                                    onChange={(e) =>
                                      setLessonForm({ ...lessonForm, description: e.target.value })
                                    }
                                    className="flex-1 px-3 py-1 border rounded resize-none"
                                    placeholder="Description"
                                    rows={2}
                                  />
                                  <input
                                    type="number"
                                    value={lessonForm.duration}
                                    onChange={(e) =>
                                      setLessonForm({ ...lessonForm, duration: e.target.value })
                                    }
                                    className="w-24 px-3 py-1 border rounded"
                                    placeholder="Min"
                                    min="1"
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleUpdateLesson(lesson.id)}
                                    disabled={isSubmitting}
                                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditingLesson(null)}
                                    className="px-3 py-1 text-gray-600 text-sm hover:text-gray-900"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-800">
                                  {lessonIndex + 1}. {lesson.title}
                                </span>
                                {lesson.estimatedDuration && (
                                  <span className="text-xs text-gray-500 flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {lesson.estimatedDuration}m
                                  </span>
                                )}
                                <span className="text-xs text-gray-400">
                                  ({lesson.contentBlocks.length} block
                                  {lesson.contentBlocks.length !== 1 ? 's' : ''})
                                </span>
                              </div>
                            )}
                          </div>
                          {editingLesson !== lesson.id && (
                            <div className="flex items-center gap-1 opacity-0 group-hover/lesson:opacity-100 transition-opacity">
                              <button
                                onClick={() => startEditingLesson(lesson)}
                                className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                                title="Edit lesson"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteLesson(lesson.id, lesson.title)}
                                className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                                title="Delete lesson"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Lesson Content Blocks */}
                        {expandedLessons.has(lesson.id) && (
                          <div className="p-3 space-y-2 bg-white">
                            {lesson.contentBlocks.map((block) => {
                              const Icon = contentTypeIcons[block.type]
                              return (
                                <div
                                  key={block.id}
                                  className="flex items-center gap-3 p-2 bg-gray-50 rounded group/block"
                                >
                                  <div className="p-1.5 bg-white border rounded">
                                    <Icon className="h-4 w-4 text-gray-500" />
                                  </div>
                                  {editingContent === block.id ? (
                                    <ContentBlockEditor
                                      type={block.type}
                                      form={contentForm}
                                      setForm={setContentForm}
                                      availableSurveys={availableSurveys}
                                      onSave={() => handleUpdateContent(block.id)}
                                      onCancel={() => setEditingContent(null)}
                                      isSubmitting={isSubmitting}
                                    />
                                  ) : (
                                    <>
                                      <div className="flex-1">
                                        <span className="text-sm text-gray-700">
                                          {block.title || contentTypeLabels[block.type]}
                                        </span>
                                        <span className="text-xs text-gray-400 ml-2">
                                          {contentTypeLabels[block.type]}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1 opacity-0 group-hover/block:opacity-100 transition-opacity">
                                        <button
                                          onClick={() => startEditingContent(block)}
                                          className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                                          title="Edit content"
                                        >
                                          <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteContent(block.id)}
                                          className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                                          title="Delete content"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              )
                            })}

                            {/* Add Content Form */}
                            {addingContentTo === lesson.id ? (
                              <div className="p-3 bg-blue-50 rounded-lg">
                                <ContentBlockEditor
                                  type={contentForm.type}
                                  form={contentForm}
                                  setForm={setContentForm}
                                  availableSurveys={availableSurveys}
                                  onSave={() => handleAddContent(lesson.id)}
                                  onCancel={() => setAddingContentTo(null)}
                                  isSubmitting={isSubmitting}
                                  isNew
                                />
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setContentForm({ type: 'TEXT', title: '', content: {}, threshold: '' })
                                  setAddingContentTo(lesson.id)
                                }}
                                className="w-full flex items-center justify-center gap-2 p-2 text-sm text-gray-500 border border-dashed rounded hover:border-blue-500 hover:text-blue-600"
                              >
                                <Plus className="h-4 w-4" />
                                Add Content Block
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Add Lesson Form */}
                    {addingLessonTo === module.id ? (
                      <div className="p-3 bg-green-50 rounded-lg">
                        <div className="space-y-2">
                          <input
                            type="text"
                            placeholder="Lesson title"
                            value={lessonForm.title}
                            onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <textarea
                              placeholder="Description (optional)"
                              value={lessonForm.description}
                              onChange={(e) =>
                                setLessonForm({ ...lessonForm, description: e.target.value })
                              }
                              className="flex-1 px-3 py-2 border rounded-lg resize-none"
                              rows={2}
                            />
                            <input
                              type="number"
                              placeholder="Duration (min)"
                              value={lessonForm.duration}
                              onChange={(e) =>
                                setLessonForm({ ...lessonForm, duration: e.target.value })
                              }
                              className="w-32 px-3 py-2 border rounded-lg"
                              min="1"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAddLesson(module.id)}
                              disabled={isSubmitting}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                            >
                              {isSubmitting ? 'Adding...' : 'Add Lesson'}
                            </button>
                            <button
                              onClick={() => setAddingLessonTo(null)}
                              className="px-4 py-2 text-gray-600 hover:text-gray-900"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setLessonForm({ title: '', description: '', duration: '' })
                          setAddingLessonTo(module.id)
                        }}
                        className="w-full flex items-center justify-center gap-2 p-3 text-sm text-gray-500 border border-dashed rounded-lg hover:border-green-500 hover:text-green-600"
                      >
                        <Plus className="h-4 w-4" />
                        Add Lesson
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Course Settings</h2>
              <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={settingsForm.title}
                  onChange={(e) => setSettingsForm({ ...settingsForm, title: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={settingsForm.description}
                  onChange={(e) => setSettingsForm({ ...settingsForm, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg resize-none"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Thumbnail URL</label>
                <input
                  type="url"
                  value={settingsForm.thumbnail}
                  onChange={(e) => setSettingsForm({ ...settingsForm, thumbnail: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="https://example.com/image.jpg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Audience</label>
                <div className="flex gap-3">
                  {['COACH', 'AMBASSADOR'].map((role) => (
                    <label key={role} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={settingsForm.allowedRoles.includes(role)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSettingsForm({
                              ...settingsForm,
                              allowedRoles: [...settingsForm.allowedRoles, role],
                            })
                          } else {
                            setSettingsForm({
                              ...settingsForm,
                              allowedRoles: settingsForm.allowedRoles.filter((r) => r !== role),
                            })
                          }
                        }}
                        className="w-4 h-4 rounded"
                      />
                      <span>{role === 'COACH' ? 'Coaches' : 'Ambassadors'}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estimated Duration (minutes)
                </label>
                <input
                  type="number"
                  value={settingsForm.estimatedDuration}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, estimatedDuration: e.target.value })
                  }
                  className="w-full max-w-xs px-3 py-2 border rounded-lg"
                  min="1"
                />
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSettings}
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================
// CONTENT BLOCK EDITOR COMPONENT
// ============================================

interface ContentBlockEditorProps {
  type: 'VIDEO' | 'TEXT' | 'QUIZ' | 'DOCUMENT'
  form: {
    type: 'VIDEO' | 'TEXT' | 'QUIZ' | 'DOCUMENT'
    title: string
    content: Record<string, unknown>
    threshold: string
  }
  setForm: (form: ContentBlockEditorProps['form']) => void
  availableSurveys: AvailableSurvey[]
  onSave: () => void
  onCancel: () => void
  isSubmitting: boolean
  isNew?: boolean
}

function ContentBlockEditor({
  type,
  form,
  setForm,
  availableSurveys,
  onSave,
  onCancel,
  isSubmitting,
  isNew,
}: ContentBlockEditorProps) {
  return (
    <div className="flex-1 space-y-3">
      {isNew && (
        <div className="flex gap-2">
          {(['VIDEO', 'TEXT', 'QUIZ', 'DOCUMENT'] as const).map((t) => {
            const Icon = contentTypeIcons[t]
            return (
              <button
                key={t}
                onClick={() => setForm({ ...form, type: t, content: {} })}
                className={`flex items-center gap-2 px-3 py-1.5 rounded border text-sm ${
                  form.type === t
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                {contentTypeLabels[t]}
              </button>
            )
          })}
        </div>
      )}

      <input
        type="text"
        placeholder="Title (optional)"
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        className="w-full px-3 py-2 border rounded text-sm"
      />

      {/* Type-specific content fields */}
      {form.type === 'VIDEO' && (
        <div className="space-y-2">
          <input
            type="url"
            placeholder="Video URL (YouTube, Vimeo, or direct link)"
            value={(form.content.url as string) || ''}
            onChange={(e) =>
              setForm({
                ...form,
                content: { ...form.content, url: e.target.value, provider: detectProvider(e.target.value) },
              })
            }
            className="w-full px-3 py-2 border rounded text-sm"
          />
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Duration (seconds)"
              value={(form.content.duration as number) || ''}
              onChange={(e) =>
                setForm({
                  ...form,
                  content: { ...form.content, duration: parseInt(e.target.value) || 0 },
                })
              }
              className="w-32 px-3 py-2 border rounded text-sm"
            />
            <input
              type="number"
              placeholder="Watch % to complete (default: 80)"
              value={form.threshold}
              onChange={(e) => setForm({ ...form, threshold: e.target.value })}
              className="w-48 px-3 py-2 border rounded text-sm"
              min="1"
              max="100"
            />
          </div>
        </div>
      )}

      {form.type === 'TEXT' && (
        <div className="space-y-2">
          <textarea
            placeholder="Enter text content (Markdown supported)"
            value={(form.content.content as string) || ''}
            onChange={(e) =>
              setForm({
                ...form,
                content: { content: e.target.value, format: 'markdown' },
              })
            }
            className="w-full px-3 py-2 border rounded text-sm resize-none"
            rows={6}
          />
        </div>
      )}

      {form.type === 'QUIZ' && (
        <div className="space-y-2">
          <select
            value={(form.content.surveyId as string) || ''}
            onChange={(e) =>
              setForm({
                ...form,
                content: { surveyId: e.target.value },
              })
            }
            className="w-full px-3 py-2 border rounded text-sm"
          >
            <option value="">Select a quiz...</option>
            {availableSurveys.map((survey) => (
              <option key={survey.id} value={survey.id}>
                {survey.title} ({survey.questionCount} questions
                {survey.passingScore ? `, ${survey.passingScore}% to pass` : ''})
              </option>
            ))}
          </select>
          {availableSurveys.length === 0 && (
            <p className="text-xs text-gray-500">
              No published quizzes available. Create a quiz in Surveys & Quizzes first.
            </p>
          )}
        </div>
      )}

      {form.type === 'DOCUMENT' && (
        <div className="space-y-2">
          <input
            type="url"
            placeholder="Document URL"
            value={(form.content.url as string) || ''}
            onChange={(e) =>
              setForm({
                ...form,
                content: { ...form.content, url: e.target.value },
              })
            }
            className="w-full px-3 py-2 border rounded text-sm"
          />
          <input
            type="text"
            placeholder="File name (e.g., workbook.pdf)"
            value={(form.content.fileName as string) || ''}
            onChange={(e) =>
              setForm({
                ...form,
                content: { ...form.content, fileName: e.target.value },
              })
            }
            className="w-full px-3 py-2 border rounded text-sm"
          />
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onSave}
          disabled={isSubmitting}
          className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Saving...' : isNew ? 'Add' : 'Save'}
        </button>
        <button onClick={onCancel} className="px-4 py-1.5 text-gray-600 text-sm hover:text-gray-900">
          Cancel
        </button>
      </div>
    </div>
  )
}

function detectProvider(url: string): 'youtube' | 'vimeo' | 'custom' {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
  if (url.includes('vimeo.com')) return 'vimeo'
  return 'custom'
}
