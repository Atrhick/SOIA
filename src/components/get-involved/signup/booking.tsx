'use client'

/**
 * Booking UI shared by /discovery/[token] (variant 'manage') and the sign-up page's step 2
 * (variant 'signup'): pick a time (screen 6), you're booked (screen 7), no open times (screen 5b B),
 * and the manage view of an existing call (change or cancel).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarPlus, Check, Globe, Loader2, Video } from 'lucide-react'
import { TimeZoneSelect } from '@/components/get-involved/time-zone-select'
import { askToBeContacted, bookDiscoveryCall, cancelDiscoveryCall, saveHelpWith, type BookedCall } from '@/lib/actions/get-involved'
import { requestSlotHelp } from '@/lib/actions/discovery-requests'
import { googleCalendarUrl, zoneLabel } from './calendar-link'

export type BookView = {
  kind: 'book'
  firstName: string
  minor: boolean
  parentName: string | null
  /** Display name when only one host covers this person's age range. */
  hostLabel: string | null
  slots: string[]
  /** Open "no times" requests, so the buttons show as done after a reload. */
  requested: { notify: boolean; reachOut: boolean }
  call: { startsAt: string; endsAt: string; timezone: string; hostName: string; meetingUrl: string | null; canChange: boolean } | null
  /** Outreach setting, e.g. "1 business day". Empty = no time is promised. */
  replyWithin: string
  /** Text reminders are on and this person asked for them. */
  textReminders: boolean
  programName: string | null
  /** Show "your sponsored seat" in "What happens next". */
  sponsored: boolean
  helpWith: string
}

export const focusRing = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2'
export const btn = `h-12 px-5 rounded-xl bg-primary-700 hover:bg-primary-800 text-white font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60 ${focusRing}`
export const btnOutline = `h-12 px-5 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-900 font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60 ${focusRing}`
const linkBtn = `font-semibold text-primary-700 underline underline-offset-2 hover:text-primary-800 rounded min-h-[44px] inline-flex items-center ${focusRing}`

export function fmt(iso: string, tz: string, o: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en-US', { ...o, timeZone: tz }).format(new Date(iso))
}
const longWhen = (iso: string, tz: string) => `${fmt(iso, tz, { weekday: 'long', month: 'long', day: 'numeric' })} · ${fmt(iso, tz, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}`
const timeRange = (start: string, end: string, tz: string) => `${fmt(start, tz, { hour: 'numeric', minute: '2-digit' })} – ${fmt(end, tz, { hour: 'numeric', minute: '2-digit' })}`
const plus30 = (iso: string) => new Date(new Date(iso).getTime() + 30 * 60_000).toISOString()
const firstWord = (s: string | null | undefined) => (s ?? '').trim().split(' ')[0] || ''

const WEEK_MS = 7 * 86400_000

