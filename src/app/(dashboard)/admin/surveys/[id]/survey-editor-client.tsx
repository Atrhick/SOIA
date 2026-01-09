'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  CheckCircle,
  Circle,
  AlignLeft,
  ListChecks,
  Sliders,
  Type,
  FileText,
  ChevronDown,
  ChevronUp,
  Save,
  X,
  Settings,
  BarChart3,
} from 'lucide-react'
import {
  addQuestion,
  updateQuestion,
  deleteQuestion,
  reorderQuestions,
  duplicateQuestion,
  updateSurvey,
} from '@/lib/actions/surveys'

interface SurveyOption {
  id: string
  optionText: string
  isCorrect?: boolean
  sortOrder: number
}

interface SurveyQuestion {
  id: string
  questionText: string
  questionType: 'MULTIPLE_CHOICE' | 'MULTIPLE_SELECT' | 'LIKERT_SCALE' | 'TEXT_SHORT' | 'TEXT_LONG'
  isRequired: boolean
  sortOrder: number
  likertConfig: { minLabel: string; maxLabel: string; minValue: number; maxValue: number } | null
  minLength: number | null
  maxLength: number | null
  options: SurveyOption[]
}

interface Survey {
  id: string
  title: string
  description: string | null
  type: 'QUIZ' | 'SURVEY'
  status: string
  allowedRoles: string[]
  isAnonymous: boolean
  scoreMode: 'NO_SCORING' | 'SCORE_ONLY' | 'PASS_FAIL' | null
  passingScore: number | null
  showResults: boolean
  allowRetake: boolean
  publishedAt: string | null
  closesAt: string | null
  createdAt: string
  submissionCount: number
  questions: SurveyQuestion[]
}

interface SurveyEditorClientProps {
  survey: Survey
}

const QUESTION_TYPES = [
  { value: 'MULTIPLE_CHOICE', label: 'Multiple Choice', icon: Circle, description: 'Single answer from options' },
  { value: 'MULTIPLE_SELECT', label: 'Multiple Select', icon: ListChecks, description: 'Multiple answers from options' },
  { value: 'LIKERT_SCALE', label: 'Likert Scale', icon: Sliders, description: 'Rating scale (1-5, 1-7, etc.)' },
  { value: 'TEXT_SHORT', label: 'Short Text', icon: Type, description: 'Single line text response' },
  { value: 'TEXT_LONG', label: 'Long Text', icon: FileText, description: 'Multi-line text response' },
]

