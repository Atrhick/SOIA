'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CalendarClock, Check, CheckCircle2, ChevronDown, Loader2, Plus, UserPlus, Video, X } from 'lucide-react'
import { removeDiscoveryHost, saveDiscoveryHost } from '@/lib/actions/discovery-admin'
import { AGE_RANGES, AgeRangeValue } from '@/lib/get-involved/core'
import { zoneLabel } from '@/lib/get-involved/time-zones'
import { HOST_STATUS_LABEL, hostStatus, meetingLinkWarning, type HostStatus } from '@/lib/get-involved/host-status'
import { TimeZoneSelect } from '@/components/get-involved/time-zone-select'

interface HostInfo { displayName: string; active: boolean; ageRanges: string[]; meetingUrl: string; timezone: string; blocks: number; upcoming: number }
interface Person { userId: string; email: string; role: string; name: string; host: HostInfo | null }

const ROLE_TAG: Record<string, string> = { ADMIN: 'Admin', COACH: 'Coach' }
const input = 'w-full h-11 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600'
const btn = 'h-11 px-4 rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2'
const STATUS_STYLE: Record<HostStatus, string> = {
  BOOKABLE: 'bg-green-100 text-green-800',
  NEEDS_TIMES: 'bg-amber-100 text-amber-900',
  NEEDS_AGES: 'bg-amber-100 text-amber-900',
  PAUSED: 'bg-gray-100 text-gray-700',
}
const ageLabel = (v: string) => AGE_RANGES.find((a) => a.value === v)?.label ?? v
const ageOrder = (v: string) => AGE_RANGES.findIndex((a) => a.value === v)
const andList = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)
const initials = (s: string) => s.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => (x?.[0] || '?').toUpperCase()).join('') || '?'

