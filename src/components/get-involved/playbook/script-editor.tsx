'use client'

import { useMemo, useRef, useState } from 'react'
import { Check, Loader2, X } from 'lucide-react'
import { kit } from '@/components/ui/kit/styles'
import { HelpTip } from '@/components/ui/kit/help-tip'
import { SCRIPT_FILL_INS, checksPass, scriptChecks, type ScenarioKey, type ScriptText, type ScriptVariant } from '@/lib/get-involved/scripts'
import { insertAt } from './helpers'

export type EditorResult = { ok: true } | { ok: false; error: string }

/** What each fill-in becomes, in plain words (shown in the "?" next to the fill-in buttons). */
const FILL_IN_HELP: Record<(typeof SCRIPT_FILL_INS)[number], string> = {
  '{intro}': 'The right opening for whoever sends it: "I run [business], and one of our programs is [program], [one line]".',
  '{first name}': "The person's first name.",
  '{personal line}': 'One line about them that the sender writes ("You mentioned ...").',
  '{my name}': "The sender's first name.",
  '{business}': 'The business name (or the program name if there is none).',
  '{program}': 'The program name.',
  '{program line}': 'One line on what the program does.',
  '{link}': 'The sign-up link.',
  '{sponsor line}': '"Families who are a good fit may qualify for a NowTransformed sponsored seat." Left out when the program has no sponsored seats.',
}

/**
 * Edit one message (owner on the Playbook, admin on Message templates). Shows the automatic checks as
 * a live list, fill-ins you can tap to insert, Save (only goes through when every check passes; if
 * not, says which one right here), an optional draft save (admin) and an optional "Reset to our
 * version" with a confirm. The caller shows the toast and the Undo.
 */
