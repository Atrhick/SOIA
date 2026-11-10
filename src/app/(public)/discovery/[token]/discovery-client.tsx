'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarCheck, Loader2 } from 'lucide-react'
import { bookDiscoveryCall, cancelDiscoveryCall, requestNewLink } from '@/lib/actions/get-involved'

export type DiscoveryView =
  | { kind: 'expired' }
  | { kind: 'message'; title: string; body: string }
  | {
      kind: 'book'
      firstName: string
      minor: boolean
      parentName: string | null
      hostLabel: string | null
      slots: string[]
      call: { startsAt: string; timezone: string; hostName: string; meetingUrl: string | null; canChange: boolean } | null
    }

const card = 'max-w-2xl mx-auto bg-white border border-gray-200 rounded-2xl p-6 md:p-8 space-y-5'
const btn = 'h-12 px-5 rounded-xl bg-primary-700 hover:bg-primary-800 text-white font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60'
const TZ_CHOICES = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix', 'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu']

function fmt(iso: string, tz: string, o: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en-US', { ...o, timeZone: tz }).format(new Date(iso))
}
const longWhen = (iso: string, tz: string) => `${fmt(iso, tz, { weekday: 'long', month: 'long', day: 'numeric' })} · ${fmt(iso, tz, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}`

export function DiscoveryClient({ token, view }: { token: string; view: DiscoveryView }) {
  if (view.kind === 'expired') return <Expired />
  if (view.kind === 'message') return <div className={card}><h1 className="text-2xl font-bold text-gray-900">{view.title}</h1><p className="text-gray-700">{view.body}</p></div>
  return <Book token={token} v={view} />
}

function Expired() {
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <div className={card}>
      <h1 className="text-2xl font-bold text-gray-900">This link has expired</h1>
      <p className="text-gray-700">For your privacy, links in our emails work for 14 days. Enter your email and we&apos;ll send a fresh one that picks up where you left off.</p>
      {sent ? (
        <p role="status" className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-green-800">If that email is in our system, a new link is on its way.</p>
      ) : (
        <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setError(null); const r = await requestNewLink(new FormData(e.currentTarget)); setBusy(false); if ('error' in r) setError(r.error); else setSent(true) }}>
          <label htmlFor="em" className="block text-sm font-semibold text-gray-700">Email</label>
          <input id="em" name="email" type="email" required placeholder="name@example.com" className="w-full h-11 rounded-lg border border-gray-300 px-3" />
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button className={btn} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Send me a new link</button>
        </form>
      )}
    </div>
  )
}

