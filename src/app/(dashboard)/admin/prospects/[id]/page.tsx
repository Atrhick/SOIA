import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getProspect } from '@/lib/actions/prospects'
import { ProspectDetailClient } from './prospect-detail-client'
import { JourneyRecordClient } from './journey-record-client'
import { loadRecord } from './record-data'

export const dynamic = 'force-dynamic'

export default async function ProspectDetailPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { view?: string }
}) {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  // Get Involved prospects (with a journey token) get the journey record; older coach-pipeline
  // prospects keep the original detail page. ?view=classic shows the original page for anyone.
  if (searchParams.view !== 'classic') {
    const record = await loadRecord(params.id)
    if (record) return <JourneyRecordClient record={record} readOnly={!!session.user.isImpersonating} />
  }

  const result = await getProspect(params.id)

  if (result.error || !result.prospect) {
    notFound()
  }

  return (
    <div className="space-y-4">
      {searchParams.view === 'classic' && (
        <Link href={`/admin/prospects/${params.id}`} className="inline-block text-sm font-semibold text-primary-700 hover:underline">
          Back to the Get Involved record
        </Link>
      )}
      <ProspectDetailClient prospect={result.prospect} />
    </div>
  )
}
