'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, Loader2, Video } from 'lucide-react'
import { decideAfterCall, saveCallRecord } from '@/lib/actions/discovery-admin'
import { CALL_OUTCOMES, CALL_TOPICS, CallOutcome, PARENT_RELATIONSHIPS, callRecordSubmitLabel } from '@/lib/get-involved/call-record'
import type { GetInvolvedRoleValue } from '@/lib/get-involved/core'

export interface CallRecordData {
  call: {
    id: string; startsAt: string; status: string; meetingUrl: string | null; notes: string | null; topicsCovered: string[]
    parentAttended: boolean | null; parentAttendeeName: string | null; parentAttendeeRelationship: string | null; outcomeAt: string | null; cancelReason: string | null
  }
  prospect: {
    id: string; firstName: string; name: string; age: string; minor: boolean; city: string | null; parentName: string | null; parentFirst: string | null
    parentRelationship: string | null; parentConsent: string | null; status: string; roleLabel: string | null; canChooseRole: boolean
  }
  host: string | null
  inviter: string | null
  inviterFirst: string | null
  roles: { role: string; label: string; price: string }[]
  steps: { label: string; state: 'done' | 'current' | 'todo' }[]
  nextStep: string
  closed: boolean
  /** The viewer's zone for times on this page. */
  tz: string
  /** Link to the full prospect record (admins only); null for a coach host. */
  prospectHref: string | null
}

const whenIn = (iso: string, tz: string) => new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: tz, timeZoneName: 'short' }).format(new Date(iso))
const sameDay = (a: Date, b: Date, tz: string) => a.toLocaleDateString('en-US', { timeZone: tz }) === b.toLocaleDateString('en-US', { timeZone: tz })

const card = 'bg-white border border-gray-200 rounded-xl p-5'
const h2 = 'text-xs font-bold uppercase tracking-wide text-primary-800'
const lbl = 'block text-sm font-semibold text-gray-700 mb-1.5'
const field = 'w-full rounded-lg border border-gray-300 px-3 text-[15px] text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
const focus = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2'
/** A radio that looks like a button. Uses a real input so arrow keys and screen readers work. */
const chip = (on: boolean, tone: 'primary' | 'red' = 'primary') =>
  `inline-flex items-center justify-center min-h-11 px-4 rounded-lg text-sm cursor-pointer select-none peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500 peer-focus-visible:ring-offset-2 ${
    on ? (tone === 'red' ? 'border-2 border-red-600 bg-red-50 text-red-800 font-bold' : 'border-2 border-primary-700 bg-sky-100 text-primary-800 font-bold') : 'border border-gray-300 bg-white text-gray-700 hover:border-gray-400 font-semibold'}`
const RESULT: Record<string, { label: string; cls: string }> = {
  BOOKED: { label: 'Booked', cls: 'bg-sky-100 text-sky-800' }, KEPT: { label: 'Kept', cls: 'bg-green-100 text-green-800' },
  NO_SHOW: { label: 'No-show', cls: 'bg-red-100 text-red-800' }, CANCELLED: { label: 'Cancelled', cls: 'bg-gray-100 text-gray-700' },
}

function FieldError({ id, msg }: { id: string; msg?: string }) {
  return msg ? <p id={id} role="alert" className="mt-1.5 text-sm text-red-700">{msg}</p> : null
}

