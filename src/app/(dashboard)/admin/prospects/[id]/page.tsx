import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getProspect } from '@/lib/actions/prospects'
import { ProspectDetailClient } from './prospect-detail-client'

export default async function ProspectDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  const result = await getProspect(params.id)

  if (result.error || !result.prospect) {
    notFound()
  }

  return <ProspectDetailClient prospect={result.prospect} />
}