export function ScriptEditor({
  idPrefix, scenario, variant, initial, saveLabel = 'Save', onSave, onSaveDraft, onCancel, resetLabel, resetConfirm = 'Go back to our version? Your words are replaced. You can undo right after.', onReset,
}: {
  idPrefix: string
  scenario: ScenarioKey
  variant: ScriptVariant
  initial: ScriptText
  saveLabel?: string
  onSave: (t: ScriptText) => Promise<EditorResult>
  /** Admin only: save without passing the checks. */
  onSaveDraft?: (t: ScriptText) => Promise<EditorResult>
  onCancel?: () => void
  /** Shown only when given, e.g. "Reset to our version". */
  resetLabel?: string
  resetConfirm?: string
  onReset?: () => Promise<EditorResult>
}) {
  const [subject, setSubject] = useState(initial.subject ?? '')
  const [body, setBody] = useState(initial.body)
  const [busy, setBusy] = useState<null | 'save' | 'draft' | 'reset'>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const subjectRef = useRef<HTMLInputElement>(null)
  const lastField = useRef<'subject' | 'body'>('body')
  const isEmail = variant === 'EMAIL'

  const checks = useMemo(() => scriptChecks(scenario, variant, { subject: isEmail ? subject : null, body }), [scenario, variant, isEmail, subject, body])
  const failing = checks.filter((c) => !c.ok)
  const text = (): ScriptText => ({ subject: isEmail ? subject : null, body })

  function insert(token: string) {
    const useSubject = isEmail && lastField.current === 'subject'
    const el = useSubject ? subjectRef.current : bodyRef.current
    const value = useSubject ? subject : body
    const r = insertAt(value, el?.selectionStart ?? value.length, el?.selectionEnd ?? value.length, token)
    if (useSubject) setSubject(r.text); else setBody(r.text)
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(r.cursor, r.cursor) })
  }

  async function save() {
    setError(null)
    if (!checksPass(checks)) {
      setError(`Fix this first: ${failing.map((c) => c.label).join('; ')}.`)
      ;(failing.some((c) => c.id === 'subject') ? subjectRef.current : bodyRef.current)?.focus()
      return
    }
    setBusy('save')
    const r = await onSave(text())
    setBusy(null)
    if (!r.ok) setError(r.error)
  }
  async function saveDraft() {
    if (!onSaveDraft) return
    setError(null)
    if (!body.trim()) { setError('Write the message first.'); bodyRef.current?.focus(); return }
    setBusy('draft')
    const r = await onSaveDraft(text())
    setBusy(null)
    if (!r.ok) setError(r.error)
  }
  async function reset() {
    if (!onReset) return
    setBusy('reset'); setError(null)
    const r = await onReset()
    setBusy(null); setConfirmReset(false)
    if (!r.ok) setError(r.error)
  }

  return (
    <div className="space-y-4">
      {isEmail && (
        <div>
          <label htmlFor={`${idPrefix}-subject`} className={kit.label}>Subject</label>
          <input id={`${idPrefix}-subject`} ref={subjectRef} value={subject} maxLength={120}
            onFocus={() => { lastField.current = 'subject' }} onChange={(e) => setSubject(e.target.value)} className={kit.input} />
        </div>
      )}
      <div>
        <label htmlFor={`${idPrefix}-body`} className={kit.label}>Message</label>
        <textarea id={`${idPrefix}-body`} ref={bodyRef} value={body} rows={variant === 'SHORT' ? 6 : 10} maxLength={3000}
          onFocus={() => { lastField.current = 'body' }} onChange={(e) => setBody(e.target.value)} className={kit.textarea} />
      </div>

      <div>
        <p className="flex items-center text-base font-semibold text-gray-900">
          Tap to add a fill-in
          <HelpTip label="What are fill-ins?">
            <p>Words in curly brackets are filled in for each person when the message is copied or sent.</p>
            <ul className="space-y-1">{SCRIPT_FILL_INS.map((t) => <li key={t}><strong>{t}</strong>: {FILL_IN_HELP[t]}</li>)}</ul>
          </HelpTip>
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {SCRIPT_FILL_INS.map((t) => (
            <button key={t} type="button" onClick={() => insert(t)}
              className={`min-h-[44px] rounded-full border border-primary-200 bg-primary-50 px-3 text-sm font-semibold text-primary-800 hover:bg-primary-100 ${kit.ring}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-base font-semibold text-gray-900">Checks</p>
        <ul className="mt-2 space-y-1.5">
          {checks.map((c) => (
            <li key={c.id} className={`flex items-start gap-2 text-base ${c.ok ? 'text-green-800' : 'text-red-700'}`}>
              {c.ok ? <Check className="mt-0.5 h-5 w-5 flex-none" aria-hidden /> : <X className="mt-0.5 h-5 w-5 flex-none" aria-hidden />}
              <span><span className="sr-only">{c.ok ? 'Passes: ' : 'Needs fixing: '}</span>{c.label}</span>
            </li>
          ))}
        </ul>
      </div>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-base text-red-800">{error}</p>}
      {!error && failing.length > 0 && (
        <p className="text-base text-red-700">To save, fix: {failing.map((c) => c.label).join('; ')}.</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={save} disabled={!!busy} className={kit.primary}>
          {busy === 'save' && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}{saveLabel}
        </button>
        {onSaveDraft && (
          <button type="button" onClick={saveDraft} disabled={!!busy} className={kit.secondary}>
            {busy === 'draft' && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}Save as draft
          </button>
        )}
        {onCancel && <button type="button" onClick={onCancel} disabled={!!busy} className={kit.secondary}>Cancel</button>}
        {onReset && resetLabel && !confirmReset && (
          <button type="button" onClick={() => setConfirmReset(true)} disabled={!!busy} className={kit.quiet}>{resetLabel}</button>
        )}
      </div>
      {onReset && confirmReset && (
        <div role="group" aria-label="Confirm reset" className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-base text-gray-900">{resetConfirm}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={reset} disabled={!!busy} className={kit.danger}>
              {busy === 'reset' && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}Yes, reset
            </button>
            <button type="button" onClick={() => setConfirmReset(false)} disabled={!!busy} className={kit.secondary}>Keep mine</button>
          </div>
        </div>
      )}
    </div>
  )
}
