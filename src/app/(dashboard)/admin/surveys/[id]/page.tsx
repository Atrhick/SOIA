import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getSurveyById } from '@/lib/actions/surveys'
import { SurveyEditorClient } from './survey-editor-client'

interface PageProps {
  params: { id: string }
}

export default async function SurveyEditorPage({ params }: PageProps) {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  const { survey, error } = await getSurveyById(params.id)

  if (error || !survey) {
    notFound()
  }

  return <SurveyEditorClient survey={survey} />
}
