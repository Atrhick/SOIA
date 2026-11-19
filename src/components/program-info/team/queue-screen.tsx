/**
 * Team queue screen (server): the list, and on wide screens the selected page beside it.
 * Used by /admin/program-pages (selects the first page of the chosen chip on wide screens) and
 * /admin/program-pages/[id] (the page; the list shows beside it from lg up).
 */
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getProgramPagesQueue, getTeamPageDetail } from '@/lib/actions/program-info'
import { TEAM_QUEUE_PATH, pageFramePath } from '@/lib/program-info/paths'
import { QueueList } from './queue-list'
import { TeamPageDetail } from './team-page-detail'
import { ResponsiveOfferPreview } from '@/components/program-info/offer-preview'
import { BUCKET_PARAM, bucketFromParam, defaultBucket } from './format'

function Fail({ text }: { text: string }) {
  return <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-base text-red-800">{text}</p>
}

async function DetailWithPreview({ id }: { id: string }) {
  const r = await getTeamPageDetail(id)
  if (!r.ok) return <Fail text={r.error} />
  const d = r.detail
  const working = d.versions.find((v) => v.status === 'DRAFT') ?? d.versions.find((v) => v.status === 'SENT') ?? null
  const offerPage = working?.offerPage ?? d.current.offerPage ?? null
  const preview = offerPage ? (
    <div className="overflow-hidden rounded-xl border border-gray-300">
      <p className="m-0 border-b border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-700">Preview. The sign-up form is switched off.</p>
      <div className="max-h-[560px] overflow-y-auto lg:max-h-none lg:overflow-visible">
        <ResponsiveOfferPreview offerPage={offerPage} page={d} frameSrc={pageFramePath(d.id, working?.number)} title={`Preview of the ${d.pageName} at computer width`} maxHeight={560} />
      </div>
    </div>
  ) : null
  // key: a fresh client state (edit boxes) when the selected page changes
  return <TeamPageDetail key={d.id} detail={d} preview={preview} />
}

export async function QueueScreen({ show: showParam, selectedId, pageView }: {
  show: string | string[] | undefined
  /** The page shown; on the queue route null = first page of the chip (wide screens only). */
  selectedId: string | null
  /** True on /admin/program-pages/[id]: the page shows on phones too, the list only on wide screens. */
  pageView: boolean
}) {
  const q = await getProgramPagesQueue()
  if (!q.ok) return <Fail text={q.error} />
  const { items, counts } = q.queue
  const show = bucketFromParam(showParam) ?? (pageView && selectedId ? items.find((i) => i.id === selectedId)?.bucket : null) ?? defaultBucket(counts)
  const auto = !pageView ? items.find((i) => i.bucket === show)?.id ?? null : null
  const shownId = pageView ? selectedId : auto

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-5">
      <div className={pageView ? 'hidden lg:block' : ''}>
        <h1 className="m-0 text-2xl font-extrabold text-gray-900 sm:text-[26px]">Program pages</h1>
        <p className="m-0 mt-1.5 text-base text-gray-700">Sorted by who needs to act next, longest waiting first.</p>
      </div>
      {pageView && (
        <Link href={`${TEAM_QUEUE_PATH}?show=${BUCKET_PARAM[show]}`} className="inline-flex min-h-[44px] items-center gap-1.5 self-start rounded-lg px-1 text-base font-semibold text-primary-700 hover:underline lg:hidden">
          <ArrowLeft className="h-5 w-5" aria-hidden /> Back to the queue
        </Link>
      )}
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(320px,2fr)_3fr] lg:items-start">
        <div className={pageView ? 'hidden lg:block' : ''}>
          <QueueList items={items} counts={counts} show={show} selectedId={shownId} />
        </div>
        {shownId ? (
          <div className={pageView ? '' : 'hidden lg:block'}>
            <DetailWithPreview id={shownId} />
          </div>
        ) : (
          !pageView && <p className="hidden rounded-2xl border border-dashed border-gray-300 p-6 text-base text-gray-600 lg:block">Pick a page to see it here.</p>
        )}
      </div>
    </div>
  )
}
