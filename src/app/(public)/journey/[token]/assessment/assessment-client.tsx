'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import type { AssessmentQuestion } from '@/lib/get-involved/core'
import { submitAssessment } from '@/lib/actions/journey-assessment'
import { primaryBtn, stepCard } from '@/components/get-involved/journey-step-frame'
import { JourneyExpired } from '@/components/get-involved/journey-expired'

const draftKey = (token: string) => `gi-assessment-draft:${token}`
const MAX = 2000

export function AssessmentClient({ token, firstName, roleLabel, questions }: {
  token: string
  firstName: string
  roleLabel: string
  questions: AssessmentQuestion[]
}) {
  const router = useRouter()
  const [answers, setAnswers] = useState<string[]>(() => questions.map(() => ''))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [expired, setExpired] = useState(false)
  const [restored, setRestored] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  // Keep a draft on this device so a closed tab doesn't lose their typing.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey(token))
      const saved = raw ? JSON.parse(raw) : null
      if (Array.isArray(saved) && saved.some((s) => typeof s === 'string' && s)) {
        setAnswers(questions.map((_, i) => (typeof saved[i] === 'string' ? saved[i] : '')))
        setRestored(true)
      }
    } catch { /* storage unavailable: start empty */ }
  }, [token, questions])

  function setAnswer(i: number, v: string) {
    const next = answers.map((a, j) => (j === i ? v : a))
    setAnswers(next)
    try { localStorage.setItem(draftKey(token), JSON.stringify(next)) } catch { /* ignore */ }
    if (errors[`q${i}`]) setErrors((e) => { const n = { ...e }; delete n[`q${i}`]; return n })
  }

  function focusFirstError(errs: Record<string, string>) {
    const first = questions.findIndex((_, i) => errs[`q${i}`])
    if (first < 0) return
    const el = formRef.current?.querySelector<HTMLElement>(`[data-q="${first}"]`)
    el?.focus()
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const local: Record<string, string> = {}
    questions.forEach((q, i) => { if (!answers[i]?.trim()) local[`q${i}`] = 'Please answer this question' })
    if (Object.keys(local).length) { setErrors(local); setError('Please answer every question.'); focusFirstError(local); return }
    setBusy(true); setError(null)
    try {
      const r = await submitAssessment(token, answers)
      if (r.ok) {
        try { localStorage.removeItem(draftKey(token)) } catch { /* ignore */ }
        router.push(r.next)
        return
      }
      if (r.expired) { setExpired(true); return }
      setError(r.error)
      if (r.fieldErrors) { setErrors(r.fieldErrors); focusFirstError(r.fieldErrors) }
      setBusy(false)
    } catch {
      setError('Something went wrong. Please try again.')
      setBusy(false)
    }
  }

  if (expired) return <JourneyExpired />

  return (
    <form ref={formRef} noValidate onSubmit={onSubmit} className={`${stepCard} space-y-6`} aria-labelledby="assess-title">
      <div className="space-y-2">
        <span className="inline-block rounded-full bg-sky-100 px-2.5 py-1 text-xs font-bold text-primary-800">{roleLabel}</span>
        <h1 id="assess-title" className="text-2xl md:text-3xl font-bold text-gray-900">Three quick questions</h1>
        <p className="text-gray-700">Great talking with you, {firstName}. These help us prepare your orientation. About 5 minutes.</p>
        {restored && <p role="status" className="text-sm text-gray-600">We kept what you typed last time on this device.</p>}
      </div>

      {questions.map((q, i) => {
        const id = `q${i}`
        const err = errors[id]
        const label = `${i + 1}. ${q.text}`
        const describedBy = err ? `${id}-err` : undefined
        if (q.type === 'SHORT_TEXT') {
          return (
            <div key={i} className="space-y-1.5">
              <label htmlFor={id} className="block font-semibold text-gray-900">{label}</label>
              <textarea id={id} data-q={i} rows={4} maxLength={MAX} value={answers[i]} onChange={(e) => setAnswer(i, e.target.value)}
                aria-invalid={!!err} aria-describedby={describedBy}
                className={`w-full rounded-xl border px-3 py-2.5 text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 ${err ? 'border-red-500' : 'border-gray-300'}`} />
              <div className="flex justify-between gap-3 text-xs">
                <span>{err && <span id={`${id}-err`} role="alert" className="text-sm text-red-700">{err}</span>}</span>
                {answers[i].length > MAX - 200 && <span className="text-gray-500">{answers[i].length}/{MAX}</span>}
              </div>
            </div>
          )
        }
        const options = q.type === 'CHOICE' ? q.choices : ['1', '2', '3', '4', '5']
        return (
          <fieldset key={i} className="min-w-0 space-y-2" aria-describedby={describedBy} aria-invalid={!!err}>
            <legend className="font-semibold text-gray-900">{label}</legend>
            {q.type === 'SCALE_1_5' && <p className="text-sm text-gray-600">1 = not at all, 5 = very much</p>}
            <div className={q.type === 'SCALE_1_5' ? 'grid grid-cols-5 gap-2 max-w-sm' : 'grid gap-2 sm:grid-cols-2'}>
              {options.map((o, k) => {
                const checked = answers[i] === o
                return (
                  <label key={o} className={`flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-600 ${q.type === 'SCALE_1_5' ? 'justify-center' : ''} ${checked ? 'border-2 border-primary-700 bg-primary-50 font-semibold text-primary-800' : err ? 'border-red-400 text-gray-800' : 'border-gray-300 text-gray-800'}`}>
                    <input type="radio" name={id} value={o} checked={checked} onChange={() => setAnswer(i, o)} data-q={k === 0 ? i : undefined}
                      className={q.type === 'SCALE_1_5' ? 'sr-only' : 'h-4 w-4 accent-primary-700'} />
                    <span>{o}</span>
                  </label>
                )
              })}
            </div>
            {err && <p id={`${id}-err`} role="alert" className="text-sm text-red-700">{err}</p>}
          </fieldset>
        )
      })}

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-600">Your answers are saved on this device until you submit.</p>
        <button type="submit" className={`${primaryBtn} w-full whitespace-nowrap sm:w-auto`} disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{busy ? 'Submitting…' : 'Submit answers'}
        </button>
      </div>
    </form>
  )
}
