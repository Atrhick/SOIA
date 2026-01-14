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
  options: {
    id: string
    optionText: string
    sortOrder: number
  }[]
}

interface Survey {
  id: string
  title: string
  description: string | null
  type: string
  showProgressBar: boolean
  requiresProspectInfo: boolean
  questions: SurveyQuestion[]
}

interface Props {
  survey: Survey
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

export function AssessmentClient({ survey }: Props) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0) // 0 = prospect info if required, 1+ = questions
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
  const totalSteps = survey.questions.length + (showProspectForm ? 1 : 0)
  const currentQuestionIndex = showProspectForm ? currentStep - 1 : currentStep
  const currentQuestion = currentQuestionIndex >= 0 && currentQuestionIndex < survey.questions.length
    ? survey.questions[currentQuestionIndex]
    : null

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
    return prospectInfo.firstName.trim() && prospectInfo.lastName.trim() && prospectInfo.email.trim()
  }, [showProspectForm, prospectInfo])

  const isCurrentStepValid = useCallback(() => {
    if (showProspectForm && currentStep === 0) {
      return isProspectInfoValid()
    }

    if (!currentQuestion) return false
    if (!currentQuestion.isRequired) return true

    const answer = answers[currentQuestion.id]
    if (!answer) return false

    switch (currentQuestion.questionType) {
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
  }, [currentStep, showProspectForm, currentQuestion, answers, isProspectInfoValid])

  const handleNext = useCallback(async () => {
    if (!isCurrentStepValid()) {
      setError('Please complete this step before continuing')
      return
    }

    setError(null)

    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
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
  }, [currentStep, totalSteps, isCurrentStepValid, answers, survey.id, showProspectForm, prospectInfo])

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

  if (isComplete) {
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
        {/* Prospect Info Form */}
        {showProspectForm && currentStep === 0 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Your Information
            </h2>
            <p className="text-gray-600 text-sm mb-6">
              Please provide your contact information to get started.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={prospectInfo.firstName}
                    onChange={(e) => handleProspectInfoChange('firstName', e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="John"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={prospectInfo.lastName}
                    onChange={(e) => handleProspectInfoChange('lastName', e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Doe"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  value={prospectInfo.email}
                  onChange={(e) => handleProspectInfoChange('email', e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="tel"
                  value={prospectInfo.phone}
                  onChange={(e) => handleProspectInfoChange('phone', e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Who Referred You?
              </label>
              <div className="relative">
                <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={prospectInfo.referrerName}
                  onChange={(e) => handleProspectInfoChange('referrerName', e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Referrer's name (optional)"
                />
              </div>
            </div>
          </div>
        )}

        {/* Question Display */}
        {currentQuestion && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {currentQuestion.questionText}
                {currentQuestion.isRequired && <span className="text-red-500 ml-1">*</span>}
              </h2>
            </div>

            {/* Multiple Choice */}
            {currentQuestion.questionType === 'MULTIPLE_CHOICE' && (
              <div className="space-y-3">
                {currentQuestion.options.map(option => {
                  const isSelected = answers[currentQuestion.id]?.selectedOptionIds?.includes(option.id)
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleOptionSelect(currentQuestion.id, option.id, false)}
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
            {currentQuestion.questionType === 'MULTIPLE_SELECT' && (
              <div className="space-y-3">
                <p className="text-sm text-gray-500 mb-2">Select all that apply</p>
                {currentQuestion.options.map(option => {
                  const isSelected = answers[currentQuestion.id]?.selectedOptionIds?.includes(option.id)
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleOptionSelect(currentQuestion.id, option.id, true)}
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
            {currentQuestion.questionType === 'LIKERT_SCALE' && currentQuestion.likertConfig && (
              <div className="space-y-4">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>{currentQuestion.likertConfig.minLabel}</span>
                  <span>{currentQuestion.likertConfig.maxLabel}</span>
                </div>
                <div className="flex justify-between gap-2">
                  {Array.from(
                    { length: currentQuestion.likertConfig.maxValue - currentQuestion.likertConfig.minValue + 1 },
                    (_, i) => currentQuestion.likertConfig!.minValue + i
                  ).map(value => {
                    const isSelected = answers[currentQuestion.id]?.likertValue === value
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => handleAnswerChange(currentQuestion.id, { likertValue: value })}
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
            {currentQuestion.questionType === 'TEXT_SHORT' && (
              <input
                type="text"
                value={answers[currentQuestion.id]?.textResponse || ''}
                onChange={(e) => handleAnswerChange(currentQuestion.id, { textResponse: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Type your answer here..."
                maxLength={currentQuestion.maxLength || undefined}
              />
            )}

            {/* Long Text */}
            {currentQuestion.questionType === 'TEXT_LONG' && (
              <textarea
                value={answers[currentQuestion.id]?.textResponse || ''}
                onChange={(e) => handleAnswerChange(currentQuestion.id, { textResponse: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[150px]"
                placeholder="Type your answer here..."
                maxLength={currentQuestion.maxLength || undefined}
              />
            )}
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
