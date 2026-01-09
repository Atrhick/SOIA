'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Send,
  AlertCircle,
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

  const [answers, setAnswers] = useState<Record<string, {
    selectedOptionIds?: string[]
    likertValue?: number
    textResponse?: string
  }>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<SubmissionResult | null>(null)

  const handleOptionChange = (questionId: string, optionId: string, isMultiple: boolean) => {
    setAnswers(prev => {
      const current = prev[questionId]?.selectedOptionIds || []

      if (isMultiple) {
        // Toggle for multiple select
        const newSelected = current.includes(optionId)
          ? current.filter(id => id !== optionId)
          : [...current, optionId]
        return {
          ...prev,
          [questionId]: { ...prev[questionId], selectedOptionIds: newSelected }
        }
      } else {
        // Single select
        return {
          ...prev,
          [questionId]: { selectedOptionIds: [optionId] }
        }
      }
    })
  }

  const handleLikertChange = (questionId: string, value: number) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: { likertValue: value }
    }))
  }

  const handleTextChange = (questionId: string, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: { textResponse: value }
    }))
  }

  const validateAnswers = (): string | null => {
    for (const question of survey.questions) {
      if (!question.isRequired) continue

      const answer = answers[question.id]

      switch (question.questionType) {
        case 'MULTIPLE_CHOICE':
        case 'MULTIPLE_SELECT':
          if (!answer?.selectedOptionIds?.length) {
            return `Please answer question: "${question.questionText.substring(0, 50)}..."`
          }
          break
        case 'LIKERT_SCALE':
          if (answer?.likertValue === undefined) {
            return `Please answer question: "${question.questionText.substring(0, 50)}..."`
          }
          break
        case 'TEXT_SHORT':
        case 'TEXT_LONG':
          if (!answer?.textResponse?.trim()) {
            return `Please answer question: "${question.questionText.substring(0, 50)}..."`
          }
          if (question.minLength && answer.textResponse.length < question.minLength) {
            return `Answer must be at least ${question.minLength} characters for: "${question.questionText.substring(0, 50)}..."`
          }
          break
      }
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const validationError = validateAnswers()
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSubmitting(true)
    setError('')

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

      {/* Questions Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {survey.questions.map((question, index) => (
          <div key={question.id} className="bg-white rounded-lg border p-6">
            <div className="mb-4">
              <div className="flex items-start gap-2">
                <span className="text-sm font-medium text-gray-500">{index + 1}.</span>
                <div className="flex-1">
                  <p className="font-medium">
                    {question.questionText}
                    {question.isRequired && <span className="text-red-500 ml-1">*</span>}
                  </p>
                </div>
              </div>
            </div>

            {/* Multiple Choice */}
            {question.questionType === 'MULTIPLE_CHOICE' && (
              <div className="space-y-2 ml-6">
                {question.options.map((option) => (
                  <label
                    key={option.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      answers[question.id]?.selectedOptionIds?.includes(option.id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`question-${question.id}`}
                      checked={answers[question.id]?.selectedOptionIds?.includes(option.id) || false}
                      onChange={() => handleOptionChange(question.id, option.id, false)}
                      className="text-blue-600"
                    />
                    <span>{option.optionText}</span>
                  </label>
                ))}
              </div>
            )}

            {/* Multiple Select */}
            {question.questionType === 'MULTIPLE_SELECT' && (
              <div className="space-y-2 ml-6">
                <p className="text-sm text-gray-500 mb-2">Select all that apply</p>
                {question.options.map((option) => (
                  <label
                    key={option.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      answers[question.id]?.selectedOptionIds?.includes(option.id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={answers[question.id]?.selectedOptionIds?.includes(option.id) || false}
                      onChange={() => handleOptionChange(question.id, option.id, true)}
                      className="rounded text-blue-600"
                    />
                    <span>{option.optionText}</span>
                  </label>
                ))}
              </div>
            )}

            {/* Likert Scale */}
            {question.questionType === 'LIKERT_SCALE' && question.likertConfig && (
              <div className="ml-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500">{question.likertConfig.minLabel}</span>
                  <span className="text-sm text-gray-500">{question.likertConfig.maxLabel}</span>
                </div>
                <div className="flex justify-center gap-2">
                  {Array.from({
                    length: question.likertConfig.maxValue - question.likertConfig.minValue + 1
                  }).map((_, i) => {
                    const value = question.likertConfig!.minValue + i
                    const isSelected = answers[question.id]?.likertValue === value
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleLikertChange(question.id, value)}
                        className={`w-12 h-12 rounded-full border-2 text-lg font-medium transition-colors ${
                          isSelected
                            ? 'border-blue-500 bg-blue-500 text-white'
                            : 'border-gray-300 text-gray-600 hover:border-blue-300'
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
              <div className="ml-6">
                <input
                  type="text"
                  value={answers[question.id]?.textResponse || ''}
                  onChange={(e) => handleTextChange(question.id, e.target.value)}
                  className="w-full rounded-lg border p-3"
                  placeholder="Enter your answer..."
                  maxLength={question.maxLength || undefined}
                />
                {(question.minLength || question.maxLength) && (
                  <p className="text-xs text-gray-500 mt-1">
                    {question.minLength && `Min: ${question.minLength} characters`}
                    {question.minLength && question.maxLength && ' • '}
                    {question.maxLength && `Max: ${question.maxLength} characters`}
                    {' • '}
                    Current: {(answers[question.id]?.textResponse || '').length} characters
                  </p>
                )}
              </div>
            )}

            {/* Long Text */}
            {question.questionType === 'TEXT_LONG' && (
              <div className="ml-6">
                <textarea
                  value={answers[question.id]?.textResponse || ''}
                  onChange={(e) => handleTextChange(question.id, e.target.value)}
                  className="w-full rounded-lg border p-3"
                  rows={4}
                  placeholder="Enter your answer..."
                  maxLength={question.maxLength || undefined}
                />
                {(question.minLength || question.maxLength) && (
                  <p className="text-xs text-gray-500 mt-1">
                    {question.minLength && `Min: ${question.minLength} characters`}
                    {question.minLength && question.maxLength && ' • '}
                    {question.maxLength && `Max: ${question.maxLength} characters`}
                    {' • '}
                    Current: {(answers[question.id]?.textResponse || '').length} characters
                  </p>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Link
            href={`${basePath}/surveys`}
            className="px-6 py-3 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </form>
    </div>
  )
}
