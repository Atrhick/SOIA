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
  Layers,
  FolderPlus,
  Eye,
  User,
  Mail,
  Phone,
  Users,
  Lock,
} from 'lucide-react'
import {
  addQuestion,
  updateQuestion,
  deleteQuestion,
  reorderQuestions,
  duplicateQuestion,
  updateSurvey,
  createSurveyPage,
  updateSurveyPage,
  deleteSurveyPage,
  moveQuestionToPage,
  addQuestionToPage,
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
  pageId: string | null
}

interface SurveyPage {
  id: string
  title: string | null
  description: string | null
  sortOrder: number
}

interface ContactInfoField {
  name: string
  label: string
  type: string
  required: boolean
  enabled: boolean
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
  pages: SurveyPage[]
  isPublic: boolean
  requiresProspectInfo: boolean
  showProgressBar: boolean
  contactInfoConfig: ContactInfoField[] | null
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

// Default contact info fields configuration
const DEFAULT_CONTACT_FIELDS: ContactInfoField[] = [
  { name: 'firstName', label: 'First Name', type: 'text', required: true, enabled: true },
  { name: 'lastName', label: 'Last Name', type: 'text', required: true, enabled: true },
  { name: 'email', label: 'Email', type: 'email', required: true, enabled: true },
  { name: 'phone', label: 'Phone', type: 'tel', required: false, enabled: true },
  { name: 'referrerName', label: 'Referrer Name', type: 'text', required: false, enabled: false },
]

export function SurveyEditorClient({ survey }: SurveyEditorClientProps) {
  const [questions, setQuestions] = useState<SurveyQuestion[]>(survey.questions)
  const [pages, setPages] = useState<SurveyPage[]>(survey.pages || [])
  const [showQuestionForm, setShowQuestionForm] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<SurveyQuestion | null>(null)
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)

  // Page management state
  const [showPageForm, setShowPageForm] = useState(false)
  const [editingPage, setEditingPage] = useState<SurveyPage | null>(null)
  const [pageForm, setPageForm] = useState({ title: '', description: '' })
  const [addingToPageId, setAddingToPageId] = useState<string | null>(null)

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
    isPublic: survey.isPublic,
    requiresProspectInfo: survey.requiresProspectInfo,
    showProgressBar: survey.showProgressBar,
    contactInfoFields: survey.contactInfoConfig || DEFAULT_CONTACT_FIELDS,
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

