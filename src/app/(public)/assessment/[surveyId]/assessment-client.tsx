'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Loader2,
  User,
  Mail,
  Phone,
  UserPlus,
  Eye,
  AlertTriangle,
} from 'lucide-react'
import { submitPublicSurvey } from '@/lib/actions/surveys'

interface SurveyQuestion {
  id: string
  questionText: string
  questionType: 'MULTIPLE_CHOICE' | 'MULTIPLE_SELECT' | 'LIKERT_SCALE' | 'TEXT_SHORT' | 'TEXT_LONG'
  isRequired: boolean
  sortOrder: number
  likertConfig: { minLabel: string; maxLabel: string; minValue: number; maxValue: number } | null
  minLength: number | null
  maxLength: number | null
  pageId: string | null
  options: {
    id: string
    optionText: string
    sortOrder: number
  }[]
}

interface SurveyPage {
  id: string
  title: string | null
  description: string | null
  sortOrder: number
  questions: SurveyQuestion[]
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
  type: string
  showProgressBar: boolean
  requiresProspectInfo: boolean
  contactInfoConfig: ContactInfoField[] | null
  questions: SurveyQuestion[]
  pages: SurveyPage[]
}

// A "step" is either a page with questions or a standalone question
interface SurveyStep {
  type: 'page' | 'question'
  page?: SurveyPage
  question?: SurveyQuestion
}

// Default contact info fields (used if no config is provided)
const DEFAULT_CONTACT_FIELDS: ContactInfoField[] = [
  { name: 'firstName', label: 'First Name', type: 'text', required: true, enabled: true },
  { name: 'lastName', label: 'Last Name', type: 'text', required: true, enabled: true },
  { name: 'email', label: 'Email Address', type: 'email', required: true, enabled: true },
  { name: 'phone', label: 'Phone Number', type: 'tel', required: false, enabled: true },
  { name: 'referrerName', label: 'Who Referred You?', type: 'text', required: false, enabled: false },
]

interface Props {
  survey: Survey
  isPreview?: boolean
}

interface Answer {
  questionId: string
  selectedOptionIds?: string[]
  likertValue?: number
  textResponse?: string
}

interface ProspectInfo {
  firstName: string
  lastName: string
  email: string
  phone: string
  phoneCountryCode: string
  referrerName: string
}

