'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, Search, Video } from 'lucide-react'
import { ClientPager, usePaged } from '@/components/ui/client-pager'
import { staffCancelCall } from '@/lib/actions/discovery-admin'
import { AGE_RANGES } from '@/lib/get-involved/core'
import { callStats } from '@/lib/get-involved/call-tools'
import { MoveCall } from './move-call'

const ring = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2'

export interface CallRow {
  id: string; prospectId: string; name: string; email: string; phone: string | null; age: string; ageRange: string | null; minor: boolean
  parent: string | null; inviter: string | null; host: string | null; startsAt: string; status: string; meetingUrl: string | null; notes: string | null
}

/** Where links point, which zone times are shown in, and whether admin-only controls show. */
export interface CallsView { base: string; tz: string; admin: boolean }
const whenIn = (iso: string, tz: string) => new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: tz, timeZoneName: 'short' }).format(new Date(iso))
const STATUS: Record<string, string> = { BOOKED: 'bg-sky-100 text-sky-800', KEPT: 'bg-green-100 text-green-800', NO_SHOW: 'bg-red-100 text-red-800', CANCELLED: 'bg-gray-100 text-gray-700' }
const LABEL: Record<string, string> = { BOOKED: 'Booked', KEPT: 'Kept', NO_SHOW: 'No-show', CANCELLED: 'Cancelled' }

