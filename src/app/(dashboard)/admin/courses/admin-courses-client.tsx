'use client'

import { useState } from 'react'
import {
  BookOpen,
  Plus,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  HelpCircle,
  Video,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'
import {
  createCourse,
  updateCourse,
  deleteCourse,
  toggleCourseActive,
  addQuestion,
  updateQuestion,
  deleteQuestion,
} from '@/lib/actions/courses'

interface QuizOption {
  id: string
  optionText: string
  isCorrect: boolean
  sortOrder: number
}

interface QuizQuestion {
  id: string
  questionText: string
  sortOrder: number
  options: QuizOption[]
}

interface Course {
  id: string
  name: string
  description: string | null
  videoUrl: string | null
  embedCode: string | null
  isRequired: boolean
  sortOrder: number
  isActive: boolean
  createdAt: string
  questions: QuizQuestion[]
  stats: {
    totalAttempts: number
    passedAttempts: number
  }
}

interface Stats {
  totalCourses: number
  totalAttempts: number
  passedAttempts: number
  passRate: number
}

interface AdminCoursesClientProps {
  courses: Course[]
  stats: Stats
}

export function AdminCoursesClient({ courses, stats }: AdminCoursesClientProps) {
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null)
  const [showCourseForm, setShowCourseForm] = useState(false)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [showQuestionForm, setShowQuestionForm] = useState<string | null>(null)
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Course form state
  const [courseForm, setCourseForm] = useState({
    name: '',
    description: '',
    videoUrl: '',
    embedCode: '',
    isRequired: false,
    sortOrder: 0,
    isActive: true,
  })

  // Question form state
  const [questionForm, setQuestionForm] = useState({
    questionText: '',
    sortOrder: 0,
    options: [
      { optionText: '', isCorrect: false },
      { optionText: '', isCorrect: false },
    ],
  })

  const resetCourseForm = () => {
    setCourseForm({
      name: '',
      description: '',
      videoUrl: '',
      embedCode: '',
      isRequired: false,
      sortOrder: courses.length,
      isActive: true,
    })
    setEditingCourse(null)
    setShowCourseForm(false)
  }

  const resetQuestionForm = () => {
    setQuestionForm({
      questionText: '',
      sortOrder: 0,
      options: [
        { optionText: '', isCorrect: false },
        { optionText: '', isCorrect: false },
      ],
    })
    setEditingQuestion(null)
    setShowQuestionForm(null)
  }

  const handleEditCourse = (course: Course) => {
    setCourseForm({
      name: course.name,
      description: course.description || '',
      videoUrl: course.videoUrl || '',
      embedCode: course.embedCode || '',
      isRequired: course.isRequired,
      sortOrder: course.sortOrder,
      isActive: course.isActive,
    })
    setEditingCourse(course)
    setShowCourseForm(true)
  }

  const handleEditQuestion = (courseId: string, question: QuizQuestion) => {
    setQuestionForm({
      questionText: question.questionText,
      sortOrder: question.sortOrder,
      options: question.options.map((o) => ({
        optionText: o.optionText,
        isCorrect: o.isCorrect,
      })),
    })
    setEditingQuestion(question)
    setShowQuestionForm(courseId)
  }

  const handleCourseSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')

    const formData = new FormData()
    formData.set('name', courseForm.name)
    formData.set('description', courseForm.description)
    formData.set('videoUrl', courseForm.videoUrl)
    formData.set('embedCode', courseForm.embedCode)
    formData.set('isRequired', String(courseForm.isRequired))
    formData.set('sortOrder', String(courseForm.sortOrder))
    formData.set('isActive', String(courseForm.isActive))

    try {
      const result = editingCourse
        ? await updateCourse(editingCourse.id, formData)
        : await createCourse(formData)

      if (result.error) {
        setError(result.error)
      } else {
        resetCourseForm()
      }
    } catch {
      setError('An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteCourse = async (courseId: string) => {
    if (!confirm('Are you sure you want to delete this course? This will also delete all associated questions and quiz results.')) {
      return
    }

    setIsSubmitting(true)
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

  const handleToggleCourse = async (courseId: string) => {
    try {
      const result = await toggleCourseActive(courseId)
      if (result.error) {
        setError(result.error)
      }
    } catch {
      setError('An error occurred')
    }
  }

  const handleQuestionSubmit = async (e: React.FormEvent, courseId: string) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')

    try {
      const result = editingQuestion
        ? await updateQuestion(editingQuestion.id, questionForm)
        : await addQuestion(courseId, questionForm)

      if (result.error) {
        setError(result.error)
      } else {
        resetQuestionForm()
      }
    } catch {
      setError('An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm('Are you sure you want to delete this question?')) {
      return
    }

    setIsSubmitting(true)
    try {
      const result = await deleteQuestion(questionId)
      if (result.error) {
        setError(result.error)
      }
    } catch {
      setError('An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const addOption = () => {
    if (questionForm.options.length < 6) {
      setQuestionForm({
        ...questionForm,
        options: [...questionForm.options, { optionText: '', isCorrect: false }],
      })
    }
  }

  const removeOption = (index: number) => {
    if (questionForm.options.length > 2) {
      setQuestionForm({
        ...questionForm,
        options: questionForm.options.filter((_, i) => i !== index),
      })
    }
  }

  const updateOption = (index: number, field: 'optionText' | 'isCorrect', value: string | boolean) => {
    const newOptions = [...questionForm.options]
    newOptions[index] = { ...newOptions[index], [field]: value }
    setQuestionForm({ ...questionForm, options: newOptions })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Courses & Quizzes</h1>
          <p className="text-gray-600">Manage training courses and quiz questions</p>
        </div>
        <button
          onClick={() => {
            resetCourseForm()
            setShowCourseForm(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add Course
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BookOpen className="h-5 w-5 text-blue-600" />
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
              <HelpCircle className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Quiz Attempts</p>
              <p className="text-2xl font-bold">{stats.totalAttempts}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Passed</p>
              <p className="text-2xl font-bold">{stats.passedAttempts}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Video className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pass Rate</p>
              <p className="text-2xl font-bold">{stats.passRate}%</p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Course Form Modal */}
      {showCourseForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">
              {editingCourse ? 'Edit Course' : 'Add New Course'}
            </h2>
            <form onSubmit={handleCourseSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Course Name *
                </label>
                <input
                  type="text"
                  value={courseForm.name}
                  onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })}
                  className="w-full rounded-lg border p-2"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={courseForm.description}
                  onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                  className="w-full rounded-lg border p-2"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Video URL
                </label>
                <input
                  type="url"
                  value={courseForm.videoUrl}
                  onChange={(e) => setCourseForm({ ...courseForm, videoUrl: e.target.value })}
                  className="w-full rounded-lg border p-2"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Embed Code
                </label>
                <textarea
                  value={courseForm.embedCode}
                  onChange={(e) => setCourseForm({ ...courseForm, embedCode: e.target.value })}
                  className="w-full rounded-lg border p-2 font-mono text-sm"
                  rows={3}
                  placeholder="<iframe ...>"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={courseForm.sortOrder}
                    onChange={(e) => setCourseForm({ ...courseForm, sortOrder: parseInt(e.target.value) || 0 })}
                    className="w-full rounded-lg border p-2"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={courseForm.isRequired}
                      onChange={(e) => setCourseForm({ ...courseForm, isRequired: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700">Required for onboarding</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={courseForm.isActive}
                  onChange={(e) => setCourseForm({ ...courseForm, isActive: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">Course is active</span>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingCourse ? 'Update Course' : 'Create Course'}
                </button>
                <button
                  type="button"
                  onClick={resetCourseForm}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Courses List */}
      <div className="space-y-4">
        {courses.length > 0 ? (
          courses.map((course) => (
            <div key={course.id} className="bg-white rounded-lg border">
              <div
                className="p-4 cursor-pointer"
                onClick={() => setExpandedCourse(expandedCourse === course.id ? null : course.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium">{course.name}</h3>
                      {course.isRequired && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                          Required
                        </span>
                      )}
                      {!course.isActive && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium">
                          Inactive
                        </span>
                      )}
                    </div>
                    {course.description && (
                      <p className="text-sm text-gray-500 mt-1">{course.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                      <span>{course.questions.length} questions</span>
                      <span>{course.stats.totalAttempts} attempts</span>
                      <span className="text-green-600">
                        {course.stats.passedAttempts} passed
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleToggleCourse(course.id)
                      }}
                      className="p-2 text-gray-400 hover:text-gray-600"
                      title={course.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {course.isActive ? (
                        <ToggleRight className="h-5 w-5 text-green-600" />
                      ) : (
                        <ToggleLeft className="h-5 w-5" />
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEditCourse(course)
                      }}
                      className="p-2 text-gray-400 hover:text-blue-600"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteCourse(course.id)
                      }}
                      className="p-2 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    {expandedCourse === course.id ? (
                      <ChevronUp className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>

              {expandedCourse === course.id && (
                <div className="border-t p-4 space-y-4">
                  {/* Course Details */}
                  {(course.videoUrl || course.embedCode) && (
                    <div className="bg-gray-50 p-3 rounded-lg text-sm">
                      {course.videoUrl && (
                        <p>
                          <span className="font-medium">Video URL:</span>{' '}
                          <a href={course.videoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            {course.videoUrl}
                          </a>
                        </p>
                      )}
                      {course.embedCode && (
                        <p className="mt-1">
                          <span className="font-medium">Embed code:</span>{' '}
                          <span className="text-gray-500">Configured</span>
                        </p>
                      )}
                    </div>
                  )}

                  {/* Questions Header */}
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Quiz Questions</h4>
                    <button
                      onClick={() => {
                        resetQuestionForm()
                        setShowQuestionForm(course.id)
                      }}
                      className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      <Plus className="h-4 w-4" />
                      Add Question
                    </button>
                  </div>

                  {/* Question Form */}
                  {showQuestionForm === course.id && (
                    <form
                      onSubmit={(e) => handleQuestionSubmit(e, course.id)}
                      className="bg-gray-50 p-4 rounded-lg space-y-4"
                    >
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Question Text *
                        </label>
                        <textarea
                          value={questionForm.questionText}
                          onChange={(e) => setQuestionForm({ ...questionForm, questionText: e.target.value })}
                          className="w-full rounded-lg border p-2"
                          rows={2}
                          required
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-medium text-gray-700">
                            Answer Options * (check correct answers)
                          </label>
                          <button
                            type="button"
                            onClick={addOption}
                            disabled={questionForm.options.length >= 6}
                            className="text-sm text-blue-600 hover:text-blue-700 disabled:text-gray-400"
                          >
                            + Add Option
                          </button>
                        </div>
                        <div className="space-y-2">
                          {questionForm.options.map((option, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={option.isCorrect}
                                onChange={(e) => updateOption(index, 'isCorrect', e.target.checked)}
                                className="rounded text-green-600"
                              />
                              <input
                                type="text"
                                value={option.optionText}
                                onChange={(e) => updateOption(index, 'optionText', e.target.value)}
                                placeholder={`Option ${index + 1}`}
                                className="flex-1 rounded-lg border p-2 text-sm"
                                required
                              />
                              {questionForm.options.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => removeOption(index)}
                                  className="p-1 text-gray-400 hover:text-red-600"
                                >
                                  <XCircle className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                        >
                          {isSubmitting ? 'Saving...' : editingQuestion ? 'Update Question' : 'Add Question'}
                        </button>
                        <button
                          type="button"
                          onClick={resetQuestionForm}
                          className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-100"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Questions List */}
                  {course.questions.length > 0 ? (
                    <div className="space-y-3">
                      {course.questions.map((question, qIndex) => (
                        <div key={question.id} className="border rounded-lg p-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-sm">
                                {qIndex + 1}. {question.questionText}
                              </p>
                              <div className="mt-2 space-y-1">
                                {question.options.map((option) => (
                                  <div
                                    key={option.id}
                                    className={`flex items-center gap-2 text-sm ${
                                      option.isCorrect ? 'text-green-700' : 'text-gray-600'
                                    }`}
                                  >
                                    {option.isCorrect ? (
                                      <CheckCircle className="h-4 w-4 text-green-600" />
                                    ) : (
                                      <span className="w-4 h-4 border rounded-full" />
                                    )}
                                    {option.optionText}
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleEditQuestion(course.id, question)}
                                className="p-1 text-gray-400 hover:text-blue-600"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteQuestion(question.id)}
                                className="p-1 text-gray-400 hover:text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No questions added yet. Add questions to create a quiz for this course.
                    </p>
                  )}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="bg-white rounded-lg border p-8 text-center">
            <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <h3 className="font-medium text-gray-900">No Courses</h3>
            <p className="text-sm text-gray-500 mt-1">
              Create your first training course to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
