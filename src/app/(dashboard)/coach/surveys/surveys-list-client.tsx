'use client'

import Link from 'next/link'
import {
  FileQuestion,
  ClipboardList,
  CheckCircle,
  Clock,
  RefreshCw,
  XCircle,
  ArrowRight,
} from 'lucide-react'

interface Survey {
  id: string
  title: string
  description: string | null
  type: 'QUIZ' | 'SURVEY'
  isAnonymous: boolean
  passingScore: number | null
  allowRetake: boolean
  closesAt: string | null
  questionCount: number
  submission: {
    id: string
    score: number | null
    passed: boolean | null
    submittedAt: string
  } | null
}

interface SurveysListClientProps {
  surveys: Survey[]
  userRole: 'COACH' | 'AMBASSADOR'
}

export function SurveysListClient({ surveys, userRole }: SurveysListClientProps) {
  const basePath = userRole === 'COACH' ? '/coach' : '/ambassador'

  const quizzes = surveys.filter(s => s.type === 'QUIZ')
  const surveysOnly = surveys.filter(s => s.type === 'SURVEY')
  const completedCount = surveys.filter(s => s.submission).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Surveys & Quizzes</h1>
        <p className="text-gray-600">Complete quizzes and surveys to share your feedback</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileQuestion className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Available</p>
              <p className="text-2xl font-bold">{surveys.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold">{completedCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold">{surveys.length - completedCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quizzes Section */}
      {quizzes.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <FileQuestion className="h-5 w-5 text-blue-600" />
            Quizzes
          </h2>
          <div className="space-y-3">
            {quizzes.map((quiz) => (
              <SurveyCard key={quiz.id} survey={quiz} basePath={basePath} />
            ))}
          </div>
        </div>
      )}

      {/* Surveys Section */}
      {surveysOnly.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-purple-600" />
            Surveys
          </h2>
          <div className="space-y-3">
            {surveysOnly.map((survey) => (
              <SurveyCard key={survey.id} survey={survey} basePath={basePath} />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {surveys.length === 0 && (
        <div className="bg-white rounded-lg border p-8 text-center">
          <ClipboardList className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-medium text-gray-900">No Surveys Available</h3>
          <p className="text-sm text-gray-500 mt-1">
            Check back later for new quizzes and surveys.
          </p>
        </div>
      )}
    </div>
  )
}

function SurveyCard({ survey, basePath }: { survey: Survey; basePath: string }) {
  const hasSubmission = !!survey.submission
  const canRetake = survey.allowRetake && hasSubmission
  const isExpired = survey.closesAt && new Date(survey.closesAt) < new Date()

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium">{survey.title}</h3>
            {survey.isAnonymous && (
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                Anonymous
              </span>
            )}
          </div>
          {survey.description && (
            <p className="text-sm text-gray-500">{survey.description}</p>
          )}
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
            <span>{survey.questionCount} questions</span>
            {survey.type === 'QUIZ' && survey.passingScore && (
              <span>Pass: {survey.passingScore}%</span>
            )}
            {survey.closesAt && (
              <span className={`flex items-center gap-1 ${isExpired ? 'text-red-600' : ''}`}>
                <Clock className="h-3 w-3" />
                {isExpired ? 'Closed' : `Closes: ${new Date(survey.closesAt).toLocaleDateString()}`}
              </span>
            )}
          </div>

          {/* Submission Status */}
          {hasSubmission && (
            <div className="mt-3 p-2 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-4 text-sm">
                {survey.type === 'QUIZ' ? (
                  <>
                    <span className="flex items-center gap-1">
                      {survey.submission!.passed ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                      {survey.submission!.passed ? 'Passed' : 'Not Passed'}
                    </span>
                    <span className="font-medium">
                      Score: {survey.submission!.score?.toFixed(0)}%
                    </span>
                  </>
                ) : (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    Completed
                  </span>
                )}
                <span className="text-gray-500">
                  {new Date(survey.submission!.submittedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="ml-4">
          {!hasSubmission && !isExpired && (
            <Link
              href={`${basePath}/surveys/${survey.id}`}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Start
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
          {canRetake && !isExpired && (
            <Link
              href={`${basePath}/surveys/${survey.id}`}
              className="flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50"
            >
              <RefreshCw className="h-4 w-4" />
              Retake
            </Link>
          )}
          {hasSubmission && !canRetake && (
            <span className="px-4 py-2 bg-gray-100 text-gray-500 rounded-lg inline-block">
              Completed
            </span>
          )}
          {isExpired && !hasSubmission && (
            <span className="px-4 py-2 bg-red-50 text-red-600 rounded-lg inline-block">
              Expired
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
