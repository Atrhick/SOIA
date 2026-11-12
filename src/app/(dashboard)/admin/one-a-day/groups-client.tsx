'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { reshuffleOutreachGroups, sendOutreachCheckIn } from '@/lib/actions/outreach-admin'
import type { AdminGroupsData } from '@/lib/get-involved/outreach-stats'

const focus = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2'
const th = 'py-2 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 whitespace-nowrap'
const td = 'py-2.5 pr-4 text-sm text-gray-900 align-top'

const quiet = (d: number | null) => (d === null ? 'no invites yet' : `no invites in ${d} day${d === 1 ? '' : 's'}`)

/** "Groups of 5" on /admin/one-a-day: activity per group, who needs help (with a check-in email) and next month's reshuffle. */
export function GroupsClient({ data, canAct }: { data: AdminGroupsData; canAct: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [sent, setSent] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)

  async function checkIn(userId: string) {
    setBusy(userId); setError(null); setNotice(null)
    try {
      const r = await sendOutreachCheckIn(userId)
      if ('error' in r) setError(r.error)
      else { setNotice(r.message); setSent((s) => new Set(s).add(userId)) }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  async function reshuffle() {
    setBusy('reshuffle'); setError(null); setNotice(null)
    try {
      const r = await reshuffleOutreachGroups(data.nextMonth)
      if ('error' in r) setError(r.error)
      else { setNotice(r.message); setConfirming(false); router.refresh() }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section aria-labelledby="groups-h" className="bg-white border border-gray-200 rounded-xl p-5 min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="groups-h" className="font-bold text-gray-900">Groups of 5 · {data.monthLabel}</h2>
          <p className="text-sm text-gray-600 mt-1">Members only see their own group. Groups mix experienced and new members.</p>
        </div>
        {canAct && !confirming && (
          <button type="button" onClick={() => { setConfirming(true); setError(null); setNotice(null) }}
            className={`min-h-11 px-4 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-800 hover:border-gray-400 ${focus}`}>
            {data.nextMonthHasGroups ? 'Reshuffle' : 'Set groups'} for {data.nextMonthLabel.split(' ')[0]}
          </button>
        )}
      </div>

      {confirming && (
        <div role="group" aria-labelledby="confirm-h" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p id="confirm-h" className="text-sm text-amber-900">
            {data.nextMonthHasGroups
              ? `Reshuffle ${data.nextMonthLabel}? The groups already set for ${data.nextMonthLabel} are replaced.`
              : `Set the groups for ${data.nextMonthLabel} now?`} Every active coach and ambassador is placed. This month&apos;s groups don&apos;t change.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button type="button" onClick={reshuffle} disabled={busy === 'reshuffle'}
              className={`min-h-11 px-4 rounded-lg bg-primary-700 text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60 ${focus}`}>
              {busy === 'reshuffle' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Yes, {data.nextMonthHasGroups ? 'reshuffle' : 'set groups'}
            </button>
            <button type="button" onClick={() => setConfirming(false)} disabled={busy === 'reshuffle'}
              className={`min-h-11 px-4 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-800 ${focus}`}>Cancel</button>
          </div>
        </div>
      )}

      {error && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="mt-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">{notice}</p>}

      {data.groups.length === 0 ? (
        <p className="text-sm text-gray-600 mt-3">{data.current ? 'No active coaches or ambassadors to group yet.' : `No groups were set for ${data.monthLabel}.`}</p>
      ) : (
        <div className="overflow-x-auto mt-3">
          <table className="w-full">
            <caption className="sr-only">Groups for {data.monthLabel}: active members, calls booked and who needs help</caption>
            <thead><tr className="border-b border-gray-200">{['Group', 'Active', 'Calls booked', data.current ? 'Needs help' : 'Members'].map((h) => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {data.groups.map((g) => {
                const help = g.members.filter((m) => m.needsHelp)
                return (
                  <tr key={g.groupNo} className="border-b border-gray-100">
                    <th scope="row" className={`${td} font-semibold text-left whitespace-nowrap`}>
                      Group {g.groupNo}
                      <span className="block text-xs font-normal text-gray-600 max-w-[16rem]">{g.members.map((m) => m.name).join(', ')}</span>
                    </th>
                    <td className={`${td} whitespace-nowrap`}>{g.active} of {g.members.length}</td>
                    <td className={td}>{g.callsBooked}</td>
                    <td className={td}>
                      {!data.current ? `${g.members.length} members` : help.length === 0 ? 'None' : (
                        <ul className="space-y-2">
                          {help.map((m) => (
                            <li key={m.userId} className="flex flex-wrap items-center gap-2">
                              <span>{m.name} <span className="text-gray-600">({quiet(m.daysQuiet)})</span></span>
                              {canAct && (sent.has(m.userId)
                                ? <span className="text-sm font-semibold text-green-800">Sent</span>
                                : (
                                  <button type="button" onClick={() => checkIn(m.userId)} disabled={busy !== null}
                                    className={`min-h-11 px-3 rounded-lg border border-sky-300 bg-white text-primary-700 text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-60 ${focus}`}>
                                    {busy === m.userId && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Send a check-in<span className="sr-only"> to {m.name}</span>
                                  </button>
                                ))}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {data.current && <p className="text-xs text-gray-600 mt-3">Active = sent a message or had a form filled this month. Needs help = no message or invite in {7} days or more. A check-in is a short friendly email; one per member every 3 days.</p>}
    </section>
  )
}