export function CallsClient({ rows: allRows, now, mine, isHost, view }: { rows: CallRow[]; now: string; mine: boolean; isHost: boolean; view: CallsView }) {
  const when = (iso: string) => whenIn(iso, view.tz)
  const [age, setAge] = useState('')
  const [q, setQ] = useState('')
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    return allRows.filter((r) => (!age || r.ageRange === age) && (!t || r.name.toLowerCase().includes(t) || (r.email ?? '').toLowerCase().includes(t) || (r.host ?? '').toLowerCase().includes(t) || (r.inviter ?? '').toLowerCase().includes(t)))
  }, [allRows, age, q])
  const t = new Date(now).getTime()
  const needs = rows.filter((r) => r.status === 'BOOKED' && new Date(r.startsAt).getTime() <= t)
  const upcoming = rows.filter((r) => r.status === 'BOOKED' && new Date(r.startsAt).getTime() > t)
  const past = rows.filter((r) => r.status !== 'BOOKED').reverse()
  const stats = callStats(rows, new Date(now))
  const key = `${age}|${q}`
  const needsP = usePaged(needs, 10, key)
  const upcomingP = usePaged(upcoming, 20, key)
  const pastP = usePaged(past, 25, key)
  const tiles = [
    { label: 'Today', value: String(stats.today) },
    { label: 'This week', value: String(stats.thisWeek) },
    { label: 'Need an outcome', value: String(stats.needOutcome), warn: stats.needOutcome > 0 },
    { label: 'Show-up rate (30 days)', value: stats.showUpRate === null ? '–' : `${stats.showUpRate}%` },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {view.admin ? <>
          <Link href="/admin/discovery-calls" aria-current={mine ? 'true' : undefined} className={`h-9 px-4 rounded-full text-sm font-semibold border inline-flex items-center ${ring} ${mine ? 'bg-primary-700 border-primary-700 text-white' : 'border-gray-300 text-gray-700'}`}>My calls</Link>
          <Link href="/admin/discovery-calls?who=all" aria-current={!mine ? 'true' : undefined} className={`h-9 px-4 rounded-full text-sm font-semibold border inline-flex items-center ${ring} ${!mine ? 'bg-primary-700 border-primary-700 text-white' : 'border-gray-300 text-gray-700'}`}>Everyone</Link>
          {mine && !isHost && <span className="text-sm text-gray-600">You&apos;re not set up as a host yet. See the Hosts tab.</span>}
          </> : <span className="text-sm text-gray-600">Calls you host. Admins can also see them.</span>}
        </div>
        <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="call-q" className="block text-xs font-semibold text-gray-600 mb-1">Search</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input id="call-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email, host or inviter" className={`h-9 w-60 rounded-lg border border-gray-300 bg-white pl-8 pr-2 text-sm ${ring}`} />
          </div>
        </div>
        <div>
          <label htmlFor="age-filter" className="block text-xs font-semibold text-gray-600 mb-1">Age range</label>
          <select id="age-filter" value={age} onChange={(e) => setAge(e.target.value)} className={`h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm ${ring}`}>
            <option value="">All age ranges</option>
            {AGE_RANGES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </div>
        </div>
      </div>

      <dl className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tiles.map((x) => (
          <div key={x.label} className={`rounded-xl border bg-white p-4 ${x.warn ? 'border-orange-300' : 'border-gray-200'}`}>
            <dt className="text-xs font-semibold text-gray-600">{x.label}</dt>
            <dd className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">{x.value}</dd>
          </div>
        ))}
      </dl>

      <section className={`bg-white border rounded-xl p-5 ${needs.length ? 'border-orange-300' : 'border-gray-200'}`}>
        <h2 className="font-bold text-gray-900">Needs an outcome ({needs.length})</h2>
        {needs.length === 0 ? <p className="text-sm text-gray-600 mt-2">Nothing waiting. After each call, record what happened here.</p> : (
          <><ul className="mt-3 space-y-3">{needsP.slice.map((r) => <OutcomeCard key={r.id} r={r} view={view} />)}</ul><ClientPager paged={needsP} noun="calls" /></>
        )}
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-bold text-gray-900">Upcoming ({upcoming.length})</h2>
        {upcoming.length === 0 ? <p className="text-sm text-gray-600 mt-2">No upcoming calls.</p> : (
          <><ul className="mt-3 divide-y divide-gray-100">{upcomingP.slice.map((r) => <UpcomingRow key={r.id} r={r} view={view} />)}</ul><ClientPager paged={upcomingP} noun="calls" /></>
        )}
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-bold text-gray-900">Last 30 days ({past.length})</h2>
        {past.length === 0 ? <p className="text-sm text-gray-600 mt-2">No finished calls yet.</p> : (
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-600"><th className="py-2 pr-3 font-semibold">When</th><th className="py-2 pr-3 font-semibold">Prospect</th><th className="py-2 pr-3 font-semibold">Age</th><th className="py-2 pr-3 font-semibold">Host</th><th className="py-2 pr-3 font-semibold">Result</th></tr></thead>
              <tbody>{pastP.slice.map((r) => (
                <tr key={r.id} className="border-t border-gray-100"><td className="py-2.5 pr-3 whitespace-nowrap">{when(r.startsAt)}</td><td className="py-2.5 pr-3"><Link className="font-semibold text-primary-700 hover:underline" href={`${view.base}/${r.id}`}>{r.name}</Link></td><td className="py-2.5 pr-3 whitespace-nowrap">{r.age}</td><td className="py-2.5 pr-3 whitespace-nowrap">{r.host ?? '–'}</td><td className="py-2.5 pr-3"><span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${STATUS[r.status]}`}>{LABEL[r.status]}</span></td></tr>
              ))}</tbody>
            </table>
            <ClientPager paged={pastP} noun="calls" />
          </div>
        )}
      </section>
    </div>
  )
}

function Who({ r, view }: { r: CallRow; view: CallsView }) {
  const when = (iso: string) => whenIn(iso, view.tz)
  return (
    <div className="min-w-0">
      <p className="font-semibold text-gray-900"><Link href={`${view.base}/${r.id}`} className="hover:underline">{r.name}</Link>{r.minor && <span className="ml-2 text-xs font-semibold rounded-full px-2 py-0.5 bg-orange-100 text-orange-800">Parent required</span>}</p>
      <p className="text-xs text-gray-600">{when(r.startsAt)} · {r.age}{r.host ? ` · Host ${r.host}` : ''}{r.inviter ? ` · Invited by ${r.inviter}` : ''}</p>
      {r.parent && <p className="text-xs text-orange-800">Parent: {r.parent}</p>}
    </div>
  )
}

function UpcomingRow({ r, view }: { r: CallRow; view: CallsView }) {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  return (
    <li className="py-3 flex flex-wrap items-start gap-3 justify-between">
      <Who r={r} view={view} />
      <div className="flex flex-wrap items-start gap-2">
        {r.meetingUrl && <a href={r.meetingUrl} target="_blank" rel="noreferrer" className={`h-9 px-3 rounded-lg border border-gray-300 text-sm font-semibold inline-flex items-center gap-1.5 ${ring}`}><Video className="h-4 w-4" aria-hidden />Join<span className="sr-only"> {r.name}&apos;s call (opens in a new tab)</span></a>}
        {view.admin && <MoveCall callId={r.id} name={r.name} tz={view.tz} />}
        {!confirm ? <button type="button" onClick={() => setConfirm(true)} className={`h-9 px-3 rounded-lg border border-red-300 bg-white text-red-700 text-sm font-semibold ${ring}`}>Cancel call<span className="sr-only"> for {r.name}</span></button> : (
          <button type="button" disabled={busy} onClick={async () => { setBusy(true); const x = await staffCancelCall(r.id, {}); setBusy(false); if ('error' in x) setErr(x.error); else router.refresh() }} className={`h-9 px-3 rounded-lg bg-red-700 text-white text-sm font-semibold inline-flex items-center gap-1.5 ${ring}`}>{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Yes, cancel and email them</button>
        )}
      </div>
      {err && <p role="alert" className="w-full text-sm text-red-700">{err}</p>}
    </li>
  )
}

function OutcomeCard({ r, view }: { r: CallRow; view: CallsView }) {
  return (
    <li className="rounded-xl border border-gray-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Who r={r} view={view} />
        <Link href={`${view.base}/${r.id}`} className="h-10 px-4 rounded-lg bg-primary-700 hover:bg-primary-800 text-white text-sm font-semibold inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2">Record outcome<span className="sr-only"> for {r.name}</span></Link>
      </div>
    </li>
  )
}
