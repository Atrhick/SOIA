import { notFound, redirect } from 'next/navigation'
import { getPublicSurvey, getSurveyById } from '@/lib/actions/surveys'
import { auth } from '@/lib/auth'
import { AssessmentClient } from './assessment-client'

export default async function PublicAssessmentPage({
  params,
  searchParams,
}: {
  params: { surveyId: string }
  searchParams: { preview?: string }
}) {
  const isPreview = searchParams.preview === 'true'

  // Preview mode requires admin access
  if (isPreview) {
    const session = await auth()
    if (!session || session.user.role !== 'ADMIN') {
      redirect('/login')
    }

    // Use getSurveyById for preview (works with draft surveys too)
    const result = await getSurveyById(params.surveyId)
    if (result.error || !result.survey) {
      notFound()
    }

    return <AssessmentClient survey={result.survey} isPreview={true} />
  }

  // Normal mode - use public survey endpoint
  const result = await getPublicSurvey(params.surveyId)

  if (result.error || !result.survey) {
    notFound()
  }

  return <AssessmentClient survey={result.survey} isPreview={false} />
}
