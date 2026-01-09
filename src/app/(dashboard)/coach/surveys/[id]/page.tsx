import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getSurveyById } from '@/lib/actions/surveys'
import { SurveyFormClient } from './survey-form-client'

interface PageProps {
  params: { id: string }
}

export default async function TakeSurveyPage({ params }: PageProps) {
  const session = await auth()

  if (!session || session.user.role !== 'COACH') {
    redirect('/login')
  }

  const { survey, error } = await getSurveyById(params.id)

  if (error || !survey) {
    notFound()
  }

  // Filter out isCorrect for non-admin users (already done in getSurveyById)
  return <SurveyFormClient survey={survey} userRole="COACH" />
}
