import { notFound } from 'next/navigation'
import { getLeadQualificationData } from '@/lib/actions/program-pages'
import { JourneyClient } from './journey-client'

export const metadata = {
  title: 'Your program | NowTransformed',
}

export default async function ProgramRegistrationPage({
  params,
}: {
  params: { slug: string; token: string }
}) {
  const result = await getLeadQualificationData(params.slug, params.token)
  if ('error' in result) {
    notFound()
  }

  return <JourneyClient token={params.token} journey={result.journey} lead={result.lead} />
}
