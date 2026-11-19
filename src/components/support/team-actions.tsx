'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Send, UserCheck } from 'lucide-react'
import { kit } from '@/components/ui/kit/styles'
import { BODY_MAX, TEAM_STATUS_CHOICES, TEAM_STATUS_LABEL, type SupportStatus } from '@/lib/support/core'
import { assignSupportMessage, replyAsTeam, setSupportStatus } from '@/lib/actions/support'

type Banner = { ok: boolean; text: string } | null

function BannerLine({ b }: { b: Banner }) {
  if (!b) return null
  return (
    <p role={b.ok ? 'status' : 'alert'} className={b.ok ? 'text-base text-green-700' : 'rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-base text-red-800'}>
      {b.text}
    </p>
  )
}

export interface AssigneeOption { id: string; name: string; email: string; role: 'ADMIN' | 'SUB_ADMIN' }

/** Assign / reassign (admins only). */
export function AssignBox({ messageId, current, people }: { messageId: string; current: { id: string; name: string } | null; people: AssigneeOption[] }) {
  const router = useRouter()
  const [pick, setPick] = useState('')
  const [busy, setBusy] = useState(false)
  const [b, setB] = useState<Banner>(null)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pick) { setB({ ok: false, text: 'Please choose someone.' }); return }
    setBusy(true); setB(null)
    const r = await assignSupportMessage(messageId, pick)
    setBusy(false)
    if (!r.ok) { setB({ ok: false, text: r.error }); return }
    setB({ ok: true, text: 'Assigned. They have been told.' }); setPick('')
    router.refresh()
  }
  return (
    <form onSubmit={submit} className="space-y-2">
      <label htmlFor="assign-to" className={kit.label}>{current ? 'Reassign to' : 'Assign to'}</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <select id="assign-to" value={pick} onChange={(e) => setPick(e.target.value)} className={`${kit.input} min-w-0`}>
          <option value="">Choose a team member</option>
          {people.filter((p) => p.id !== current?.id).map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({p.role === 'ADMIN' ? 'admin' : 'sub-admin'})</option>
          ))}
        </select>
        <button type="submit" className={`${kit.secondary} shrink-0`} disabled={busy}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserCheck className="h-5 w-5" />}
          {current ? 'Reassign' : 'Assign'}
        </button>
      </div>
      <BannerLine b={b} />
    </form>
  )
}

/** Change the status on its own (no reply). */
export function StatusBox({ messageId, status, hasAssignee }: { messageId: string; status: SupportStatus; hasAssignee: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [b, setB] = useState<Banner>(null)
  const go = async (to: string) => {
    setBusy(to); setB(null)
    const r = await setSupportStatus(messageId, to)
    setBusy(null)
    if (!r.ok) { setB({ ok: false, text: r.error }); return }
    setB({ ok: true, text: 'Status changed. The sender has been told.' })
    router.refresh()
  }
  const label = (s: (typeof TEAM_STATUS_CHOICES)[number]) => (s === 'ASSIGNED' ? (status === 'DONE' ? 'Open again' : 'No longer waiting') : s === 'DONE' ? 'Mark done' : TEAM_STATUS_LABEL[s])
  return (
    <div className="space-y-2">
      <p className={kit.label}>Status</p>
      <div className="flex flex-wrap gap-2">
        {TEAM_STATUS_CHOICES.filter((s) => s !== status && (hasAssignee || s === 'DONE')).map((s) => (
          <button key={s} type="button" className={kit.secondary} disabled={!!busy} onClick={() => go(s)}>
            {busy === s && <Loader2 className="h-5 w-5 animate-spin" />}
            {label(s)}
          </button>
        ))}
      </div>
      <BannerLine b={b} />
    </div>
  )
}

/** The team's reply. "Then" lets the reply also ask the sender something or close it, with one notice to them. */
export function TeamReplyForm({ messageId, status, takes }: { messageId: string; status: SupportStatus; takes: boolean }) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [then, setThen] = useState('')
  const [busy, setBusy] = useState(false)
  const [b, setB] = useState<Banner>(null)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setB(null)
    const r = await replyAsTeam(messageId, body, then || null)
    setBusy(false)
    if (!r.ok) { setB({ ok: false, text: r.error }); return }
    setBody(''); setThen('')
    setB({ ok: true, text: 'Sent. They get it in the app and by email, signed by the NowTRANSFORMED team.' })
    router.refresh()
  }
  return (
    <form onSubmit={submit} className={`${kit.card} space-y-3`}>
      <label htmlFor="team-reply" className={kit.label}>Reply to the sender</label>
      <p className={kit.hint}>They see it as coming from the NowTRANSFORMED team, not from you by name.{takes ? ' Replying assigns this message to you.' : ''}</p>
      <textarea id="team-reply" value={body} onChange={(e) => setBody(e.target.value)} maxLength={BODY_MAX} rows={5} className={kit.textarea} />
      <div>
        <label htmlFor="team-then" className={kit.label}>After sending</label>
        <select id="team-then" value={then} onChange={(e) => setThen(e.target.value)} className={kit.input}>
          <option value="">Keep the status{status === 'DONE' ? ' (Done)' : ''}</option>
          {status !== 'WAITING_ON_SENDER' && <option value="WAITING_ON_SENDER">I asked them something: waiting on sender</option>}
          {status !== 'DONE' && <option value="DONE">That solves it: mark done</option>}
        </select>
      </div>
      <BannerLine b={b} />
      <button type="submit" className={kit.primary} disabled={busy || !body.trim()}>
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        Send reply
      </button>
    </form>
  )
}
