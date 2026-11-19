'use client'

/**
 * Team queue (admin /admin/program-pages): filter chips with counts and the list of pages, sorted by
 * who acts next, then longest waiting (the order teamQueue() returns).
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { TEAM_BUCKET_LABELS, type TeamBucket } from '@/lib/program-info/stage'
import { TEAM_QUEUE_PATH, teamPagePath } from '@/lib/program-info/paths'
import type { TeamQueueItem } from '@/lib/program-info/server'
import { BUCKET_PARAM, BUCKET_PILL, CHIPS, waitingText } from './format'

function subLine(i: TeamQueueItem): string {
  const parts: string[] = []
  if (i.changeRequest) parts.push(`“${i.changeRequest.length > 70 ? `${i.changeRequest.slice(0, 69)}…` : i.changeRequest}”`)
  if (i.changeRound > 0) parts.push(`round ${i.changeRound}`)
  if (i.isLive && i.bucket !== 'LIVE') parts.push('Live')
  if (i.changedSinceLiveCount > 0) parts.push(`${i.changedSinceLiveCount} answer${i.changedSinceLiveCount === 1 ? '' : 's'} changed since live`)
  else if (i.changedSinceSentCount > 0) parts.push(`${i.changedSinceSentCount} answer${i.changedSinceSentCount === 1 ? '' : 's'} changed since sent`)
  if (i.openQuestionCount > 0) parts.push(`${i.openQuestionCount} question${i.openQuestionCount === 1 ? '' : 's'} open`)
  if (i.hasNote) parts.push('note from the owner')
  if (i.stage === 'ANSWERING' && !i.isLive) parts.push(`${i.sectionsDone} of ${i.sectionsTotal} sections`)
  if (i.bucket !== 'LIVE') parts.push(waitingText(i.waitingDays))
  return parts.join(' · ')
}

export function QueueList({ items, counts, show, selectedId }: {
  items: TeamQueueItem[]
  counts: Record<TeamBucket, number>
  show: TeamBucket
  selectedId: string | null
}) {
  const router = useRouter()
  const shown = items.filter((i) => i.bucket === show)
  const pick = (b: TeamBucket) => router.push(`${TEAM_QUEUE_PATH}?show=${BUCKET_PARAM[b]}`, { scroll: false })

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
        {CHIPS.map((b) => {
          const on = b === show
          return (
            <button
              key={b}
              type="button"
              aria-pressed={on}
              onClick={() => pick(b)}
              className={`min-h-[44px] rounded-full border px-4 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2 ${
                on ? 'border-primary-700 bg-primary-700 text-white' : b === 'STALLED' && counts.STALLED > 0 ? 'border-red-300 bg-white text-red-800 hover:bg-red-50' : 'border-gray-300 bg-white text-gray-900 hover:bg-gray-50'
              }`}
            >
              {TEAM_BUCKET_LABELS[b]} · {counts[b] ?? 0}
            </button>
          )
        })}
      </div>

      <nav aria-label={`${TEAM_BUCKET_LABELS[show]} pages`} className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        {shown.length === 0 ? (
          <p className="p-4 text-base text-gray-600">Nothing here right now.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {shown.map((i) => {
              const current = i.id === selectedId
              return (
                <li key={i.id}>
                  <Link
                    href={`${teamPagePath(i.id)}?show=${BUCKET_PARAM[show]}`}
                    aria-current={current ? 'page' : undefined}
                    className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-4 py-3.5 text-gray-900 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-600 ${current ? 'bg-primary-50 shadow-[inset_3px_0_0_theme(colors.primary.700)]' : ''}`}
                  >
                    <span className="min-w-0">
                      <span className="block text-[15px] font-bold">
                        {i.hasOwner ? i.ownerName : 'No owner'} · {i.programName}{i.audienceLabel ? ` · ${i.audienceLabel}` : ''}
                      </span>
                      <span className="mt-0.5 block text-sm text-gray-600">{subLine(i)}</span>
                    </span>
                    <span className="flex flex-wrap gap-1.5">
                      {!i.hasOwner && <span className="whitespace-nowrap rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-bold text-gray-800">No owner</span>}
                      <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${BUCKET_PILL[i.bucket]}`}>{i.teamLabel}</span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </nav>
    </div>
  )
}
