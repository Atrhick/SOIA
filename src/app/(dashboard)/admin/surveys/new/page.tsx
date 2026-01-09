import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { SurveyBuilderClient } from './survey-builder-client'

interface PageProps {
  searchParams: Promise<{ type?: string }>
}

export default async function NewSurveyPage({ searchParams }: PageProps) {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  const params = await searchParams
  const initialType = params.type === 'SURVEY' ? 'SURVEY' : 'QUIZ'

  return <SurveyBuilderClient initialType={initialType} />
}
