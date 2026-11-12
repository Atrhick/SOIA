import type { ProgramStats } from '@/lib/get-involved/outreach-stats'
import { channelLabel } from '@/lib/get-involved/outreach-stats'

const card = 'bg-white border border-gray-200 rounded-xl p-5 min-w-0'
const th = 'py-2 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 whitespace-nowrap'
const td = 'py-2.5 pr-4 text-sm text-gray-900'

/** "Whole program" funnel and "By channel" table on /admin/one-a-day. Server component. */
export function ProgramFunnel({ stats, periodLabel }: { stats: ProgramStats; periodLabel: string }) {
  const f = stats.funnel
  const tiles: [string, string | number][] = [
    ['Members active', `${stats.active} of ${stats.members}`],
    ['Messages sent', f.sent],
    ['Forms filled', f.forms],
    ['Calls booked', f.booked],
    ['Calls attended', f.attended],
    ['Joined', f.joined],
  ]
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section aria-labelledby="program-h" className={card}>
        <h2 id="program-h" className="font-bold text-gray-900">Whole program, {periodLabel}</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
          {tiles.map(([label, v]) => (
            <div key={label} className="rounded-lg bg-gray-50 px-3 py-2.5 min-w-0 flex flex-col-reverse">
              <dt className="text-sm text-gray-600 break-words">{label}</dt>
              <dd className="text-2xl font-bold text-gray-900">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-gray-900 mt-3">
          {stats.drop
            ? <>Biggest drop {periodLabel}: <strong>{stats.drop.from} → {stats.drop.to}</strong> ({stats.drop.pct}% didn&apos;t go on).</>
            : 'Not enough activity yet to show where people drop off.'}
        </p>
        <p className="text-xs text-gray-600 mt-2">Members active = coaches and ambassadors with at least one message or form. Calls booked, attended and joined follow the people who filled a form in this period.</p>
      </section>

      <section aria-labelledby="bychannel-h" className={card}>
        <h2 id="bychannel-h" className="font-bold text-gray-900 mb-3">By channel</h2>
        {stats.channels.length === 0 ? <p className="text-sm text-gray-600">No messages or forms in this period.</p> : (
          <div className="overflow-x-auto">
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
        <p className="text-xs text-gray-600 mt-2">Channel comes from the share link the person used. &quot;Unknown / before tracking&quot; = forms from links without a channel, or from before it was tracked.</p>
      </section>
    </div>
  )
}
