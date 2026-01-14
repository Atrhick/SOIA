'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Send,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import { submitSurvey } from '@/lib/actions/surveys'

interface SurveyOption {
  id: string
  optionText: string
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
  isAnonymous: boolean
  scoreMode: 'NO_SCORING' | 'SCORE_ONLY' | 'PASS_FAIL' | null
  passingScore: number | null
  showResults: boolean
  allowRetake: boolean
  showProgressBar?: boolean
  questions: SurveyQuestion[]
}

interface SurveyFormClientProps {
  survey: Survey
  userRole: 'COACH' | 'AMBASSADOR'
}

interface SubmissionResult {
  success: boolean
  score?: number | null
  passed?: boolean | null
  showResults?: boolean
}

export function SurveyFormClient({ survey, userRole }: SurveyFormClientProps) {
  const router = useRouter()
  const basePath = userRole === 'COACH' ? '/coach' : '/ambassador'

  const [currentStep, setCurrentStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, {
    selectedOptionIds?: string[]
    likertValue?: number
    textResponse?: string
  }>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<SubmissionResult | null>(null)

  const totalSteps = survey.questions.length
  const currentQuestion = survey.questions[currentStep]
  const progress = ((currentStep + 1) / totalSteps) * 100
  const showProgressBar = survey.showProgressBar !== false // Default to true

  const handleOptionChange = useCallback((questionId: string, optionId: string, isMultiple: boolean) => {
    setAnswers(prev => {
      const current = prev[questionId]?.selectedOptionIds || []

      if (isMultiple) {
        const newSelected = current.includes(optionId)
          ? current.filter(id => id !== optionId)
          : [...current, optionId]
        return {
          ...prev,
          [questionId]: { ...prev[questionId], selectedOptionIds: newSelected }
        }
      } else {
        return {
          ...prev,
          [questionId]: { selectedOptionIds: [optionId] }
        }
      }
    })
  }, [])

  const handleLikertChange = useCallback((questionId: string, value: number) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: { likertValue: value }
    }))
  }, [])

  const handleTextChange = useCallback((questionId: string, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: { textResponse: value }
    }))
  }, [])

  const isCurrentStepValid = useCallback(() => {
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
        if (!answer.textResponse?.trim()) return false
        if (currentQuestion.minLength && answer.textResponse.length < currentQuestion.minLength) return false
        return true
      default:
        return false
    }
  }, [currentQuestion, answers])

  const handleNext = useCallback(async () => {
    if (!isCurrentStepValid()) {
      setError('Please complete this question before continuing')
      return
    }

    setError('')

    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
      // Submit the survey
      setIsSubmitting(true)

      const formattedAnswers = survey.questions.map(q => ({
        questionId: q.id,
        selectedOptionIds: answers[q.id]?.selectedOptionIds,
        likertValue: answers[q.id]?.likertValue,
        textResponse: answers[q.id]?.textResponse,
      }))

      try {
        const response = await submitSurvey(survey.id, formattedAnswers)

        if (response.error) {
          setError(response.error)
        } else {
          setResult({
            success: true,
            score: response.score,
            passed: response.passed,
            showResults: response.showResults,
          })
        }
      } catch {
        setError('Failed to submit. Please try again.')
      } finally {
        setIsSubmitting(false)
      }
    }
  }, [currentStep, totalSteps, isCurrentStepValid, survey, answers])

  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
      setError('')
    }
  }, [currentStep])

  // Show results screen
  if (result) {
    const showScore = survey.type === 'QUIZ' && survey.scoreMode !== 'NO_SCORING' && result.score !== null && result.score !== undefined
    const showPassFail = survey.scoreMode === 'PASS_FAIL'

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-white rounded-lg border p-8 text-center">
          {/* Practice Mode (NO_SCORING) or Survey */}
          {(survey.type !== 'QUIZ' || survey.scoreMode === 'NO_SCORING') && (
            <>
              <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Thank You!</h2>
              <p className="text-gray-600">
                Your response has been submitted successfully.
              </p>
              {survey.type === 'QUIZ' && survey.scoreMode === 'NO_SCORING' && (
                <p className="text-sm text-gray-500 mt-2">
                  This was a practice quiz - no score is recorded.
                </p>
              )}
            </>
          )}

          {/* SCORE_ONLY mode */}
          {showScore && !showPassFail && (
            <>
              <CheckCircle className="h-16 w-16 text-blue-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Quiz Complete!</h2>
              <p className="text-lg text-gray-600 mb-4">
                You scored <span className="font-bold text-blue-600">{result.score!.toFixed(0)}%</span>
              </p>
              <p className="text-gray-500">
                {survey.allowRetake
                  ? 'You can retake this quiz to improve your score.'
                  : 'Your response has been recorded.'}
              </p>
            </>
          )}

          {/* PASS_FAIL mode */}
          {showScore && showPassFail && (
            <>
              {result.passed ? (
                <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
              ) : (
                <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              )}
              <h2 className="text-2xl font-bold mb-2">
                {result.passed ? 'Congratulations!' : 'Keep Trying!'}
              </h2>
              <p className="text-lg text-gray-600 mb-4">
                You scored <span className="font-bold">{result.score!.toFixed(0)}%</span>
                {survey.passingScore && ` (${survey.passingScore}% required to pass)`}
              </p>
              {result.passed ? (
                <p className="text-green-600">You have successfully passed this quiz.</p>
              ) : (
                <p className="text-gray-500">
                  {survey.allowRetake
                    ? 'You can retake this quiz to improve your score.'
                    : 'Unfortunately, you did not pass this quiz.'}
                </p>
              )}
            </>
          )}

          <div className="mt-8">
            <Link
              href={`${basePath}/surveys`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Back to Surveys
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`${basePath}/surveys`}>
          <button className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="h-5 w-5" />
          </button>
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{survey.title}</h1>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              survey.type === 'QUIZ' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
            }`}>
              {survey.type}
            </span>
          </div>
          {survey.description && (
            <p className="text-gray-600 mt-1">{survey.description}</p>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {showProgressBar && (
        <div className="bg-white rounded-lg border p-4">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Question {currentStep + 1} of {totalSteps}</span>
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

      {/* Info Bar */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium">
            {survey.questions.length} question{survey.questions.length !== 1 ? 's' : ''}
            {survey.type === 'QUIZ' && survey.scoreMode === 'PASS_FAIL' && survey.passingScore && ` • ${survey.passingScore}% required to pass`}
            {survey.type === 'QUIZ' && survey.scoreMode === 'NO_SCORING' && ' • Practice mode'}
          </p>
          {survey.isAnonymous && (
            <p className="mt-1">Your response is anonymous.</p>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>
      )}

      {/* Single Question Display */}
      {currentQuestion && (
        <div className="bg-white rounded-lg border p-6">
          <div className="mb-6">
            <p className="text-lg font-medium text-gray-900">
              {currentQuestion.questionText}
              {currentQuestion.isRequired && <span className="text-red-500 ml-1">*</span>}
            </p>
          </div>

          {/* Multiple Choice */}
          {currentQuestion.questionType === 'MULTIPLE_CHOICE' && (
            <div className="space-y-3">
              {currentQuestion.options.map((option) => {
                const isSelected = answers[currentQuestion.id]?.selectedOptionIds?.includes(option.id)
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleOptionChange(currentQuestion.id, option.id, false)}
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
              {currentQuestion.options.map((option) => {
                const isSelected = answers[currentQuestion.id]?.selectedOptionIds?.includes(option.id)
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleOptionChange(currentQuestion.id, option.id, true)}
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
                      onClick={() => handleLikertChange(currentQuestion.id, value)}
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
            <div>
              <input
                type="text"
                value={answers[currentQuestion.id]?.textResponse || ''}
                onChange={(e) => handleTextChange(currentQuestion.id, e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Type your answer here..."
                maxLength={currentQuestion.maxLength || undefined}
              />
              {(currentQuestion.minLength || currentQuestion.maxLength) && (
                <p className="text-xs text-gray-500 mt-2">
                  {currentQuestion.minLength && `Min: ${currentQuestion.minLength} characters`}
                  {currentQuestion.minLength && currentQuestion.maxLength && ' • '}
                  {currentQuestion.maxLength && `Max: ${currentQuestion.maxLength} characters`}
                  {' • '}
                  Current: {(answers[currentQuestion.id]?.textResponse || '').length} characters
                </p>
              )}
            </div>
          )}

          {/* Long Text */}
          {currentQuestion.questionType === 'TEXT_LONG' && (
            <div>
              <textarea
                value={answers[currentQuestion.id]?.textResponse || ''}
                onChange={(e) => handleTextChange(currentQuestion.id, e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[150px]"
                placeholder="Type your answer here..."
                maxLength={currentQuestion.maxLength || undefined}
              />
              {(currentQuestion.minLength || currentQuestion.maxLength) && (
                <p className="text-xs text-gray-500 mt-2">
                  {currentQuestion.minLength && `Min: ${currentQuestion.minLength} characters`}
                  {currentQuestion.minLength && currentQuestion.maxLength && ' • '}
                  {currentQuestion.maxLength && `Max: ${currentQuestion.maxLength} characters`}
                  {' • '}
                  Current: {(answers[currentQuestion.id]?.textResponse || '').length} characters
                </p>
              )}
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
                  <Send className="w-5 h-5" />
                  Submit
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
      )}
    </div>
  )
}
