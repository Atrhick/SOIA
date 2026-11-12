import Link from 'next/link'
import type { MemberResults } from '@/lib/get-involved/outreach-stats'
import { channelLabel } from '@/lib/get-involved/outreach-stats'
import type { StreakDayState } from '@/lib/get-involved/outreach-streak'

/** "My results" for a coach or ambassador (shared by /coach and /ambassador one-a-day/results). Server-rendered, no client code. */

const card = 'bg-white border border-gray-200 rounded-xl p-5 min-w-0'
const th = 'py-2 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 whitespace-nowrap'
const td = 'py-2.5 pr-4 text-sm text-gray-900'
const focus = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2'

const DOT: Record<StreakDayState, { cls: string; label: string }> = {
  sent: { cls: 'bg-primary-700', label: 'sent' },
  free: { cls: 'bg-sky-200', label: 'free miss used' },
  missed: { cls: 'bg-gray-200', label: 'missed' },
  today: { cls: 'bg-white border-2 border-dashed border-gray-300', label: 'today, not done yet' },
}

const dayName = (key: string) =>
  new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${key}T12:00:00Z`))

export function ResultsView({ data, basePath }: { data: MemberResults; basePath: '/coach/one-a-day' | '/ambassador/one-a-day' }) {
  const { streak, funnel, group } = data
  const steps: [string, number][] = [
    ['Messages sent', funnel.sent], ['Said yes', funnel.saidYes], ['Filled the form', funnel.forms],
    ['Booked a call', funnel.booked], ['Came to the call', funnel.attended], ['Joined', funnel.joined],
  ]
  const nothingYet = steps.every(([, v]) => v === 0)

  return (
    <div className="space-y-6">
      <div>
        <nav aria-label="Breadcrumb" className="text-sm mb-1">
          <ol className="flex flex-wrap items-center gap-1.5 text-gray-600">
            <li><Link href={basePath} className={`font-semibold text-primary-700 hover:underline ${focus}`}>One-A-Day</Link></li>
            <li aria-hidden>/</li>
            <li aria-current="page" className="font-semibold text-gray-900">My results</li>
          </ol>
        </nav>
        <h1 className="text-2xl font-bold text-gray-900">My results · {data.monthLabel}</h1>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-labelledby="streak-h" className={card}>
          <h2 id="streak-h" className="font-bold text-gray-900">My streak</h2>
          <p className="text-3xl font-bold text-gray-900 mt-1">{streak.streak} day{streak.streak === 1 ? '' : 's'}</p>
          <p className="text-sm text-gray-600">
            {streak.doneToday ? 'Done for today.' : 'Send one message today to keep it going.'} {streak.freeMissesLeft} free miss{streak.freeMissesLeft === 1 ? '' : 'es'} left this month.
          </p>
          <ol aria-label="The last 14 days" className="flex flex-wrap gap-1.5 mt-4">
            {streak.last14.map((d) => (
              <li key={d.day} className={`w-6 h-6 rounded-md ${DOT[d.state].cls}`} title={`${dayName(d.day)}: ${DOT[d.state].label}`}>
                <span className="sr-only">{dayName(d.day)}: {DOT[d.state].label}</span>
              </li>
            ))}
          </ol>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-gray-600" aria-label="Legend">
            {(['sent', 'free', 'missed'] as const).map((k) => (
              <li key={k} className="inline-flex items-center gap-1.5"><span aria-hidden className={`inline-block w-3 h-3 rounded ${DOT[k].cls}`} />{k === 'sent' ? 'Sent' : k === 'free' ? 'Free miss used' : 'Missed'}</li>
            ))}
          </ul>
          <p className="text-sm text-gray-600 mt-3">A day counts when you send a message from the share kit or someone fills in your form. You get 2 free misses a month, so one busy day doesn&apos;t reset everything.</p>
        </section>

        <section aria-labelledby="funnel-h" className={card}>
          <h2 id="funnel-h" className="font-bold text-gray-900">Where my invites went</h2>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
            {steps.map(([label, v]) => (
              <div key={label} className="rounded-lg bg-gray-50 px-3 py-2.5 min-w-0 flex flex-col-reverse">
                <dt className="text-sm text-gray-600 break-words">{label}</dt>
                <dd className="text-2xl font-bold text-gray-900">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-gray-600 mt-3">
            {nothingYet ? 'Nothing yet this month. Your numbers show up here as you send messages. ' : ''}
            &quot;Said yes&quot; counts when you tap &quot;After a yes&quot; in the share kit. The last three steps follow the people who filled your form this month.
          </p>
        </section>
      </div>

      <section aria-labelledby="channel-h" className={card}>
        <h2 id="channel-h" className="font-bold text-gray-900 mb-3">Which channel works for me</h2>
        {data.channels.length === 0 ? (
          <p className="text-sm text-gray-600">No messages or forms yet this month. Once you send a few, you&apos;ll see which way of reaching people brings you calls.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <caption className="sr-only">Messages sent, forms and calls booked by channel, {data.monthLabel}</caption>
              <thead><tr className="border-b border-gray-200">{['Channel', 'Sent', 'Forms', 'Calls', 'Calls per 10 sent'].map((h) => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead>
              <tbody>
                {data.channels.map((r) => (
                  <tr key={r.channel} className="border-b border-gray-100">
                    <th scope="row" className={`${td} font-semibold text-left`}>{channelLabel(r.channel)}</th>
                    <td className={td}>{r.sent}</td>
                    <td className={td}>{r.forms}</td>
                    <td className={td}>{r.calls}</td>
                    <td className={td}>{r.per10 === null ? '–' : r.per10}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data.takeaway
          ? <p className="text-sm font-semibold text-gray-900 mt-3">{data.takeaway}</p>
          : data.channels.length > 0 && <p className="text-sm text-gray-600 mt-3">Not enough yet to say which channel works best. That needs at least 5 messages and a booked call in one channel.</p>}
      </section>

      <section aria-labelledby="group-h" className={card}>
        <h2 id="group-h" className="font-bold text-gray-900">My group this month</h2>
        {!group ? (
          <p className="text-sm text-gray-600 mt-2">You&apos;re not in a group this month. Admins set new groups of 5 at the start of each month, so you&apos;ll be in next month&apos;s.</p>
        ) : (
          <>
            <p className="text-sm text-gray-600">Group {group.groupNo} · {group.rows.length} members, new groups each month. Only your group sees this.</p>
            <div className="overflow-x-auto mt-3">
              <table className="w-full">
                <caption className="sr-only">My group: streak and calls booked this month</caption>
                <thead><tr className="border-b border-gray-200">{['Member', 'Streak', 'Calls booked'].map((h) => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {group.rows.map((r, i) => (
                    <tr key={i} className={`border-b border-gray-100 ${r.me ? 'bg-sky-50' : ''}`} aria-current={r.me ? 'true' : undefined}>
                      <th scope="row" className={`${td} text-left ${r.me ? 'font-bold text-primary-800' : 'font-semibold'}`}>{r.name}</th>
                      <td className={td}>{r.streak > 0 ? `${r.streak} day${r.streak === 1 ? '' : 's'}` : '–'}</td>
                      <td className={td}>{r.callsBooked}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {group.encouragement && <p className="text-sm font-semibold text-gray-900 mt-3">{group.encouragement}</p>}
          </>
        )}
      </section>
    </div>
  )
}
