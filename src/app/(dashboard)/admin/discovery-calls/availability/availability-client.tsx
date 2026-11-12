'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Check, CheckCircle2, ChevronDown, Copy, Globe2, LayoutTemplate, Loader2, Plus, X } from 'lucide-react'
import { saveAvailability } from '@/lib/actions/discovery-admin'
import { zoneLabel, zoneOffset } from '@/lib/get-involved/time-zones'
import {
  DAY_END, DAY_NAMES, MIN_BLOCK, WEEKDAYS, WEEK_ORDER, copyDay, nextBlock, preset, sameWindows, timeLabel, weeklySlots, windowErrors, type Win,
} from '@/lib/get-involved/weekly-times'

const TIMES = Array.from({ length: DAY_END / MIN_BLOCK + 1 }, (_, i) => i * MIN_BLOCK)
const ring = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2'
const btn = `h-11 px-4 rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-60 ${ring}`
const select = 'h-10 rounded-lg border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600'
const PRESETS: { label: string; build: () => Win[] }[] = [
  { label: 'Weekdays, 9 AM – 5 PM', build: () => preset(WEEKDAYS, 9 * 60, 17 * 60) },
  { label: 'Weekdays, 9 AM – 12 PM', build: () => preset(WEEKDAYS, 9 * 60, 12 * 60) },
  { label: 'Weekday evenings, 5 – 8 PM', build: () => preset(WEEKDAYS, 17 * 60, 20 * 60) },
]

