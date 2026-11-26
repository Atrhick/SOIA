'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { CheckCircle, Loader2, MessageSquare, PenLine, AlertCircle, Lock } from 'lucide-react'
import { saveExerciseAnswer } from '@/lib/actions/lms/exercises'
import { answeredCount, isExerciseComplete, type ExerciseAnswers, type ExerciseContent } from '@/lib/lms/exercise'
import { InlineText, LessonMarkdown } from './lesson-markdown'

export interface ExerciseComment {
  id: string
  authorName: string
  body: string
  createdAt: string
}

export interface ExerciseState {
  answers: ExerciseAnswers
  completedAt: string | null
  updatedAt: string | null
  comments: ExerciseComment[]
}

interface Props {
  blockId: string
  title: string | null
  content: ExerciseContent
  initial?: ExerciseState
  /** Preview or an admin viewing as someone: answers show but cannot change. */
  readOnly?: boolean
  readOnlyReason?: string
  onCompleted?: (lessonComplete: boolean) => void
}

type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

const SAVE_DELAY_MS = 1200

export function ExerciseBlock({ blockId, title, content, initial, readOnly, readOnlyReason, onCompleted }: Props) {
  const uid = useId()
  const [answers, setAnswers] = useState<ExerciseAnswers>(initial?.answers ?? {})
  const [state, setState] = useState<SaveState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(initial?.updatedAt ?? null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef(answers)
  const dirty = useRef(false)
  const wasComplete = useRef(!!initial?.completedAt)

  const done = answeredCount(content, answers)
  const total = content.prompts.length
  const complete = isExerciseComplete(content, answers)

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    if (!dirty.current || readOnly) return
    dirty.current = false
    setState('saving')
    const result = await saveExerciseAnswer(blockId, latest.current)
    if ('error' in result && result.error) {
      dirty.current = true
      setState('error')
      setError(result.error)
      return
    }
    if ('success' in result) {
      setState(dirty.current ? 'pending' : 'saved')
      setError(null)
      setSavedAt(result.savedAt ?? null)
      if (result.complete && !wasComplete.current) {
        wasComplete.current = true
        onCompleted?.(!!result.lessonComplete)
      }
      if (!result.complete) wasComplete.current = false
    }
  }, [blockId, readOnly, onCompleted])

  // Save what's left when leaving the page.
  useEffect(() => {
    return () => {
      if (dirty.current && !readOnly) void saveExerciseAnswer(blockId, latest.current)
    }
  }, [blockId, readOnly])

  const update = (promptId: string, value: string | string[]) => {
    if (readOnly) return
    const next = { ...latest.current, [promptId]: value }
    latest.current = next
    dirty.current = true
    setAnswers(next)
    setState('pending')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS)
  }

  return (
    <section aria-labelledby={`${uid}-title`} className="my-6 rounded-xl border-2 border-indigo-100 bg-indigo-50/40 p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <h3 id={`${uid}-title`} className="flex min-w-0 items-center gap-2 text-lg font-semibold text-gray-900">
          <PenLine className="h-5 w-5 shrink-0 text-indigo-700" aria-hidden="true" />
          <span className="min-w-0">{title ? `Exercise: ${title}` : 'Exercise'}</span>
        </h3>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-medium ${
            complete ? 'bg-green-100 text-green-800' : 'bg-white text-gray-700 border'
          }`}
        >
          {complete && <CheckCircle className="h-4 w-4" aria-hidden="true" />}
          {done} of {total} answered
        </span>
      </div>

      {content.intro && <LessonMarkdown content={content.intro} className="mb-4 !text-base" />}

      {readOnly && (
        <p className="mb-4 flex items-center gap-2 rounded-lg bg-white p-3 text-sm text-gray-700 border">
          <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
          {readOnlyReason || 'Answers cannot be changed here.'}
        </p>
      )}

      <ol className="space-y-5">
        {content.prompts.map((p, i) => {
          const id = `${uid}-${p.id}`
          const value = answers[p.id]
          return (
            <li key={p.id} className="rounded-lg bg-white p-3 sm:p-4 border">
              {p.kind === 'text' ? (
                <>
                  <label htmlFor={id} className="mb-2 block font-medium text-gray-900">
                    <span className="mr-1 text-indigo-700">{i + 1}.</span>
                    <InlineText text={p.label} />
                  </label>
                  <textarea
                    id={id}
                    value={typeof value === 'string' ? value : ''}
                    onChange={(e) => update(p.id, e.target.value)}
                    onBlur={() => void flush()}
                    readOnly={readOnly}
                    rows={4}
                    maxLength={5000}
                    placeholder={readOnly ? 'No answer yet' : 'Write your answer here'}
                    className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-base text-gray-900 placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 read-only:bg-gray-50"
                  />
                </>
              ) : (
                <fieldset>
                  <legend className="mb-2 font-medium text-gray-900">
                    <span className="mr-1 text-indigo-700">{i + 1}.</span>
                    <InlineText text={p.label} />
                    <span className="ml-1 text-sm font-normal text-gray-600">
                      {p.kind === 'single' ? '(choose one)' : '(choose all that apply)'}
                    </span>
                  </legend>
                  <div className="space-y-2">
                    {(p.options ?? []).map((o, oi) => {
                      const checked =
                        p.kind === 'single' ? value === o : Array.isArray(value) && value.includes(o)
                      return (
                        <label
                          key={oi}
                          className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-gray-900 focus-within:ring-2 focus-within:ring-indigo-500/40 ${
                            checked ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:bg-gray-50'
                          } ${readOnly ? 'cursor-default' : ''}`}
                        >
                          <input
                            type={p.kind === 'single' ? 'radio' : 'checkbox'}
                            name={id}
                            value={o}
                            checked={checked}
                            disabled={readOnly}
                            onChange={(e) => {
                              if (p.kind === 'single') update(p.id, o)
                              else {
                                const cur = Array.isArray(value) ? value : []
                                update(p.id, e.target.checked ? [...cur, o] : cur.filter((x) => x !== o))
                              }
                            }}
                            className="h-5 w-5 shrink-0 accent-indigo-600"
                          />
                          <span className="min-w-0">{o}</span>
                        </label>
                      )
                    })}
                  </div>
                </fieldset>
              )}
            </li>
          )
        })}
      </ol>

      {!readOnly && (
        <div className="mt-3 flex min-h-[24px] flex-wrap items-center gap-2 text-sm" aria-live="polite">
          {state === 'saving' && (
            <span className="flex items-center gap-1 text-gray-700">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Saving...
            </span>
          )}
          {state === 'pending' && <span className="text-gray-600">Changes not saved yet</span>}
          {(state === 'saved' || (state === 'idle' && savedAt)) && (
            <span className="flex items-center gap-1 text-green-800">
              <CheckCircle className="h-4 w-4" aria-hidden="true" /> Saved
              {savedAt ? ` ${new Date(savedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''}
            </span>
          )}
          {state === 'error' && (
            <span className="flex flex-wrap items-center gap-2 text-red-700">
              <AlertCircle className="h-4 w-4" aria-hidden="true" /> {error}
              <button
                type="button"
                onClick={() => {
                  dirty.current = true
                  void flush()
                }}
                className="min-h-[44px] rounded-lg border border-red-300 px-3 font-medium hover:bg-red-50"
              >
                Try again
              </button>
            </span>
          )}
          {state !== 'error' && <span className="text-gray-600">Only you, your coach and the NowTransformed team can see your answers.</span>}
        </div>
      )}

      {(initial?.comments.length ?? 0) > 0 && (
        <div className="mt-4 space-y-2">
          {initial!.comments.map((c) => (
            <div key={c.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-gray-900">
                <MessageSquare className="h-4 w-4" aria-hidden="true" />
                {c.authorName}
                <span className="font-normal text-gray-600">
                  {new Date(c.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              </p>
              <p className="whitespace-pre-wrap text-gray-800">{c.body}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