export function AssessmentClient({ survey, isPreview = false }: Props) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0) // 0 = prospect info if required, 1+ = questions/pages
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [prospectInfo, setProspectInfo] = useState<ProspectInfo>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    phoneCountryCode: 'US',
    referrerName: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isComplete, setIsComplete] = useState(false)
  const [prospectId, setProspectId] = useState<string | null>(null)

  const showProspectForm = survey.requiresProspectInfo

  // Get the active contact fields from config or use defaults
  const contactFields = survey.contactInfoConfig || DEFAULT_CONTACT_FIELDS
  const enabledContactFields = contactFields.filter(f => f.enabled)

  // Build steps: pages with their questions + standalone questions
  const surveySteps: SurveyStep[] = []

  // Add pages with questions (sorted by sortOrder)
  const sortedPages = [...(survey.pages || [])].sort((a, b) => a.sortOrder - b.sortOrder)
  for (const page of sortedPages) {
    if (page.questions && page.questions.length > 0) {
      surveySteps.push({
        type: 'page',
        page: {
          ...page,
          questions: [...page.questions].sort((a, b) => a.sortOrder - b.sortOrder)
        }
      })
    }
  }

  // Add standalone questions (questions not in any page)
  const standaloneQuestions = survey.questions
    .filter(q => !q.pageId)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  for (const question of standaloneQuestions) {
    surveySteps.push({ type: 'question', question })
  }

  const totalSteps = surveySteps.length + (showProspectForm ? 1 : 0)
  const currentStepIndex = showProspectForm ? currentStep - 1 : currentStep
  const currentSurveyStep = currentStepIndex >= 0 && currentStepIndex < surveySteps.length
    ? surveySteps[currentStepIndex]
    : null

  // For backward compatibility: get current question (only if it's a single question step)
  const currentQuestion = currentSurveyStep?.type === 'question' ? currentSurveyStep.question : null

  const progress = ((currentStep + 1) / totalSteps) * 100

  const handleProspectInfoChange = useCallback((field: keyof ProspectInfo, value: string) => {
    setProspectInfo(prev => ({ ...prev, [field]: value }))
  }, [])

  const handleAnswerChange = useCallback((questionId: string, answer: Partial<Answer>) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        ...answer,
        questionId,
      },
    }))
  }, [])

  const isProspectInfoValid = useCallback(() => {
    if (!showProspectForm) return true
    // Check all required enabled fields
    for (const field of enabledContactFields) {
      if (field.required) {
        const value = prospectInfo[field.name as keyof ProspectInfo]
        if (!value || (typeof value === 'string' && !value.trim())) {
          return false
        }
      }
    }
    return true
  }, [showProspectForm, prospectInfo, enabledContactFields])

  // Validate a single question
  const isQuestionValid = useCallback((question: SurveyQuestion) => {
    if (!question.isRequired) return true

    const answer = answers[question.id]
    if (!answer) return false

    switch (question.questionType) {
      case 'MULTIPLE_CHOICE':
        return answer.selectedOptionIds && answer.selectedOptionIds.length === 1
      case 'MULTIPLE_SELECT':
        return answer.selectedOptionIds && answer.selectedOptionIds.length > 0
      case 'LIKERT_SCALE':
        return answer.likertValue !== undefined
      case 'TEXT_SHORT':
      case 'TEXT_LONG':
        return answer.textResponse && answer.textResponse.trim().length > 0
      default:
        return false
    }
  }, [answers])

  const isCurrentStepValid = useCallback(() => {
    // In preview mode, skip validation entirely
    if (isPreview) return true

    if (showProspectForm && currentStep === 0) {
      return isProspectInfoValid()
    }

    if (!currentSurveyStep) return false

    // For page steps, validate all questions on the page
    if (currentSurveyStep.type === 'page' && currentSurveyStep.page) {
      for (const question of currentSurveyStep.page.questions) {
        if (!isQuestionValid(question)) {
          return false
        }
      }
      return true
    }

    // For single question steps
    if (currentSurveyStep.type === 'question' && currentSurveyStep.question) {
      return isQuestionValid(currentSurveyStep.question)
    }

    return false
  }, [currentStep, showProspectForm, currentSurveyStep, isProspectInfoValid, isQuestionValid, isPreview])

  const handleNext = useCallback(async () => {
    if (!isCurrentStepValid()) {
      setError('Please complete this step before continuing')
      return
    }

    setError(null)

    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
      // In preview mode, just show completion without submitting
      if (isPreview) {
        setIsComplete(true)
        return
      }

      // Submit the survey
      setIsSubmitting(true)
      try {
        const answerArray = Object.values(answers)
        const result = await submitPublicSurvey(
          survey.id,
          answerArray,
          showProspectForm ? {
            firstName: prospectInfo.firstName.trim(),
            lastName: prospectInfo.lastName.trim(),
            email: prospectInfo.email.trim(),
            phone: prospectInfo.phone.trim() || undefined,
            phoneCountryCode: prospectInfo.phoneCountryCode || undefined,
            referrerName: prospectInfo.referrerName.trim() || undefined,
          } : undefined
        )

        if (result.error) {
          setError(result.error)
        } else {
          if (result.prospectId) {
            setProspectId(result.prospectId)
          }
          setIsComplete(true)
        }
      } catch {
        setError('Failed to submit assessment. Please try again.')
      } finally {
        setIsSubmitting(false)
      }
    }
  }, [currentStep, totalSteps, isCurrentStepValid, answers, survey.id, showProspectForm, prospectInfo, isPreview])

  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
      setError(null)
    }
  }, [currentStep])

  const handleOptionSelect = useCallback((questionId: string, optionId: string, isMultiple: boolean) => {
    setAnswers(prev => {
      const current = prev[questionId]?.selectedOptionIds || []

      if (isMultiple) {
        // Toggle selection for multiple select
        const newSelection = current.includes(optionId)
          ? current.filter(id => id !== optionId)
          : [...current, optionId]
        return {
          ...prev,
          [questionId]: {
            questionId,
            selectedOptionIds: newSelection,
          },
        }
      } else {
        // Single selection
        return {
          ...prev,
          [questionId]: {
            questionId,
            selectedOptionIds: [optionId],
          },
        }
      }
    })
  }, [])

  // Helper function to render a single question
  const renderQuestion = (question: SurveyQuestion) => (
    <>
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {question.questionText}
          {question.isRequired && <span className="text-red-500 ml-1">*</span>}
        </h3>
      </div>

      {/* Multiple Choice */}
      {question.questionType === 'MULTIPLE_CHOICE' && (
        <div className="space-y-3">
          {question.options.map(option => {
            const isSelected = answers[question.id]?.selectedOptionIds?.includes(option.id)
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => handleOptionSelect(question.id, option.id, false)}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                  isSelected
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    isSelected ? 'border-primary-500 bg-primary-500' : 'border-gray-300'
                  }`}>
                    {isSelected && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>
                  <span className="text-gray-900">{option.optionText}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Multiple Select */}
      {question.questionType === 'MULTIPLE_SELECT' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500 mb-2">Select all that apply</p>
          {question.options.map(option => {
            const isSelected = answers[question.id]?.selectedOptionIds?.includes(option.id)
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => handleOptionSelect(question.id, option.id, true)}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                  isSelected
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    isSelected ? 'border-primary-500 bg-primary-500' : 'border-gray-300'
                  }`}>
                    {isSelected && (
                      <CheckCircle className="w-3 h-3 text-white" />
                    )}
                  </div>
                  <span className="text-gray-900">{option.optionText}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Likert Scale */}
      {question.questionType === 'LIKERT_SCALE' && question.likertConfig && (
        <div className="space-y-4">
          <div className="flex justify-between text-sm text-gray-600">
            <span>{question.likertConfig.minLabel}</span>
            <span>{question.likertConfig.maxLabel}</span>
          </div>
          <div className="flex justify-between gap-2">
            {Array.from(
              { length: question.likertConfig.maxValue - question.likertConfig.minValue + 1 },
              (_, i) => question.likertConfig!.minValue + i
            ).map(value => {
              const isSelected = answers[question.id]?.likertValue === value
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleAnswerChange(question.id, { likertValue: value })}
                  className={`flex-1 py-3 rounded-lg border-2 font-medium transition-all ${
                    isSelected
                      ? 'border-primary-500 bg-primary-500 text-white'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  {value}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Short Text */}
      {question.questionType === 'TEXT_SHORT' && (
        <input
          type="text"
          value={answers[question.id]?.textResponse || ''}
          onChange={(e) => handleAnswerChange(question.id, { textResponse: e.target.value })}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          placeholder="Type your answer here..."
          maxLength={question.maxLength || undefined}
        />
      )}

      {/* Long Text */}
      {question.questionType === 'TEXT_LONG' && (
        <textarea
          value={answers[question.id]?.textResponse || ''}
          onChange={(e) => handleAnswerChange(question.id, { textResponse: e.target.value })}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[150px]"
          placeholder="Type your answer here..."
          maxLength={question.maxLength || undefined}
        />
      )}
    </>
  )

  if (isComplete) {
    // Preview mode completion screen
    if (isPreview) {
      return (
        <div className="max-w-2xl mx-auto">
          {/* Preview Banner */}
          <div className="mb-6 bg-amber-50 border border-amber-300 rounded-lg p-4 flex items-center gap-3">
            <Eye className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-amber-800 font-medium">Preview Mode</p>
              <p className="text-amber-700 text-sm">This is how the completion screen will appear to respondents.</p>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Preview Complete!
            </h1>
            <p className="text-gray-600 mb-6">
              This is how the completion screen will appear to respondents after submission.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <p className="text-amber-800 text-sm">
                <AlertTriangle className="w-4 h-4 inline mr-1" />
                No responses were recorded during this preview.
              </p>
            </div>
            <button
              onClick={() => window.close()}
              className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors mr-3"
            >
              Close Preview
            </button>
            <button
              onClick={() => {
                setIsComplete(false)
                setCurrentStep(0)
                setAnswers({})
                setProspectInfo({
                  firstName: '',
                  lastName: '',
                  email: '',
                  phone: '',
                  phoneCountryCode: 'US',
                  referrerName: '',
                })
              }}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Preview Again
            </button>
          </div>
        </div>
      )
    }

    // Normal completion screen
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Assessment Complete!
          </h1>
          <p className="text-gray-600 mb-4">
            Thank you for completing the coach assessment.
          </p>
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-6">
            <p className="text-primary-800 font-medium mb-3">
              Next step: Schedule your orientation call with our team.
            </p>
            <button
              onClick={() => router.push(`/book/orientation${prospectId ? `?prospectId=${prospectId}` : ''}`)}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors inline-flex items-center gap-2"
            >
              Schedule Orientation
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Or, someone from our team will reach out to you within 24 hours.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Please check your email (including spam folder) for further communication.
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Return Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Preview Mode Banner */}
      {isPreview && (
        <div className="mb-6 bg-amber-50 border border-amber-300 rounded-lg p-4 flex items-center gap-3">
          <Eye className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-amber-800 font-medium">Preview Mode</p>
            <p className="text-amber-700 text-sm">Responses will not be saved. You can skip required fields.</p>
          </div>
          <button
            onClick={() => window.close()}
            className="px-3 py-1 text-sm bg-amber-100 text-amber-800 rounded hover:bg-amber-200 transition-colors"
          >
            Close
          </button>
        </div>
      )}

      {/* Survey Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{survey.title}</h1>
        {survey.description && (
          <p className="text-gray-600">{survey.description}</p>
        )}
      </div>

      {/* Progress Bar */}
      {survey.showProgressBar && (
        <div className="mb-8">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Step {currentStep + 1} of {totalSteps}</span>
            <span>{Math.round(progress)}% complete</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-600 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Content Card */}
      <div className="bg-white rounded-xl shadow-lg p-8">
        {/* Prospect Info Form - Dynamic fields based on survey config */}
        {showProspectForm && currentStep === 0 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Your Information
            </h2>
            <p className="text-gray-600 text-sm mb-6">
              Please provide your contact information to get started.
            </p>

            {/* Name fields in a row if both enabled */}
            {enabledContactFields.some(f => f.name === 'firstName') && enabledContactFields.some(f => f.name === 'lastName') ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {enabledContactFields.filter(f => f.name === 'firstName' || f.name === 'lastName').map(field => {
                  const Icon = field.name === 'firstName' || field.name === 'lastName' ? User : User
                  return (
                    <div key={field.name}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {field.label} {field.required && <span className="text-red-500">*</span>}
                      </label>
                      <div className="relative">
                        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          type={field.type}
                          value={prospectInfo[field.name as keyof ProspectInfo] || ''}
                          onChange={(e) => handleProspectInfoChange(field.name as keyof ProspectInfo, e.target.value)}
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          placeholder={field.name === 'firstName' ? 'John' : 'Doe'}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : null}

            {/* Other fields */}
            {enabledContactFields.filter(f => f.name !== 'firstName' && f.name !== 'lastName').map(field => {
              let Icon = User
              let placeholder = ''
              if (field.name === 'email') {
                Icon = Mail
                placeholder = 'name@example.com'
              } else if (field.name === 'phone') {
                Icon = Phone
                placeholder = '(555) 123-4567'
              } else if (field.name === 'referrerName') {
                Icon = UserPlus
                placeholder = "Referrer's name"
              }

              return (
                <div key={field.name}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field.label} {field.required && <span className="text-red-500">*</span>}
                  </label>
                  <div className="relative">
                    <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type={field.type}
                      value={prospectInfo[field.name as keyof ProspectInfo] || ''}
                      onChange={(e) => handleProspectInfoChange(field.name as keyof ProspectInfo, e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder={placeholder || `Enter ${field.label.toLowerCase()}`}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Question Display - Single Question Step */}
        {currentSurveyStep?.type === 'question' && currentSurveyStep.question && (
          <div className="space-y-6">
            {renderQuestion(currentSurveyStep.question)}
          </div>
        )}

        {/* Page Display - Multiple Questions Step */}
        {currentSurveyStep?.type === 'page' && currentSurveyStep.page && (
          <div className="space-y-8">
            {/* Page Header */}
            {(currentSurveyStep.page.title || currentSurveyStep.page.description) && (
              <div className="border-b border-gray-200 pb-4">
                {currentSurveyStep.page.title && (
                  <h2 className="text-xl font-semibold text-gray-900">
                    {currentSurveyStep.page.title}
                  </h2>
                )}
                {currentSurveyStep.page.description && (
                  <p className="text-gray-600 mt-1">
                    {currentSurveyStep.page.description}
                  </p>
                )}
              </div>
            )}

            {/* Questions on this page */}
            {currentSurveyStep.page.questions.map((question, index) => (
              <div key={question.id} className="space-y-4">
                {index > 0 && <div className="border-t border-gray-100 pt-6" />}
                {renderQuestion(question)}
              </div>
            ))}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              currentStep === 0
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <ChevronLeft className="w-5 h-5" />
            Previous
          </button>

          <button
            type="button"
            onClick={handleNext}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Submitting...
              </>
            ) : currentStep === totalSteps - 1 ? (
              <>
                Submit
                <CheckCircle className="w-5 h-5" />
              </>
            ) : (
              <>
                Next
                <ChevronRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