export function AvailabilityClient({ hostUserId, hostName, timezone, windows, showZone = true }: { hostUserId: string; hostName: string; timezone: string; windows: Win[]; /** Off when the page header already shows the zone. */ showZone?: boolean }) {
  const router = useRouter()
  const [saved, setSaved] = useState<Win[]>(windows)
  const [list, setList] = useState<Win[]>(windows)
  const [stash, setStash] = useState<Record<number, Win[]>>({})
  const [copying, setCopying] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [leaveTo, setLeaveTo] = useState<string | null>(null)
  const [templates, setTemplates] = useState(false)

  const errors = useMemo(() => windowErrors(list), [list])
  const errorCount = Object.keys(errors).length
  const dirty = !sameWindows(list, saved)
  const slots = weeklySlots(list)
  const first = hostName.split(' ')[0] || hostName

  // Don't lose edits: warn on tab close, and catch clicks on links (e.g. switching host).
  useEffect(() => {
    if (!dirty) return
    const onUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest('a[href]') as HTMLAnchorElement | null
      if (!a || a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey) return
      const url = new URL(a.href, window.location.href)
      if (url.origin !== window.location.origin || (url.pathname === window.location.pathname && url.search === window.location.search)) return
      e.preventDefault(); e.stopPropagation()
      setLeaveTo(url.pathname + url.search)
    }
    window.addEventListener('beforeunload', onUnload)
    document.addEventListener('click', onClick, true)
    return () => { window.removeEventListener('beforeunload', onUnload); document.removeEventListener('click', onClick, true) }
  }, [dirty])

  const edit = (next: Win[]) => { setList(next); setMsg(null) }
  const setAt = (i: number, patch: Partial<Win>) => edit(list.map((w, j) => {
    if (j !== i) return w
    const n = { ...w, ...patch }
    if (patch.startMinute !== undefined && n.endMinute - n.startMinute < MIN_BLOCK) n.endMinute = Math.min(n.startMinute + 60, DAY_END)
    return n
  }))
  function applyTemplate(build: () => Win[]) {
    if (list.length && !window.confirm(`Replace ${first}'s current times with this template? Nothing is saved until you click Save.`)) return
    edit(build()); setStash({}); setCopying(null); setTemplates(false)
  }
  function toggleDay(d: number, on: boolean) {
    if (on) {
      const back = stash[d]?.length ? stash[d] : [nextBlock([], d)!]
      edit([...list, ...back])
    } else {
      setStash({ ...stash, [d]: list.filter((w) => w.dayOfWeek === d) })
      edit(list.filter((w) => w.dayOfWeek !== d))
      if (copying === d) setCopying(null)
    }
  }

  async function save(then?: string) {
    if (errorCount) { setMsg({ ok: false, text: `Fix the ${errorCount === 1 ? 'time marked' : `${errorCount} times marked`} in red, then save.` }); setLeaveTo(null); return }
    setBusy(true); setMsg(null)
    const r = await saveAvailability(hostUserId, list)
    setBusy(false)
    if ('error' in r) { setMsg({ ok: false, text: r.error ?? 'Could not save.' }); setLeaveTo(null); return }
    setSaved(list); setStash({})
    setMsg({ ok: true, text: list.length ? 'Saved. Prospects see these times right away.' : `Saved. ${first} has no weekly times, so prospects can’t book them.` })
    if (then) router.push(then); else router.refresh()
  }
  function discard(then?: string) {
    setList(saved); setStash({}); setCopying(null); setMsg(null); setLeaveTo(null)
    if (then) setTimeout(() => router.push(then), 0)
  }

  return (
    <section aria-labelledby="wt-h" className="bg-white border border-gray-200 rounded-xl">
      <div className="p-5 space-y-3 border-b border-gray-100">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="wt-h" className="font-bold text-gray-900">{showZone ? <>{hostName}&apos;s weekly times</> : 'Weekly times'}</h2>
            <p className="text-sm text-gray-600 mt-0.5">When prospects can book a 30-minute call, in {showZone ? 'this' : `${first}'s`} time zone. Prospects see them in their own zone, 12 hours to 3 weeks ahead.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {showZone && <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-800"><Globe2 className="h-3.5 w-3.5" aria-hidden />{zoneLabel(timezone)} ({zoneOffset(timezone)})</span>}
            {list.length > 0 && (
              <button type="button" aria-expanded={templates} aria-controls="wt-templates" onClick={() => setTemplates(!templates)} className={`h-9 px-3 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-800 hover:bg-gray-50 inline-flex items-center gap-1.5 ${ring}`}>
                <LayoutTemplate className="h-4 w-4" aria-hidden />Templates<ChevronDown className={`h-4 w-4 transition-transform ${templates ? 'rotate-180' : ''}`} aria-hidden />
              </button>
            )}
          </div>
        </div>
        {list.length > 0 && templates && (
          <div id="wt-templates" className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs text-gray-600 mb-2">Replaces the times below. Nothing is saved until you click Save.</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => <button key={p.label} type="button" onClick={() => applyTemplate(p.build)} className={`h-9 px-3 rounded-lg text-sm font-semibold border border-primary-300 text-primary-800 bg-white hover:bg-primary-50 ${ring}`}>{p.label}</button>)}
            </div>
          </div>
        )}
        <p className={`text-sm font-medium flex items-center gap-1.5 ${list.length ? 'text-gray-800' : 'text-amber-800'}`} aria-live="polite">
          {list.length
            ? <><CheckCircle2 className="h-4 w-4 text-green-700" aria-hidden />{slots} half-hour slot{slots === 1 ? '' : 's'} a week across {new Set(list.map((w) => w.dayOfWeek)).size} day{new Set(list.map((w) => w.dayOfWeek)).size === 1 ? '' : 's'}</>
            : <><AlertTriangle className="h-4 w-4" aria-hidden />No weekly times: prospects can&apos;t book {first} yet.</>}
        </p>
        {list.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-300 p-3">
            <p className="text-sm font-semibold text-gray-800 mb-2">Quick start</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => <button key={p.label} type="button" onClick={() => applyTemplate(p.build)} className={`${btn} border border-primary-300 text-primary-800 bg-white hover:bg-primary-50`}>{p.label}</button>)}
            </div>
            <p className="text-xs text-gray-600 mt-2">Or switch on the days below one by one. You can change everything before saving.</p>
          </div>
        )}
      </div>

      <ul className="divide-y divide-gray-100">
        {WEEK_ORDER.map((d) => {
          const rows = list.map((w, i) => ({ w, i })).filter((x) => x.w.dayOfWeek === d).sort((a, b) => a.w.startMinute - b.w.startMinute)
          const on = rows.length > 0
          const more = nextBlock(list, d)
          return (
            <li key={d} className={`px-5 py-2.5 ${on ? '' : 'bg-gray-50/50'}`}>
              <div className="grid gap-x-4 gap-y-2 sm:grid-cols-[9.5rem_1fr]">
                <div className="flex items-center gap-3 h-10 w-fit">
                  <button type="button" role="switch" aria-checked={on} aria-label={`${DAY_NAMES[d]} available`} onClick={() => toggleDay(d, !on)}
                    className={`relative flex-none h-7 w-12 rounded-full transition-colors ${ring} ${on ? 'bg-primary-700' : 'bg-gray-300'}`}>
                    <span className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
                  </button>
                  <span className={`text-sm font-semibold ${on ? 'text-gray-900' : 'text-gray-500'}`} aria-hidden>{DAY_NAMES[d]}</span>
                </div>
                <div className="min-w-0 space-y-2">
                  {!on && <p className="h-10 flex items-center text-sm text-gray-500">Unavailable</p>}
                  {rows.map(({ w, i }) => (
                    <div key={i}>
                      <div className="flex items-center gap-2">
                        <select aria-label={`${DAY_NAMES[d]} from`} value={w.startMinute} onChange={(e) => setAt(i, { startMinute: Number(e.target.value) })} className={`${select} flex-1 min-w-0 sm:flex-none sm:w-36 ${errors[i] ? 'border-red-400' : ''}`} aria-invalid={!!errors[i] || undefined} aria-describedby={errors[i] ? `wt-err-${i}` : undefined}>
                          {TIMES.slice(0, -1).map((t) => <option key={t} value={t}>{timeLabel(t)}</option>)}
                        </select>
                        <span className="text-sm text-gray-500" aria-hidden>–</span>
                        <select aria-label={`${DAY_NAMES[d]} until`} value={w.endMinute} onChange={(e) => setAt(i, { endMinute: Number(e.target.value) })} className={`${select} flex-1 min-w-0 sm:flex-none sm:w-44 ${errors[i] ? 'border-red-400' : ''}`} aria-invalid={!!errors[i] || undefined}>
                          {TIMES.filter((t) => t > w.startMinute).map((t) => <option key={t} value={t}>{timeLabel(t)}</option>)}
                        </select>
                        <button type="button" aria-label={`Remove ${DAY_NAMES[d]} ${timeLabel(w.startMinute)} to ${timeLabel(w.endMinute)}`} onClick={() => edit(list.filter((_, j) => j !== i))}
                          className={`flex-none h-10 w-10 rounded-lg inline-flex items-center justify-center text-gray-500 hover:bg-red-50 hover:text-red-700 ${ring}`}><X className="h-5 w-5" aria-hidden /></button>
                      </div>
                      {errors[i] && <p id={`wt-err-${i}`} className="text-xs text-red-700 mt-1">{errors[i]}</p>}
                    </div>
                  ))}
                  {on && (
                    <div className="flex flex-wrap gap-x-4">
                      <button type="button" disabled={!more} onClick={() => more && edit([...list, more])} className={`h-8 rounded text-sm font-semibold text-primary-700 hover:underline inline-flex items-center gap-1 disabled:text-gray-400 disabled:no-underline ${ring}`}><Plus className="h-4 w-4" aria-hidden />Add another time</button>
                      <button type="button" aria-expanded={copying === d} onClick={() => setCopying(copying === d ? null : d)} className={`h-8 rounded text-sm font-semibold text-primary-700 hover:underline inline-flex items-center gap-1 ${ring}`}><Copy className="h-4 w-4" aria-hidden />Copy to other days</button>
                    </div>
                  )}
                  {copying === d && <CopyPanel from={d} onApply={(targets) => { edit(copyDay(list, d, targets)); setCopying(null) }} onCancel={() => setCopying(null)} />}
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      {leaveTo && (
        <div role="alertdialog" aria-labelledby="leave-h" className="mx-5 mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-3">
          <p id="leave-h" className="text-sm font-semibold text-amber-900">You have unsaved changes to {first}&apos;s times.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => save(leaveTo)} disabled={busy} className={`${btn} bg-primary-700 hover:bg-primary-800 text-white`}>Save and continue</button>
            <button type="button" onClick={() => discard(leaveTo)} className={`${btn} border border-gray-300 bg-white text-gray-800`}>Discard changes</button>
            <button type="button" onClick={() => setLeaveTo(null)} className={`${btn} text-gray-700 hover:bg-amber-100`}>Stay here</button>
          </div>
        </div>
      )}

      <div className={`${dirty ? 'sticky bottom-0 z-10 bg-white border-gray-200 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]' : 'bg-gray-50 border-gray-100'} flex flex-wrap items-center gap-3 rounded-b-xl border-t px-5 py-3`}>
        <button type="button" onClick={() => save()} disabled={busy || !dirty} className={`${btn} ${dirty ? 'bg-primary-700 hover:bg-primary-800 text-white' : 'bg-gray-200 text-gray-500 disabled:opacity-100'}`}>{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Save weekly times</button>
        {dirty && <button type="button" onClick={() => discard()} disabled={busy} className={`${btn} text-gray-700 hover:bg-gray-100`}>Discard changes</button>}
        <span className="text-sm" role={msg ? (msg.ok ? 'status' : 'alert') : undefined}>
          {msg ? <span className={msg.ok ? 'text-green-700' : 'text-red-700'}>{msg.text}</span>
            : dirty ? <span className="text-gray-700">{errorCount ? <span className="text-red-700">{errorCount} time{errorCount === 1 ? '' : 's'} to fix</span> : 'Unsaved changes'}</span>
            : <span className="text-gray-600 inline-flex items-center gap-1"><Check className="h-4 w-4 text-green-700" aria-hidden />All changes saved</span>}
        </span>
      </div>
    </section>
  )
}

function CopyPanel({ from, onApply, onCancel }: { from: number; onApply: (days: number[]) => void; onCancel: () => void }) {
  const [days, setDays] = useState<number[]>([])
  const others = WEEK_ORDER.filter((d) => d !== from)
  const all = days.length === others.length
  return (
    <fieldset className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
      <legend className="sr-only">Copy {DAY_NAMES[from]}&apos;s times to</legend>
      <p className="text-sm font-semibold text-gray-800" aria-hidden>Copy {DAY_NAMES[from]}&apos;s times to:</p>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800"><input type="checkbox" checked={all} onChange={() => setDays(all ? [] : others)} className="h-[18px] w-[18px] accent-primary-700" />Every day</label>
        {others.map((d) => (
          <label key={d} className="inline-flex items-center gap-2 text-sm text-gray-800">
            <input type="checkbox" checked={days.includes(d)} onChange={() => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])} className="h-[18px] w-[18px] accent-primary-700" /><span aria-hidden>{DAY_NAMES[d].slice(0, 3)}</span><span className="sr-only">{DAY_NAMES[d]}</span>
          </label>
        ))}
      </div>
      <p className="text-xs text-gray-600">This replaces the times on the days you pick.</p>
      <div className="flex gap-2">
        <button type="button" disabled={!days.length} onClick={() => onApply(days)} className={`${btn} h-10 bg-primary-700 hover:bg-primary-800 text-white`}>Copy</button>
        <button type="button" onClick={onCancel} className={`${btn} h-10 text-gray-700 hover:bg-gray-100`}>Cancel</button>
      </div>
    </fieldset>
  )
}