function useDeviceZone() {
  const [tz, setTz] = useState('America/Chicago')
  useEffect(() => { try { setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago') } catch { /* keep default */ } }, [])
  return [tz, setTz] as const
}

export function Book({ token, v, card, variant = 'manage' }: { token: string; v: BookView; card: string; variant?: 'manage' | 'signup' }) {
  const router = useRouter()
  const [tz, setTz] = useDeviceZone()
  const [mode, setMode] = useState<'view' | 'pick'>(v.call ? 'view' : 'pick')
  const [day, setDay] = useState<string | null>(null)
  const [slot, setSlot] = useState<string | null>(null)
  const [parentOk, setParentOk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [tzOpen, setTzOpen] = useState(false)
  const [done, setDone] = useState<null | { kind: 'booked' | 'moved'; call: BookedCall } | { kind: 'cancelled' }>(null)
  const [nowMs, setNowMs] = useState<number | null>(null)
  useEffect(() => { setNowMs(Date.now()) }, [])

  // The button that was pressed unmounts when the screen changes, so move focus to the new heading.
  const headingRef = useRef<HTMLHeadingElement>(null)
  const first = useRef(true)
  useEffect(() => { if (first.current) { first.current = false; return } headingRef.current?.focus() }, [mode, done])

  // Sign-up: the next 7 days (people who book soon keep the call). If nothing is open that soon, show all.
  const { shown, weekOnly } = useMemo(() => {
    if (variant !== 'signup' || nowMs === null) return { shown: v.slots, weekOnly: false }
    const week = v.slots.filter((s) => new Date(s).getTime() - nowMs < WEEK_MS)
    return week.length > 0 ? { shown: week, weekOnly: true } : { shown: v.slots, weekOnly: false }
  }, [v.slots, variant, nowMs])

  const days = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const s of shown) {
      const key = fmt(s, tz, { year: 'numeric', month: '2-digit', day: '2-digit' })
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(s)
    }
    const today = nowMs === null ? null : fmt(new Date(nowMs).toISOString(), tz, { year: 'numeric', month: '2-digit', day: '2-digit' })
    const tomorrow = nowMs === null ? null : fmt(new Date(nowMs + 86400_000).toISOString(), tz, { year: 'numeric', month: '2-digit', day: '2-digit' })
    return Array.from(map.entries()).map(([key, list]) => ({
      key,
      top: key === today ? 'Today' : key === tomorrow ? 'Tomorrow' : fmt(list[0], tz, { weekday: 'short' }),
      num: fmt(list[0], tz, { day: 'numeric' }),
      full: fmt(list[0], tz, { weekday: 'long', month: 'short', day: 'numeric' }),
      list,
    }))
  }, [shown, tz, nowMs])
  const current = days.find((d) => d.key === day) ?? days[0] ?? null
  const firstParent = firstWord(v.parentName) || 'Your parent'
  const h1 = `text-2xl md:text-3xl font-bold text-gray-900 rounded ${focusRing}`

  async function book() {
    if (!slot) return
    setBusy(true); setError(null)
    const r = await bookDiscoveryCall(token, { startsAt: slot, timezone: tz, parentWillAttend: v.minor ? parentOk : false })
    setBusy(false)
    if ('error' in r) { setError(r.error); if (variant === 'manage') router.refresh(); return }
    setDone({ kind: v.call ? 'moved' : 'booked', call: r.call })
    if (variant === 'manage') router.refresh()
  }

  async function cancel() {
    setBusy(true); setError(null)
    const r = await cancelDiscoveryCall(token, { reason })
    setBusy(false)
    if ('error' in r) { setError(r.error); return }
    setDone({ kind: 'cancelled' })
    setCancelOpen(false)
    router.refresh()
  }

  if (done?.kind === 'cancelled') {
    return (
      <div className={card}>
        <h1 ref={headingRef} tabIndex={-1} className={h1}>Your call is cancelled</h1>
        <p className="text-gray-700">We&apos;ve let the team know. Whenever you&apos;re ready, you can pick a new time here or come back to this link later.</p>
        <button type="button" className={btn} onClick={() => { setDone(null); setSlot(null); setMode('pick') }}>Pick a new time</button>
      </div>
    )
  }
  if (done) {
    return (
      <Booked
        token={token}
        v={v}
        card={card}
        call={done.call}
        moved={done.kind === 'moved'}
        headingRef={headingRef}
        onChange={variant === 'manage' ? () => { setDone(null); setSlot(null); setMode('view') } : null}
      />
    )
  }

  if (mode === 'view' && v.call) {
    const c = v.call
    return (
      <div className={card}>
        <h1 ref={headingRef} tabIndex={-1} className={h1}>Your discovery call</h1>
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="font-bold text-gray-900">{longWhen(c.startsAt, c.timezone)}</p>
          <p className="text-sm text-gray-600 mt-1">
            Discovery call with <strong className="text-gray-900">{c.hostName}</strong> · {Math.round((new Date(c.endsAt).getTime() - new Date(c.startsAt).getTime()) / 60_000)} minutes
            {c.meetingUrl && <> · <a className={`text-primary-700 underline rounded ${focusRing}`} href={c.meetingUrl} target="_blank" rel="noreferrer">Join link<span className="sr-only"> (opens in a new tab)</span></a></>}
          </p>
        </div>
        {v.minor && <p className="rounded-xl border border-orange-300 bg-orange-50 p-3 text-sm text-orange-900"><strong>A parent or guardian must be on this call.</strong> If no parent joins, we&apos;ll kindly reschedule.</p>}
        <CalendarButtons token={token} call={{ startsAt: c.startsAt, endsAt: c.endsAt, hostName: c.hostName, meetingUrl: c.meetingUrl }} minor={v.minor} />
        {c.canChange ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <button type="button" className={btn} onClick={() => { setMode('pick'); setSlot(null) }}>Pick a new time</button>
              <button type="button" className={`h-12 px-5 rounded-xl border border-red-300 bg-white text-red-700 font-semibold hover:bg-red-50 ${focusRing}`} onClick={() => setCancelOpen((o) => !o)} aria-expanded={cancelOpen} aria-controls="cancel-panel">Cancel my call</button>
            </div>
            {cancelOpen && (
              <div id="cancel-panel" className="rounded-xl border border-gray-200 p-4 space-y-3">
                <label htmlFor="why" className="block text-sm font-semibold text-gray-700">Reason (optional, helps us)</label>
                <select id="why" value={reason} onChange={(e) => setReason(e.target.value)} className="w-full h-11 rounded-lg border border-gray-300 px-3 text-base">
                  <option value="">Choose one</option><option>Something came up</option><option>Not interested right now</option><option>Other</option>
                </select>
                <button type="button" className={`h-11 px-5 rounded-xl bg-red-700 hover:bg-red-800 text-white font-semibold inline-flex items-center gap-2 disabled:opacity-60 ${focusRing}`} disabled={busy} onClick={cancel}>{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Yes, cancel the call</button>
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

  const hostFirst = firstWord(v.hostLabel)
  return (
    <div className={card}>
      {variant === 'signup' ? (
        <>
          <p className="flex items-center gap-2 text-sm font-semibold text-green-700" role="status">
            <Check className="h-[18px] w-[18px]" strokeWidth={2.6} aria-hidden />
            Thanks, {v.firstName}. We&apos;ve saved your details.
          </p>
          <div>
            <p className="text-sm text-gray-600">Step 2 of 2</p>
            <h1 ref={headingRef} tabIndex={-1} className={`mt-1 ${h1}`}>Pick a time for your free 15-minute call</h1>
            <p className="mt-2 text-gray-700">A friendly chat with a NowTransformed host about {v.programName ?? 'the ways you can get involved'} and whether it fits you.</p>
          </div>
        </>
      ) : (
        <>
          <h1 ref={headingRef} tabIndex={-1} className={h1}>{v.call ? 'Pick a new time' : `Book your discovery call${hostFirst ? ` with ${hostFirst}` : ''}`}</h1>
          {v.call && <p className="text-sm text-gray-600">Now: <strong className="text-gray-900">{longWhen(v.call.startsAt, tz)}</strong> with {v.call.hostName}</p>}
          <p className="text-gray-700">A free 15-minute video call to learn your goals and show you where you&apos;d fit.</p>
        </>
      )}
      {v.minor && <p className="rounded-xl border border-orange-300 bg-orange-50 p-3 text-sm text-orange-900"><strong>A parent or guardian must be on this call.</strong> Pick a time that works for both of you. {firstParent} gets the invite and reminders too.</p>}

      {days.length === 0 ? (
        v.call
          ? <p className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sky-900">There are no other open times right now. Your current time is still booked.</p>
          : <NoSlots token={token} requested={v.requested} replyWithin={v.replyWithin} />
      ) : (
        <>
          <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-gray-700 min-w-0"><Globe className="h-4 w-4 flex-none" aria-hidden /><span className="truncate">Times in {zoneLabel(tz)}</span></span>
              <button type="button" className={linkBtn} aria-expanded={tzOpen} aria-controls="tz-pick" onClick={() => setTzOpen((o) => !o)}>Change<span className="sr-only"> time zone</span></button>
            </div>
            {tzOpen && (
              <div id="tz-pick" className="pb-2">
                <label htmlFor="tz" className="block text-sm font-semibold text-gray-700 mb-1.5">Your time zone</label>
                <TimeZoneSelect id="tz" value={tz} onChange={(z) => { setTz(z); setSlot(null) }} className="w-full max-w-full h-11 rounded-lg border border-gray-300 px-3" />
              </div>
            )}
          </div>

          <fieldset className="min-w-0">
            <legend className="text-sm font-bold text-gray-900 mb-2">Soonest times first</legend>
            <div className="flex gap-2 overflow-x-auto p-1 -m-1">
              {days.map((d) => {
                const on = current?.key === d.key
                return (
                  <button key={d.key} type="button" aria-pressed={on} aria-label={d.full} onClick={() => { setDay(d.key); setSlot(null) }}
                    className={`flex-none min-w-[4rem] px-2 h-[68px] rounded-xl border flex flex-col items-center justify-center gap-0.5 ${focusRing} ${on ? 'border-2 border-primary-700 bg-primary-50' : 'border-gray-300 bg-white'}`}>
                    <span className={`text-sm ${on ? 'text-primary-800 font-semibold' : 'text-gray-600'}`}>{d.top}</span>
                    <span className="text-lg font-bold text-gray-900">{d.num}</span>
                  </button>
                )
              })}
            </div>
            {weekOnly && <p className="mt-2 text-sm text-gray-600">Showing the next 7 days. People who book soon are much more likely to make the call.</p>}
          </fieldset>

          {current && (
            <fieldset className="min-w-0">
              <legend className="text-sm font-bold text-gray-900 mb-2">{current.full}</legend>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {current.list.map((s) => (
                  <button key={s} type="button" aria-pressed={slot === s} onClick={() => setSlot(s)}
                    className={`h-12 rounded-lg border font-semibold text-base ${focusRing} ${slot === s ? 'border-primary-700 bg-primary-700 text-white' : 'border-primary-700 bg-white text-primary-800 hover:bg-primary-50'}`}>{fmt(s, tz, { hour: 'numeric', minute: '2-digit' })}</button>
                ))}
              </div>
            </fieldset>
          )}

          {slot && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
              <p className="font-bold text-gray-900">{fmt(slot, tz, { weekday: 'short', month: 'short', day: 'numeric' })} · {timeRange(slot, plus30(slot), tz)}</p>
              <p className="text-sm text-gray-700">With {hostFirst ? `${hostFirst}, a NowTransformed host` : 'a NowTransformed host'}, by video.</p>
              {v.minor && (
                <label className="flex gap-2.5 items-start text-sm text-gray-800">
                  <input type="checkbox" checked={parentOk} onChange={(e) => setParentOk(e.target.checked)} className="mt-0.5 h-5 w-5 flex-none accent-primary-700" />
                  {v.parentName ?? 'My parent or guardian'} will be on this call with me.
                </label>
              )}
              {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
              <button type="button" className={`${btn} w-full`} disabled={busy || (v.minor && !parentOk)} onClick={book}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{v.call ? 'Move my call to this time' : 'Book this time'}
              </button>
            </div>
          )}
          {v.call && <button type="button" className={btnOutline} onClick={() => setMode('view')}>Keep my current time</button>}
          {!v.call && <ContactMe token={token} done={v.requested.reachOut} signup={variant === 'signup'} />}
        </>
      )}
    </div>
  )
}

/** "None of these work? Ask us to contact you." */
function ContactMe({ token, done: wasDone, signup }: { token: string; done: boolean; signup: boolean }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(wasDone ? { ok: true, text: 'We have your request. Someone from our team will contact you.' } : null)
  async function ask() {
    setBusy(true); setMsg(null)
    const r = await askToBeContacted(token)
    setBusy(false)
    setMsg('error' in r ? { ok: false, text: r.error } : { ok: true, text: r.message ?? 'Done.' })
  }
  return (
    <div className="text-sm text-gray-700 space-y-1">
      <p>
        None of these work?{' '}
        {msg?.ok ? null : <button type="button" className={linkBtn} onClick={ask} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" aria-hidden />}Ask us to contact you</button>}
        {signup && <> Leave now and we&apos;ll email you this page so you can book later.</>}
      </p>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={msg.ok ? 'text-green-800' : 'text-red-700'}>{msg.text}</p>}
    </div>
  )
}

/** Google Calendar link + .ics download for a booked call. */
function CalendarButtons({ token, call, minor, stacked = false }: { token: string; call: { startsAt: string; endsAt: string; hostName: string; meetingUrl: string | null }; minor: boolean; stacked?: boolean }) {
  const [origin, setOrigin] = useState('')
  useEffect(() => { setOrigin(window.location.origin) }, [])
  const manage = origin ? `${origin}/discovery/${encodeURIComponent(token)}` : ''
  const google = googleCalendarUrl({
    title: `NowTransformed discovery call with ${call.hostName}`,
    startsAt: call.startsAt,
    endsAt: call.endsAt,
    details: [
      `Your free ${Math.round((new Date(call.endsAt).getTime() - new Date(call.startsAt).getTime()) / 60_000)}-minute discovery call with ${call.hostName}.`,
      call.meetingUrl ? `Join: ${call.meetingUrl}` : 'The join link is in your confirmation email.',
      minor ? 'A parent or guardian must be on this call.' : null,
      manage ? `Change or cancel (up to 2 hours before): ${manage}` : null,
    ].filter(Boolean).join('\n'),
    location: call.meetingUrl,
  })
  return (
    <div className={stacked ? 'grid gap-2' : 'flex flex-wrap gap-3'}>
      <a href={google} target="_blank" rel="noreferrer" className={btnOutline}><CalendarPlus className="h-4 w-4" aria-hidden />Google Calendar<span className="sr-only"> (opens in a new tab)</span></a>
      <a href={`/discovery/${encodeURIComponent(token)}/calendar`} download="discovery-call.ics" className={btnOutline}><CalendarPlus className="h-4 w-4" aria-hidden />Apple or Outlook (.ics)</a>
    </div>
  )
}

/** Screen 7: you're booked. */
function Booked({ token, v, card, call, moved, headingRef, onChange }: {
  token: string; v: BookView; card: string; call: BookedCall; moved: boolean
  headingRef: React.RefObject<HTMLHeadingElement | null>; onChange: (() => void) | null
}) {
  const tz = call.timezone
  const [help, setHelp] = useState(v.helpWith)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const parentFirst = firstWord(v.parentName) || 'your parent'
  async function save() {
    setSaving(true); setMsg(null)
    const r = await saveHelpWith(token, help)
    setSaving(false)
    setMsg('error' in r ? { ok: false, text: r.error } : { ok: true, text: r.message ?? 'Saved.' })
  }
  return (
    <div className={card}>
      <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center"><Check className="h-7 w-7 text-green-700" strokeWidth={2.6} aria-hidden /></div>
      <h1 ref={headingRef} tabIndex={-1} className={`text-2xl md:text-3xl font-extrabold text-gray-900 rounded ${focusRing}`}>{moved ? 'Your call has moved' : `You're booked, ${v.firstName}`}</h1>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2">
        <p className="text-xl font-bold text-gray-900">{fmt(call.startsAt, tz, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
        <p className="text-lg text-gray-900">{timeRange(call.startsAt, call.endsAt, tz)} <span className="text-sm text-gray-600">{zoneLabel(tz, new Date(call.startsAt))}</span></p>
        <p className="text-sm text-gray-700"><Video className="inline h-4 w-4 mr-1 -mt-0.5" aria-hidden />Video call with {call.hostName === 'our team' ? 'a NowTransformed host' : `${call.hostName}, a NowTransformed host`}. The link is in your email.</p>
      </div>
      {v.minor && <p className="rounded-xl border border-orange-300 bg-orange-50 p-3 text-sm text-orange-900"><strong>{v.parentName ?? 'Your parent or guardian'} is invited and must be on the call.</strong></p>}

      <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 space-y-3">
        <div>
          <h2 className="font-bold text-gray-900">Put it in your calendar now</h2>
          <p className="text-sm text-gray-700 mt-0.5">People who save the time themselves are far less likely to miss the call.</p>
        </div>
        <CalendarButtons token={token} call={call} minor={v.minor} stacked />
      </div>

      <div className="space-y-2">
        <h2 className="font-bold text-gray-900">What happens next</h2>
        <ol className="list-decimal pl-5 text-sm leading-7 text-gray-700">
          <li>A confirmation email is on its way now{v.minor ? ` to you and ${parentFirst}` : ''}.</li>
          <li>We remind you the day before (and 3 days before, if the call is further off), by email{v.textReminders ? ' and by text' : ''}.</li>
          <li>On the call: what you&apos;d like help with, how {v.programName ? 'the program' : 'NowTransformed'} works{v.sponsored ? ', and whether a sponsored seat is a fit' : ''}.</li>
        </ol>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
        <label htmlFor="help-with" className="block text-sm font-semibold text-gray-900">Optional: what would you most like help with?</label>
        <textarea id="help-with" rows={3} maxLength={1000} value={help} onChange={(e) => { setHelp(e.target.value); setMsg(null) }} aria-describedby="help-with-hint"
          className="w-full rounded-lg border border-gray-400 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="For example: sleeping better, work stress" />
        <p id="help-with-hint" className="text-sm text-gray-600">Your host reads this before the call.</p>
        <button type="button" className={btnOutline} onClick={save} disabled={saving || !help.trim()}>{saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Save</button>
        {msg && <p role={msg.ok ? 'status' : 'alert'} className={`text-sm ${msg.ok ? 'text-green-800' : 'text-red-700'}`}>{msg.text}</p>}
      </div>

      <p className="text-sm text-gray-700">
        Need a different time?{' '}
        {onChange
          ? <button type="button" className={linkBtn} onClick={onChange}>Change or cancel</button>
          : <a className={linkBtn} href={`/discovery/${encodeURIComponent(token)}`}>Change or cancel</a>}
      </p>
    </div>
  )
}

/** Screen 5b B: nothing open. The admins are alerted by the page; here the person can ask for help. */
function NoSlots({ token, requested, replyWithin }: { token: string; requested: { notify: boolean; reachOut: boolean }; replyWithin: string }) {
  const [done, setDone] = useState(requested)
  const [busy, setBusy] = useState<null | 'NOTIFY' | 'REACH_OUT'>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  async function ask(kind: 'NOTIFY' | 'REACH_OUT') {
    setBusy(kind); setMsg(null)
    const r = await requestSlotHelp(token, kind)
    setBusy(null)
    if ('error' in r) { setMsg({ ok: false, text: r.error }); return }
    setDone((d) => (kind === 'NOTIFY' ? { ...d, notify: true } : { ...d, reachOut: true }))
    setMsg({ ok: true, text: r.message })
  }
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <div>
        <h2 className="text-lg font-bold text-gray-900">No call times are open right now</h2>
        <p className="text-sm text-gray-700 mt-1">Our hosts are fully booked. Choose how you&apos;d like us to reach you, and someone will get back to you{replyWithin ? ` within ${replyWithin}` : ''}. You haven&apos;t lost your place.</p>
      </div>
      <div className="grid gap-2">
        <button type="button" className={btn} disabled={busy !== null || done.notify} onClick={() => ask('NOTIFY')}>
          {busy === 'NOTIFY' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{done.notify ? "We'll email you" : 'Email me when times open'}
        </button>
        <button type="button" className={btnOutline} disabled={busy !== null || done.reachOut} onClick={() => ask('REACH_OUT')}>
          {busy === 'REACH_OUT' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{done.reachOut ? 'A host will contact you' : 'Ask a host to contact me'}
        </button>
      </div>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`text-sm ${msg.ok ? 'text-green-800' : 'text-red-700'}`}>{msg.text}</p>}
      <p className="text-sm text-gray-600">Admins are alerted at once, so they can add times.</p>
    </div>
  )
}
