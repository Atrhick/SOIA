'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { submitQuizAnswers } from '@/lib/actions/onboarding'
import { CheckCircle2, XCircle } from 'lucide-react'

interface Question {
  id: string
  questionText: string
  options: {
    id: string
    optionText: string
  }[]
}

interface QuizFormProps {
  courseId: string
  questions: Question[]
}

export function QuizForm({ courseId, questions }: QuizFormProps) {
  const router = useRouter()
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<{ score: number; passed: boolean } | null>(null)

  const handleOptionSelect = (questionId: string, optionId: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionId,
    }))
  }

  const handleSubmit = async () => {
    // Check if all questions are answered
    const unanswered = questions.filter((q) => !answers[q.id])
    if (unanswered.length > 0) {
      alert(`Please answer all questions. ${unanswered.length} question(s) remaining.`)
      return
    }

    setIsLoading(true)
    const response = await submitQuizAnswers(courseId, answers)

    if (response.error) {
      alert(response.error)
    } else if (response.score !== undefined) {
      setResult({ score: response.score, passed: response.passed ?? false })
    }

    setIsLoading(false)
  }

  if (result) {
    return (
      <div className="space-y-6">
        <div className={`p-6 rounded-lg text-center ${
          result.passed ? 'bg-green-50' : 'bg-yellow-50'
        }`}>
          {result.passed ? (
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
          ) : (
            <XCircle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
          )}
          <h2 className="text-2xl font-bold mb-2">
            {result.passed ? 'Congratulations!' : 'Almost There!'}
          </h2>
          <p className="text-lg text-gray-600 mb-2">
            Your Score: <span className="font-bold">{Math.round(result.score)}%</span>
          </p>
          <p className="text-gray-500">
            {result.passed
              ? 'You have successfully passed the assessment.'
              : 'You need at least 80% to pass. Please try again.'}
          </p>
        </div>

        <div className="flex justify-center gap-4">
          {!result.passed && (
            <Button
              onClick={() => {
                setResult(null)
                setAnswers({})
              }}
            >
              Try Again
            </Button>
          )}
          <Button
            variant={result.passed ? 'default' : 'outline'}
            onClick={() => router.push('/coach/onboarding')}
          >
            Back to Onboarding
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {questions.map((question, index) => (
        <div key={question.id} className="space-y-4">
          <div className="flex gap-3">
            <span className="flex-shrink-0 w-8 h-8 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-medium">
              {index + 1}
            </span>
            <p className="font-medium text-gray-900 pt-1">{question.questionText}</p>
          </div>

          <div className="ml-11 space-y-2">
            {question.options.map((option) => (
              <label
                key={option.id}
                className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                  answers[question.id] === option.id
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name={question.id}
                  value={option.id}
                  checked={answers[question.id] === option.id}
                  onChange={() => handleOptionSelect(question.id, option.id)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-gray-700">{option.optionText}</span>
              </label>
            ))}
          </div>
        </div>
      ))}

      <div className="pt-6 border-t">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {Object.keys(answers).length} of {questions.length} questions answered
          </p>
          <Button
            onClick={handleSubmit}
            isLoading={isLoading}
            disabled={Object.keys(answers).length !== questions.length}
          >
            Submit Assessment
          </Button>
        </div>
      </div>
    </div>
  )
}