/** `children` (server-rendered, e.g. the "Where they came from" and call guide cards) shows under the header card. */
export function CallRecordClient({ data, now, children }: { data: CallRecordData; now: string; children?: React.ReactNode }) {
  const { call, prospect: p } = data
  const started = new Date(call.startsAt).getTime() <= new Date(now).getTime()
  const today = sameDay(new Date(call.startsAt), new Date(now), data.tz)
  const when = (iso: string) => whenIn(iso, data.tz)
  const [done, setDone] = useState<string | null>(null)

  return (
    <div className="space-y-5">
      {/* Who */}
      <div className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900">{p.name}</h1>
            <p className="text-sm text-gray-600 mt-1">
              {when(call.startsAt)} · {p.age}{p.city ? ` · ${p.city}` : ''}{data.host ? ` · Host ${data.host}` : ''}{data.inviter ? ` · invited by ${data.inviter}` : ''}
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {p.minor && <span className="text-xs font-semibold rounded-full px-2.5 py-1 bg-gray-100 text-gray-800">17 and under</span>}
              {p.minor && p.parentConsent && <span className="text-xs font-semibold rounded-full px-2.5 py-1 bg-green-100 text-green-800">Parent consent ✓ {p.parentConsent}</span>}
              {p.roleLabel && <span className="text-xs font-semibold rounded-full px-2.5 py-1 bg-sky-100 text-sky-800">Role: {p.roleLabel}</span>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {call.status === 'BOOKED' && (
              <span className={`text-xs font-semibold rounded-full px-3 py-1.5 ${started ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'}`}>
                {started ? 'Needs an outcome' : today ? 'Discovery call today' : 'Upcoming call'}
              </span>
            )}
            {call.status !== 'BOOKED' && <span className={`text-xs font-semibold rounded-full px-3 py-1.5 ${RESULT[call.status]?.cls ?? ''}`}>{RESULT[call.status]?.label ?? call.status}</span>}
            {call.meetingUrl && call.status === 'BOOKED' && <a href={call.meetingUrl} target="_blank" rel="noreferrer" className={`h-9 px-3 rounded-lg border border-gray-300 text-sm font-semibold inline-flex items-center gap-1.5 ${focus}`}><Video className="h-4 w-4" aria-hidden />Join call</a>}
            {data.prospectHref && <Link href={data.prospectHref} className={`h-9 px-3 rounded-lg border border-gray-300 text-sm font-semibold inline-flex items-center ${focus}`}>Prospect record</Link>}
          </div>
        </div>
      </div>

      {children}

      {/* Journey */}
      <div className={card}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-gray-900">Journey</h2>
          <span className="text-sm text-gray-600">{data.closed ? 'Closed' : `${Math.max(1, data.steps.findIndex((s) => s.state === 'current') + 1 || data.steps.length)} of ${data.steps.length}`}</span>
        </div>
        <ol className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {data.steps.map((s, i) => (
            <li key={s.label} aria-current={s.state === 'current' ? 'step' : undefined}
              className={`min-w-0 flex items-center gap-2 rounded-lg px-3 py-2.5 ${s.state === 'done' ? 'bg-green-100 text-green-800' : s.state === 'current' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>
              <span className={`flex-none w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center ${s.state === 'done' ? 'bg-green-600' : s.state === 'current' ? 'bg-amber-600' : 'bg-gray-400'}`}>
                {s.state === 'done' ? <Check className="h-3.5 w-3.5" aria-label="Done" /> : i + 1}
              </span>
              <span className="text-sm font-semibold">{s.label}</span>
            </li>
          ))}
        </ol>
        <p className="text-sm text-gray-600 mt-3">Next: {data.nextStep}</p>
      </div>

      {done && <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">{done}</p>}

      {call.status === 'BOOKED'
        ? <RecordForm data={data} started={started} onDone={setDone} />
        : <Recorded data={data} onDone={setDone} />}
    </div>
  )
}

type Errors = Record<string, string>

function RecordForm({ data, started, onDone }: { data: CallRecordData; started: boolean; onDone: (m: string) => void }) {
  const router = useRouter()
  const { call, prospect: p } = data
  const [parent, setParent] = useState<'yes' | 'no' | null>(null)
  const [parentName, setParentName] = useState(p.parentName ?? '')
  const [relationship, setRelationship] = useState((PARENT_RELATIONSHIPS as readonly string[]).includes(p.parentRelationship ?? '') ? p.parentRelationship! : 'Parent')
  const [outcome, setOutcome] = useState<CallOutcome | null>(started ? 'KEPT' : null)
  const [topics, setTopics] = useState<string[]>([])
  const [notes, setNotes] = useState(call.notes ?? '')
  const [role, setRole] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [fe, setFe] = useState<Errors>({})

  const minor = p.minor
  const effective: CallOutcome | null = minor && parent === 'no' && outcome === 'KEPT' ? null : outcome
  const roleValue = role === 'LATER' ? null : (role || null) as GetInvolvedRoleValue | null
  const roleName = data.roles.find((r) => r.role === role)?.label ?? null
  const label = !effective ? 'Choose an outcome' : effective === 'KEPT' && !role ? 'Choose the role they chose' : callRecordSubmitLabel({ outcome: effective, role: roleValue }, roleName, minor)
  const parentFirst = p.parentFirst ?? 'their parent'

  /** Drop a field's error once the person changes that field. */
  function clear(...keys: string[]) {
    if (keys.some((k) => fe[k])) setFe((prev) => { const n = { ...prev }; keys.forEach((k) => delete n[k]); if (!Object.keys(n).length) setErr(null); return n })
  }

  function pickParent(v: 'yes' | 'no') {
    clear('parentAttended', 'outcome')
    setParent(v)
    if (v === 'no' && (outcome === 'KEPT' || outcome === null)) setOutcome('RESCHEDULE')
    if (v === 'yes' && outcome === 'RESCHEDULE' && started) setOutcome('KEPT')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null); setFe({})
    const local: Errors = {}
    if (!effective) local.outcome = 'Choose how the call went.'
    if (effective === 'KEPT' && !role) local.role = 'Choose the role they chose, or "Not decided yet".'
    if (effective === 'KEPT' && minor && parent === null) local.parentAttended = 'Answer this first.'
    if (Object.keys(local).length) { setFe(local); setErr('Please fix the highlighted fields above.'); return }
    setBusy(true)
    try {
      const r = await saveCallRecord(call.id, {
        outcome: effective!, role: roleValue, topics, notes,
        parentAttended: minor ? (parent === null ? null : parent === 'yes') : null, parentName, parentRelationship: relationship,
      })
      if ('error' in r) { setFe(r.fieldErrors ?? {}); setErr(r.fieldErrors && Object.keys(r.fieldErrors).length ? 'Please fix the highlighted fields above.' : r.error) } else { onDone(r.message); router.refresh() }
    } catch {
      setErr('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const sendsTo = effective === 'KEPT' && roleValue
    ? `Emails ${p.firstName}${minor ? ` (cc ${parentFirst})` : ''} ${roleValue === 'SPONSOR' ? 'the giving page' : 'the 3 questions'}${data.inviterFirst ? ` · tells ${data.inviterFirst}` : ''}`
    : effective === 'NOT_A_FIT' ? `Sends ${p.firstName}${minor ? ` and ${parentFirst}` : ''} a kind email${data.inviterFirst ? ` · tells ${data.inviterFirst}` : ''}`
    : effective === 'NO_SHOW' ? `Emails ${p.firstName} a link to rebook${data.inviterFirst ? ` · tells ${data.inviterFirst}` : ''}`
    : effective === 'RESCHEDULE' ? `Cancels this call and emails ${p.firstName}${minor ? ` and ${parentFirst}` : ''} a link to pick a new time`
    : effective === 'KEPT' ? 'Marks the call kept. You can choose the role later on this page.' : ''

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {minor && (
        <fieldset className="rounded-xl border-2 border-orange-300 bg-white p-5 space-y-4 min-w-0" aria-describedby={fe.parentAttended ? 'e-parent' : undefined}>
          <legend className="px-1 text-xs font-bold uppercase tracking-wide text-orange-800">Required first: parent or guardian</legend>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p id="parent-q" className="text-[15px] text-gray-900">Was <strong>{p.parentName ?? 'a parent'}</strong> (or another parent or guardian) on the whole call?</p>
            <div role="radiogroup" aria-labelledby="parent-q" className="flex gap-2">
              {(['yes', 'no'] as const).map((v) => (
                <label key={v}>
                  <input type="radio" name="parentAttended" value={v} checked={parent === v} onChange={() => pickParent(v)} className="peer sr-only" />
                  <span className={chip(parent === v, v === 'no' ? 'red' : 'primary')}>{v === 'yes' ? 'Yes' : 'No'}</span>
                </label>
              ))}
            </div>
          </div>
          <FieldError id="e-parent" msg={fe.parentAttended} />
          {parent !== 'no' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="parentName" className={lbl}>Name of the adult on the call</label>
                <input id="parentName" value={parentName} onChange={(e) => { clear('parentName'); setParentName(e.target.value) }} maxLength={120} autoComplete="off" aria-invalid={!!fe.parentName} aria-describedby={fe.parentName ? 'e-pn' : undefined} className={`${field} h-11`} />
                <FieldError id="e-pn" msg={fe.parentName} />
              </div>
              <div>
                <label htmlFor="parentRel" className={lbl}>Relationship</label>
                <select id="parentRel" value={relationship} onChange={(e) => { clear('parentRelationship'); setRelationship(e.target.value) }} aria-invalid={!!fe.parentRelationship} aria-describedby={fe.parentRelationship ? 'e-pr' : undefined} className={`${field} h-11`}>
                  {PARENT_RELATIONSHIPS.map((r) => <option key={r}>{r}</option>)}
                </select>
                <FieldError id="e-pr" msg={fe.parentRelationship} />
              </div>
            </div>
          )}
          <p className={`rounded-lg border px-3 py-2.5 text-sm ${parent === 'no' ? 'border-red-200 bg-red-50 text-red-800' : 'border-red-100 bg-red-50/60 text-red-800'}`}>
            <strong>If &quot;No&quot;:</strong> the call can&apos;t be marked kept. Choose &quot;Reschedule&quot;. {p.firstName} and {parentFirst} get a kind email with new times: &quot;We need a parent or guardian on the call. Let&apos;s find a time that works for you both.&quot;
          </p>
        </fieldset>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] items-start">
        <div className="space-y-5 min-w-0">
          <fieldset className={`${card} min-w-0`} aria-describedby={fe.outcome ? 'e-outcome' : undefined}>
            <legend className="sr-only">How did the call go?</legend>
            <h2 className="font-bold text-gray-900 mb-3" aria-hidden>1 · How did the call go?</h2>
            <div className="flex flex-wrap gap-2">
              {CALL_OUTCOMES.map((o) => {
                const off = (o.value === 'KEPT' || o.value === 'NO_SHOW') && !started || (o.value === 'KEPT' && minor && parent === 'no')
                return (
                  <label key={o.value} className={off ? 'opacity-50' : ''}>
                    <input type="radio" name="outcome" value={o.value} checked={outcome === o.value} disabled={off} onChange={() => { clear('outcome'); setOutcome(o.value) }} className="peer sr-only" />
                    <span className={`${chip(outcome === o.value, o.value === 'NOT_A_FIT' ? 'red' : 'primary')} ${off ? 'cursor-not-allowed' : ''}`}>{o.label}</span>
                  </label>
                )
              })}
            </div>
            {!started && <p className="text-sm text-gray-600 mt-3">This call hasn&apos;t started yet. Kept and No-show open once it has. You can still reschedule it or close it as not a fit.</p>}
            {outcome === 'NOT_A_FIT' && <p className="text-sm text-gray-700 mt-3">We&apos;ll close {p.firstName}&apos;s journey{started ? '' : ', cancel this call'} and send a kind thank-you email that invites them to community events. Notes stay private.</p>}
            {outcome === 'NO_SHOW' && <p className="text-sm text-gray-700 mt-3">{p.firstName} gets a link to rebook. After two missed calls they are paused.</p>}
            <FieldError id="e-outcome" msg={fe.outcome} />
          </fieldset>

          <div className={`${card} space-y-3`}>
            {(effective === 'KEPT' || effective === 'NOT_A_FIT') && (
              <fieldset className="min-w-0" aria-describedby={fe.topics ? 'e-topics' : undefined}>
                <legend className="font-bold text-gray-900 mb-2">2 · Covered on the call</legend>
                <div className="space-y-1">
                  {CALL_TOPICS.map((t) => (
                    <label key={t} className="flex items-center gap-3 min-h-11 text-[15px] text-gray-800 cursor-pointer">
                      <input type="checkbox" checked={topics.includes(t)} onChange={(e) => setTopics(e.target.checked ? [...topics, t] : topics.filter((x) => x !== t))} className="h-5 w-5 rounded border-gray-300 text-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500" />
                      {t}
                    </label>
                  ))}
                </div>
                <FieldError id="e-topics" msg={fe.topics} />
              </fieldset>
            )}
            <div>
              <label htmlFor="notes" className={lbl}>{effective === 'NOT_A_FIT' ? 'Why not a fit (admins only)' : effective === 'RESCHEDULE' ? 'Reason (included in their email)' : 'Notes (admins only)'}</label>
              <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} maxLength={effective === 'RESCHEDULE' ? 300 : 4000} aria-invalid={!!fe.notes} aria-describedby={fe.notes ? 'e-notes' : undefined}
                placeholder="What they're interested in, questions they asked" className={`${field} py-2.5 resize-y`} />
              <FieldError id="e-notes" msg={fe.notes} />
            </div>
          </div>
        </div>

        <div className={`${card} space-y-3 min-w-0`}>
          {effective === 'KEPT' ? (
            <fieldset className="min-w-0" aria-describedby={fe.role ? 'e-role' : 'role-help'}>
              <legend className="font-bold text-gray-900 mb-3">3 · Role they chose</legend>
              {data.roles.length === 0 ? (
                <p className="text-sm text-gray-700 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2.5">No active roles are open to this age range. Check Role Settings, or save the call and choose later.</p>
              ) : (
                <div className="space-y-2">
                  {data.roles.map((r) => (
                    <label key={r.role} className={`flex items-center gap-3 min-h-11 px-3 py-2 rounded-lg cursor-pointer focus-within:ring-2 focus-within:ring-primary-500 ${role === r.role ? 'border-2 border-primary-700 bg-sky-50' : 'border border-gray-200 hover:border-gray-300'}`}>
                      <input type="radio" name="role" value={r.role} checked={role === r.role} onChange={() => { clear('role'); setRole(r.role) }} className="h-[18px] w-[18px] accent-primary-700" />
                      <span className="flex-1 min-w-0 text-sm font-semibold text-gray-900">{r.label}</span>
                      <span className="text-xs text-gray-600 text-right">{r.price}</span>
                    </label>
                  ))}
                </div>
              )}
              <label className={`mt-2 flex items-center gap-3 min-h-11 px-3 py-2 rounded-lg cursor-pointer focus-within:ring-2 focus-within:ring-primary-500 ${role === 'LATER' ? 'border-2 border-primary-700 bg-sky-50' : 'border border-dashed border-gray-300'}`}>
                <input type="radio" name="role" value="LATER" checked={role === 'LATER'} onChange={() => { clear('role'); setRole('LATER') }} className="h-[18px] w-[18px] accent-primary-700" />
                <span className="text-sm text-gray-700">Not decided yet: choose later</span>
              </label>
              <p id="role-help" className="text-xs text-gray-600 mt-2">Only roles open to this age range are listed.{minor ? ' 17 and under only see free youth roles.' : ' For coach and service provider, pick "Coach + service provider".'}</p>
              <FieldError id="e-role" msg={fe.role} />
            </fieldset>
          ) : (
            <div>
              <h2 className="font-bold text-gray-900">3 · Next</h2>
              <p className="text-sm text-gray-600 mt-2">{effective ? sendsTo : 'Choose how the call went to see what happens next.'}</p>
            </div>
          )}
          {err && <p role="alert" className="text-sm text-red-700 rounded-lg bg-red-50 border border-red-200 px-3 py-2">{err}</p>}
          <button type="submit" disabled={busy || !effective}
            className={`w-full min-h-12 px-4 py-2 rounded-xl text-white text-[15px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 ${effective === 'NOT_A_FIT' ? 'bg-red-700 hover:bg-red-800' : 'bg-primary-700 hover:bg-primary-800'} ${focus}`}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{busy ? 'Saving…' : label}
          </button>
          {effective === 'KEPT' && sendsTo && <p className="text-xs text-gray-600 text-center">{sendsTo}</p>}
        </div>
      </div>
    </form>
  )
}

function Recorded({ data, onDone }: { data: CallRecordData; onDone: (m: string) => void }) {
  const when = (iso: string) => whenIn(iso, data.tz)
  const { call, prospect: p } = data
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] items-start">
      <section className={`${card} space-y-3 min-w-0`}>
        <h2 className={h2}>Call record</h2>
        <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[160px_minmax(0,1fr)] text-sm">
          <dt className="font-semibold text-gray-700">Result</dt><dd className="text-gray-900">{RESULT[call.status]?.label ?? call.status}{call.outcomeAt ? ` · recorded ${when(call.outcomeAt)}` : ''}</dd>
          {call.cancelReason && <><dt className="font-semibold text-gray-700">Reason</dt><dd className="text-gray-900">{call.cancelReason}</dd></>}
          {p.minor && call.status === 'KEPT' && <><dt className="font-semibold text-gray-700">Adult on the call</dt><dd className="text-gray-900">{call.parentAttendeeName ? `${call.parentAttendeeName}${call.parentAttendeeRelationship ? ` (${call.parentAttendeeRelationship})` : ''}` : call.parentAttended ? 'Yes' : 'Not recorded'}</dd></>}
          {call.status === 'KEPT' && <><dt className="font-semibold text-gray-700">Covered</dt><dd className="text-gray-900">{call.topicsCovered.length ? call.topicsCovered.join(' · ') : 'Not recorded'}</dd></>}
          <dt className="font-semibold text-gray-700">Notes</dt><dd className="text-gray-900 whitespace-pre-wrap break-words">{call.notes || 'None'}</dd>
          <dt className="font-semibold text-gray-700">Role</dt><dd className="text-gray-900">{p.roleLabel ?? 'Not chosen yet'}</dd>
        </dl>
      </section>
      {p.canChooseRole ? <DecideLater data={data} onDone={onDone} /> : (
        <section className={`${card} space-y-2 min-w-0`}>
          <h2 className={h2}>What&apos;s next</h2>
          <p className="text-sm text-gray-800">{data.nextStep}</p>
          {data.prospectHref ? <>
            <p className="text-sm text-gray-600">Changes to the role, notes and later steps are made on the prospect record.</p>
            <Link href={data.prospectHref} className={`mt-1 h-10 px-4 rounded-lg border border-gray-300 text-sm font-semibold inline-flex items-center ${focus}`}>Open prospect record</Link>
          </> : <p className="text-sm text-gray-600">An admin handles later changes to the role. Reply to any of our emails if something needs fixing.</p>}
        </section>
      )}
    </div>
  )
}

function DecideLater({ data, onDone }: { data: CallRecordData; onDone: (m: string) => void }) {
  const router = useRouter()
  const { prospect: p } = data
  const [choice, setChoice] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const roleName = data.roles.find((r) => r.role === choice)?.label ?? null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!choice) { setErr('Choose the role, or Not a fit.'); return }
    setBusy(true)
    try {
      const r = await decideAfterCall(data.call.id, { decision: choice, notes })
      if ('error' in r) setErr(r.error); else { onDone(r.message); router.refresh() }
    } catch {
      setErr('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  const label = choice === 'NOT_A_FIT' ? 'Close as not a fit and send a kind email' : choice ? callRecordSubmitLabel({ outcome: 'KEPT', role: choice as GetInvolvedRoleValue }, roleName, p.minor) : 'Choose a role'
  return (
    <form onSubmit={submit} noValidate className={`${card} space-y-3 min-w-0`}>
      <fieldset className="min-w-0" aria-describedby={err ? 'e-decide' : undefined}>
        <legend className="font-bold text-gray-900 mb-1">Choose the role</legend>
        <p className="text-sm text-gray-600 mb-3">The call was kept, but no role was chosen yet.</p>
        <div className="space-y-2">
          {[...data.roles.map((r) => ({ value: r.role, label: r.label, price: r.price })), { value: 'NOT_A_FIT', label: 'Not a fit', price: '' }].map((r) => (
            <label key={r.value} className={`flex items-center gap-3 min-h-11 px-3 py-2 rounded-lg cursor-pointer focus-within:ring-2 focus-within:ring-primary-500 ${choice === r.value ? (r.value === 'NOT_A_FIT' ? 'border-2 border-red-600 bg-red-50' : 'border-2 border-primary-700 bg-sky-50') : 'border border-gray-200'}`}>
              <input type="radio" name="decision" value={r.value} checked={choice === r.value} onChange={() => setChoice(r.value)} className="h-[18px] w-[18px] accent-primary-700" />
              <span className="flex-1 min-w-0 text-sm font-semibold text-gray-900">{r.label}</span>
              {r.price && <span className="text-xs text-gray-600">{r.price}</span>}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="decide-notes" className={lbl}>Note (admins only, optional)</label>
        <textarea id="decide-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={4000} className={`${field} py-2.5`} />
      </div>
      {err && <p id="e-decide" role="alert" className="text-sm text-red-700 rounded-lg bg-red-50 border border-red-200 px-3 py-2">{err}</p>}
      <button type="submit" disabled={busy} className={`w-full min-h-12 px-4 py-2 rounded-xl text-white text-[15px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 ${choice === 'NOT_A_FIT' ? 'bg-red-700 hover:bg-red-800' : 'bg-primary-700 hover:bg-primary-800'} ${focus}`}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{busy ? 'Saving…' : label}
      </button>
    </form>
  )
}
