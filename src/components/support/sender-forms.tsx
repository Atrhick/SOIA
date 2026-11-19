'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2, Send } from 'lucide-react'
import { kit } from '@/components/ui/kit/styles'
import { BODY_MAX, IMPERSONATION_REFUSAL, SUBJECT_MAX, SUPPORT_CATEGORIES } from '@/lib/support/core'
import { replyAsSender, sendSupportMessage } from '@/lib/actions/support'

function ErrorLine({ text }: { text: string | null }) {
  if (!text) return null
  return <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-base text-red-800">{text}</p>
}

function Viewing() {
  return <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-base text-amber-900">{IMPERSONATION_REFUSAL}</p>
}

/** "Send the team a message": category, subject, message. */
export function SendSupportForm({ impersonating }: { impersonating: boolean }) {
  const router = useRouter()
  const [category, setCategory] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (impersonating) { setError(IMPERSONATION_REFUSAL); return }
    if (!category) { setError('Please choose what it’s about.'); return }
    setBusy(true)
    setError(null)
    const r = await sendSupportMessage({ category, subject, body })
    setBusy(false)
    if (!r.ok) { setError(r.error); return }
    setSent(true)
    setCategory(''); setSubject(''); setBody('')
    router.refresh()
  }

  if (sent) {
    return (
      <div className={kit.card}>
        <p role="status" className="flex items-start gap-2 text-base text-gray-900">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
          <span><strong>Sent.</strong> The team will reply here and by email.</span>
        </p>
        <button type="button" className={`${kit.quiet} mt-2`} onClick={() => setSent(false)}>Send another message</button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className={`${kit.card} space-y-4`}>
      <h2 className="text-lg font-semibold text-gray-900">Send the team a message</h2>
      {impersonating && <Viewing />}
      <div>
        <label htmlFor="support-category" className={kit.label}>What is it about?</label>
        <select id="support-category" value={category} onChange={(e) => setCategory(e.target.value)} className={kit.input} disabled={impersonating}>
          <option value="">Choose one</option>
          {SUPPORT_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="support-subject" className={kit.label}>Subject</label>
        <input id="support-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={SUBJECT_MAX} className={kit.input} placeholder="For example: I can't open my program page" disabled={impersonating} />
      </div>
      <div>
        <label htmlFor="support-body" className={kit.label}>Your message</label>
        <textarea id="support-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={BODY_MAX} rows={6} className={kit.textarea} placeholder="Tell us what happened and what you were trying to do." disabled={impersonating} />
        <p className={kit.hint}>{body.length} of {BODY_MAX} characters</p>
      </div>
      <ErrorLine text={error} />
      <button type="submit" className={kit.primary} disabled={busy || impersonating}>
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        Send message
      </button>
    </form>
  )
}

/** The sender's reply box on their own message. */
export function SenderReplyForm({ messageId, impersonating, done }: { messageId: string; impersonating: boolean; done: boolean }) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (impersonating) { setError(IMPERSONATION_REFUSAL); return }
    setBusy(true); setError(null); setOk(false)
    const r = await replyAsSender(messageId, body)
    setBusy(false)
    if (!r.ok) { setError(r.error); return }
    setBody(''); setOk(true)
    router.refresh()
  }

  return (
    <form onSubmit={submit} className={`${kit.card} space-y-3`}>
      <label htmlFor="sender-reply" className={kit.label}>Reply</label>
      {impersonating && <Viewing />}
      {done && <p className={kit.hint}>This message is marked done. Replying opens it again.</p>}
      <textarea id="sender-reply" value={body} onChange={(e) => setBody(e.target.value)} maxLength={BODY_MAX} rows={4} className={kit.textarea} disabled={impersonating} />
      <ErrorLine text={error} />
      {ok && <p role="status" className="text-base text-green-700">Sent. The team will reply here and by email.</p>}
      <button type="submit" className={kit.primary} disabled={busy || impersonating || !body.trim()}>
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        Send reply
      </button>
    </form>
  )
}
