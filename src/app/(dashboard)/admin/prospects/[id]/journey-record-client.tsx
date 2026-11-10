'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, Copy, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { addProspectNote, changeProspectRole, markProspectNotAFit, resendAssessmentQuestions } from '@/lib/actions/journey-admin'
import type { ActivityItem, RecordData, StepItem } from './record-data'

const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2'
const CARD = 'bg-white border border-gray-200 rounded-2xl p-5'
const CARD_TITLE = 'text-xs font-bold uppercase tracking-wide text-primary-800'
const BTN_OUTLINE = `h-10 px-4 rounded-xl border text-sm font-semibold inline-flex items-center justify-center gap-2 bg-white disabled:opacity-50 ${FOCUS}`
const TZ = 'America/Chicago'

function fmt(isoStr: string, withTime = true) {
  const d = new Date(isoStr)
  const now = new Date()
  const key = (x: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(x)
  const time = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).format(d)
  const yesterday = new Date(now.getTime() - 86400_000)
  const day = key(d) === key(now) ? 'Today' : key(d) === key(yesterday) ? 'Yesterday'
    : new Intl.DateTimeFormat('en-US', { timeZone: TZ, month: 'short', day: 'numeric', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) }).format(d)
  return withTime ? `${day} ${time}` : day
}

type Dlg = null | 'resend' | 'role' | 'notfit'

export function JourneyRecordClient({ record: r, readOnly }: { record: RecordData; readOnly: boolean }) {
  const [dlg, setDlg] = useState<Dlg>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const done = (msg?: string) => { setDlg(null); setFlash(msg ?? 'Saved.') }

  return (
    <div className="space-y-5 max-w-6xl">
      <nav aria-label="Breadcrumb" className="text-sm">
        <ol className="flex flex-wrap items-center gap-1">
          <li><Link href="/admin/prospects" className={`text-primary-700 hover:underline rounded ${FOCUS}`}>Prospects</Link></li>
          <li aria-hidden className="text-gray-400">/</li>
          <li aria-current="page" className="font-semibold text-gray-900 break-all">{r.name}</li>
        </ol>
      </nav>

      {/* Header */}
      <section className={`${CARD} flex flex-col lg:flex-row lg:items-start gap-4 justify-between`}>
        <div className="flex items-start gap-4 min-w-0">
          <div aria-hidden className="h-14 w-14 shrink-0 rounded-full bg-sky-100 text-primary-800 font-bold text-lg flex items-center justify-center">{r.initials}</div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 break-words">{r.name}</h1>
            <p className="text-sm text-gray-700 mt-0.5 break-words">
              <a href={`mailto:${r.email}`} className={`hover:underline rounded ${FOCUS}`}>{r.email}</a>
              {r.phone && <> · <a href={`tel:${r.phone}`} className={`hover:underline rounded ${FOCUS}`}>{r.phone}</a></>}
              {r.city && <> · {r.city}</>}
            </p>
            <ul className="flex flex-wrap gap-1.5 mt-2" aria-label="Summary">
              <li className="text-xs font-semibold rounded-full px-2.5 py-1 bg-gray-100 text-gray-800">{r.ageLabel}</li>
              {r.roleLabel && <li className="text-xs font-semibold rounded-full px-2.5 py-1 bg-sky-100 text-sky-900">{r.roleLabel}{r.rolePrice ? ` · ${r.rolePrice}` : ''}</li>}
              <li className={`text-xs font-semibold rounded-full px-2.5 py-1 ${r.stageClass}`}>{r.stageLabel}</li>
            </ul>
            {r.parent && (
              <p className="text-sm text-orange-900 mt-2 break-words">
                Parent: {r.parent.name ?? 'not given'}{r.parent.relationship ? ` (${r.parent.relationship})` : ''}{r.parent.email ? ` · ${r.parent.email}` : ''}{r.parent.phone ? ` · ${r.parent.phone}` : ''}
                {' · '}{r.parent.consentAt ? `consent given ${fmt(r.parent.consentAt, false).toLowerCase()}` : 'no consent yet'}
              </p>
            )}
          </div>
        </div>
        {!readOnly && (
          <div className="flex flex-wrap gap-2 lg:justify-end lg:shrink-0">
            {r.can.resend && <button type="button" onClick={() => setDlg('resend')} className={`${BTN_OUTLINE} border-primary-300 text-primary-800 hover:bg-primary-50`}>Resend questions</button>}
            {r.can.changeRole && r.roleOptions.length > 0 && (
              <button type="button" onClick={() => setDlg('role')} className={`${BTN_OUTLINE} border-primary-300 text-primary-800 hover:bg-primary-50`}>{r.role ? 'Change role' : 'Choose role'}</button>
            )}
            {r.can.notAFit && <button type="button" onClick={() => setDlg('notfit')} className={`${BTN_OUTLINE} border-red-300 text-red-700 hover:bg-red-50`}>Mark not a fit</button>}
          </div>
        )}
      </section>

      {flash && (
        <div role="status" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 flex items-start justify-between gap-3">
          <span>{flash}</span>
          <button type="button" onClick={() => setFlash(null)} className={`text-green-900 font-semibold rounded ${FOCUS}`}>Dismiss</button>
        </div>
      )}

      <Progress steps={r.steps} closedNote={r.closedNote} nextStep={r.nextStep} />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,370px)] gap-5 items-start">
        <Activity items={r.activity} nextStep={r.closedNote ? null : r.nextStep} waitingOn={r.waitingOn} />

        <div className="space-y-5 min-w-0">
          <InvitedBy r={r} />
          <CallNotes r={r} />
          <Answers r={r} />
          <Details r={r} />
          {r.link && <JourneyLink link={r.link} />}
          {!readOnly && <AddNote prospectId={r.id} onSaved={(m) => setFlash(m)} />}
        </div>
      </div>

      <p className="text-xs text-gray-600">
        Need the older coach-pipeline tools for this person?{' '}
        <Link href={`/admin/prospects/${r.id}?view=classic`} className={`font-semibold text-primary-700 hover:underline rounded ${FOCUS}`}>Open the classic detail page</Link>
      </p>

      {dlg === 'resend' &&<ResendDialog r={r} onClose={() => setDlg(null)} onDone={done} />}
      {dlg === 'role' && <RoleDialog r={r} onClose={() => setDlg(null)} onDone={done} />}
      {dlg === 'notfit' && <NotFitDialog r={r} onClose={() => setDlg(null)} onDone={done} />}
    </div>
  )
}