export function SurveyEditorClient({ survey }: SurveyEditorClientProps) {
  const [questions, setQuestions] = useState<SurveyQuestion[]>(survey.questions)
  const [showQuestionForm, setShowQuestionForm] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<SurveyQuestion | null>(null)
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)

  // Survey settings form
  const [settingsForm, setSettingsForm] = useState({
    title: survey.title,
    description: survey.description || '',
    allowedRoles: survey.allowedRoles,
    isAnonymous: survey.isAnonymous,
    scoreMode: (survey.scoreMode || 'SCORE_ONLY') as 'NO_SCORING' | 'SCORE_ONLY' | 'PASS_FAIL',
    passingScore: survey.passingScore || 80,
    showResults: survey.showResults,
    allowRetake: survey.allowRetake,
    closesAt: survey.closesAt ? survey.closesAt.split('T')[0] : '',
  })

  const [questionForm, setQuestionForm] = useState({
    questionText: '',
    questionType: 'MULTIPLE_CHOICE' as SurveyQuestion['questionType'],
    isRequired: true,
    options: [
      { optionText: '', isCorrect: false },
      { optionText: '', isCorrect: false },
    ],
    likertConfig: {
      minLabel: 'Strongly Disagree',
      maxLabel: 'Strongly Agree',
      minValue: 1,
      maxValue: 5,
    },
    minLength: undefined as number | undefined,
    maxLength: undefined as number | undefined,
  })

  const resetForm = () => {
    setQuestionForm({
      questionText: '',
      questionType: 'MULTIPLE_CHOICE',
      isRequired: true,
      options: [
        { optionText: '', isCorrect: false },
        { optionText: '', isCorrect: false },
      ],
      likertConfig: {
        minLabel: 'Strongly Disagree',
        maxLabel: 'Strongly Agree',
        minValue: 1,
        maxValue: 5,
      },
      minLength: undefined,
      maxLength: undefined,
    })
    setEditingQuestion(null)
    setShowQuestionForm(false)
    setError('')
  }

  const handleEditQuestion = (question: SurveyQuestion) => {
    setQuestionForm({
      questionText: question.questionText,
      questionType: question.questionType,
      isRequired: question.isRequired,
      options: question.options.length > 0
        ? question.options.map(o => ({ optionText: o.optionText, isCorrect: o.isCorrect || false }))
        : [{ optionText: '', isCorrect: false }, { optionText: '', isCorrect: false }],
      likertConfig: question.likertConfig || {
        minLabel: 'Strongly Disagree',
        maxLabel: 'Strongly Agree',
        minValue: 1,
        maxValue: 5,
      },
      minLength: question.minLength || undefined,
      maxLength: question.maxLength || undefined,
    })
    setEditingQuestion(question)
    setShowQuestionForm(true)
  }

  const toggleRole = (role: string) => {
    if (settingsForm.allowedRoles.includes(role)) {
      if (settingsForm.allowedRoles.length > 1) {
        setSettingsForm({ ...settingsForm, allowedRoles: settingsForm.allowedRoles.filter(r => r !== role) })
      }
    } else {
      setSettingsForm({ ...settingsForm, allowedRoles: [...settingsForm.allowedRoles, role] })
    }
  }

  const handleSaveSettings = async () => {
    setIsSubmitting(true)
    setError('')

    const formData = new FormData()
    formData.set('title', settingsForm.title)
    formData.set('description', settingsForm.description)
    formData.set('allowedRoles', JSON.stringify(settingsForm.allowedRoles))
    formData.set('isAnonymous', String(settingsForm.isAnonymous))
    formData.set('showResults', String(settingsForm.showResults))
    formData.set('allowRetake', String(settingsForm.allowRetake))
    if (settingsForm.closesAt) {
      formData.set('closesAt', settingsForm.closesAt)
    }
    if (survey.type === 'QUIZ') {
      formData.set('scoreMode', settingsForm.scoreMode)
      if (settingsForm.scoreMode === 'PASS_FAIL') {
        formData.set('passingScore', String(settingsForm.passingScore))
      }
    }

    try {
      const result = await updateSurvey(survey.id, formData)
      if (result.error) {
        setError(result.error)
      } else {
        setSettingsSaved(true)
        setTimeout(() => setSettingsSaved(false), 2000)
      }
    } catch {
      setError('An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')

    const data: any = {
      questionText: questionForm.questionText,
      questionType: questionForm.questionType,
      isRequired: questionForm.isRequired,
      sortOrder: editingQuestion ? editingQuestion.sortOrder : questions.length,
    }

    if (['MULTIPLE_CHOICE', 'MULTIPLE_SELECT'].includes(questionForm.questionType)) {
      data.options = questionForm.options.filter(o => o.optionText.trim())
      if (data.options.length < 2) {
        setError('At least 2 options are required')
        setIsSubmitting(false)
        return
      }
    }

    if (questionForm.questionType === 'LIKERT_SCALE') {
      data.likertConfig = questionForm.likertConfig
    }

    if (['TEXT_SHORT', 'TEXT_LONG'].includes(questionForm.questionType)) {
      if (questionForm.minLength) data.minLength = questionForm.minLength
      if (questionForm.maxLength) data.maxLength = questionForm.maxLength
    }

    try {
      if (editingQuestion) {
        const result = await updateQuestion(editingQuestion.id, data)
        if (result.error) {
          setError(result.error)
        } else {
          // Optimistic update - update local state
          setQuestions(questions.map(q =>
            q.id === editingQuestion.id
              ? {
                  ...q,
                  questionText: data.questionText,
                  questionType: data.questionType,
                  isRequired: data.isRequired,
                  likertConfig: data.likertConfig || null,
                  minLength: data.minLength || null,
                  maxLength: data.maxLength || null,
                  options: data.options?.map((o: any, idx: number) => ({
                    id: `temp-${idx}`,
                    optionText: o.optionText,
                    isCorrect: o.isCorrect,
                    sortOrder: idx,
                  })) || [],
                }
              : q
          ))
          resetForm()
        }
      } else {
        const result = await addQuestion(survey.id, data)
        if (result.error) {
          setError(result.error)
        } else if (result.question) {
          // Add new question to local state
          const newQuestion: SurveyQuestion = {
            id: result.question.id,
            questionText: result.question.questionText,
            questionType: result.question.questionType,
            isRequired: result.question.isRequired,
            sortOrder: result.question.sortOrder,
            likertConfig: result.question.likertConfig as any,
            minLength: result.question.minLength,
            maxLength: result.question.maxLength,
            options: result.question.options?.map((o: any) => ({
              id: o.id,
              optionText: o.optionText,
              isCorrect: o.isCorrect,
              sortOrder: o.sortOrder,
            })) || [],
          }
          setQuestions([...questions, newQuestion])
          resetForm()
        }
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
      } else {
        setQuestions(questions.filter(q => q.id !== questionId))
      }
    } catch {
      setError('An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDuplicateQuestion = async (questionId: string) => {
    setIsSubmitting(true)
    try {
      const result = await duplicateQuestion(questionId)
      if (result.error) {
        setError(result.error)
      } else if (result.question) {
        const newQuestion: SurveyQuestion = {
          id: result.question.id,
          questionText: result.question.questionText,
          questionType: result.question.questionType as SurveyQuestion['questionType'],
          isRequired: result.question.isRequired,
          sortOrder: result.question.sortOrder,
          likertConfig: result.question.likertConfig as any,
          minLength: result.question.minLength,
          maxLength: result.question.maxLength,
          options: result.question.options?.map((o: any) => ({
            id: o.id,
            optionText: o.optionText,
            isCorrect: o.isCorrect,
            sortOrder: o.sortOrder,
          })) || [],
        }
        setQuestions([...questions, newQuestion])
      }
    } catch {
      setError('An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleMoveQuestion = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === questions.length - 1) return

    const newQuestions = [...questions]
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    const temp = newQuestions[index]
    newQuestions[index] = newQuestions[swapIndex]
    newQuestions[swapIndex] = temp

    // Optimistic update
    setQuestions(newQuestions)

    // Update server
    const questionIds = newQuestions.map(q => q.id)
    const result = await reorderQuestions(survey.id, questionIds)
    if (result.error) {
      // Revert on error
      setQuestions(questions)
      setError(result.error)
    }
  }

  const addOption = () => {
    if (questionForm.options.length < 8) {
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

  const getQuestionTypeIcon = (type: string) => {
    const found = QUESTION_TYPES.find(t => t.value === type)
    return found ? found.icon : Circle
  }

  const getQuestionTypeLabel = (type: string) => {
    const found = QUESTION_TYPES.find(t => t.value === type)
    return found ? found.label : type
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/surveys">
          <button className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="h-5 w-5" />
          </button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{settingsForm.title}</h1>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              survey.type === 'QUIZ' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
            }`}>
              {survey.type}
            </span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              survey.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' :
              survey.status === 'DRAFT' ? 'bg-gray-100 text-gray-600' : 'bg-yellow-100 text-yellow-700'
            }`}>
              {survey.status}
            </span>
          </div>
          <p className="text-gray-600">{settingsForm.description || 'No description'}</p>
        </div>
        {survey.submissionCount > 0 && (
          <Link
            href={`/admin/surveys/${survey.id}/results`}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            <BarChart3 className="h-4 w-4" />
            View Results
          </Link>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Survey Settings Section */}
      <div className="bg-white rounded-lg border">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="w-full p-4 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-3">
            <Settings className="h-5 w-5 text-gray-400" />
            <span className="font-medium">Survey Settings</span>
            <span className="text-sm text-gray-500">
              {questions.length} questions | {survey.submissionCount} submissions
            </span>
            {settingsSaved && (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle className="h-4 w-4" /> Saved
              </span>
            )}
          </div>
          {showSettings ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
        </button>

        {showSettings && (
          <div className="border-t p-6 space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input
                type="text"
                value={settingsForm.title}
                onChange={(e) => setSettingsForm({ ...settingsForm, title: e.target.value })}
                className="w-full rounded-lg border p-2"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={settingsForm.description}
                onChange={(e) => setSettingsForm({ ...settingsForm, description: e.target.value })}
                className="w-full rounded-lg border p-2"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Available To */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Available To *</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settingsForm.allowedRoles.includes('COACH')}
                      onChange={() => toggleRole('COACH')}
                      className="rounded text-blue-600"
                    />
                    <span className="text-sm">Coaches</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settingsForm.allowedRoles.includes('AMBASSADOR')}
                      onChange={() => toggleRole('AMBASSADOR')}
                      className="rounded text-blue-600"
                    />
                    <span className="text-sm">Ambassadors</span>
                  </label>
                </div>
              </div>

              {/* Score Mode (Quiz only) */}
              {survey.type === 'QUIZ' && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Scoring Mode</label>
                  <div className="space-y-2">
                    <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50 transition-colors">
                      <input
                        type="radio"
                        name="scoreMode"
                        value="NO_SCORING"
                        checked={settingsForm.scoreMode === 'NO_SCORING'}
                        onChange={() => setSettingsForm({ ...settingsForm, scoreMode: 'NO_SCORING' })}
                        className="mt-1 text-blue-600"
                      />
                      <div>
                        <div className="font-medium text-gray-900">Practice Mode</div>
                        <div className="text-sm text-gray-500">No scores calculated. Great for learning or self-assessment.</div>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50 transition-colors">
                      <input
                        type="radio"
                        name="scoreMode"
                        value="SCORE_ONLY"
                        checked={settingsForm.scoreMode === 'SCORE_ONLY'}
                        onChange={() => setSettingsForm({ ...settingsForm, scoreMode: 'SCORE_ONLY' })}
                        className="mt-1 text-blue-600"
                      />
                      <div>
                        <div className="font-medium text-gray-900">Score Only</div>
                        <div className="text-sm text-gray-500">Show score percentage without pass/fail judgment.</div>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50 transition-colors">
                      <input
                        type="radio"
                        name="scoreMode"
                        value="PASS_FAIL"
                        checked={settingsForm.scoreMode === 'PASS_FAIL'}
                        onChange={() => setSettingsForm({ ...settingsForm, scoreMode: 'PASS_FAIL' })}
                        className="mt-1 text-blue-600"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">Pass/Fail</div>
                        <div className="text-sm text-gray-500">Require a minimum score to pass.</div>
                        {settingsForm.scoreMode === 'PASS_FAIL' && (
                          <div className="mt-2 flex items-center gap-2">
                            <label className="text-sm text-gray-700">Passing Score:</label>
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={settingsForm.passingScore}
                              onChange={(e) => setSettingsForm({ ...settingsForm, passingScore: parseInt(e.target.value) || 80 })}
                              className="w-20 rounded-lg border p-1.5 text-sm"
                            />
                            <span className="text-sm text-gray-500">%</span>
                          </div>
                        )}
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-4">
              {survey.type === 'SURVEY' && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settingsForm.isAnonymous}
                    onChange={(e) => setSettingsForm({ ...settingsForm, isAnonymous: e.target.checked })}
                    className="rounded text-blue-600"
                  />
                  <span className="text-sm text-gray-700">Anonymous responses</span>
                </label>
              )}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settingsForm.allowRetake}
                  onChange={(e) => setSettingsForm({ ...settingsForm, allowRetake: e.target.checked })}
                  className="rounded text-blue-600"
                />
                <span className="text-sm text-gray-700">Allow retake</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settingsForm.showResults}
                  onChange={(e) => setSettingsForm({ ...settingsForm, showResults: e.target.checked })}
                  className="rounded text-blue-600"
                />
                <span className="text-sm text-gray-700">Show results</span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Close Date (optional)</label>
              <input
                type="date"
                value={settingsForm.closesAt}
                onChange={(e) => setSettingsForm({ ...settingsForm, closesAt: e.target.value })}
                className="w-full rounded-lg border p-2"
              />
            </div>

            <div className="pt-2">
              <button
                onClick={handleSaveSettings}
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Questions Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Questions ({questions.length})</h2>
        <button
          onClick={() => {
            resetForm()
            setShowQuestionForm(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add Question
        </button>
      </div>

      {/* Question Form */}
      {showQuestionForm && (
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {editingQuestion ? 'Edit Question' : 'Add New Question'}
            </h2>
            <button onClick={resetForm} className="p-1 hover:bg-gray-100 rounded">
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Question Type Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Question Type
              </label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {QUESTION_TYPES.map(type => {
                  const Icon = type.icon
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setQuestionForm({ ...questionForm, questionType: type.value as any })}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        questionForm.questionType === type.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Icon className={`h-5 w-5 mb-1 ${
                        questionForm.questionType === type.value ? 'text-blue-600' : 'text-gray-400'
                      }`} />
                      <div className="text-sm font-medium">{type.label}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Question Text */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Question *
              </label>
              <textarea
                value={questionForm.questionText}
                onChange={(e) => setQuestionForm({ ...questionForm, questionText: e.target.value })}
                className="w-full rounded-lg border p-3"
                rows={2}
                placeholder="Enter your question..."
                required
              />
            </div>

            {/* Options for Multiple Choice / Multiple Select */}
            {['MULTIPLE_CHOICE', 'MULTIPLE_SELECT'].includes(questionForm.questionType) && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">
                    Options * {survey.type === 'QUIZ' && '(check correct answers)'}
                  </label>
                  <button
                    type="button"
                    onClick={addOption}
                    disabled={questionForm.options.length >= 8}
                    className="text-sm text-blue-600 hover:text-blue-700 disabled:text-gray-400"
                  >
                    + Add Option
                  </button>
                </div>
                <div className="space-y-2">
                  {questionForm.options.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      {survey.type === 'QUIZ' && (
                        <input
                          type="checkbox"
                          checked={option.isCorrect}
                          onChange={(e) => updateOption(index, 'isCorrect', e.target.checked)}
                          className="rounded text-green-600"
                          title="Mark as correct answer"
                        />
                      )}
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
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Likert Scale Config */}
            {questionForm.questionType === 'LIKERT_SCALE' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Min Value
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="5"
                      value={questionForm.likertConfig.minValue}
                      onChange={(e) => setQuestionForm({
                        ...questionForm,
                        likertConfig: { ...questionForm.likertConfig, minValue: parseInt(e.target.value) }
                      })}
                      className="w-full rounded-lg border p-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Value
                    </label>
                    <input
                      type="number"
                      min="3"
                      max="10"
                      value={questionForm.likertConfig.maxValue}
                      onChange={(e) => setQuestionForm({
                        ...questionForm,
                        likertConfig: { ...questionForm.likertConfig, maxValue: parseInt(e.target.value) }
                      })}
                      className="w-full rounded-lg border p-2"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Min Label
                    </label>
                    <input
                      type="text"
                      value={questionForm.likertConfig.minLabel}
                      onChange={(e) => setQuestionForm({
                        ...questionForm,
                        likertConfig: { ...questionForm.likertConfig, minLabel: e.target.value }
                      })}
                      className="w-full rounded-lg border p-2"
                      placeholder="e.g., Strongly Disagree"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Label
                    </label>
                    <input
                      type="text"
                      value={questionForm.likertConfig.maxLabel}
                      onChange={(e) => setQuestionForm({
                        ...questionForm,
                        likertConfig: { ...questionForm.likertConfig, maxLabel: e.target.value }
                      })}
                      className="w-full rounded-lg border p-2"
                      placeholder="e.g., Strongly Agree"
                    />
                  </div>
                </div>
                {/* Preview */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm text-gray-600 mb-2">Preview:</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{questionForm.likertConfig.minLabel}</span>
                    <div className="flex gap-2">
                      {Array.from({ length: questionForm.likertConfig.maxValue - questionForm.likertConfig.minValue + 1 }).map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          className="w-8 h-8 rounded-full border-2 border-gray-300 text-sm font-medium text-gray-600 hover:border-blue-500"
                        >
                          {questionForm.likertConfig.minValue + i}
                        </button>
                      ))}
                    </div>
                    <span className="text-xs text-gray-500">{questionForm.likertConfig.maxLabel}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Text Length Config */}
            {['TEXT_SHORT', 'TEXT_LONG'].includes(questionForm.questionType) && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min Length (optional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={questionForm.minLength || ''}
                    onChange={(e) => setQuestionForm({
                      ...questionForm,
                      minLength: e.target.value ? parseInt(e.target.value) : undefined
                    })}
                    className="w-full rounded-lg border p-2"
                    placeholder="No minimum"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Length (optional)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={questionForm.maxLength || ''}
                    onChange={(e) => setQuestionForm({
                      ...questionForm,
                      maxLength: e.target.value ? parseInt(e.target.value) : undefined
                    })}
                    className="w-full rounded-lg border p-2"
                    placeholder="No maximum"
                  />
                </div>
              </div>
            )}

            {/* Required toggle */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={questionForm.isRequired}
                onChange={(e) => setQuestionForm({ ...questionForm, isRequired: e.target.checked })}
                className="rounded text-blue-600"
              />
              <label className="text-sm text-gray-700">Required question</label>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {isSubmitting ? 'Saving...' : editingQuestion ? 'Update Question' : 'Add Question'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Questions List */}
      <div className="space-y-3">
        {questions.length > 0 ? (
          questions.map((question, index) => {
            const Icon = getQuestionTypeIcon(question.questionType)
            const isExpanded = expandedQuestion === question.id

            return (
              <div key={question.id} className="bg-white rounded-lg border">
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedQuestion(isExpanded ? null : question.id)}
                >
                  <div className="flex items-start gap-3">
                    {/* Reorder buttons */}
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleMoveQuestion(index, 'up')
                        }}
                        disabled={index === 0}
                        className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleMoveQuestion(index, 'down')
                        }}
                        disabled={index === questions.length - 1}
                        className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-600 font-medium text-sm">
                      {index + 1}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="h-4 w-4 text-gray-400" />
                        <span className="text-xs text-gray-500">{getQuestionTypeLabel(question.questionType)}</span>
                        {question.isRequired && (
                          <span className="text-xs text-red-500">*</span>
                        )}
                      </div>
                      <p className="font-medium">{question.questionText}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDuplicateQuestion(question.id)
                        }}
                        className="p-1 text-gray-400 hover:text-blue-600"
                        title="Duplicate"
                        disabled={isSubmitting}
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEditQuestion(question)
                        }}
                        className="p-1 text-gray-400 hover:text-blue-600"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteQuestion(question.id)
                        }}
                        className="p-1 text-gray-400 hover:text-red-600"
                        disabled={isSubmitting}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t px-4 py-3 bg-gray-50">
                    {['MULTIPLE_CHOICE', 'MULTIPLE_SELECT'].includes(question.questionType) && (
                      <div className="space-y-1">
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
                              <Circle className="h-4 w-4 text-gray-300" />
                            )}
                            {option.optionText}
                          </div>
                        ))}
                      </div>
                    )}

                    {question.questionType === 'LIKERT_SCALE' && question.likertConfig && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          {question.likertConfig.minLabel}
                        </span>
                        <div className="flex gap-2">
                          {Array.from({
                            length: question.likertConfig.maxValue - question.likertConfig.minValue + 1
                          }).map((_, i) => (
                            <div
                              key={i}
                              className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center text-sm text-gray-600"
                            >
                              {question.likertConfig!.minValue + i}
                            </div>
                          ))}
                        </div>
                        <span className="text-xs text-gray-500">
                          {question.likertConfig.maxLabel}
                        </span>
                      </div>
                    )}

                    {question.questionType === 'TEXT_SHORT' && (
                      <div className="text-sm text-gray-500">
                        Short text response
                        {(question.minLength || question.maxLength) && (
                          <span className="ml-2">
                            ({question.minLength && `min: ${question.minLength}`}
                            {question.minLength && question.maxLength && ', '}
                            {question.maxLength && `max: ${question.maxLength}`} characters)
                          </span>
                        )}
                      </div>
                    )}

                    {question.questionType === 'TEXT_LONG' && (
                      <div className="text-sm text-gray-500">
                        Long text response (paragraph)
                        {(question.minLength || question.maxLength) && (
                          <span className="ml-2">
                            ({question.minLength && `min: ${question.minLength}`}
                            {question.minLength && question.maxLength && ', '}
                            {question.maxLength && `max: ${question.maxLength}`} characters)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        ) : (
          <div className="bg-white rounded-lg border p-8 text-center">
            <AlignLeft className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <h3 className="font-medium text-gray-900">No Questions Yet</h3>
            <p className="text-sm text-gray-500 mt-1">
              Add questions to build your {survey.type === 'QUIZ' ? 'quiz' : 'survey'}.
            </p>
            <button
              onClick={() => {
                resetForm()
                setShowQuestionForm(true)
              }}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Add First Question
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
