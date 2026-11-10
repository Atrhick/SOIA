import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getProspect } from '@/lib/actions/prospects'
import { isJourneyProspect } from '@/lib/prospect-pipeline'
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
  // prospects keep the original detail page. ?view=classic shows a Get Involved prospect's
  // older-pipeline data read only: its buttons would skip the journey (the server refuses them too).
  if (searchParams.view !== 'classic') {
    const record = await loadRecord(params.id)
    if (record) return <JourneyRecordClient record={record} readOnly={!!session.user.isImpersonating} />
  }

  const result = await getProspect(params.id)

  if (result.error || !result.prospect) {
    notFound()
  }

  const journey = isJourneyProspect(result.prospect)

  return (
    <div className="space-y-4">
      {journey && (
        <div role="note" className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <p>
            This person is on the Get Involved journey, so this older coach-pipeline page is read only.
            Choose a role, create their login or close them out from their Get Involved record.
          </p>
          <Link
            href={`/admin/prospects/${params.id}`}
            className="mt-1 inline-block font-semibold text-primary-700 hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
          >
            Back to the Get Involved record
          </Link>
        </div>
      )}
      <ProspectDetailClient prospect={result.prospect} readOnly={journey} />
    </div>
  )
}
