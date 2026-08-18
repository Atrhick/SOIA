import Link from 'next/link'
import { AlertCircle, ArrowRight, type LucideIcon } from 'lucide-react'

export interface AttentionItem {
  count: number
  label: string
  href: string
  icon?: LucideIcon
  /** Amber for time-sensitive things, grey for tidy-up work. */
  urgent?: boolean
}

/**
 * The first thing a coach sees. Renders nothing at all when there is nothing
 * to do, so an empty state is never dressed up as work.
 *
 * Every row is a link that lands somewhere the item can actually be actioned.
 */
export function NeedsAttention({ items }: { items: AttentionItem[] }) {
  const live = items.filter((i) => i.count > 0)
  if (live.length === 0) return null

  const total = live.reduce((sum, i) => sum + i.count, 0)

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertCircle className="h-5 w-5 text-amber-600" />
        <h2 className="font-semibold text-amber-900">
          {total} thing{total === 1 ? '' : 's'} need your attention
        </h2>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {live.map((item) => {
          const Icon = item.icon
          return (
            <li key={item.label}>
              <Link
                href={item.href}
                className="flex items-center gap-3 rounded-md bg-white border border-amber-200 px-3 py-2.5 hover:border-amber-400 transition-colors"
              >
                <span
                  className={
                    item.urgent
                      ? 'text-lg font-bold text-amber-700 tabular-nums min-w-[2ch]'
                      : 'text-lg font-bold text-gray-700 tabular-nums min-w-[2ch]'
                  }
                >
                  {item.count}
                </span>
                {Icon && <Icon className="h-4 w-4 text-gray-400 shrink-0" />}
                <span className="text-sm text-gray-800 flex-1">{item.label}</span>
                <ArrowRight className="h-4 w-4 text-gray-300 shrink-0" />
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * Progress against a target. Shows the raw count with no bar when no target
 * has been set, rather than implying a target of zero.
 */
export function TargetBar({
  label,
  actual,
  target,
  unit,
}: {
  label: string
  actual: number
  target: number
  unit?: string | null
}) {
  const hasTarget = target > 0
  const pct = hasTarget ? Math.min(100, Math.round((actual / target) * 100)) : 0
  const met = hasTarget && actual >= target

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm text-gray-600">{label}</p>
        <p className="text-sm font-medium text-gray-900 tabular-nums">
          {hasTarget ? `${actual} / ${target}` : actual}
          {unit ? <span className="text-gray-400 font-normal"> {unit}</span> : null}
        </p>
      </div>
      {hasTarget ? (
        <div className="mt-1.5 h-2 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={met ? 'h-full bg-green-500' : 'h-full bg-primary-500'}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : (
        <p className="text-xs text-gray-400 mt-1">No monthly target set</p>
      )}
    </div>
  )
}
