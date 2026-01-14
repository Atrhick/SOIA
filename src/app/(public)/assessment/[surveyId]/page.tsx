import { notFound } from 'next/navigation'
import { getPublicSurvey } from '@/lib/actions/surveys'
import { AssessmentClient } from './assessment-client'

export default async function PublicAssessmentPage({
  params,
}: {
  params: { surveyId: string }
}) {
  const result = await getPublicSurvey(params.surveyId)

  if (result.error || !result.survey) {
    notFound()
  }

  return <AssessmentClient survey={result.survey} />
}
