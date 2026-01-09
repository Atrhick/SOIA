'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Users,
  CheckCircle,
  XCircle,
  TrendingUp,
  Download,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { exportSurveyResultsCSV, getIndividualResponses } from '@/lib/actions/surveys'

interface Survey {
  id: string
  title: string
  type: 'QUIZ' | 'SURVEY'
  isAnonymous: boolean
  scoreMode: 'NO_SCORING' | 'SCORE_ONLY' | 'PASS_FAIL' | null
  passingScore: number | null
}

interface Stats {
  totalSubmissions: number
  roleBreakdown: Record<string, number>
  quizStats: {
    averageScore: number
    passRate: number
    passCount: number
    failCount: number
  } | null
}

interface OptionCount {
  id: string
  text: string
  isCorrect: boolean
  count: number
  percentage: number
}

interface QuestionAnalytic {
  id: string
  questionText: string
  questionType: string
  responseCount: number
  optionCounts?: OptionCount[]
  average?: number
  distribution?: Record<number, number>
  config?: { minLabel: string; maxLabel: string; minValue: number; maxValue: number }
  responses?: { text: string | null; submittedAt: string; userRole: string | null }[]
}

interface IndividualResponse {
  id: string
  userId: string | null
  userRole: string | null
  score: number | null
  passed: boolean | null
  submittedAt: string
  answers: {
    questionId: string
    questionText: string
    questionType: string
    selectedOptions: string[]
    likertValue: number | null
    textResponse: string | null
    isCorrect: boolean | null
  }[]
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface SurveyResultsClientProps {
  survey: Survey
  stats: Stats
  questionAnalytics: QuestionAnalytic[]
  initialResponses: IndividualResponse[]
  pagination?: Pagination
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

export function SurveyResultsClient({
  survey,
  stats,
  questionAnalytics,
  initialResponses,
  pagination,
}: SurveyResultsClientProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'questions' | 'responses'>('overview')
  const [responses, setResponses] = useState(initialResponses)
  const [currentPage, setCurrentPage] = useState(pagination?.page || 1)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [expandedResponse, setExpandedResponse] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const result = await exportSurveyResultsCSV(survey.id)
      if (result.error) {
        alert(result.error)
        return
      }

      // Create CSV content
      const csvContent = [
        result.headers!.join(','),
        ...result.rows!.map(row =>
          row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',')
        ),
      ].join('\n')

      // Download
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = result.filename!
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      alert('Failed to export')
    } finally {
      setIsExporting(false)
    }
  }

  const loadMoreResponses = async () => {
    if (!pagination || currentPage >= pagination.totalPages) return

    setIsLoadingMore(true)
    try {
      const result = await getIndividualResponses(survey.id, currentPage + 1, 20)
      if (result.submissions) {
        setResponses([...responses, ...result.submissions])
        setCurrentPage(currentPage + 1)
      }
    } catch {
      // Ignore
    } finally {
      setIsLoadingMore(false)
    }
  }

  // Prepare data for role breakdown pie chart
  const roleData = Object.entries(stats.roleBreakdown).map(([role, count]) => ({
    name: role === 'COACH' ? 'Coaches' : role === 'AMBASSADOR' ? 'Ambassadors' : role,
    value: count,
  }))

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/admin/surveys/${survey.id}`}>
            <button className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="h-5 w-5" />
            </button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{survey.title} - Results</h1>
            <p className="text-gray-600">
              {stats.totalSubmissions} submission{stats.totalSubmissions !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          onClick={handleExport}
          disabled={isExporting || stats.totalSubmissions === 0}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {isExporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Responses</p>
              <p className="text-2xl font-bold">{stats.totalSubmissions}</p>
            </div>
          </div>
        </div>

        {/* Show score stats only for SCORE_ONLY and PASS_FAIL modes */}
        {survey.type === 'QUIZ' && stats.quizStats && survey.scoreMode !== 'NO_SCORING' && (
          <>
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Average Score</p>
                  <p className="text-2xl font-bold">{stats.quizStats.averageScore.toFixed(1)}%</p>
                </div>
              </div>
            </div>

            {/* Show pass/fail stats only for PASS_FAIL mode */}
            {survey.scoreMode === 'PASS_FAIL' && (
              <>
                <div className="bg-white rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Passed</p>
                      <p className="text-2xl font-bold">{stats.quizStats.passCount}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <XCircle className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Failed</p>
                      <p className="text-2xl font-bold">{stats.quizStats.failCount}</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* Show message for practice mode quizzes */}
        {survey.type === 'QUIZ' && survey.scoreMode === 'NO_SCORING' && (
          <div className="bg-white rounded-lg border p-4 col-span-3">
            <p className="text-sm text-gray-600">Practice Mode</p>
            <p className="text-sm text-gray-500">Scores are not tracked for this quiz.</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3 px-1 font-medium border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('questions')}
            className={`pb-3 px-1 font-medium border-b-2 transition-colors ${
              activeTab === 'questions'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Question Analysis
          </button>
          <button
            onClick={() => setActiveTab('responses')}
            className={`pb-3 px-1 font-medium border-b-2 transition-colors ${
              activeTab === 'responses'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Individual Responses
          </button>
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Role Breakdown */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="font-semibold mb-4">Responses by Role</h3>
            {roleData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={roleData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {roleData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No data available</p>
            )}
          </div>

          {/* Pass/Fail for Quizzes - only show for PASS_FAIL mode */}
          {survey.type === 'QUIZ' && stats.quizStats && survey.scoreMode === 'PASS_FAIL' && (
            <div className="bg-white rounded-lg border p-6">
              <h3 className="font-semibold mb-4">Pass/Fail Distribution</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: 'Passed', value: stats.quizStats.passCount, fill: '#10b981' },
                      { name: 'Failed', value: stats.quizStats.failCount, fill: '#ef4444' },
                    ]}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={60} />
                    <Tooltip />
                    <Bar dataKey="value" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 text-center">
                <p className="text-lg font-semibold">
                  Pass Rate: <span className="text-green-600">{stats.quizStats.passRate.toFixed(1)}%</span>
                </p>
                <p className="text-sm text-gray-500">
                  (Passing score: {survey.passingScore}%)
                </p>
              </div>
            </div>
          )}

          {/* Score Distribution for SCORE_ONLY mode */}
          {survey.type === 'QUIZ' && stats.quizStats && survey.scoreMode === 'SCORE_ONLY' && (
            <div className="bg-white rounded-lg border p-6">
              <h3 className="font-semibold mb-4">Score Statistics</h3>
              <div className="text-center py-8">
                <p className="text-4xl font-bold text-blue-600">{stats.quizStats.averageScore.toFixed(1)}%</p>
                <p className="text-gray-500 mt-2">Average Score</p>
                <p className="text-sm text-gray-400 mt-4">
                  {stats.totalSubmissions} submission{stats.totalSubmissions !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          )}

          {/* Practice Mode info */}
          {survey.type === 'QUIZ' && survey.scoreMode === 'NO_SCORING' && (
            <div className="bg-white rounded-lg border p-6">
              <h3 className="font-semibold mb-4">Practice Mode Quiz</h3>
              <div className="text-center py-8">
                <p className="text-gray-500">
                  This quiz is in practice mode. Scores are not calculated or tracked.
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  Users can take this quiz for learning purposes without being evaluated.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Questions Tab */}
      {activeTab === 'questions' && (
        <div className="space-y-6">
          {questionAnalytics.map((question, index) => (
            <div key={question.id} className="bg-white rounded-lg border p-6">
              <div className="mb-4">
                <p className="text-sm text-gray-500">Question {index + 1}</p>
                <p className="font-medium">{question.questionText}</p>
                <p className="text-sm text-gray-500">{question.responseCount} responses</p>
              </div>

              {/* Multiple Choice / Multiple Select Chart */}
              {question.optionCounts && (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={question.optionCounts.map(opt => ({
                        name: opt.text.length > 30 ? opt.text.substring(0, 30) + '...' : opt.text,
                        count: opt.count,
                        percentage: opt.percentage,
                        fill: opt.isCorrect ? '#10b981' : '#3b82f6',
                      }))}
                      layout="vertical"
                      margin={{ left: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          name === 'count' ? `${value} responses` : `${value.toFixed(1)}%`,
                          name === 'count' ? 'Count' : 'Percentage'
                        ]}
                      />
                      <Bar dataKey="count" name="count" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Likert Scale Chart */}
              {question.distribution && question.config && (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={Object.entries(question.distribution).map(([value, count]) => ({
                        name: value,
                        count,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#8b5cf6" />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex justify-between text-sm text-gray-500 mt-2">
                    <span>{question.config.minLabel}</span>
                    <span>Average: {question.average?.toFixed(2)}</span>
                    <span>{question.config.maxLabel}</span>
                  </div>
                </div>
              )}

              {/* Text Responses */}
              {question.responses && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {question.responses.length > 0 ? (
                    question.responses.map((response, i) => (
                      <div key={i} className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm">{response.text}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {response.userRole} - {new Date(response.submittedAt).toLocaleDateString()}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-4">No text responses</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Responses Tab */}
      {activeTab === 'responses' && (
        <div className="space-y-4">
          {responses.length > 0 ? (
            <>
              {responses.map((response) => (
                <div key={response.id} className="bg-white rounded-lg border">
                  <div
                    className="p-4 cursor-pointer"
                    onClick={() => setExpandedResponse(
                      expandedResponse === response.id ? null : response.id
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="font-medium">
                            {survey.isAnonymous ? 'Anonymous' : response.userId || 'Unknown'}
                          </p>
                          <p className="text-sm text-gray-500">
                            {response.userRole} - {new Date(response.submittedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {/* Show score based on scoreMode */}
                        {survey.type === 'QUIZ' && survey.scoreMode !== 'NO_SCORING' && response.score !== null && (
                          <div className="text-right">
                            <p className="font-medium">{response.score.toFixed(0)}%</p>
                            {survey.scoreMode === 'PASS_FAIL' && (
                              <p className={`text-sm ${response.passed ? 'text-green-600' : 'text-red-600'}`}>
                                {response.passed ? 'Passed' : 'Failed'}
                              </p>
                            )}
                          </div>
                        )}
                        {survey.type === 'QUIZ' && survey.scoreMode === 'NO_SCORING' && (
                          <span className="text-sm text-gray-400">Practice</span>
                        )}
                        {expandedResponse === response.id ? (
                          <ChevronUp className="h-5 w-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>

                  {expandedResponse === response.id && (
                    <div className="border-t p-4 bg-gray-50 space-y-3">
                      {response.answers.map((answer, i) => (
                        <div key={i} className="flex gap-4">
                          <span className="text-sm text-gray-500 w-6">{i + 1}.</span>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{answer.questionText}</p>
                            <div className="mt-1 text-sm">
                              {answer.selectedOptions.length > 0 && (
                                <p className="flex items-center gap-2">
                                  {answer.selectedOptions.join(', ')}
                                  {answer.isCorrect !== null && (
                                    answer.isCorrect ? (
                                      <CheckCircle className="h-4 w-4 text-green-600" />
                                    ) : (
                                      <XCircle className="h-4 w-4 text-red-600" />
                                    )
                                  )}
                                </p>
                              )}
                              {answer.likertValue !== null && (
                                <p>Rating: {answer.likertValue}</p>
                              )}
                              {answer.textResponse && (
                                <p className="text-gray-600">{answer.textResponse}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {pagination && currentPage < pagination.totalPages && (
                <div className="text-center pt-4">
                  <button
                    onClick={loadMoreResponses}
                    disabled={isLoadingMore}
                    className="px-6 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    {isLoadingMore ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-lg border p-8 text-center">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <h3 className="font-medium text-gray-900">No Responses Yet</h3>
              <p className="text-sm text-gray-500 mt-1">
                Responses will appear here once users complete this {survey.type.toLowerCase()}.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
