import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getAllSurveys } from '@/lib/actions/surveys'
import { SurveysAdminClient } from './surveys-admin-client'

export default async function AdminSurveysPage() {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  const { surveys, error } = await getAllSurveys()

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  // Calculate stats
  const quizzes = surveys.filter(s => s.type === 'QUIZ')
  const surveysOnly = surveys.filter(s => s.type === 'SURVEY')
  const totalSubmissions = surveys.reduce((acc, s) => acc + s.submissionCount, 0)

  const stats = {
    totalQuizzes: quizzes.length,
    totalSurveys: surveysOnly.length,
    publishedCount: surveys.filter(s => s.status === 'PUBLISHED').length,
    totalSubmissions,
  }

  return <SurveysAdminClient surveys={surveys} stats={stats} />
}
