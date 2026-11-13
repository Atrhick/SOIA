'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, AlertCircle, Loader2, Plus, X, ClipboardList } from 'lucide-react'
import { kit } from '@/components/ui/kit/styles'
import { useToast } from '@/components/ui/kit/toast'
import { HelpTip } from '@/components/ui/kit/help-tip'
import { sendInvites, type InviteResult } from '@/lib/actions/outreach-invites'
import { buildInviteText, isValidEmail, parsePastedList, pickInviteScript } from '@/lib/get-involved/outreach-invites'
import { suggestEmail } from '@/lib/get-involved/email-typo'
import { disclosureLine } from '@/lib/get-involved/outreach-templates'
import type { InviteProgramOption } from '@/components/get-involved/share-kit/data'
import { hasBlank } from '@/lib/get-involved/scripts'
import { ideasFor } from '@/lib/get-involved/line-ideas'
import { LineIdeasPicker } from './line-ideas-picker'
import { PERSONAL_EXAMPLES } from './shared'

interface Row { key: number; firstName: string; email: string; parent: boolean }
type FieldError = { key: number | 'tick' | 'personal'; field: 'firstName' | 'email' | 'tick' | 'personal'; text: string } | null

export function EmailForMe(props: {
  role: 'COACH' | 'AMBASSADOR'
  program: InviteProgramOption
  myFirstName: string
  myFullName: string
  photoUrl: string | null
  usedToday: number
  limit: number
}) {
  const { program } = props
  const router = useRouter()
  const toast = useToast()
  const seq = useRef(1)
  const [rows, setRows] = useState<Row[]>([{ key: 0, firstName: '', email: '', parent: false }])
  const [personal, setPersonal] = useState('')
  const personalRef = useRef<HTMLTextAreaElement>(null)
  const [iKnow, setIKnow] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [paste, setPaste] = useState('')
  const [pasteNote, setPasteNote] = useState<string | null>(null)
  const [err, setErr] = useState<FieldError>(null)
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<InviteResult[]>([])
  const [used, setUsed] = useState(props.usedToday)
  const left = Math.max(0, props.limit - used)

  const filled = rows.filter((r) => r.firstName.trim() || r.email.trim())
  const previewRow = filled[0] ?? rows[0]

  const preview = useMemo(() => {
    const script = pickInviteScript((k) => program.scripts[k], previewRow.parent)
    if (!script) return null
    return buildInviteText({
      script,
      values: { firstName: previewRow.firstName.trim() || '[first name]', personalLine: personal, myName: props.myFirstName, business: program.business, program: program.program, programLine: program.programLine, link: '', sponsorship: program.sponsorship, owns: program.owns, mainLink: program.id === null },
      disclosure: disclosureLine(props.role, program.owns),
      senderFullName: props.myFullName,
    })
  }, [program, previewRow.firstName, previewRow.parent, personal, props.myFirstName, props.myFullName, props.role])

  const update = (key: number, patch: Partial<Row>) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
    if (err && err.key === key) setErr(null)
  }
  const addRow = () => {
    const key = seq.current++
    setRows((rs) => [...rs, { key, firstName: '', email: '', parent: false }])
    setTimeout(() => document.getElementById(`ef-name-${key}`)?.focus(), 0)
  }
  const removeRow = (key: number) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : rs))

  function addPasted() {
    const { people, unreadable } = parsePastedList(paste)
    if (!people.length) { setPasteNote('We couldn\'t find any email addresses. Put one person on each line, like "Maria, maria@example.com".'); return }
    const keep = rows.filter((r) => r.firstName.trim() || r.email.trim())
    const added = people.map((p) => ({ key: seq.current++, firstName: p.firstName, email: p.email, parent: false }))
    setRows([...keep, ...added])
    setPaste(''); setPasteOpen(false)
    setPasteNote(null)
    const missing = added.filter((r) => !r.firstName).length
    toast.success(`Added ${added.length} ${added.length === 1 ? 'person' : 'people'}.${missing ? ` Add a first name for ${missing}.` : ''}${unreadable.length ? ` Skipped ${unreadable.length} line${unreadable.length === 1 ? '' : 's'} with no email.` : ''}`)
  }

  function fail(e: NonNullable<FieldError>) {
    setErr(e)
    const id = e.field === 'tick' ? 'ef-tick' : e.field === 'personal' ? 'ef-personal' : `ef-${e.field === 'firstName' ? 'name' : 'email'}-${e.key}`
    setTimeout(() => { const el = document.getElementById(id); el?.focus(); el?.scrollIntoView({ block: 'center', behavior: 'smooth' }) }, 0)
  }

  async function send() {
    const list = rows.filter((r) => r.firstName.trim() || r.email.trim())
    if (!list.length) return fail({ key: rows[0].key, field: 'firstName', text: 'Add the first name of the person to invite.' })
    for (const r of list) {
      if (!r.firstName.trim()) return fail({ key: r.key, field: 'firstName', text: 'Add their first name.' })
      if (!r.email.trim()) return fail({ key: r.key, field: 'email', text: `Add ${r.firstName.trim()}'s email address.` })
      if (!isValidEmail(r.email)) return fail({ key: r.key, field: 'email', text: "That email address isn't complete. Check it, e.g. name@example.com." })
      const typo = suggestEmail(r.email)
      if (typo) return fail({ key: r.key, field: 'email', text: `That looks mistyped. Did you mean ${typo}?` })
    }
    if (hasBlank(personal)) return fail({ key: 'personal', field: 'personal', text: 'Change the part in [brackets] to your own words.' })
    if (left <= 0) { toast.error(`Limit reached: you can send to ${props.limit} people a day. Try again tomorrow, or copy a message to send yourself.`); return }
    if (!iKnow) return fail({ key: 'tick', field: 'tick', text: 'Tick this box to confirm you know these people.' })

    setBusy(true); setErr(null)
    const r = await sendInvites({ programId: program.id, people: list.map((x) => ({ firstName: x.firstName, email: x.email, parent: x.parent })), personalLine: personal, iKnowThem: true })
    setBusy(false)
    if (!r.ok) { toast.error(r.error); return }
    setResults(r.results)
    setUsed(r.usedToday)
    if (r.summary.ok) toast.success(r.summary.text)
    else toast.error(r.summary.text)
    // Keep only the people who still need a look (mistyped, not sent), so they can be fixed and sent again.
    const fix = new Set(r.results.filter((x) => !x.ok && (x.suggestion || /didn't send|isn't complete|first name/.test(x.text))).map((x) => x.email))
    const keep = list.filter((x) => fix.has(x.email.trim().toLowerCase()))
    setRows(keep.length ? keep : [{ key: seq.current++, firstName: '', email: '', parent: false }])
    if (!keep.length) { setIKnow(false); setPersonal('') }
    router.refresh()
  }

  function applySuggestion(email: string, suggestion: string) {
    setRows((rs) => rs.map((r) => (r.email.trim().toLowerCase() === email ? { ...r, email: suggestion } : r)))
    setResults((xs) => xs.filter((x) => x.email !== email))
  }

  const count = filled.length || 1
  const sendLabel = count > 1 ? `Send ${count} invitations` : 'Send invitation'

  return (
    <div className="space-y-5">
      <p className="rounded-xl bg-amber-50 px-4 py-3 text-base text-amber-950">
        <strong>Under 18?</strong> Enter their parent&apos;s name and email, and tick &quot;Parent of a teen&quot;. We never email anyone under 18.
      </p>

      <fieldset className="space-y-4">
        <legend className="sr-only">Who to invite</legend>
        {rows.map((r, i) => {
          const typo = r.email.includes('@') ? suggestEmail(r.email) : null
          const nameErr = err && err.key === r.key && err.field === 'firstName' ? err.text : null
          const emailErr = err && err.key === r.key && err.field === 'email' ? err.text : null
          return (
            <div key={r.key} className="rounded-2xl border border-gray-200 p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <p className="text-base font-semibold text-gray-900">{rows.length > 1 ? `Person ${i + 1}` : 'Who are you inviting?'}</p>
                {rows.length > 1 && (
                  <button type="button" onClick={() => removeRow(r.key)} aria-label={`Remove person ${i + 1}`} className={`inline-flex h-11 w-11 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 ${kit.ring}`}><X className="h-5 w-5" aria-hidden /></button>
                )}
              </div>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor={`ef-name-${r.key}`} className={kit.label}>{r.parent ? "Parent's first name" : 'First name'}</label>
                  <input id={`ef-name-${r.key}`} value={r.firstName} onChange={(e) => update(r.key, { firstName: e.target.value })} maxLength={60} autoComplete="off" aria-invalid={!!nameErr} aria-describedby={nameErr ? `ef-name-err-${r.key}` : undefined} className={kit.input} />
                  {nameErr && <p id={`ef-name-err-${r.key}`} className="mt-1 text-sm font-semibold text-red-700">{nameErr}</p>}
                </div>
                <div>
                  <label htmlFor={`ef-email-${r.key}`} className={kit.label}>{r.parent ? "Parent's email" : 'Email'}</label>
                  <input id={`ef-email-${r.key}`} type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={r.email} onChange={(e) => update(r.key, { email: e.target.value })} maxLength={254} placeholder="name@example.com" aria-invalid={!!emailErr} aria-describedby={emailErr || typo ? `ef-email-err-${r.key}` : undefined} className={kit.input} />
                  {(emailErr || typo) && (
                    <p id={`ef-email-err-${r.key}`} className={`mt-1 text-sm ${emailErr ? 'font-semibold text-red-700' : 'text-amber-900'}`}>
                      {emailErr ?? `Did you mean ${typo}?`}{' '}
                      {typo && <button type="button" onClick={() => { update(r.key, { email: typo }); setErr(null) }} className="min-h-[44px] font-semibold text-primary-700 underline">Use it</button>}
                    </p>
                  )}
                </div>
              </div>
              <label className="mt-2 inline-flex min-h-[44px] items-center gap-2.5 text-base text-gray-800">
                <input type="checkbox" checked={r.parent} onChange={(e) => update(r.key, { parent: e.target.checked })} className="h-5 w-5 rounded border-gray-400 text-primary-700 focus:ring-primary-600" />
                Parent of a teen (under 18)
              </label>
            </div>
          )
        })}
        <div className="flex flex-wrap gap-x-4">
          <button type="button" onClick={addRow} className={kit.quiet}><Plus className="h-5 w-5" aria-hidden />Add another person</button>
          <button type="button" onClick={() => setPasteOpen((o) => !o)} aria-expanded={pasteOpen} className={kit.quiet}><ClipboardList className="h-5 w-5" aria-hidden />Paste a list</button>
        </div>
        {pasteOpen && (
          <div className="space-y-2 rounded-2xl border border-gray-200 p-3 sm:p-4">
            <label htmlFor="ef-paste" className={kit.label}>Paste names and emails, one person per line</label>
            <textarea id="ef-paste" value={paste} onChange={(e) => setPaste(e.target.value)} rows={4} placeholder={'Maria, maria@example.com\njames@example.com'} className={kit.textarea} />
            {pasteNote && <p className="text-sm font-semibold text-red-700">{pasteNote}</p>}
            <button type="button" onClick={addPasted} className={kit.secondary}>Add these people</button>
          </div>
        )}
      </fieldset>

      <div>
        <label htmlFor="ef-personal" className={kit.label}>A line of your own <span className="font-normal text-gray-600">(optional)</span></label>
        <textarea id="ef-personal" ref={personalRef} value={personal} onChange={(e) => { setPersonal(e.target.value); if (err?.field === 'personal') setErr(null) }} rows={2} maxLength={300} placeholder={rows.length <= 1 ? 'Write your own, or tap an idea below' : `e.g. ${PERSONAL_EXAMPLES[previewRow.parent ? 'PARENT' : 'KNOW']}`}
          aria-invalid={err?.field === 'personal'} aria-describedby={err?.field === 'personal' ? 'ef-personal-err' : undefined} className={kit.textarea} />
        {err?.field === 'personal' && <p id="ef-personal-err" className="mt-1 text-sm font-semibold text-red-700">{err.text}</p>}
        <p className={kit.hint}>{rows.length > 1 ? 'Goes to everyone on this list, so keep it general.' : 'Why you thought of them. It makes people far more likely to reply.'}</p>
        {rows.length <= 1 && <LineIdeasPicker id="ef-ideas" ideas={ideasFor(previewRow.parent ? 'PARENT' : 'KNOW', program.lineIdeas)} target={personalRef} onPick={(l) => { setPersonal(l.slice(0, 300)); if (err?.field === 'personal') setErr(null) }} />}
      </div>

      {preview && (
        <details className="group rounded-2xl border border-gray-200 bg-gray-50">
          <summary className={`flex min-h-[48px] cursor-pointer items-center px-4 text-base font-semibold text-primary-700 ${kit.ring} rounded-2xl`}>
            Preview the email {previewRow.firstName.trim() ? `${previewRow.firstName.trim()} will get` : 'they will get'}
          </summary>
          <div className="space-y-3 border-t border-gray-200 bg-white p-4 text-base leading-relaxed text-gray-800 rounded-b-2xl">
            <p className="text-sm text-gray-600">From: <strong className="text-gray-900">{preview.from || props.myFirstName}</strong> through NowTransformed</p>
            <p className="text-sm text-gray-600">Subject: <strong className="text-gray-900">{preview.subject}</strong></p>
            {preview.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
            <p><span className="inline-block rounded-lg bg-sky-700 px-4 py-2.5 font-semibold text-white">{preview.button}</span></p>
            <p className="text-sm text-gray-600">At the bottom: our mailing address and a link to stop invitations like this.</p>
          </div>
        </details>
      )}

      <div>
        <label className={`flex items-start gap-3 rounded-xl border p-3 text-base ${err?.field === 'tick' ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}>
          <input id="ef-tick" type="checkbox" checked={iKnow} onChange={(e) => { setIKnow(e.target.checked); if (err?.field === 'tick') setErr(null) }} aria-describedby={err?.field === 'tick' ? 'ef-tick-err' : undefined} className="mt-0.5 h-5 w-5 flex-none rounded border-gray-400 text-primary-700 focus:ring-primary-600" />
          <span className="text-gray-900">These are people I know who&apos;d expect to hear from me.</span>
        </label>
        {err?.field === 'tick' && <p id="ef-tick-err" className="mt-1 text-sm font-semibold text-red-700">{err.text}</p>}
      </div>

      <div className="space-y-2">
        <button type="button" onClick={send} disabled={busy} className={kit.primaryBlock}>
          {busy && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}{busy ? 'Sending…' : sendLabel}
        </button>
        <p className="flex items-center justify-center text-center text-sm text-gray-600">
          {left > 0 ? `You can send to ${left} more ${left === 1 ? 'person' : 'people'} today.` : `You've reached today's ${props.limit}. Copy a message to send yourself instead.`}
          <HelpTip label="Why there's a daily limit">
            <p>We send up to {props.limit} invitations a day for you, and never email the same person twice in a month, whoever asks. It keeps our emails out of spam folders.</p>
            <p>Anyone who asked not to get these is skipped.</p>
          </HelpTip>
        </p>
      </div>

      {results.length > 0 && (
        <section aria-label="What happened" className="space-y-2">
          <h3 className="text-base font-semibold text-gray-900">What happened</h3>
          <ul className="space-y-2">
            {results.map((x) => (
              <li key={x.email + x.text} className={`flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-base ${x.ok ? 'bg-green-50 text-green-900' : 'bg-amber-50 text-amber-950'}`}>
                {x.ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-green-700" aria-hidden /> : <AlertCircle className="mt-0.5 h-5 w-5 flex-none text-amber-700" aria-hidden />}
                <span className="min-w-0 flex-1 break-words">
                  {x.text}
                  {x.suggestion && <> <button type="button" onClick={() => applySuggestion(x.email, x.suggestion!)} className="min-h-[44px] font-semibold text-primary-700 underline">Use {x.suggestion}</button></>}
                </span>
              </li>
            ))}
          </ul>
          {results.some((x) => x.ok) && <p className="text-sm text-gray-700">They&apos;re on your Follow-ups list for day 3. If they sign up, you&apos;ll see it in Results.</p>}
        </section>
      )}
    </div>
  )
}
