import { notFound } from 'next/navigation'
import { getLeadQualificationData } from '@/lib/actions/program-pages'
import { QualificationClient } from './qualification-client'

export const metadata = {
  title: 'Your meeting details | NowTransformed',
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

  return <QualificationClient token={params.token} data={result.data} />
}
