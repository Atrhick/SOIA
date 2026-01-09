import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getSurveyResults, getIndividualResponses } from '@/lib/actions/surveys'
import { SurveyResultsClient } from './survey-results-client'

interface PageProps {
  params: { id: string }
}

export default async function SurveyResultsPage({ params }: PageProps) {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  const [resultsData, responsesData] = await Promise.all([
    getSurveyResults(params.id),
    getIndividualResponses(params.id, 1, 20),
  ])

  if (resultsData.error || !resultsData.survey) {
    notFound()
  }

  return (
    <SurveyResultsClient
      survey={resultsData.survey}
      stats={resultsData.stats}
      questionAnalytics={resultsData.questionAnalytics}
      initialResponses={responsesData.submissions || []}
      pagination={responsesData.pagination}
    />
  )
}
