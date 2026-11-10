'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BellRing, ExternalLink, Loader2, Play } from 'lucide-react'
import {
  DAY_PARTS, DayPart, QUICK_DAYS, Recording, addDaysYmd, checkRemindChoice, remindInstant, ymdIn,
} from '@/lib/get-involved/orientation-rules'
import { markOrientationWatched, remindOrientationLater } from '@/lib/actions/journey-assessment'
import { primaryBtn, secondaryBtn, stepCard } from '@/components/get-involved/journey-step-frame'
import { JourneyExpired } from '@/components/get-involved/journey-expired'

function fmt(d: Date | string, tz: string, o: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en-US', { ...o, timeZone: tz }).format(new Date(d))
}
const whenLong = (iso: string, tz: string) => `${fmt(iso, tz, { weekday: 'short', month: 'short', day: 'numeric' })} at ${fmt(iso, tz, { hour: 'numeric', minute: '2-digit' })}`

interface Props {
  token: string
  roleLabel: string
  minutes: number | null
  recording: Recording | null
  points: string[]
  checkQuestion: string | null
  /** ISO; set when they already picked a later time that hasn't come yet. */
  remindAt: string | null
  startLater: boolean
  maxDays: number
}

export function OrientationClient(props: Props) {
  const [mode, setMode] = useState<'watch' | 'later'>(props.startLater ? 'later' : 'watch')
  const [remindAt, setRemindAt] = useState(props.remindAt)
  const [expired, setExpired] = useState(false)
  const [tz, setTz] = useState('America/Chicago')
  useEffect(() => { try { setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago') } catch { /* keep default */ } }, [])
  const headingRef = useRef<HTMLHeadingElement>(null)
  const first = useRef(true)
  useEffect(() => { if (first.current) { first.current = false; return } headingRef.current?.focus() }, [mode])

  if (expired) return <JourneyExpired />
  return mode === 'watch'
    ? <Watch {...props} tz={tz} remindAt={remindAt} headingRef={headingRef} onLater={() => setMode('later')} onExpired={() => setExpired(true)} />
    : <Later {...props} tz={tz} remindAt={remindAt} headingRef={headingRef} onSaved={setRemindAt} onWatch={() => setMode('watch')} onExpired={() => setExpired(true)} />
}

type Inner = Props & { tz: string; headingRef: React.RefObject<HTMLHeadingElement | null>; onExpired: () => void }

function Watch({ token, roleLabel, minutes, recording, points, checkQuestion, remindAt, tz, headingRef, onLater, onExpired }: Inner & { onLater: () => void }) {
  const router = useRouter()
  const [answer, setAnswer] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const checkRef = useRef<HTMLTextAreaElement>(null)
  const role = roleLabel.toLowerCase()

  async function done() {
    if (checkQuestion && !answer.trim()) { setFieldError('Please answer this question'); setError('Please answer the question about the recording.'); checkRef.current?.focus(); return }
    setBusy(true); setError(null); setFieldError(null)
    try {
      const r = await markOrientationWatched(token, { checkAnswer: answer })
      if (r.ok) { router.push(r.next); return }
      if (r.expired) { onExpired(); return }
      setError(r.error)
      if (r.fieldErrors?.checkAnswer) { setFieldError(r.fieldErrors.checkAnswer); checkRef.current?.focus() }
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setBusy(false)
  }

  return (
    <div className={`${stepCard} space-y-5`}>
      <div className="space-y-2">
        <span className="inline-block rounded-full bg-sky-100 px-2.5 py-1 text-xs font-bold text-primary-800">{roleLabel} orientation</span>
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl md:text-3xl font-bold text-gray-900 focus:outline-none">What being a {role} looks like</h1>
      </div>

      {remindAt && (
        <p role="status" className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
          <BellRing className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
          <span>We&apos;ll email you a reminder on {whenLong(remindAt, tz)}. You can also watch now.</span>
        </p>
      )}

      <Video recording={recording} roleLabel={roleLabel} minutes={minutes} />

      {points.length > 0 && (
        <div>
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-primary-800">In this video</h2>
          <ul className="mt-2 space-y-1.5 text-gray-700">
            {points.map((pt, i) => (
              <li key={i} className="flex gap-2.5"><span aria-hidden className="mt-2.5 h-1.5 w-1.5 flex-none rounded-full bg-primary-700" /><span>{pt}</span></li>
            ))}
          </ul>
        </div>
      )}

      {checkQuestion && (
        <div className="space-y-1.5">
          <label htmlFor="check" className="block font-semibold text-gray-900">{checkQuestion}</label>
          <p id="check-hint" className="text-sm text-gray-600">A sentence or two is fine. It helps us know the video made sense.</p>
          <textarea id="check" ref={checkRef} rows={3} maxLength={2000} value={answer}
            onChange={(e) => { setAnswer(e.target.value); setFieldError(null) }}
            aria-invalid={!!fieldError} aria-describedby={fieldError ? 'check-hint check-err' : 'check-hint'}
            className={`w-full rounded-xl border px-3 py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 ${fieldError ? 'border-red-500' : 'border-gray-300'}`} />
          {fieldError && <p id="check-err" role="alert" className="text-sm text-red-700">{fieldError}</p>}
        </div>
      )}

      {error && !fieldError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button type="button" className={`${primaryBtn} w-full sm:w-auto`} disabled={busy} onClick={done}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}I&apos;ve watched it: continue
        </button>
        <button type="button" className={`${secondaryBtn} w-full sm:w-auto`} disabled={busy} onClick={onLater}>
          {remindAt ? 'Change my reminder' : 'Remind me later: pick a date'}
        </button>
      </div>
      <p className="text-sm text-gray-600">Not a good time? Pick a day and we&apos;ll save your place and email you the link then.</p>
    </div>
  )
}

function Video({ recording, roleLabel, minutes }: { recording: Recording | null; roleLabel: string; minutes: number | null }) {
  if (recording?.kind === 'embed') {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-primary-950">
        <iframe src={recording.src} title={`${roleLabel} orientation video`} className="absolute inset-0 h-full w-full" loading="lazy"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
      </div>
    )
  }
  const length = minutes ? `${minutes} min` : 'length'
  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-xl bg-primary-900 p-4 text-center text-sky-100">
      {recording?.kind === 'link' ? (
        <>
          <a href={recording.href} target="_blank" rel="noopener noreferrer" aria-label={`Open the ${roleLabel.toLowerCase()} orientation recording in a new tab`}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-primary-900 hover:bg-sky-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-300">
            <Play className="ml-1 h-7 w-7" aria-hidden />
          </a>
          <a href={recording.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm underline focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 rounded">
            Open the recording{minutes ? ` · ${minutes} min` : ''}<ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        </>
      ) : (
        <>
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-primary-900" aria-hidden><Play className="ml-1 h-7 w-7" /></span>
          <span className="text-sm">[Orientation recording · {length}]</span>
        </>
      )}
    </div>
  )
}

function Later({ token, roleLabel, minutes, maxDays, tz, remindAt, headingRef, onSaved, onWatch, onExpired }: Inner & { onSaved: (iso: string) => void; onWatch: () => void }) {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => { setNow(new Date()) }, [])
  const [day, setDay] = useState<string | null>(null)
  const [part, setPart] = useState<DayPart | null>(null)
  const [errors, setErrors] = useState<{ date?: string; part?: string }>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)
  const role = roleLabel.toLowerCase()

  const days = useMemo(() => {
    if (!now) return []
    return Array.from({ length: QUICK_DAYS }, (_, i) => {
      const ymd = addDaysYmd(now, i, tz)
      const noon = remindInstant(ymd, 'AFTERNOON', tz)!
      return { ymd, label: fmt(noon, tz, { weekday: 'short', day: 'numeric' }).replace(/(\d+) (\w+)/, '$2 $1'), long: fmt(noon, tz, { weekday: 'long', month: 'long', day: 'numeric' }) }
    })
  }, [now, tz])
  const today = now ? ymdIn(now, tz) : ''
  const lastDay = now ? addDaysYmd(now, maxDays, tz) : ''
  const pickedOther = !!day && !days.some((d) => d.ymd === day)
  const choice = now && day && part ? checkRemindChoice(day, part, tz, now) : null
  const partPassed = (p: DayPart) => {
    if (!now || !day) return false
    const c = checkRemindChoice(day, p, tz, now)
    return !c.ok && c.field === 'part'
  }

  async function save() {
    const local: { date?: string; part?: string } = {}
    if (!day) local.date = 'Please pick a day'
    if (!part) local.part = 'Please pick a time of day'
    if (choice && !choice.ok) local[choice.field] = choice.error
    if (local.date || local.part) { setErrors(local); setError(local.date ?? local.part ?? null); return }
    setBusy(true); setError(null); setErrors({})
    try {
      const r = await remindOrientationLater(token, { date: day, part, timezone: tz })
      if (r.ok) { setSaved(r.remindAt); onSaved(r.remindAt) }
      else if (r.expired) { onExpired(); return }
      else { setError(r.error); if (r.fieldErrors) setErrors(r.fieldErrors) }
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setBusy(false)
  }

  const chip = (on: boolean, bad: boolean) =>
    `h-12 whitespace-nowrap rounded-xl border px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40 ${on ? 'border-2 border-primary-700 bg-sky-100 font-semibold text-primary-800' : bad ? 'border-red-400 bg-white text-gray-800' : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50'}`

  return (
    <div className={`${stepCard} space-y-5`}>
      <div className="space-y-2">
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl md:text-3xl font-bold text-gray-900 focus:outline-none">Pick a time to watch</h1>
        <p className="text-gray-700">
          {minutes ? `The ${role} orientation recording is about ${minutes} minutes. ` : `The ${role} orientation is a short recording. `}
          Choose when you&apos;ll watch and we&apos;ll send a reminder with the link.
        </p>
        {remindAt && !saved && <p className="text-sm text-gray-600">Your current reminder: {whenLong(remindAt, tz)}. Picking a new time replaces it.</p>}
      </div>

      {!now ? (
        <p className="flex items-center gap-2 text-gray-600" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Loading dates…</p>
      ) : (
        <>
          <fieldset className="min-w-0" aria-describedby={errors.date ? 'day-err' : undefined}>
            <legend className="mb-1.5 text-sm font-semibold text-gray-700">Day</legend>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))]">
              {days.map((d) => (
                <button key={d.ymd} type="button" aria-pressed={day === d.ymd} aria-label={d.long} onClick={() => { setDay(d.ymd); setErrors({}); setError(null); setSaved(null) }}
                  className={chip(day === d.ymd, !!errors.date)}>{d.label}</button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label htmlFor="other-day" className="text-sm text-gray-700">Another day (up to {maxDays} days ahead)</label>
              <input id="other-day" type="date" min={today} max={lastDay} value={pickedOther ? day ?? '' : ''}
                onChange={(e) => { setDay(e.target.value || null); setErrors({}); setError(null); setSaved(null) }}
                className={`h-11 rounded-lg border px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 ${pickedOther ? 'border-2 border-primary-700' : 'border-gray-300'}`} />
            </div>
            {errors.date && <p id="day-err" role="alert" className="mt-1.5 text-sm text-red-700">{errors.date}</p>}
          </fieldset>

          <fieldset className="min-w-0" aria-describedby={errors.part ? 'part-err' : 'part-hint'}>
            <legend className="mb-1.5 text-sm font-semibold text-gray-700">Time</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {DAY_PARTS.map((p) => {
                const passed = partPassed(p.value)
                return (
                  <button key={p.value} type="button" aria-pressed={part === p.value} disabled={passed}
                    onClick={() => { setPart(p.value); setErrors({}); setError(null); setSaved(null) }}
                    className={chip(part === p.value, !!errors.part)}>
                    {p.label}<span className="sr-only">{passed ? ' (already passed today)' : ''}</span>
                  </button>
                )
              })}
            </div>
            <p id="part-hint" className="mt-1.5 text-xs text-gray-500">Morning 9:00 AM · Afternoon 1:00 PM · Evening 7:00 PM ({tz.replace('_', ' ')} time)</p>
            {errors.part && <p id="part-err" role="alert" className="mt-1.5 text-sm text-red-700">{errors.part}</p>}
          </fieldset>

          {error && !errors.date && !errors.part && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button type="button" className={`${primaryBtn.replace('h-12 ', '')} min-h-[3rem] w-full py-2.5`} disabled={busy} onClick={save}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {choice?.ok ? `Remind me ${whenLong(choice.at.toISOString(), tz)}` : 'Remind me'}
          </button>

          {saved && (
            <p role="status" className="rounded-xl border border-green-300 bg-green-50 p-3 text-sm text-green-800">
              Saved. We&apos;ll email you at {fmt(saved, tz, { hour: 'numeric', minute: '2-digit' })} on {fmt(saved, tz, { weekday: 'short', month: 'short', day: 'numeric' })}. You can also watch any time from the link in your email.
            </p>
          )}
        </>
      )}

      <button type="button" onClick={onWatch} className="text-sm font-medium text-primary-700 underline hover:text-primary-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 rounded">
        Actually, I&apos;ll watch now
      </button>
    </div>
  )
}
