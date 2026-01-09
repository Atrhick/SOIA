import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getSurveyById } from '@/lib/actions/surveys'
import { SurveyFormClient } from '../../../coach/surveys/[id]/survey-form-client'

interface PageProps {
  params: { id: string }
}

export default async function TakeSurveyPage({ params }: PageProps) {
  const session = await auth()

  if (!session || session.user.role !== 'AMBASSADOR') {
    redirect('/login')
  }

  const { survey, error } = await getSurveyById(params.id)

  if (error || !survey) {
    notFound()
  }

  return <SurveyFormClient survey={survey} userRole="AMBASSADOR" />
}