// ---------- progress ----------

function Progress({ steps, closedNote, nextStep }: { steps: StepItem[]; closedNote: string | null; nextStep: string }) {
  const style: Record<StepItem['state'], string> = {
    done: 'bg-green-100 text-green-800',
    current: 'bg-primary-700 text-white',
    todo: 'bg-gray-100 text-gray-600',
    stopped: 'bg-red-50 text-red-800 border border-red-200',
  }
  const sr: Record<StepItem['state'], string> = { done: 'done', current: 'current step', todo: 'not yet', stopped: 'stopped here' }
  return (
    <section aria-label="Journey progress" className={CARD}>
      <ol className="grid grid-cols-2 sm:grid-cols-4 lg:grid-flow-col lg:auto-cols-fr lg:grid-cols-none gap-2">
        {steps.map((s) => (
          <li key={s.stage} aria-current={s.state === 'current' ? 'step' : undefined} className={`rounded-xl px-3 py-2.5 text-sm font-semibold text-center inline-flex items-center justify-center gap-1 ${style[s.state]}`}>
            {s.state === 'done' && <Check className="h-4 w-4 shrink-0" aria-hidden />}
            <span>{s.label}</span>
            <span className="sr-only">({sr[s.state]})</span>
          </li>
        ))}
      </ol>
      <p className="text-sm text-gray-700 mt-3">{closedNote ? <span className="text-red-800 font-semibold">{closedNote}</span> : <>Next: <strong>{nextStep}</strong></>}</p>
    </section>
  )
}

// ---------- activity ----------

