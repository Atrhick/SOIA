'use client'

import { useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { kit } from '@/components/ui/kit/styles'
import type { PlaybookGuide } from '@/lib/get-involved/scripts'
import { GUIDE_LIMITS, formToGuide, guideProblem, guideToForm, type GuideForm } from './helpers'
import type { EditorResult } from './script-editor'

/** Owner's editor for "How to pitch [program]": a summary, then sections with a title and one point per line. */
export function GuideEditor({ program, initial, onSave, onCancel, onReset }: {
  program: string
  initial: PlaybookGuide | null
  onSave: (g: PlaybookGuide) => Promise<EditorResult>
  onCancel: () => void
  /** Only when the owner has their own version. */
  onReset?: () => Promise<EditorResult>
}) {
  const [form, setForm] = useState<GuideForm>(() => guideToForm(initial))
  const [busy, setBusy] = useState<null | 'save' | 'reset'>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  const setSection = (i: number, patch: Partial<GuideForm['sections'][number]>) =>
    setForm((f) => ({ ...f, sections: f.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) }))

  async function save() {
    const guide = formToGuide(form)
    const problem = guideProblem(guide)
    if (problem) { setError(problem); return }
    setBusy('save'); setError(null)
    const r = await onSave(guide)
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
    <div className="space-y-5">
      <div>
        <label htmlFor="guide-summary" className={kit.label}>Summary</label>
        <textarea id="guide-summary" rows={3} maxLength={GUIDE_LIMITS.summary} value={form.summary}
          onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} className={kit.textarea}
          placeholder={`Who ${program} is for and what you're asking people to do.`} />
        <p className={kit.hint}>One or two sentences.</p>
      </div>

      {form.sections.map((s, i) => (
        <fieldset key={i} className="space-y-3 rounded-2xl border border-gray-200 p-4">
          <legend className="px-1 text-base font-semibold text-gray-900">Section {i + 1}</legend>
          <div>
            <label htmlFor={`guide-title-${i}`} className={kit.label}>Title</label>
            <input id={`guide-title-${i}`} value={s.title} maxLength={GUIDE_LIMITS.title} onChange={(e) => setSection(i, { title: e.target.value })} className={kit.input} />
          </div>
          <div>
            <label htmlFor={`guide-points-${i}`} className={kit.label}>Points</label>
            <textarea id={`guide-points-${i}`} rows={5} value={s.points} onChange={(e) => setSection(i, { points: e.target.value })} className={kit.textarea} />
            <p className={kit.hint}>One point per line.</p>
          </div>
          {form.sections.length > 1 && (
            <button type="button" onClick={() => setForm((f) => ({ ...f, sections: f.sections.filter((_, j) => j !== i) }))} className={kit.quiet}>
              <Trash2 className="h-5 w-5" aria-hidden />Remove this section
            </button>
          )}
        </fieldset>
      ))}
      {form.sections.length < GUIDE_LIMITS.sections && (
        <button type="button" onClick={() => setForm((f) => ({ ...f, sections: [...f.sections, { title: '', points: '' }] }))} className={kit.secondary}>
          <Plus className="h-5 w-5" aria-hidden />Add a section
        </button>
      )}

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-base text-red-800">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={save} disabled={!!busy} className={kit.primary}>
          {busy === 'save' && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}Save guide
        </button>
        <button type="button" onClick={onCancel} disabled={!!busy} className={kit.secondary}>Cancel</button>
        {onReset && !confirmReset && <button type="button" onClick={() => setConfirmReset(true)} disabled={!!busy} className={kit.quiet}>Reset to our version</button>}
      </div>
      {onReset && confirmReset && (
        <div role="group" aria-label="Confirm reset" className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-base text-gray-900">Go back to our guide? Your version is replaced. You can undo right after.</p>
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
