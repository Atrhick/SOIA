import { ChevronRight } from 'lucide-react'
import type { ProgramStats } from '@/lib/get-involved/outreach-stats'
import { channelLabel } from '@/lib/get-involved/outreach-stats'

const th = 'py-2 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 whitespace-nowrap'
const td = 'py-2 pr-4 text-sm text-gray-900'

/** Step-by-step "how is it going" row at the top of /admin/one-a-day. Server component. */
export function ProgramOverview({ stats, periodLabel, activeToday }: { stats: ProgramStats; periodLabel: string; activeToday: number }) {
  const f = stats.funnel
  const steps: { label: string; value: number; hint: string }[] = [
    { label: 'Messages sent', value: f.sent, hint: 'Invites sent from the share kit' },
    { label: 'Forms filled', value: f.forms, hint: 'People who filled out a Get Involved form' },
    { label: 'Calls booked', value: f.booked, hint: 'Of those people, how many booked a call' },
    { label: 'Came to the call', value: f.attended, hint: 'Calls marked as kept' },
    { label: 'Joined', value: f.joined, hint: 'Became a coach or ambassador' },
  ]
  return (
    <section aria-labelledby="overview-h" className="bg-white border border-gray-200 rounded-xl p-5 min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="overview-h" className="text-lg font-bold text-gray-900">How it&apos;s going, {periodLabel}</h2>
        <p className="text-sm text-gray-600">
          <strong className="text-gray-900">{stats.active} of {stats.members}</strong> members have started · <strong className="text-gray-900">{activeToday}</strong> active today
        </p>
      </div>
      <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:items-stretch lg:gap-0">
        {steps.map((s, i) => {
          const prev = i > 0 ? steps[i - 1].value : null
          const pct = prev ? Math.round((s.value / prev) * 100) : null
          return (
            <li key={s.label} className="flex min-w-0 items-center lg:flex-1">
              {i > 0 && (
                <span className="hidden lg:flex w-12 flex-none flex-col items-center text-xs text-gray-500" aria-hidden="true">
                  <ChevronRight className="h-4 w-4" />{pct !== null ? `${Math.min(pct, 100)}%` : ''}
                </span>
              )}
              <div className="w-full rounded-lg bg-gray-50 px-3 py-3" title={s.hint}>
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-sm text-gray-700">{s.label}</p>
                {pct !== null && <p className="text-xs text-gray-500 lg:hidden">{Math.min(pct, 100)}% of the step before</p>}
              </div>
            </li>
          )
        })}
      </ol>
      <p className="mt-3 text-sm text-gray-700">
        {stats.drop
          ? <>Most people stop between <strong>{stats.drop.from}</strong> and <strong>{stats.drop.to}</strong> ({stats.drop.pct}% don&apos;t go on).</>
          : f.sent + f.forms === 0
            ? 'Nothing yet this period. Once members start sending invites, this shows where people drop off.'
            : 'Too few people yet to say where they drop off.'}
      </p>
    </section>
  )
}

/** "Which way of inviting works" table. Server component. */
export function ChannelTable({ stats }: { stats: ProgramStats }) {
  return (
    <section aria-labelledby="bychannel-h" className="bg-white border border-gray-200 rounded-xl p-5 min-w-0">
      <h2 id="bychannel-h" className="font-bold text-gray-900">Which way of inviting works</h2>
      <p className="text-sm text-gray-600 mt-1">Text, WhatsApp, email and so on, from the link each person used.</p>
      {stats.channels.length === 0 ? <p className="text-sm text-gray-600 mt-3">No messages or forms in this period.</p> : (
        <div className="overflow-x-auto mt-3">
          <table className="w-full">
            <caption className="sr-only">Messages sent, forms, calls booked and joined by channel</caption>
            <thead><tr className="border-b border-gray-200">{['Channel', 'Sent', 'Forms', 'Calls', 'Joined'].map((h) => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {stats.channels.map((r) => (
                <tr key={r.channel} className="border-b border-gray-100">
                  <th scope="row" className={`${td} font-semibold text-left`}>{channelLabel(r.channel)}</th>
                  <td className={td}>{r.sent}</td>
                  <td className={td}>{r.forms}</td>
                  <td className={td}>{r.calls}</td>
                  <td className={td}>{r.joined}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-gray-500 mt-2">&quot;Unknown / before tracking&quot; = forms from links without a channel, or from before channels were tracked.</p>
    </section>
  )
}