function Book({ token, v }: { token: string; v: Extract<DiscoveryView, { kind: 'book' }> }) {
  const router = useRouter()
  const [tz, setTz] = useState('America/Chicago')
  useEffect(() => { try { setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago') } catch { /* keep default */ } }, [])
  const [mode, setMode] = useState<'view' | 'pick'>(v.call ? 'view' : 'pick')
  const [day, setDay] = useState<string | null>(null)
  const [slot, setSlot] = useState<string | null>(null)
  const [parentOk, setParentOk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [done, setDone] = useState<null | 'booked' | 'moved' | 'cancelled'>(null)

  const days = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const s of v.slots) {
      const key = fmt(s, tz, { year: 'numeric', month: '2-digit', day: '2-digit' })
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(s)
    }
    return Array.from(map.entries()).map(([key, list]) => ({ key, label: fmt(list[0], tz, { weekday: 'short', month: 'short', day: 'numeric' }), list }))
  }, [v.slots, tz])
  const current = days.find((d) => d.key === day) ?? days[0] ?? null
  const tzOptions = TZ_CHOICES.includes(tz) ? TZ_CHOICES : [tz, ...TZ_CHOICES]
  const firstParent = (v.parentName ?? '').split(' ')[0] || 'Your parent'

  async function book() {
    if (!slot) return
    setBusy(true); setError(null)
    const r = await bookDiscoveryCall(token, { startsAt: slot, timezone: tz, parentWillAttend: v.minor ? parentOk : false })
    setBusy(false)
    if ('error' in r) { setError(r.error); router.refresh(); return }
    setDone(v.call ? 'moved' : 'booked')
    router.refresh()
  }

  async function cancel() {
    setBusy(true); setError(null)
    const r = await cancelDiscoveryCall(token, { reason })
    setBusy(false)
    if ('error' in r) { setError(r.error); return }
    setDone('cancelled')
    router.refresh()
  }

  if (done) {
    return (
      <div className={card} role="status">
        <CalendarCheck className="h-10 w-10 text-green-600" aria-hidden />
        <h1 className="text-2xl font-bold text-gray-900">{done === 'cancelled' ? 'Your call is cancelled' : done === 'moved' ? 'Your call has moved' : `You're booked, ${v.firstName}`}</h1>
        {done !== 'cancelled' && slot && <p className="text-lg font-semibold text-gray-900">{longWhen(slot, tz)}</p>}
        <p className="text-gray-700">{done === 'cancelled' ? "We've let the team know. Whenever you're ready, come back to this link to pick a new time." : `A confirmation is on its way to your email${v.minor ? ` and ${firstParent}'s` : ''}. You can change or cancel from the same link up to 2 hours before.`}</p>
      </div>
    )
  }

  if (mode === 'view' && v.call) {
    const c = v.call
    return (
      <div className={card}>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Your discovery call</h1>
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="font-bold text-gray-900">{longWhen(c.startsAt, c.timezone)}</p>
          <p className="text-sm text-gray-600 mt-1">With {c.hostName} · 30 minutes{c.meetingUrl && <> · <a className="text-primary-700 underline" href={c.meetingUrl} target="_blank" rel="noreferrer">Join link</a></>}</p>
        </div>
        {v.minor && <p className="rounded-xl border border-orange-300 bg-orange-50 p-3 text-sm text-orange-900"><strong>A parent or guardian must be on this call.</strong> If no parent joins, we&apos;ll kindly reschedule.</p>}
        {c.canChange ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <button className={btn} onClick={() => { setMode('pick'); setSlot(null) }}>Pick a new time</button>
              <button className="h-12 px-5 rounded-xl border border-red-300 text-red-700 font-semibold hover:bg-red-50" onClick={() => setCancelOpen((o) => !o)} aria-expanded={cancelOpen}>Cancel my call</button>
            </div>
            {cancelOpen && (
              <div className="rounded-xl border border-gray-200 p-4 space-y-3">
                <label htmlFor="why" className="block text-sm font-semibold text-gray-700">Reason (optional, helps us)</label>
                <select id="why" value={reason} onChange={(e) => setReason(e.target.value)} className="w-full h-11 rounded-lg border border-gray-300 px-3">
                  <option value="">Choose one</option><option>Something came up</option><option>Not interested right now</option><option>Other</option>
                </select>
                <button className="h-11 px-5 rounded-xl bg-red-700 hover:bg-red-800 text-white font-semibold inline-flex items-center gap-2" disabled={busy} onClick={cancel}>{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Yes, cancel the call</button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-700">Your call is less than 2 hours away, so it can&apos;t be changed here. Please reply to your confirmation email if something came up.</p>
        )}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      </div>
    )
  }

  return (
    <div className={card}>
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{v.call ? 'Pick a new time' : `Book your discovery call${v.hostLabel ? ` with ${v.hostLabel.split(' ')[0]}` : ''}`}</h1>
      <p className="text-gray-700">A free 30-minute video call to learn your goals and show you where you&apos;d fit.</p>
      {v.minor && <p className="rounded-xl border border-orange-300 bg-orange-50 p-3 text-sm text-orange-900"><strong>A parent or guardian must be on this call.</strong> Pick a time that works for both of you. {firstParent} gets the invite and reminders too.</p>}

      {days.length === 0 ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sky-900">
          <p className="font-semibold">No open times right now</p>
          <p className="text-sm mt-1">Our team&apos;s calendar is full for the next three weeks. You haven&apos;t lost your place: please check this link again in a few days, or reply to our email and we&apos;ll reach out.</p>
        </div>
      ) : (
        <>
          <div>
            <label htmlFor="tz" className="block text-sm font-semibold text-gray-700 mb-1.5">Your time zone</label>
            <select id="tz" value={tz} onChange={(e) => { setTz(e.target.value); setSlot(null) }} className="w-full sm:w-auto h-11 rounded-lg border border-gray-300 px-3">
              {tzOptions.map((z) => <option key={z} value={z}>{z.replace('_', ' ')}</option>)}
            </select>
          </div>
          <fieldset className="min-w-0">
            <legend className="block text-sm font-semibold text-gray-700 mb-1.5">Day</legend>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {days.map((d) => (
                <button key={d.key} type="button" aria-pressed={current?.key === d.key} onClick={() => { setDay(d.key); setSlot(null) }}
                  className={`flex-none h-12 px-4 rounded-lg border text-sm ${current?.key === d.key ? 'border-2 border-primary-700 bg-primary-100 text-primary-800 font-semibold' : 'border-gray-300 bg-white text-gray-700'}`}>{d.label}</button>
              ))}
            </div>
          </fieldset>
          {current && (
            <fieldset className="min-w-0">
              <legend className="block text-sm font-semibold text-gray-700 mb-1.5">Time</legend>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {current.list.map((s) => (
                  <button key={s} type="button" aria-pressed={slot === s} onClick={() => setSlot(s)}
                    className={`h-11 rounded-lg border text-sm ${slot === s ? 'border-2 border-primary-700 bg-primary-100 text-primary-800 font-semibold' : 'border-gray-300 bg-white text-gray-700'}`}>{fmt(s, tz, { hour: 'numeric', minute: '2-digit' })}</button>
                ))}
              </div>
            </fieldset>
          )}
          {v.minor && (
            <label className="flex gap-2.5 items-start text-sm text-gray-800">
              <input type="checkbox" checked={parentOk} onChange={(e) => setParentOk(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] accent-primary-700" />
              {v.parentName ?? 'My parent or guardian'} will be on this call with me.
            </label>
          )}
          {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <button className={btn} disabled={!slot || busy || (v.minor && !parentOk)} onClick={book}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {slot ? `${v.call ? 'Move my call to' : 'Book'} ${fmt(slot, tz, { weekday: 'short', month: 'short', day: 'numeric' })} at ${fmt(slot, tz, { hour: 'numeric', minute: '2-digit' })}` : 'Pick a time'}
            </button>
            {v.call && <button className="h-12 px-5 rounded-xl border border-gray-300 font-semibold text-gray-800" onClick={() => setMode('view')}>Keep my current time</button>}
          </div>
        </>
      )}
    </div>
  )
}
