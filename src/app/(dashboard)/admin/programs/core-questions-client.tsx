'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertBanner } from '@/components/ui/alert-banner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from 'lucide-react'
import {
  DEFAULT_LIKERT,
  PROGRAM_QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  type ProgramQuestionType,
} from '@/lib/program-question-types'
import {
  createCoreQuestion,
  reorderCoreQuestions,
  setCoreQuestionActive,
  updateCoreQuestion,
} from '@/lib/actions/program-pages'

export interface CoreQuestionRow {
  id: string
  key: string
  type: string
  label: string
  required: boolean
  options?: string[]
  likert?: { min: number; max: number; minLabel: string; maxLabel: string }
  sortOrder: number
  isActive: boolean
}

type Draft = {
  type: ProgramQuestionType
  label: string
  required: boolean
  options: string[]
  likert: { min: number; max: number; minLabel: string; maxLabel: string }
}

const emptyDraft = (): Draft => ({
  type: 'TEXT_LONG',
  label: '',
  required: true,
  options: ['', ''],
  likert: { ...DEFAULT_LIKERT },
})

export function CoreQuestionsClient({ questions }: { questions: CoreQuestionRow[] }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [editing, setEditing] = useState<CoreQuestionRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft())

  const active = questions.filter((q) => q.isActive)

  const run = (fn: () => Promise<{ error?: string; success?: boolean }>, ok: string) => {
    setError(null)
    setNotice(null)
    startTransition(async () => {
      const result = await fn()
      if (result?.error) setError(result.error)
      else {
        setNotice(ok)
        setEditing(null)
        setCreating(false)
      }
    })
  }

  const payload = (d: Draft) => ({
    type: d.type,
    label: d.label,
    required: d.required,
    ...(d.type === 'DROPDOWN' || d.type === 'RADIO'
      ? { options: d.options.filter((o) => o.trim() !== '') }
      : {}),
    ...(d.type === 'LIKERT' ? { likert: d.likert } : {}),
  })

  const openEdit = (q: CoreQuestionRow) => {
    setDraft({
      type: q.type as ProgramQuestionType,
      label: q.label,
      required: q.required,
      options: q.options?.length ? [...q.options] : ['', ''],
      likert: q.likert ?? { ...DEFAULT_LIKERT },
    })
    setEditing(q)
  }

  const move = (index: number, direction: -1 | 1) => {
    const next = [...active]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    run(() => reorderCoreQuestions(next.map((q) => q.id)), 'Order saved')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Standard questions</h2>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            Asked on every program&apos;s qualification form, before each coach&apos;s own
            questions. Editing these changes all programs at once.
          </p>
        </div>
        <Button
          onClick={() => {
            setDraft(emptyDraft())
            setCreating(true)
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add question
        </Button>
      </div>

      {error && (
        <AlertBanner variant="error" message={error} dismissible onDismiss={() => setError(null)} />
      )}
      {notice && (
        <AlertBanner
          variant="success"
          message={notice}
          dismissible
          onDismiss={() => setNotice(null)}
        />
      )}

      <AlertBanner
        variant="info"
        message="Rewording a question is safe - answers already collected keep the wording they were answered under. Retiring one stops collection but keeps past answers readable."
      />

      <Card>
        <CardContent className="p-0">
          <ul className="divide-y divide-gray-100">
            {questions.map((q) => {
              const activeIndex = active.findIndex((a) => a.id === q.id)
              return (
                <li key={q.id} className="flex items-start gap-3 p-4">
                  <div className="flex flex-col gap-1 pt-1">
                    <button
                      onClick={() => move(activeIndex, -1)}
                      disabled={isPending || !q.isActive || activeIndex <= 0}
                      className="text-gray-400 hover:text-gray-700 disabled:opacity-30"
                      aria-label="Move up"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => move(activeIndex, 1)}
                      disabled={isPending || !q.isActive || activeIndex === active.length - 1}
                      className="text-gray-400 hover:text-gray-700 disabled:opacity-30"
                      aria-label="Move down"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={q.isActive ? 'font-medium text-gray-900' : 'text-gray-400'}>
                        {q.label}
                      </span>
                      {q.required && q.isActive && (
                        <Badge variant="outline" className="text-xs">Required</Badge>
                      )}
                      {!q.isActive && <Badge variant="outline">Retired</Badge>}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {QUESTION_TYPE_LABELS[q.type as ProgramQuestionType] ?? q.type}
                      {q.options?.length ? ` · ${q.options.length} options` : ''}
                      {' · '}
                      <span className="font-mono">{q.key}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => openEdit(q)} disabled={isPending}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isPending}
                      onClick={() =>
                        run(
                          () => setCoreQuestionActive(q.id, !q.isActive),
                          q.isActive ? 'Question retired' : 'Question restored'
                        )
                      }
                    >
                      {q.isActive ? <Trash2 className="h-4 w-4 text-red-500" /> : 'Restore'}
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>

      <Dialog
        open={creating || editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false)
            setEditing(null)
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit question' : 'Add a question'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'This appears on every program. Answers already collected are not affected.'
                : 'This will be added to every program’s qualification form.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[55vh] overflow-y-auto">
            <div>
              <Label htmlFor="q-label">Question</Label>
              <Input
                id="q-label"
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                placeholder="What brings you to this program?"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="q-type">Answer type</Label>
                <Select
                  value={draft.type}
                  onValueChange={(v) => setDraft({ ...draft, type: v as ProgramQuestionType })}
                >
                  <SelectTrigger id="q-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROGRAM_QUESTION_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {QUESTION_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="q-req">Answer needed?</Label>
                <Select
                  value={draft.required ? 'required' : 'optional'}
                  onValueChange={(v) => setDraft({ ...draft, required: v === 'required' })}
                >
                  <SelectTrigger id="q-req">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="required">Required</SelectItem>
                    <SelectItem value="optional">Optional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(draft.type === 'DROPDOWN' || draft.type === 'RADIO') && (
              <div className="space-y-2">
                <Label>Options</Label>
                {draft.options.map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={opt}
                      onChange={(e) => {
                        const next = [...draft.options]
                        next[i] = e.target.value
                        setDraft({ ...draft, options: next })
                      }}
                      placeholder={`Option ${i + 1}`}
                      aria-label={`Option ${i + 1}`}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setDraft({ ...draft, options: draft.options.filter((_, x) => x !== i) })
                      }
                      aria-label={`Remove option ${i + 1}`}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-gray-400" />
                    </Button>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDraft({ ...draft, options: [...draft.options, ''] })}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Add option
                </Button>
              </div>
            )}

            {draft.type === 'LIKERT' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="q-min">Low end label</Label>
                  <Input
                    id="q-min"
                    value={draft.likert.minLabel}
                    onChange={(e) =>
                      setDraft({ ...draft, likert: { ...draft.likert, minLabel: e.target.value } })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="q-max">High end label</Label>
                  <Input
                    id="q-max"
                    value={draft.likert.maxLabel}
                    onChange={(e) =>
                      setDraft({ ...draft, likert: { ...draft.likert, maxLabel: e.target.value } })
                    }
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreating(false)
                setEditing(null)
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              disabled={isPending || !draft.label.trim()}
              onClick={() =>
                run(
                  () =>
                    editing
                      ? updateCoreQuestion(editing.id, payload(draft))
                      : createCoreQuestion(payload(draft)),
                  editing ? 'Question updated' : 'Question added'
                )
              }
            >
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? 'Save changes' : 'Add question'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