export function HostsClient({ people, initialOpen = null }: { people: Person[]; initialOpen?: string | null }) {
  const hosts = people.filter((p) => p.host)
  const others = people.filter((p) => !p.host)
  const [open, setOpen] = useState<string | null>(people.some((p) => p.host && p.userId === initialOpen) ? initialOpen : null)
  // Opened from another page (?edit=): bring that host's form into view.
  useEffect(() => {
    if (open && open === initialOpen) document.getElementById(`host-${open}`)?.scrollIntoView({ block: 'center' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [adding, setAdding] = useState(false)

  const bookable = hosts.filter((h) => hostStatus(h.host!) === 'BOOKABLE')
  const coverage = AGE_RANGES.map((a) => ({
    ...a,
    bookable: bookable.filter((h) => h.host!.ageRanges.includes(a.value)).length,
    waiting: hosts.filter((h) => h.host!.active && h.host!.ageRanges.includes(a.value) && h.host!.blocks === 0).length,
  }))
  const gaps = coverage.filter((c) => c.bookable === 0)
  const needTimes = hosts.filter((h) => hostStatus(h.host!) === 'NEEDS_TIMES')

  return (
    <div className="space-y-6">
      {/* Can prospects book right now? One answer, with the next step. */}
      <section aria-labelledby="cov-h" className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          {gaps.length === 0
            ? <CheckCircle2 className="h-6 w-6 flex-none text-green-700" aria-hidden />
            : <AlertTriangle className="h-6 w-6 flex-none text-amber-600" aria-hidden />}
          <div className="min-w-0">
            <h2 id="cov-h" className="font-bold text-gray-900">
              {gaps.length === 0 ? 'Every age range can book a call' : gaps.length === AGE_RANGES.length ? 'No one can book a discovery call yet' : `${gaps.length} age range${gaps.length === 1 ? '' : 's'} can’t book a call`}
            </h2>
            <p className="text-sm text-gray-600 mt-0.5">
              {hosts.length === 0
                ? 'Add a host, choose the age ranges they take, then set their weekly times.'
                : needTimes.length > 0
                  ? `${andList(needTimes.map((h) => h.host!.displayName))} ${needTimes.length === 1 ? 'has' : 'have'} no weekly times yet, so prospects can’t see them.`
                  : gaps.length > 0 ? 'No bookable host takes these age ranges. Edit a host to add them.' : 'Prospects see times from bookable hosts who take their age range.'}
            </p>
            {needTimes.length > 0 && (
              <Link href={`/admin/discovery-calls/availability?host=${needTimes[0].userId}`} className={`${btn} mt-3 bg-primary-700 hover:bg-primary-800 text-white`}>
                <CalendarClock className="h-4 w-4" aria-hidden />Set weekly times{needTimes.length === 1 ? ` for ${needTimes[0].host!.displayName.split(' ')[0]}` : ''}
              </Link>
            )}
          </div>
        </div>
        <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2" aria-label="Bookable hosts per age range">
          {coverage.map((c) => (
            <li key={c.value} className={`rounded-lg border px-3 py-2.5 ${c.bookable === 0 ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
              <p className="text-sm font-semibold text-gray-900">{c.label}</p>
              <p className={`text-xs ${c.bookable === 0 ? 'text-amber-900' : 'text-gray-600'}`}>
                {c.bookable === 0 ? (c.waiting > 0 ? `Not bookable · ${c.waiting} waiting on times` : 'Not bookable · no host') : `${c.bookable} bookable host${c.bookable === 1 ? '' : 's'}`}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="hosts-h" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="hosts-h" className="text-lg font-bold text-gray-900">Hosts <span className="text-gray-500 font-normal">({hosts.length})</span></h2>
            <p className="text-sm text-gray-600">Admins and coaches can host. A coach host sees only their own calls and sets their own times.</p>
          </div>
          {others.length > 0 && !adding && (
            <button type="button" onClick={() => { setAdding(true); setOpen(null) }} className={`${btn} bg-primary-700 hover:bg-primary-800 text-white`}><Plus className="h-4 w-4" aria-hidden />Add host</button>
          )}
        </div>

        {adding && <AddHost others={others} onClose={() => setAdding(false)} />}

        {hosts.length === 0 && !adding ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
            <UserPlus className="mx-auto h-8 w-8 text-gray-400" aria-hidden />
            <p className="mt-2 font-semibold text-gray-900">No hosts yet</p>
            <p className="text-sm text-gray-600">Discovery calls need at least one host.</p>
          </div>
        ) : (
          <ul className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-200">
            {hosts.map((p) => (
              <HostRow key={p.userId} person={p} open={open === p.userId} onToggle={() => setOpen(open === p.userId ? null : p.userId)} onClose={() => setOpen(null)} />
            ))}
          </ul>
        )}
        {others.length === 0 && hosts.length > 0 && <p className="text-sm text-gray-600">Every active admin and coach is already a host.</p>}
      </section>
    </div>
  )
}

function HostRow({ person, open, onToggle, onClose }: { person: Person; open: boolean; onToggle: () => void; onClose: () => void }) {
  const h = person.host!
  const status = hostStatus(h)
  const linkWarn = h.meetingUrl ? meetingLinkWarning(h.meetingUrl) : 'No meeting link'
  const panelId = `host-${person.userId}`
  return (
    <li>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
        <span className="flex-none w-10 h-10 rounded-full bg-primary-50 text-primary-800 text-sm font-bold flex items-center justify-center" aria-hidden>{initials(h.displayName)}</span>
        <div className="flex-1 min-w-[12rem]">
          <p className="font-semibold text-gray-900 flex flex-wrap items-center gap-2">
            <span>{h.displayName}</span>
            {ROLE_TAG[person.role] && <span className="text-xs font-medium rounded-full px-2 py-0.5 bg-gray-100 text-gray-700">{ROLE_TAG[person.role]}</span>}
            <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${STATUS_STYLE[status]}`}>{HOST_STATUS_LABEL[status]}</span>
          </p>
          <p className="text-xs text-gray-600 break-all">{person.email}</p>
          <p className="text-sm text-gray-700 mt-1">
            {h.ageRanges.length ? [...h.ageRanges].sort((a, b) => ageOrder(a) - ageOrder(b)).map(ageLabel).join(', ') : 'No age ranges'}
            <span className="text-gray-400"> · </span>{zoneLabel(h.timezone)}
            <span className="text-gray-400"> · </span>{h.blocks} weekly time block{h.blocks === 1 ? '' : 's'}
            {h.upcoming > 0 && <><span className="text-gray-400"> · </span>{h.upcoming} upcoming call{h.upcoming === 1 ? '' : 's'}</>}
          </p>
          {linkWarn && <p className="text-xs text-amber-800 mt-1 flex items-start gap-1"><AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-none" aria-hidden />{linkWarn === 'No meeting link' ? 'No meeting link' : 'Meeting link needs a look'}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/discovery-calls/availability?host=${person.userId}`} className={`${btn} ${status === 'NEEDS_TIMES' ? 'bg-primary-700 hover:bg-primary-800 text-white' : 'border border-gray-300 text-gray-800 bg-white hover:bg-gray-50'}`}>
            <CalendarClock className="h-4 w-4" aria-hidden />{status === 'NEEDS_TIMES' ? 'Set weekly times' : 'Weekly times'}
          </Link>
          <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={panelId} className={`${btn} border border-gray-300 text-gray-800 bg-white hover:bg-gray-50`}>
            Edit<ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
          </button>
        </div>
      </div>
      {open && <div id={panelId} className="border-t border-gray-100 bg-gray-50/60 p-4 sm:p-5"><HostForm person={person} onDone={onClose} /></div>}
    </li>
  )
}

function AddHost({ others, onClose }: { others: Person[]; onClose: () => void }) {
  const [who, setWho] = useState('')
  const ref = useRef<HTMLSelectElement>(null)
  useEffect(() => { ref.current?.focus() }, [])
  const person = others.find((o) => o.userId === who)
  return (
    <section aria-labelledby="add-h" className="bg-white border-2 border-primary-200 rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <h3 id="add-h" className="font-bold text-gray-900">Add a host</h3>
        <button type="button" onClick={onClose} className="h-9 w-9 -m-1 rounded-lg inline-flex items-center justify-center text-gray-500 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600" aria-label="Close add host"><X className="h-5 w-5" aria-hidden /></button>
      </div>
      <div className="sm:max-w-md">
        <label htmlFor="add-host" className="block text-sm font-semibold text-gray-700 mb-1">Person</label>
        <select id="add-host" ref={ref} value={who} onChange={(e) => setWho(e.target.value)} className={input}>
          <option value="">Choose an admin or coach</option>
          {(['ADMIN', 'COACH'] as const).map((role) => {
            const list = others.filter((o) => o.role === role)
            return list.length ? (
              <optgroup key={role} label={role === 'ADMIN' ? 'Admins' : 'Coaches'}>
                {list.map((o) => <option key={o.userId} value={o.userId}>{o.name ? `${o.name} (${o.email})` : o.email}</option>)}
              </optgroup>
            ) : null
          })}
        </select>
      </div>
      {person && <HostForm key={person.userId} person={person} isNew onDone={onClose} />}
    </section>
  )
}

function HostForm({ person, isNew, onDone }: { person: Person; isNew?: boolean; onDone: () => void }) {
  const router = useRouter()
  const h = person.host
  const initial = { name: h?.displayName ?? person.name, ranges: h?.ageRanges ?? [], url: h?.meetingUrl ?? '', tz: h?.timezone ?? 'America/Chicago', active: h?.active ?? true }
  const [name, setName] = useState(initial.name)
  const [ranges, setRanges] = useState<string[]>(initial.ranges)
  const [url, setUrl] = useState(initial.url)
  const [tz, setTz] = useState(initial.tz)
  const [active, setActive] = useState(initial.active)
  const [busy, setBusy] = useState<'save' | 'remove' | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const id = person.userId

  const dirty = isNew || name !== initial.name || url !== initial.url || tz !== initial.tz || active !== initial.active ||
    [...ranges].sort().join() !== [...initial.ranges].sort().join()
  const nameMissing = !name.trim()
  const linkWarn = meetingLinkWarning(url)

  async function save() {
    if (nameMissing) { setError('Add the name prospects will see.'); return }
    setBusy('save'); setError(null)
    const r = await saveDiscoveryHost({ userId: id, displayName: name.trim(), ageRanges: ranges as AgeRangeValue[], meetingUrl: url.trim(), timezone: tz, active })
    setBusy(null)
    if ('error' in r) { setError(r.error ?? 'Could not save.'); return }
    onDone(); router.refresh()
  }
  async function remove() {
    setBusy('remove'); setError(null)
    const r = await removeDiscoveryHost(id)
    setBusy(null)
    if ('error' in r) { setError(r.error ?? 'Could not remove.'); setConfirmRemove(false); return }
    onDone(); router.refresh()
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); save() }} className="space-y-5" noValidate>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor={`dn-${id}`}>Name prospects see</label>
          <input id={`dn-${id}`} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={input} placeholder="e.g. Lina Lopez" aria-invalid={nameMissing || undefined} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor={`tz-${id}`}>Their time zone</label>
          <TimeZoneSelect id={`tz-${id}`} value={tz} onChange={setTz} className={input} />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor={`mu-${id}`}>Meeting link</label>
          <div className="relative">
            <Video className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden />
            <input id={`mu-${id}`} type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} maxLength={500} className={`${input} pl-9`} placeholder="https://zoom.us/j/1234567890" aria-describedby={`mu-help-${id}`} />
          </div>
          <p id={`mu-help-${id}`} className={`text-xs mt-1 ${linkWarn ? 'text-amber-800' : 'text-gray-600'}`}>
            {linkWarn ?? 'Sent to prospects in their booking confirmation. Zoom, Google Meet or Teams.'}
          </p>
        </div>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold text-gray-700">Age ranges they take</legend>
        <p className="text-xs text-gray-600 mb-2">Prospects only see hosts who take their age range. For 17 and under, a parent joins the call.</p>
        <div className="flex flex-wrap gap-2">
          {AGE_RANGES.map((a) => {
            const on = ranges.includes(a.value)
            return (
              <label key={a.value} className={`h-11 px-3.5 rounded-lg border text-sm inline-flex items-center gap-2 cursor-pointer select-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-600 has-[:focus-visible]:ring-offset-2 ${on ? 'border-primary-700 bg-primary-700 text-white font-semibold' : 'border-gray-300 bg-white text-gray-800 hover:border-gray-400'}`}>
                <input type="checkbox" className="sr-only" checked={on} onChange={() => setRanges(on ? ranges.filter((r) => r !== a.value) : [...ranges, a.value])} />
                {on ? <Check className="h-4 w-4" aria-hidden /> : <span className="h-4 w-4 rounded border border-gray-400" aria-hidden />}
                {a.label}
              </label>
            )
          })}
        </div>
      </fieldset>

      <div className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 bg-white p-3">
        <div>
          <p id={`ac-l-${id}`} className="text-sm font-semibold text-gray-800">Taking new calls</p>
          <p id={`ac-d-${id}`} className="text-xs text-gray-600">Turn off to pause new bookings. Calls already booked stay as they are.</p>
        </div>
        <button type="button" role="switch" aria-checked={active} aria-labelledby={`ac-l-${id}`} aria-describedby={`ac-d-${id}`} onClick={() => setActive(!active)}
          className={`relative flex-none h-7 w-12 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2 ${active ? 'bg-primary-700' : 'bg-gray-300'}`}>
          <span className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${active ? 'translate-x-5' : ''}`} />
        </button>
      </div>

      {error && <p role="alert" className="text-sm rounded-lg px-3 py-2 bg-red-50 text-red-700 border border-red-200">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={busy !== null || !dirty} className={`${btn} bg-primary-700 hover:bg-primary-800 text-white`}>
            {busy === 'save' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{isNew ? 'Add host' : 'Save changes'}
          </button>
          <button type="button" onClick={onDone} disabled={busy !== null} className={`${btn} text-gray-700 hover:bg-gray-100`}>Cancel</button>
          {!isNew && dirty && <span className="text-xs text-gray-600">Unsaved changes</span>}
        </div>
        {!isNew && !confirmRemove && (
          <button type="button" onClick={() => setConfirmRemove(true)} disabled={busy !== null} className={`${btn} text-red-700 hover:bg-red-50`}>Remove as host</button>
        )}
      </div>
      {!isNew && confirmRemove && (
        <div role="alertdialog" aria-labelledby={`rm-${id}`} className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
          <p id={`rm-${id}`} className="text-sm text-red-900">
            Remove <strong>{h?.displayName}</strong> as a host? Their weekly times are deleted and prospects stop seeing them.
            {h && h.upcoming > 0 ? ` They have ${h.upcoming} upcoming call${h.upcoming === 1 ? '' : 's'}, so pause them instead, or cancel those calls first.` : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={remove} disabled={busy !== null || (h?.upcoming ?? 0) > 0} className={`${btn} bg-red-700 hover:bg-red-800 text-white`}>{busy === 'remove' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Remove host</button>
            <button type="button" onClick={() => setConfirmRemove(false)} className={`${btn} border border-gray-300 bg-white text-gray-800`}>Keep</button>
          </div>
        </div>
      )}
    </form>
  )
}
