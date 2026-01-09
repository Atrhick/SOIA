'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ClipboardList,
  FileQuestion,
  Plus,
  Trash2,
  Eye,
  BarChart3,
  Users,
  CheckCircle,
  Clock,
  Archive,
  Play,
  Pause,
} from 'lucide-react'
import {
  deleteSurvey,
  updateSurveyStatus,
} from '@/lib/actions/surveys'

interface Survey {
  id: string
  title: string
  description: string | null
  type: 'QUIZ' | 'SURVEY'
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'ARCHIVED'
  allowedRoles: string[]
  isAnonymous: boolean
  passingScore: number | null
  showResults: boolean
  allowRetake: boolean
  publishedAt: string | null
  closesAt: string | null
  createdAt: string
  questionCount: number
  submissionCount: number
}

interface Stats {
  totalQuizzes: number
  totalSurveys: number
  publishedCount: number
  totalSubmissions: number
}

interface SurveysAdminClientProps {
  surveys: Survey[]
  stats: Stats
}

export function SurveysAdminClient({ surveys, stats }: SurveysAdminClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'QUIZ' | 'SURVEY'>('QUIZ')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const filteredSurveys = surveys.filter(s => s.type === activeTab)

  const handleDelete = async (surveyId: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"? This will also delete all questions and submissions.`)) {
      return
    }

    setIsSubmitting(true)
    try {
      const result = await deleteSurvey(surveyId)
      if (result.error) {
        setError(result.error)
      }
    } catch {
      setError('An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleStatusChange = async (surveyId: string, status: 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'ARCHIVED') => {
    try {
      const result = await updateSurveyStatus(surveyId, status)
      if (result.error) {
        setError(result.error)
      }
    } catch {
      setError('An error occurred')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PUBLISHED':
        return <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">Published</span>
      case 'DRAFT':
        return <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium">Draft</span>
      case 'CLOSED':
        return <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">Closed</span>
      case 'ARCHIVED':
        return <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded text-xs font-medium">Archived</span>
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Surveys & Quizzes</h1>
          <p className="text-gray-600">Create and manage quizzes and surveys for coaches and ambassadors</p>
        </div>
        <button
          onClick={() => router.push(`/admin/surveys/new?type=${activeTab}`)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add {activeTab === 'QUIZ' ? 'Quiz' : 'Survey'}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileQuestion className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Quizzes</p>
              <p className="text-2xl font-bold">{stats.totalQuizzes}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <ClipboardList className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Surveys</p>
              <p className="text-2xl font-bold">{stats.totalSurveys}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Published</p>
              <p className="text-2xl font-bold">{stats.publishedCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Users className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Submissions</p>
              <p className="text-2xl font-bold">{stats.totalSubmissions}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('QUIZ')}
            className={`pb-3 px-1 font-medium border-b-2 transition-colors ${
              activeTab === 'QUIZ'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <FileQuestion className="h-4 w-4" />
              Quizzes ({surveys.filter(s => s.type === 'QUIZ').length})
            </div>
          </button>
          <button
            onClick={() => setActiveTab('SURVEY')}
            className={`pb-3 px-1 font-medium border-b-2 transition-colors ${
              activeTab === 'SURVEY'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Surveys ({surveys.filter(s => s.type === 'SURVEY').length})
            </div>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Surveys List */}
      <div className="space-y-4">
        {filteredSurveys.length > 0 ? (
          filteredSurveys.map((survey) => (
            <div key={survey.id} className="bg-white rounded-lg border p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-medium">{survey.title}</h3>
                    {getStatusBadge(survey.status)}
                    {survey.isAnonymous && (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                        Anonymous
                      </span>
                    )}
                  </div>
                  {survey.description && (
                    <p className="text-sm text-gray-500 mt-1">{survey.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                    <span>{survey.questionCount} questions</span>
                    <span>{survey.submissionCount} submissions</span>
                    <span>
                      For: {survey.allowedRoles.map(r => r === 'COACH' ? 'Coaches' : 'Ambassadors').join(', ')}
                    </span>
                    {survey.type === 'QUIZ' && survey.passingScore && (
                      <span>Pass: {survey.passingScore}%</span>
                    )}
                    {survey.closesAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Closes: {new Date(survey.closesAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {survey.status === 'DRAFT' && (
                    <button
                      onClick={() => handleStatusChange(survey.id, 'PUBLISHED')}
                      className="p-2 text-gray-400 hover:text-green-600"
                      title="Publish"
                    >
                      <Play className="h-4 w-4" />
                    </button>
                  )}
                  {survey.status === 'PUBLISHED' && (
                    <button
                      onClick={() => handleStatusChange(survey.id, 'CLOSED')}
                      className="p-2 text-gray-400 hover:text-yellow-600"
                      title="Close"
                    >
                      <Pause className="h-4 w-4" />
                    </button>
                  )}
                  {(survey.status === 'CLOSED' || survey.status === 'DRAFT') && (
                    <button
                      onClick={() => handleStatusChange(survey.id, 'ARCHIVED')}
                      className="p-2 text-gray-400 hover:text-red-600"
                      title="Archive"
                    >
                      <Archive className="h-4 w-4" />
                    </button>
                  )}
                  <Link
                    href={`/admin/surveys/${survey.id}`}
                    className="p-2 text-gray-400 hover:text-blue-600"
                    title="Edit Questions"
                  >
                    <Eye className="h-4 w-4" />
                  </Link>
                  {survey.submissionCount > 0 && (
                    <Link
                      href={`/admin/surveys/${survey.id}/results`}
                      className="p-2 text-gray-400 hover:text-purple-600"
                      title="View Results"
                    >
                      <BarChart3 className="h-4 w-4" />
                    </Link>
                  )}
                  <button
                    onClick={() => handleDelete(survey.id, survey.title)}
                    className="p-2 text-gray-400 hover:text-red-600"
                    title="Delete"
                    disabled={isSubmitting}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white rounded-lg border p-8 text-center">
            {activeTab === 'QUIZ' ? (
              <FileQuestion className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            ) : (
              <ClipboardList className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            )}
            <h3 className="font-medium text-gray-900">
              No {activeTab === 'QUIZ' ? 'Quizzes' : 'Surveys'} Yet
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Create your first {activeTab === 'QUIZ' ? 'quiz' : 'survey'} to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