  const toggleContactField = (fieldName: string, property: 'enabled' | 'required') => {
    setSettingsForm({
      ...settingsForm,
      contactInfoFields: settingsForm.contactInfoFields.map(field =>
        field.name === fieldName
          ? { ...field, [property]: !field[property] }
          : field
      )
    })
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
    formData.set('isPublic', String(settingsForm.isPublic))
    formData.set('requiresProspectInfo', String(settingsForm.requiresProspectInfo))
    formData.set('showProgressBar', String(settingsForm.showProgressBar))
    formData.set('contactInfoConfig', JSON.stringify(settingsForm.contactInfoFields))
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
        // If adding to a specific page, use addQuestionToPage
        const result = addingToPageId
          ? await addQuestionToPage(survey.id, addingToPageId, data)
          : await addQuestion(survey.id, data)
        if (result.error) {
          setError(result.error)
        } else if (result.question) {
          // Add new question to local state
          const q = result.question as any
          const newQuestion: SurveyQuestion = {
            id: q.id,
            questionText: q.questionText,
            questionType: q.questionType,
            isRequired: q.isRequired,
            sortOrder: q.sortOrder,
            likertConfig: q.likertConfig as any,
            minLength: q.minLength,
            maxLength: q.maxLength,
            options: q.options?.map((o: any) => ({
              id: o.id,
              optionText: o.optionText,
              isCorrect: o.isCorrect,
              sortOrder: o.sortOrder,
            })) || [],
            pageId: addingToPageId,
          }
          setQuestions([...questions, newQuestion])
          resetForm()
          setAddingToPageId(null)
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
          pageId: result.question.pageId || null,
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

  // ============================================
  // PAGE MANAGEMENT HANDLERS
  // ============================================

  const resetPageForm = () => {
    setPageForm({ title: '', description: '' })
    setEditingPage(null)
    setShowPageForm(false)
  }

  const handleCreatePage = async () => {
    setIsSubmitting(true)
    try {
      const result = await createSurveyPage(survey.id, {
        title: pageForm.title || undefined,
        description: pageForm.description || undefined,
      })
      if (result.error) {
        setError(result.error)
      } else if (result.page) {
        setPages([...pages, result.page as SurveyPage])
        resetPageForm()
      }
    } catch {
      setError('Failed to create page')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdatePage = async () => {
    if (!editingPage) return

    setIsSubmitting(true)
    try {
      const result = await updateSurveyPage(editingPage.id, {
        title: pageForm.title || undefined,
        description: pageForm.description || undefined,
      })
      if (result.error) {
        setError(result.error)
      } else {
        setPages(pages.map(p =>
          p.id === editingPage.id
            ? { ...p, title: pageForm.title || null, description: pageForm.description || null }
            : p
        ))
        resetPageForm()
      }
    } catch {
      setError('Failed to update page')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeletePage = async (pageId: string) => {
    if (!confirm('Are you sure you want to delete this page/section? Questions will be moved to standalone.')) {
      return
    }

    setIsSubmitting(true)
    try {
      const result = await deleteSurveyPage(pageId)
      if (result.error) {
        setError(result.error)
      } else {
        setPages(pages.filter(p => p.id !== pageId))
        // Update questions to have no pageId
        setQuestions(questions.map(q =>
          q.pageId === pageId ? { ...q, pageId: null } : q
        ))
      }
    } catch {
      setError('Failed to delete page')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleMoveQuestionToPage = async (questionId: string, pageId: string | null) => {
    setIsSubmitting(true)
    try {
      const result = await moveQuestionToPage(questionId, pageId)
      if (result.error) {
        setError(result.error)
      } else {
        setQuestions(questions.map(q =>
          q.id === questionId ? { ...q, pageId } : q
        ))
      }
    } catch {
      setError('Failed to move question')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditPage = (page: SurveyPage) => {
    setPageForm({ title: page.title || '', description: page.description || '' })
    setEditingPage(page)
    setShowPageForm(true)
  }

  // Get questions for a specific page or standalone (no page)
  const getQuestionsForPage = (pageId: string | null) => {
    return questions.filter(q => q.pageId === pageId).sort((a, b) => a.sortOrder - b.sortOrder)
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
        <button
          onClick={() => window.open(`/assessment/${survey.id}?preview=true`, '_blank')}
          className="flex items-center gap-2 px-4 py-2 border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50"
          title="Preview how respondents will see this survey"
        >
          <Eye className="h-4 w-4" />
          Preview
        </button>
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
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settingsForm.isPublic}
                  onChange={(e) => setSettingsForm({ ...settingsForm, isPublic: e.target.checked })}
                  className="rounded text-blue-600"
                />
                <span className="text-sm text-gray-700">Public (no login required)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settingsForm.showProgressBar}
                  onChange={(e) => setSettingsForm({ ...settingsForm, showProgressBar: e.target.checked })}
                  className="rounded text-blue-600"
                />
                <span className="text-sm text-gray-700">Show progress bar</span>
              </label>
            </div>

            {/* Contact Info Collection */}
            <div className="border-t pt-4 mt-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Collect Contact Information</label>
                  <p className="text-xs text-gray-500">Collect respondent info before the survey questions</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settingsForm.requiresProspectInfo}
                    onChange={(e) => setSettingsForm({ ...settingsForm, requiresProspectInfo: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {settingsForm.requiresProspectInfo && (
                <div className="space-y-4">
                  {/* Required Fields Section */}
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                    <div className="flex items-center gap-2 mb-3">
                      <Lock className="h-4 w-4 text-blue-600" />
                      <h4 className="text-sm font-medium text-blue-900">Required Fields</h4>
                      <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">Always collected</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 py-2 px-3 bg-white rounded-lg border border-blue-200">
                        <User className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-medium text-gray-700 flex-1">First Name</span>
                        <span className="text-xs text-blue-600 font-medium">Required</span>
                      </div>
                      <div className="flex items-center gap-3 py-2 px-3 bg-white rounded-lg border border-blue-200">
                        <User className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-medium text-gray-700 flex-1">Last Name</span>
                        <span className="text-xs text-blue-600 font-medium">Required</span>
                      </div>
                      <div className="flex items-center gap-3 py-2 px-3 bg-white rounded-lg border border-blue-200">
                        <Mail className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-medium text-gray-700 flex-1">Email</span>
                        <span className="text-xs text-blue-600 font-medium">Required</span>
                      </div>
                    </div>
                  </div>

                  {/* Optional Fields Section */}
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Optional Fields</h4>
                    <div className="space-y-2">
                      {settingsForm.contactInfoFields
                        .filter(field => !['firstName', 'lastName', 'email'].includes(field.name))
                        .map((field) => {
                          const IconComponent = field.name === 'phone' ? Phone : Users
                          return (
                            <div key={field.name} className={`flex items-center gap-3 py-2 px-3 rounded-lg border transition-colors ${
                              field.enabled ? 'bg-white border-gray-300' : 'bg-gray-100 border-gray-200'
                            }`}>
                              <label className="flex items-center gap-3 flex-1 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={field.enabled}
                                  onChange={() => toggleContactField(field.name, 'enabled')}
                                  className="rounded text-blue-600 h-4 w-4"
                                />
                                <IconComponent className={`h-4 w-4 ${field.enabled ? 'text-gray-500' : 'text-gray-400'}`} />
                                <span className={`text-sm font-medium ${field.enabled ? 'text-gray-700' : 'text-gray-400'}`}>
                                  {field.label}
                                </span>
                              </label>
                              {field.enabled && (
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={field.required}
                                    onChange={() => toggleContactField(field.name, 'required')}
                                    className="rounded text-orange-500 h-4 w-4"
                                  />
                                  <span className="text-xs text-gray-500">Required</span>
                                </label>
                              )}
                            </div>
                          )
                        })}
                    </div>
                  </div>
                </div>
              )}
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setPageForm({ title: '', description: '' })
              setEditingPage(null)
              setShowPageForm(true)
            }}
            className="flex items-center gap-2 px-4 py-2 border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50"
          >
            <Layers className="h-4 w-4" />
            Add Page/Section
          </button>
          <button
            onClick={() => {
              resetForm()
              setAddingToPageId(null)
              setShowQuestionForm(true)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add Question
          </button>
        </div>
      </div>

      {/* Page Form */}
      {showPageForm && (
        <div className="bg-purple-50 rounded-lg border border-purple-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-purple-900">
              {editingPage ? 'Edit Page/Section' : 'Add New Page/Section'}
            </h3>
            <button onClick={resetPageForm} className="p-1 hover:bg-purple-100 rounded">
              <X className="h-5 w-5 text-purple-700" />
            </button>
          </div>
          <p className="text-sm text-purple-700">
            Pages group multiple questions together on one screen. Respondents see all questions on a page before moving to the next.
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-purple-900 mb-1">
                Section Title (optional)
              </label>
              <input
                type="text"
                value={pageForm.title}
                onChange={(e) => setPageForm({ ...pageForm, title: e.target.value })}
                className="w-full rounded-lg border border-purple-300 p-2"
                placeholder="e.g., Personal Information, Experience, etc."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-purple-900 mb-1">
                Description (optional)
              </label>
              <textarea
                value={pageForm.description}
                onChange={(e) => setPageForm({ ...pageForm, description: e.target.value })}
                className="w-full rounded-lg border border-purple-300 p-2"
                rows={2}
                placeholder="Instructions or context for this section..."
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={editingPage ? handleUpdatePage : handleCreatePage}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {isSubmitting ? 'Saving...' : editingPage ? 'Update Page' : 'Add Page'}
            </button>
            <button
              onClick={resetPageForm}
              className="px-4 py-2 border border-purple-300 rounded-lg hover:bg-purple-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Question Form */}
      {showQuestionForm && (
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                {editingQuestion ? 'Edit Question' : 'Add New Question'}
              </h2>
              {addingToPageId && (
                <p className="text-sm text-purple-600 mt-1">
                  Adding to: {pages.find(p => p.id === addingToPageId)?.title || 'Untitled Page'}
                </p>
              )}
            </div>
            <button onClick={() => { resetForm(); setAddingToPageId(null); }} className="p-1 hover:bg-gray-100 rounded">
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

      {/* Questions List - Grouped by Pages */}
      <div className="space-y-4">
        {/* Pages with their questions */}
        {pages.sort((a, b) => a.sortOrder - b.sortOrder).map((page, pageIndex) => {
          const pageQuestions = getQuestionsForPage(page.id)
          return (
            <div key={page.id} className="bg-purple-50 rounded-lg border border-purple-200">
              {/* Page Header */}
              <div className="p-4 border-b border-purple-200">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-100 text-purple-700">
                      <Layers className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-purple-900">
                        {page.title || `Page ${pageIndex + 1}`}
                      </h3>
                      {page.description && (
                        <p className="text-sm text-purple-700 mt-0.5">{page.description}</p>
                      )}
                      <p className="text-xs text-purple-500 mt-1">
                        {pageQuestions.length} question{pageQuestions.length !== 1 ? 's' : ''} on this page
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setAddingToPageId(page.id)
                        resetForm()
                        setShowQuestionForm(true)
                      }}
                      className="p-1.5 text-purple-600 hover:bg-purple-100 rounded"
                      title="Add question to this page"
                    >
                      <FolderPlus className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleEditPage(page)}
                      className="p-1.5 text-purple-600 hover:bg-purple-100 rounded"
                      title="Edit page"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeletePage(page.id)}
                      className="p-1.5 text-purple-600 hover:text-red-600 hover:bg-purple-100 rounded"
                      title="Delete page"
                      disabled={isSubmitting}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Questions in this page */}
              <div className="p-3 space-y-2">
                {pageQuestions.length > 0 ? (
                  pageQuestions.map((question, questionIndex) => {
                    const Icon = getQuestionTypeIcon(question.questionType)
                    const isExpanded = expandedQuestion === question.id

                    return (
                      <div key={question.id} className="bg-white rounded-lg border">
                        <div
                          className="p-3 cursor-pointer"
                          onClick={() => setExpandedQuestion(isExpanded ? null : question.id)}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-600 font-medium text-xs">
                              {questionIndex + 1}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Icon className="h-4 w-4 text-gray-400" />
                                <span className="text-xs text-gray-500">{getQuestionTypeLabel(question.questionType)}</span>
                                {question.isRequired && (
                                  <span className="text-xs text-red-500">*</span>
                                )}
                              </div>
                              <p className="font-medium text-sm">{question.questionText}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              {/* Move to page dropdown */}
                              <select
                                value={question.pageId || ''}
                                onChange={(e) => {
                                  e.stopPropagation()
                                  handleMoveQuestionToPage(question.id, e.target.value || null)
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs border rounded px-1 py-0.5 text-gray-600"
                                title="Move to page"
                              >
                                <option value="">Standalone</option>
                                {pages.map(p => (
                                  <option key={p.id} value={p.id}>
                                    {p.title || `Page ${pages.findIndex(pg => pg.id === p.id) + 1}`}
                                  </option>
                                ))}
                              </select>
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
                          <div className="border-t px-3 py-2 bg-gray-50 text-sm">
                            {['MULTIPLE_CHOICE', 'MULTIPLE_SELECT'].includes(question.questionType) && (
                              <div className="space-y-1">
                                {question.options.map((option) => (
                                  <div
                                    key={option.id}
                                    className={`flex items-center gap-2 ${
                                      option.isCorrect ? 'text-green-700' : 'text-gray-600'
                                    }`}
                                  >
                                    {option.isCorrect ? (
                                      <CheckCircle className="h-3 w-3 text-green-600" />
                                    ) : (
                                      <Circle className="h-3 w-3 text-gray-300" />
                                    )}
                                    {option.optionText}
                                  </div>
                                ))}
                              </div>
                            )}
                            {question.questionType === 'LIKERT_SCALE' && question.likertConfig && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">{question.likertConfig.minLabel}</span>
                                <span className="text-xs text-gray-400">({question.likertConfig.minValue}-{question.likertConfig.maxValue})</span>
                                <span className="text-xs text-gray-500">{question.likertConfig.maxLabel}</span>
                              </div>
                            )}
                            {['TEXT_SHORT', 'TEXT_LONG'].includes(question.questionType) && (
                              <div className="text-gray-500">
                                {question.questionType === 'TEXT_SHORT' ? 'Short' : 'Long'} text response
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })
                ) : (
                  <div className="text-center py-4 text-purple-600 text-sm">
                    <p>No questions in this page yet.</p>
                    <button
                      onClick={() => {
                        setAddingToPageId(page.id)
                        resetForm()
                        setShowQuestionForm(true)
                      }}
                      className="mt-2 text-purple-700 hover:text-purple-900 underline"
                    >
                      Add a question
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* Standalone Questions (not in any page) */}
        {getQuestionsForPage(null).length > 0 && (
          <div className="space-y-3">
            {pages.length > 0 && (
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                Standalone Questions
              </h3>
            )}
            {getQuestionsForPage(null).map((question, index) => {
              const Icon = getQuestionTypeIcon(question.questionType)
              const isExpanded = expandedQuestion === question.id
              const globalIndex = questions.findIndex(q => q.id === question.id)

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
                            handleMoveQuestion(globalIndex, 'up')
                          }}
                          disabled={globalIndex === 0}
                          className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleMoveQuestion(globalIndex, 'down')
                          }}
                          disabled={globalIndex === questions.length - 1}
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
                        {/* Move to page dropdown */}
                        {pages.length > 0 && (
                          <select
                            value={question.pageId || ''}
                            onChange={(e) => {
                              e.stopPropagation()
                              handleMoveQuestionToPage(question.id, e.target.value || null)
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs border rounded px-1 py-0.5 text-gray-600"
                            title="Move to page"
                          >
                            <option value="">Standalone</option>
                            {pages.map(p => (
                              <option key={p.id} value={p.id}>
                                {p.title || `Page ${pages.findIndex(pg => pg.id === p.id) + 1}`}
                              </option>
                            ))}
                          </select>
                        )}
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
                          <span className="text-xs text-gray-500">{question.likertConfig.minLabel}</span>
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
                          <span className="text-xs text-gray-500">{question.likertConfig.maxLabel}</span>
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
            })}
          </div>
        )}

        {/* Empty state */}
        {questions.length === 0 && pages.length === 0 && (
          <div className="bg-white rounded-lg border p-8 text-center">
            <AlignLeft className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <h3 className="font-medium text-gray-900">No Questions Yet</h3>
            <p className="text-sm text-gray-500 mt-1">
              Add questions to build your {survey.type === 'QUIZ' ? 'quiz' : 'survey'}.
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                onClick={() => {
                  setPageForm({ title: '', description: '' })
                  setEditingPage(null)
                  setShowPageForm(true)
                }}
                className="inline-flex items-center gap-2 px-4 py-2 border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50"
              >
                <Layers className="h-4 w-4" />
                Add Page/Section
              </button>
              <button
                onClick={() => {
                  resetForm()
                  setShowQuestionForm(true)
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Add Question
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
