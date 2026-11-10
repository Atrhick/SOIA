'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, Video } from 'lucide-react'
import { staffCancelCall } from '@/lib/actions/discovery-admin'

export interface CallRow {
  id: string; prospectId: string; name: string; email: string; phone: string | null; age: string; minor: boolean
  parent: string | null; inviter: string | null; host: string | null; startsAt: string; status: string; meetingUrl: string | null; notes: string | null
}

const when = (iso: string) => new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago', timeZoneName: 'short' }).format(new Date(iso))
const STATUS: Record<string, string> = { BOOKED: 'bg-sky-100 text-sky-800', KEPT: 'bg-green-100 text-green-800', NO_SHOW: 'bg-red-100 text-red-800', CANCELLED: 'bg-gray-100 text-gray-700' }
const LABEL: Record<string, string> = { BOOKED: 'Booked', KEPT: 'Kept', NO_SHOW: 'No-show', CANCELLED: 'Cancelled' }

export function CallsClient({ rows, now, mine, isHost }: { rows: CallRow[]; now: string; mine: boolean; isHost: boolean }) {
  const t = new Date(now).getTime()
  const needs = rows.filter((r) => r.status === 'BOOKED' && new Date(r.startsAt).getTime() <= t)
  const upcoming = rows.filter((r) => r.status === 'BOOKED' && new Date(r.startsAt).getTime() > t)
  const past = rows.filter((r) => r.status !== 'BOOKED').reverse()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/admin/discovery-calls" aria-current={mine ? 'true' : undefined} className={`h-9 px-4 rounded-full text-sm font-semibold border inline-flex items-center ${mine ? 'bg-primary-700 border-primary-700 text-white' : 'border-gray-300 text-gray-700'}`}>My calls</Link>
        <Link href="/admin/discovery-calls?who=all" aria-current={!mine ? 'true' : undefined} className={`h-9 px-4 rounded-full text-sm font-semibold border inline-flex items-center ${!mine ? 'bg-primary-700 border-primary-700 text-white' : 'border-gray-300 text-gray-700'}`}>Everyone</Link>
        {mine && !isHost && <span className="text-sm text-gray-600">You&apos;re not set up as a host yet. See the Hosts tab.</span>}
      </div>

      <section className={`bg-white border rounded-xl p-5 ${needs.length ? 'border-orange-300' : 'border-gray-200'}`}>
        <h2 className="font-bold text-gray-900">Needs an outcome ({needs.length})</h2>
        {needs.length === 0 ? <p className="text-sm text-gray-600 mt-2">Nothing waiting. After each call, record what happened here.</p> : (
          <ul className="mt-3 space-y-3">{needs.map((r) => <OutcomeCard key={r.id} r={r} />)}</ul>
        )}
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-bold text-gray-900">Upcoming ({upcoming.length})</h2>
        {upcoming.length === 0 ? <p className="text-sm text-gray-600 mt-2">No upcoming calls.</p> : (
          <ul className="mt-3 divide-y divide-gray-100">{upcoming.map((r) => <UpcomingRow key={r.id} r={r} />)}</ul>
        )}
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-bold text-gray-900">Last 30 days</h2>
        {past.length === 0 ? <p className="text-sm text-gray-600 mt-2">No finished calls yet.</p> : (
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-600"><th className="py-2 pr-3 font-semibold">When</th><th className="py-2 pr-3 font-semibold">Prospect</th><th className="py-2 pr-3 font-semibold">Age</th><th className="py-2 pr-3 font-semibold">Host</th><th className="py-2 pr-3 font-semibold">Result</th></tr></thead>
              <tbody>{past.map((r) => (
                <tr key={r.id} className="border-t border-gray-100"><td className="py-2.5 pr-3 whitespace-nowrap">{when(r.startsAt)}</td><td className="py-2.5 pr-3"><Link className="font-semibold text-primary-700 hover:underline" href={`/admin/discovery-calls/${r.id}`}>{r.name}</Link></td><td className="py-2.5 pr-3 whitespace-nowrap">{r.age}</td><td className="py-2.5 pr-3 whitespace-nowrap">{r.host ?? '–'}</td><td className="py-2.5 pr-3"><span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${STATUS[r.status]}`}>{LABEL[r.status]}</span></td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function Who({ r }: { r: CallRow }) {
  return (
    <div className="min-w-0">
      <p className="font-semibold text-gray-900"><Link href={`/admin/discovery-calls/${r.id}`} className="hover:underline">{r.name}</Link>{r.minor && <span className="ml-2 text-xs font-semibold rounded-full px-2 py-0.5 bg-orange-100 text-orange-800">Parent required</span>}</p>
      <p className="text-xs text-gray-600">{when(r.startsAt)} · {r.age}{r.host ? ` · Host ${r.host}` : ''}{r.inviter ? ` · Invited by ${r.inviter}` : ''}</p>
      {r.parent && <p className="text-xs text-orange-800">Parent: {r.parent}</p>}
    </div>
  )
}

function UpcomingRow({ r }: { r: CallRow }) {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  return (
    <li className="py-3 flex flex-wrap items-center gap-3 justify-between">
      <Who r={r} />
      <div className="flex flex-wrap items-center gap-2">
        {r.meetingUrl && <a href={r.meetingUrl} target="_blank" rel="noreferrer" className="h-9 px-3 rounded-lg border border-gray-300 text-sm font-semibold inline-flex items-center gap-1.5"><Video className="h-4 w-4" aria-hidden />Join</a>}
        {!confirm ? <button onClick={() => setConfirm(true)} className="h-9 px-3 rounded-lg border border-red-300 text-red-700 text-sm font-semibold">Cancel call</button> : (
          <button disabled={busy} onClick={async () => { setBusy(true); const x = await staffCancelCall(r.id, {}); setBusy(false); if ('error' in x) setErr(x.error); else router.refresh() }} className="h-9 px-3 rounded-lg bg-red-700 text-white text-sm font-semibold inline-flex items-center gap-1.5">{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Yes, cancel and email them</button>
        )}
      </div>
      {err && <p role="alert" className="w-full text-sm text-red-700">{err}</p>}
    </li>
  )
}

function OutcomeCard({ r }: { r: CallRow }) {
  return (
    <li className="rounded-xl border border-gray-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Who r={r} />
        <Link href={`/admin/discovery-calls/${r.id}`} className="h-10 px-4 rounded-lg bg-primary-700 hover:bg-primary-800 text-white text-sm font-semibold inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2">Record outcome<span className="sr-only"> for {r.name}</span></Link>
      </div>
    </li>
  )
}
