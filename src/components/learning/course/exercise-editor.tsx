'use client'

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { readExerciseContent, type ExerciseContent, type ExercisePrompt, type PromptKind } from '@/lib/lms/exercise'

/** Admin editor for an EXERCISE block: optional instructions + questions (written, choose one, choose any). */
export function ExerciseEditor({ value, onChange }: { value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const content = readExerciseContent(value)
  // Keep half-typed prompts (that fail validation) by reading raw prompts when present.
  const raw = Array.isArray((value as { prompts?: unknown }).prompts) ? ((value as { prompts: ExercisePrompt[] }).prompts) : content.prompts
  const prompts: ExercisePrompt[] = raw.map((p) => ({ id: p.id, kind: p.kind, label: p.label ?? '', options: p.options }))
  const intro = typeof (value as { intro?: unknown }).intro === 'string' ? ((value as { intro: string }).intro) : content.intro ?? ''

  const emit = (next: { intro?: string; prompts: ExercisePrompt[] }) => {
    const out: ExerciseContent = { prompts: next.prompts }
    if (next.intro?.trim()) out.intro = next.intro
    onChange(out as unknown as Record<string, unknown>)
  }
  const setPrompt = (i: number, patch: Partial<ExercisePrompt>) =>
    emit({ intro, prompts: prompts.map((p, j) => (j === i ? { ...p, ...patch } : p)) })
  const nextId = () => {
    let n = prompts.length + 1
    while (prompts.some((p) => p.id === `p${n}`)) n++
    return `p${n}`
  }
  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= prompts.length) return
    const next = [...prompts]
    ;[next[i], next[j]] = [next[j], next[i]]
    emit({ intro, prompts: next })
  }

  return (
    <div className="space-y-3">
      <textarea
        aria-label="Instructions (optional, markdown)"
        placeholder="Instructions (optional, markdown)"
        value={intro}
        onChange={(e) => emit({ intro: e.target.value, prompts })}
        rows={2}
        className="w-full resize-y rounded border px-3 py-2 text-sm"
      />
      {prompts.map((p, i) => (
        <div key={p.id} className="space-y-2 rounded border bg-white p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Question {i + 1}</span>
            <select
              aria-label={`Question ${i + 1} type`}
              value={p.kind}
              onChange={(e) => {
                const kind = e.target.value as PromptKind
                setPrompt(i, { kind, options: kind === 'text' ? undefined : p.options?.length ? p.options : ['', ''] })
              }}
              className="rounded border px-2 py-1 text-sm"
            >
              <option value="text">Written answer</option>
              <option value="single">Choose one</option>
              <option value="multi">Choose all that apply</option>
            </select>
            <div className="ml-auto flex gap-1">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-30" aria-label="Move question up">
                <ArrowUp className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === prompts.length - 1} className="rounded p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-30" aria-label="Move question down">
                <ArrowDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => emit({ intro, prompts: prompts.filter((_, j) => j !== i) })}
                className="rounded p-1.5 text-gray-600 hover:bg-red-50 hover:text-red-700"
                aria-label="Remove question"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          <textarea
            aria-label={`Question ${i + 1} text`}
            placeholder="The question"
            value={p.label}
            onChange={(e) => setPrompt(i, { label: e.target.value })}
            rows={2}
            className="w-full resize-y rounded border px-3 py-2 text-sm"
          />
          {p.kind !== 'text' && (
            <div className="space-y-1">
              {(p.options ?? []).map((o, oi) => (
                <div key={oi} className="flex gap-2">
                  <input
                    aria-label={`Option ${oi + 1}`}
                    value={o}
                    placeholder={`Option ${oi + 1}`}
                    onChange={(e) => setPrompt(i, { options: (p.options ?? []).map((x, k) => (k === oi ? e.target.value : x)) })}
                    className="flex-1 rounded border px-3 py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setPrompt(i, { options: (p.options ?? []).filter((_, k) => k !== oi) })}
                    className="rounded p-1.5 text-gray-600 hover:bg-red-50 hover:text-red-700"
                    aria-label={`Remove option ${oi + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => setPrompt(i, { options: [...(p.options ?? []), ''] })} className="text-sm font-medium text-blue-700 hover:underline">
                Add option
              </button>
            </div>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => emit({ intro, prompts: [...prompts, { id: nextId(), kind: 'text', label: '' }] })}
        className="inline-flex items-center gap-1 rounded border border-dashed px-3 py-1.5 text-sm text-gray-700 hover:border-blue-500 hover:text-blue-700"
      >
        <Plus className="h-4 w-4" /> Add question
      </button>
      <p className="text-xs text-gray-600">Learners&apos; answers are kept per question, so editing a question&apos;s words keeps their answer.</p>
    </div>
  )
}