function Activity({ items, nextStep, waitingOn }: { items: ActivityItem[]; nextStep: string | null; waitingOn: string }) {
  const dot: Record<ActivityItem['kind'], string> = { status: 'bg-primary-700', email: 'bg-sky-500', call: 'bg-primary-700', note: 'bg-amber-500', action: 'bg-gray-500' }
  return (
    <section aria-labelledby="act-h" className={CARD}>
      <h2 id="act-h" className="text-lg font-bold text-gray-900">Activity</h2>
      {nextStep && waitingOn !== 'NONE' && (
        <p className="mt-3 flex items-start gap-3 text-sm text-gray-900">
          <span aria-hidden className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-orange-500" />
          <span><strong>Waiting on {waitingOn === 'STAFF' ? 'staff' : waitingOn === 'PARENT' ? 'the parent' : 'the prospect'}:</strong> {nextStep}</span>
        </p>
      )}
      {items.length === 0 ? <p className="text-sm text-gray-600 mt-3">Nothing has happened yet.</p> : (
        <ol className="mt-3 space-y-4">
          {items.map((a, i) => (
            <li key={`${a.at}-${i}`} className="flex items-start gap-3">
              <span aria-hidden className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${dot[a.kind]}`} />
              <div className="min-w-0">
                <p className={`text-sm text-gray-900 break-words whitespace-pre-line ${a.kind === 'note' ? 'bg-amber-50 border border-amber-100 rounded-lg px-3 py-2' : ''}`}>
                  {a.kind === 'note' && <span className="font-semibold">Note: </span>}{a.text}
                </p>
                <p className="text-xs text-gray-600 mt-0.5"><time dateTime={a.at}>{fmt(a.at)}</time>{a.by ? ` · ${a.by}` : ''}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

// ---------- side cards ----------

function InvitedBy({ r }: { r: RecordData }) {
  return (
    <section aria-labelledby="inv-h" className={CARD}>
      <h2 id="inv-h" className={CARD_TITLE}>Invited by</h2>
      {r.inviter ? (
        <div className="mt-3 flex items-start gap-3">
          <div aria-hidden className="h-10 w-10 shrink-0 rounded-full bg-sky-100 text-primary-800 text-sm font-bold flex items-center justify-center">
            {r.inviter.name.split(/\s+/).map((w) => (w?.[0] || '').toUpperCase()).slice(0, 2).join('') || '?'}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 break-words">{r.inviter.name}</p>
            <p className="text-sm text-gray-700">{r.inviter.roleLabel} · {r.inviter.credit}</p>
            {r.inviter.source && <p className="text-xs text-gray-600 mt-0.5">{r.inviter.source}</p>}
            {r.inviter.note && <p className="text-sm text-gray-700 mt-2 whitespace-pre-line break-words">&ldquo;{r.inviter.note}&rdquo;</p>}
          </div>
        </div>
      ) : <p className="text-sm text-gray-600 mt-2">No inviter. They came in without an invite link, so no one gets credit.</p>}
    </section>
  )
}

const CALL_LABEL: Record<string, string> = { BOOKED: 'Booked', KEPT: 'Kept', NO_SHOW: 'No-show', CANCELLED: 'Cancelled' }

function CallNotes({ r }: { r: RecordData }) {
  const withNotes = r.calls.filter((c) => c.notes || c.topics.length || c.parentAttendee)
  return (
    <section aria-labelledby="call-h" className={CARD}>
      <h2 id="call-h" className={CARD_TITLE}>Call notes</h2>
      {withNotes.length === 0 ? <p className="text-sm text-gray-600 mt-2">No call notes yet.</p> : withNotes.map((c) => (
        <div key={c.id} className="mt-2 text-sm text-gray-800 space-y-1.5">
          {c.notes && <p className="whitespace-pre-line break-words">{c.notes}</p>}
          {c.topics.length > 0 && <p><span className="font-semibold">Topics:</span> {c.topics.join(', ')}</p>}
          {c.parentAttendee && <p><span className="font-semibold">Parent on the call:</span> {c.parentAttendee}</p>}
        </div>
      ))}
      {r.calls.length > 0 && (
        <ul className="mt-3 border-t border-gray-100 pt-2 space-y-1">
          {r.calls.map((c) => (
            <li key={c.id} className="text-xs text-gray-600 flex flex-wrap justify-between gap-x-2">
              <span>{fmt(c.startsAt)}{c.host ? ` · ${c.host}` : ''}</span>
              <span className="font-semibold">{CALL_LABEL[c.status] ?? c.status}{c.cancelReason ? `: ${c.cancelReason}` : ''}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Answers({ r }: { r: RecordData }) {
  const a = r.assessment
  let body: React.ReactNode
  if (a.answers) {
    body = (
      <dl className="mt-2 space-y-3">
        {a.answers.map((x, i) => (
          <div key={i}>
            <dt className="text-sm font-semibold text-gray-900">{i + 1}. {x.question}</dt>
            <dd className="text-sm text-gray-800 whitespace-pre-line break-words">{x.answer || '(no answer)'}{x.type === 'SCALE_1_5' ? ' / 5' : ''}</dd>
          </div>
        ))}
        {a.submittedAt && <p className="text-xs text-gray-600">Answered {fmt(a.submittedAt)}</p>}
      </dl>
    )
  } else if (!r.role) {
    body = <p className="text-sm text-gray-600 mt-2">The questions go out once a role is chosen.</p>
  } else if (r.role === 'SPONSOR') {
    body = <p className="text-sm text-gray-600 mt-2">Sponsors don&apos;t answer an assessment.</p>
  } else if (!a.sentAt) {
    body = <p className="text-sm text-gray-600 mt-2">Not sent yet.</p>
  } else {
    let reminder = ''
    if (a.reminderSentAt) reminder = ` Reminder sent ${fmt(a.reminderSentAt, false).toLowerCase()}.`
    else if (a.reminderDueAt) {
      const days = Math.ceil((new Date(a.reminderDueAt).getTime() - Date.now()) / 86400_000)
      reminder = days > 0 ? ` Auto reminder in ${days} day${days === 1 ? '' : 's'}.` : ' Auto reminder due now.'
    }
    body = <p className="text-sm text-gray-700 mt-2">Not answered yet.{reminder}</p>
  }
  return (
    <section aria-labelledby="ans-h" className={CARD}>
      <h2 id="ans-h" className={CARD_TITLE}>Assessment answers</h2>
      {body}
    </section>
  )
}

function Details({ r }: { r: RecordData }) {
  const rows: [string, string][] = []
  if (r.orientation.watchedAt) rows.push(['Orientation', `Watched ${fmt(r.orientation.watchedAt)}`])
  else if (r.orientation.remindAt) rows.push(['Orientation', `Will watch ${fmt(r.orientation.remindAt)}${r.orientation.reminderSentAt ? ` · reminder sent ${fmt(r.orientation.reminderSentAt, false).toLowerCase()}` : ''}`])
  if (r.orientation.checkAnswer) rows.push(['Orientation check', r.orientation.checkAnswer])
  if (r.terms.acceptedAt) rows.push(['Terms', `Accepted ${fmt(r.terms.acceptedAt)}${r.terms.version ? ` · version ${r.terms.version}` : ''}`])
  if (r.payment) {
    const amt = r.payment.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
    rows.push(['Payment', `${amt}${r.payment.billing ? ` (${r.payment.billing.toLowerCase().replace('_', ' ')})` : ''} · ${r.payment.status.toLowerCase()}${r.payment.paidAt ? ` ${fmt(r.payment.paidAt, false).toLowerCase()}` : ''}${r.payment.failure ? ` · ${r.payment.failure}` : ''}`])
  }
  if (r.login) rows.push(['Login', `${r.login.email ?? 'Created'}${r.login.joinedAt ? ` · joined ${fmt(r.login.joinedAt, false).toLowerCase()}` : ''}`])
  if (rows.length === 0) return null
  return (
    <section aria-labelledby="det-h" className={CARD}>
      <h2 id="det-h" className={CARD_TITLE}>Orientation, terms and login</h2>
      <dl className="mt-2 space-y-2">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs font-semibold text-gray-600">{k}</dt>
            <dd className="text-sm text-gray-900 break-words">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function JourneyLink({ link }: { link: NonNullable<RecordData['link']> }) {
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null)
  const id = useId()
  async function copy() {
    try { await navigator.clipboard.writeText(link.url); setCopied('ok') } catch { setCopied('fail') }
    setTimeout(() => setCopied(null), 2500)
  }
  return (
    <section aria-labelledby={`${id}-h`} className={CARD}>
      <h2 id={`${id}-h`} className={CARD_TITLE}>Their link</h2>
      <p className="text-sm text-gray-700 mt-2">{link.label}{link.expiresAt && !link.usable ? ' · expired' : link.expiresAt ? ` · works until ${fmt(link.expiresAt, false)}` : ''}</p>
      <div className="mt-2 flex gap-2">
        <label htmlFor={`${id}-u`} className="sr-only">Link</label>
        <input id={`${id}-u`} readOnly value={link.url} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 h-10 rounded-xl border border-gray-300 bg-gray-50 px-3 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500" />
        <button type="button" onClick={copy} className={`${BTN_OUTLINE} border-gray-300 text-gray-800 hover:bg-gray-50 shrink-0`}>
          {copied === 'ok' ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          {copied === 'ok' ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p role="status" className="text-xs text-red-700 mt-1 min-h-[1rem]">{copied === 'fail' ? 'Could not copy. Select the link and copy it by hand.' : ''}</p>
      {!link.usable && <p className="text-xs text-gray-600">This link has expired. Resending an email gives them a fresh one.</p>}
    </section>
  )
}

function AddNote({ prospectId, onSaved }: { prospectId: string; onSaved: (m: string) => void }) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) { setErr('Write a note first.'); return }
    setBusy(true); setErr(null)
    const x = await addProspectNote(prospectId, { body })
    setBusy(false)
    if ('error' in x) { setErr(x.error); return }
    setBody('')
    onSaved(x.message ?? 'Note saved.')
    router.refresh()
  }
  return (
    <form onSubmit={save} className={CARD} noValidate>
      <label htmlFor="note-body" className={`${CARD_TITLE} block`}>Add a note</label>
      <textarea
        id="note-body" value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={4000}
        placeholder="Visible to admins only" aria-invalid={!!err} aria-describedby={err ? 'note-err' : undefined}
        className={`mt-3 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${err ? 'border-red-400' : 'border-gray-300'}`}
      />
      {err && <p id="note-err" role="alert" className="text-sm text-red-700 mt-1">{err}</p>}
      <button type="submit" disabled={busy} className={`mt-2 w-full h-11 rounded-xl bg-primary-700 hover:bg-primary-800 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60 ${FOCUS}`}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Save note
      </button>
    </form>
  )
}

// ---------- dialogs ----------

function Shell({ title, description, children, onClose }: { title: string; description: React.ReactNode; children: React.ReactNode; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto rounded-2xl sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-left">{title}</DialogTitle>
          <DialogDescription className="text-left text-gray-700">{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}

function Footer({ busy, onClose, label, danger, disabled }: { busy: boolean; onClose: () => void; label: string; danger?: boolean; disabled?: boolean }) {
  return (
    <DialogFooter className="gap-2">
      <button type="button" onClick={onClose} className={`${BTN_OUTLINE} border-gray-300 text-gray-800 hover:bg-gray-50`}>Cancel</button>
      <button type="submit" disabled={busy || disabled} className={`h-10 px-4 rounded-xl text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60 ${FOCUS} ${danger ? 'bg-red-700 hover:bg-red-800' : 'bg-primary-700 hover:bg-primary-800'}`}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{label}
      </button>
    </DialogFooter>
  )
}

type DlgProps = { r: RecordData; onClose: () => void; onDone: (m?: string) => void }

function useSubmit(run: () => Promise<{ success: true; message?: string } | { error: string }>, onDone: (m?: string) => void) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      const x = await run()
      if ('error' in x) { setErr(x.error); return }
      onDone(x.message)
      router.refresh()
    } catch {
      setErr('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  return { busy, err, setErr, submit }
}

function ResendDialog({ r, onClose, onDone }: DlgProps) {
  const { busy, err, submit } = useSubmit(() => resendAssessmentQuestions(r.id), onDone)
  return (
    <Shell title="Resend the questions?" onClose={onClose} description={<>We&apos;ll email the {r.roleLabel} questions to {r.email}{r.minor ? ' and their parent' : ''} again, with a fresh link that works for 14 days.</>}>
      <form onSubmit={submit} className="space-y-3">
        {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
        <Footer busy={busy} onClose={onClose} label="Send the questions" />
      </form>
    </Shell>
  )
}

function RoleDialog({ r, onClose, onDone }: DlgProps) {
  const [role, setRole] = useState('')
  const [reason, setReason] = useState('')
  const [fieldErr, setFieldErr] = useState<string | null>(null)
  const { busy, err, submit } = useSubmit(() => changeProspectRole(r.id, { role, reason }), onDone)
  const hasProgress = !!(r.assessment.sentAt || r.assessment.submittedAt || r.orientation.watchedAt || r.orientation.remindAt)
  return (
    <Shell
      title={r.role ? 'Change role' : 'Choose a role'}
      onClose={onClose}
      description={<>Only roles open to {r.ageLabel} are listed. {r.role ? <>They&apos;ll get a new email with the new role&apos;s next step.{hasProgress ? ' Their answers and orientation progress for the current role are cleared.' : ''}</> : 'They’ll get an email with the role’s 3 questions.'}</>}
    >
      <form onSubmit={(e) => { if (!role) { e.preventDefault(); setFieldErr('Choose a role.'); return } setFieldErr(null); submit(e) }} className="space-y-4" noValidate>
        <fieldset aria-describedby={fieldErr ? 'role-err' : undefined}>
          <legend className="text-sm font-semibold text-gray-800 mb-2">Role</legend>
          <div className="space-y-2">
            {r.roleOptions.map((o) => {
              const current = o.value === r.role
              return (
                <label key={o.value} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm cursor-pointer focus-within:ring-2 focus-within:ring-primary-500 ${role === o.value ? 'border-primary-700 bg-primary-50' : 'border-gray-300'} ${current ? 'opacity-60 cursor-not-allowed' : ''}`}>
                  <input type="radio" name="role" value={o.value} checked={role === o.value} disabled={current} onChange={() => setRole(o.value)} className="h-4 w-4 text-primary-700 focus:ring-primary-500" />
                  <span className="flex-1 font-semibold text-gray-900">{o.label}{current ? ' (current)' : ''}</span>
                  <span className="text-gray-600">{o.price}</span>
                </label>
              )
            })}
          </div>
          {fieldErr && <p id="role-err" role="alert" className="text-sm text-red-700 mt-1">{fieldErr}</p>}
        </fieldset>
        {r.role && (
          <div>
            <label htmlFor="role-reason" className="block text-sm font-semibold text-gray-800 mb-1">Reason (admins only, optional)</label>
            <textarea id="role-reason" rows={2} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        )}
        {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
        <Footer busy={busy} onClose={onClose} label={r.role ? 'Change role and email them' : 'Choose role and email them'} />
      </form>
    </Shell>
  )
}

function NotFitDialog({ r, onClose, onDone }: DlgProps) {
  const [note, setNote] = useState('')
  const { busy, err, submit } = useSubmit(() => markProspectNotAFit(r.id, { note }), onDone)
  return (
    <Shell
      title={`Mark ${r.name} not a fit?`}
      onClose={onClose}
      description={<>They&apos;ll get a kind email{r.minor ? ' (copied to their parent)' : ''}{r.inviter ? `, and ${r.inviter.name} gets a short heads-up` : ''}. Any booked call is cancelled and a pending payment is closed. This can&apos;t be undone here.</>}
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="nf-note" className="block text-sm font-semibold text-gray-800 mb-1">Reason (admins only, optional)</label>
          <textarea id="nf-note" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
        <Footer busy={busy} onClose={onClose} label="Mark not a fit" danger />
      </form>
    </Shell>
  )
}
