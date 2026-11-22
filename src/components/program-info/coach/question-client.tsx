'use client'

/**
 * "Question from the team" (Question mockup, A11): every open question for this page on one screen. A
 * question tied to an answer (e.g. the cost) shows that answer's own field, pre-filled; any question also
 * takes free text ("Anything to add?", or the whole answer when it isn't tied to one). One Send for all.
 */
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { answerQuestions } from '@/lib/actions/program-info'
import { isAnswered, questionById } from '@/lib/program-info/questions'
import { programsHome, type OwnerRole } from '@/lib/program-info/paths'
import type { QuestionItem } from '@/lib/program-info/server'
import { useToast } from '@/components/ui/kit/toast'
import { normalizeUrl } from './autosave'
import { QuestionInput } from './question-fields'
import { LocalDate } from './local-date'
import { ui } from './ui'

export function QuestionForm({
  role, programId, questions, currentAnswers, focusId,
}: {
  role: OwnerRole
  programId: string
  questions: QuestionItem[]
  currentAnswers: Record<string, unknown>
  focusId: string | null
  readOnly: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(questions.filter((q) => q.answerKey).map((q) => [q.id, currentAnswers[q.answerKey!] ?? (questionById(q.answerKey!)?.kind === 'cost' ? { price: '', frequency: null, sponsoredPrice: '' } : '')])))
  const [texts, setTexts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (focusId && questions.length > 1) document.getElementById(`tq-${focusId}`)?.scrollIntoView({ block: 'start' })
  }, [focusId, questions.length])

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const items = questions.map((q) => {
      const def = q.answerKey ? questionById(q.answerKey) : undefined
      let value = def ? values[q.id] : undefined
      if (def?.kind === 'url' && typeof value === 'string') value = normalizeUrl(value)
      const text = (texts[q.id] ?? '').trim()
      return { questionId: q.id, ...(def && value !== undefined && isAnswered(def.id, value) ? { value } : {}), ...(text ? { text } : {}) }
    })
    const empty = items.findIndex((i) => !('value' in i) && !('text' in i))
    if (empty >= 0) { setError(questions.length > 1 ? `Please answer question ${empty + 1}.` : 'Please write your answer.'); return }
    setBusy(true)
    try {
      const r = await answerQuestions(programId, items)
      if (!r.ok) { setError(r.error); return }
      toast.success(r.answered > 1 ? 'Thanks. We have your answers.' : 'Thanks. We have your answer.')
      router.push(programsHome(role))
      router.refresh()
    } catch {
      setError("That didn't send. Check your connection and try again.")
    } finally {
      setBusy(false)
    }
  }

  const keyedCount = questions.filter((q) => q.answerKey).length
  return (
    <form onSubmit={send} className="flex flex-col gap-4">
      <fieldset disabled={busy} className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
        {questions.map((q, i) => {
          const def = q.answerKey ? questionById(q.answerKey) : undefined
          return (
            <section key={q.id} id={`tq-${q.id}`} aria-labelledby={`tq-${q.id}-h`} className={`${ui.card} flex scroll-mt-24 flex-col gap-3.5 p-[18px]`}>
              <div className="flex items-center gap-2.5">
                <Image src="/brand/nowtransformed-mark.png" alt="" width={36} height={36} className="h-9 w-9 flex-none" />
                <div>
                  <p className="m-0 text-sm font-bold">NowTRANSFORMED team</p>
                  <p className="m-0 text-[13px] text-gray-600"><LocalDate iso={q.createdAt} format="day" /></p>
                </div>
              </div>
              <h2 id={`tq-${q.id}-h`} className="m-0 text-base font-normal leading-relaxed">
                {questions.length > 1 && <span className="sr-only">Question {i + 1}: </span>}
                {q.question}
              </h2>
              {def ? (
                <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
                  <legend className="mb-1.5 p-0 text-[15px] font-bold">Your answer</legend>
                  <QuestionInput q={def} idPrefix={`tq-${q.id}`} value={values[q.id]} noExample={def.kind !== 'cost'}
                    label={def.kind === 'cost' ? 'Usual price' : def.label}
                    onChange={(v) => setValues((s) => ({ ...s, [q.id]: v }))} />
                </fieldset>
              ) : null}
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`tq-${q.id}-text`} className="text-[15px] font-semibold">
                  {def ? <>Anything to add? <span className={ui.optional}>Optional</span></> : 'Your answer'}
                </label>
                <textarea id={`tq-${q.id}-text`} rows={3} className={ui.box} maxLength={4000} value={texts[q.id] ?? ''} onChange={(e) => setTexts((s) => ({ ...s, [q.id]: e.target.value }))} />
              </div>
            </section>
          )
        })}
      </fieldset>
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[15px] text-red-900">{error}</div>}
      <button type="submit" className={`${ui.primary} w-full`} disabled={busy}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {questions.length > 1 ? 'Send my answers' : 'Send my answer'}
      </button>
      {keyedCount > 0 && (
        <p className={`${ui.hint} text-center`}>
          {keyedCount === 1 && questions.length === 1 && questions[0].answerKey === 'cost'
            ? "This also updates your cost answer, so you won't be asked again."
            : "This also updates the matching answers on your page, so you won't be asked again."}
        </p>
      )}
    </form>
  )
}
