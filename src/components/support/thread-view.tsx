import { cn } from '@/lib/utils'
import { fmtWhen } from './status-pill'

export interface ThreadItem { id: string; author: string; body: string; createdAt: string; fromTeam: boolean }

/** The message and its replies, oldest first. Text only; line breaks kept, long words wrap. */
export function ThreadView({ items, teamSide }: { items: ThreadItem[]; teamSide: 'left' | 'right' }) {
  return (
    <ol className="space-y-3">
      {items.map((it) => {
        const right = teamSide === 'right' ? it.fromTeam : !it.fromTeam
        return (
          <li key={it.id} className={cn('flex', right ? 'justify-end' : 'justify-start')}>
            <div className={cn('min-w-0 max-w-[92%] rounded-2xl border px-4 py-3 sm:max-w-[80%]', it.fromTeam ? 'border-sky-200 bg-sky-50' : 'border-gray-200 bg-white')}>
              <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-gray-600">
                <span className="font-semibold text-gray-900">{it.author}</span>
                <span>{fmtWhen(it.createdAt)}</span>
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words text-base text-gray-900">{it.body}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
