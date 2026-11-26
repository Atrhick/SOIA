'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle, Circle, Loader2, MessageSquare, PenLine, Trash2, X } from 'lucide-react'
import { addExerciseComment, deleteExerciseComment, type getLearnerCourseWork } from '@/lib/actions/lms/exercises'
import { isPromptAnswered, MAX_COMMENT_CHARS } from '@/lib/lms/exercise'
import { InlineText } from './lesson-markdown'

export type LearnerWork = NonNullable<Awaited<ReturnType<typeof getLearnerCourseWork>>['work']>
type Exercise = LearnerWork['modules'][number]['lessons'][number]['exercises'][number]

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

export function LearnerWorkView({ work, backHref, backLabel }: { work: LearnerWork; backHref: string; backLabel: string }) {
  const [error, setError] = useState<string | null>(null)
  const e = work.enrollment
  const exerciseTotal = work.modules.reduce((a, m) => a + m.lessons.reduce((b, l) => b + l.exercises.length, 0), 0)
  const answered = work.modules.reduce(
    (a, m) => a + m.lessons.reduce((b, l) => b + l.exercises.filter((x) => x.answer?.completedAt).length, 0),
    0
  )

  return (
    <div className="space-y-6">
      <Link href={backHref} className="inline-flex min-h-[44px] items-center gap-2 text-gray-700 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" /> {backLabel}
      </Link>

      <div className="rounded-xl border bg-white p-5">
        <p className="text-sm text-gray-600">{work.course.title}</p>
        <h1 className="text-2xl font-bold text-gray-900">{work.learner.name}</h1>
        {e ? (
          <div className="mt-3 space-y-2">
            <div
              className="h-2 w-full max-w-md overflow-hidden rounded-full bg-gray-200"
              role="progressbar"
              aria-label="Course progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={e.progressPercentage}
            >
              <div className={`h-full ${e.status === 'COMPLETED' ? 'bg-green-600' : 'bg-blue-600'}`} style={{ width: `${e.progressPercentage}%` }} />
            </div>
            <p className="text-sm text-gray-700">
              {e.completedLessons} of {e.totalLessons} lessons · {answered} of {exerciseTotal} exercises finished
              {e.lastAccessedAt ? ` · last opened ${when(e.lastAccessedAt)}` : ''}
              {e.completedAt ? ` · completed ${new Date(e.completedAt).toLocaleDateString()}` : ''}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-gray-700">Has not joined this course yet.</p>
        )}
        <p className="mt-3 text-xs text-gray-600">
          Answers are private: only {work.learner.name}, their coach and the NowTransformed team can see them.
        </p>
      </div>

      {error && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="flex h-8 w-8 items-center justify-center rounded hover:bg-red-100" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {work.modules.map((m) => (
        <section key={m.id} className="rounded-xl border bg-white">
          <h2 className="border-b p-4 text-lg font-semibold text-gray-900">{m.title}</h2>
          <ol className="divide-y">
            {m.lessons.map((l) => (
              <li key={l.id} className="p-4">
                <p className="flex items-center gap-2 font-medium text-gray-900">
                  {l.status === 'COMPLETED' ? (
                    <CheckCircle className="h-5 w-5 shrink-0 text-green-600" aria-label="Completed" />
                  ) : (
                    <Circle className="h-5 w-5 shrink-0 text-gray-400" aria-label="Not completed" />
                  )}
                  <span className="min-w-0">{l.title}</span>
                </p>
                {l.exercises.length > 0 && (
                  <div className="mt-3 space-y-4 sm:pl-7">
                    {l.exercises.map((x) => (
                      <ExerciseReview key={x.id} exercise={x} work={work} onError={setError} />
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}

function ExerciseReview({ exercise, work, onError }: { exercise: Exercise; work: LearnerWork; onError: (e: string | null) => void }) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const a = exercise.answer
  const answers = a?.answers ?? {}

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!a || !body.trim()) return
    setSaving(true)
    onError(null)
    const r = await addExerciseComment(a.id, body)
    setSaving(false)
    if ('error' in r && r.error) onError(r.error)
    else {
      setBody('')
      router.refresh()
    }
  }

  const remove = async (id: string) => {
    onError(null)
    const r = await deleteExerciseComment(id)
    if ('error' in r && r.error) onError(r.error)
    else router.refresh()
  }

  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3 sm:p-4">
      <p className="mb-2 flex flex-wrap items-center gap-2 font-semibold text-gray-900">
        <PenLine className="h-4 w-4 text-indigo-700" aria-hidden="true" />
        {exercise.title ? `Exercise: ${exercise.title}` : 'Exercise'}
        <span className="text-sm font-normal text-gray-600">
          {a ? (a.completedAt ? `finished · updated ${when(a.updatedAt)}` : `started · updated ${when(a.updatedAt)}`) : 'not started'}
        </span>
      </p>
      <ol className="space-y-3">
        {exercise.content.prompts.map((p, i) => {
          const v = answers[p.id]
          const has = isPromptAnswered(p, answers)
          return (
            <li key={p.id} className="rounded-lg border bg-white p-3">
              <p className="text-sm font-medium text-gray-900">
                {i + 1}. <InlineText text={p.label} />
              </p>
              <p className={`mt-1 whitespace-pre-wrap ${has ? 'text-gray-900' : 'italic text-gray-500'}`}>
                {has ? (Array.isArray(v) ? v.join(', ') : v) : 'No answer yet'}
              </p>
            </li>
          )
        })}
      </ol>

      {a && a.comments.length > 0 && (
        <div className="mt-3 space-y-2">
          {a.comments.map((c) => (
            <div key={c.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="mb-1 flex items-start justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <MessageSquare className="h-4 w-4" aria-hidden="true" /> {c.authorName}
                  <span className="font-normal text-gray-600">{when(c.createdAt)}</span>
                </p>
                {(c.authorId === work.viewerId || work.isAdmin) && work.canComment && (
                  <button
                    type="button"
                    onClick={() => remove(c.id)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded text-gray-600 hover:bg-amber-100 hover:text-red-700"
                    aria-label="Remove comment"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <p className="whitespace-pre-wrap text-gray-800">{c.body}</p>
            </div>
          ))}
        </div>
      )}

      {a && work.canComment && (
        <form onSubmit={submit} className="mt-3 space-y-2">
          <label htmlFor={`c-${exercise.id}`} className="block text-sm font-medium text-gray-900">
            Leave a short comment for {work.learner.name}
          </label>
          <textarea
            id={`c-${exercise.id}`}
            value={body}
            onChange={(ev) => setBody(ev.target.value)}
            rows={2}
            maxLength={MAX_COMMENT_CHARS}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            placeholder="What stood out, or a question to think about"
          />
          <button
            type="submit"
            disabled={saving || !body.trim()}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-indigo-700 px-4 font-semibold text-white hover:bg-indigo-800 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Post comment
          </button>
        </form>
      )}
    </div>
  )
}
