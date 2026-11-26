/**
 * EXERCISE content blocks: prompts a learner answers inside a lesson.
 * Pure functions only (shared by server actions, the import and the UI), so they can be unit tested.
 */
import { z } from 'zod'

export type PromptKind = 'text' | 'single' | 'multi'

export interface ExercisePrompt {
  id: string
  kind: PromptKind
  label: string
  options?: string[]
}

export interface ExerciseContent {
  intro?: string
  prompts: ExercisePrompt[]
}

/** promptId -> typed text (text) | chosen option (single) | chosen options (multi). */
export type ExerciseAnswers = Record<string, string | string[]>

export const MAX_ANSWER_CHARS = 5000
export const MAX_COMMENT_CHARS = 1000

export const exercisePromptSchema = z
  .object({
    id: z.string().min(1).max(40),
    kind: z.enum(['text', 'single', 'multi']),
    label: z.string().trim().min(1, 'Each question needs words').max(2000),
    options: z.array(z.string().trim().min(1).max(300)).max(20).optional(),
  })
  .refine((p) => p.kind === 'text' || (p.options?.length ?? 0) >= 2, {
    message: 'A choice question needs at least two options',
  })

export const exerciseContentSchema = z.object({
  intro: z.string().max(5000).optional(),
  prompts: z
    .array(exercisePromptSchema)
    .min(1, 'Add at least one question')
    .max(30)
    .refine((ps) => new Set(ps.map((p) => p.id)).size === ps.length, { message: 'Question ids must be unique' }),
})

/** Reads stored JSON into a usable shape; bad data gives an empty exercise instead of throwing. */
export function readExerciseContent(raw: unknown): ExerciseContent {
  const parsed = exerciseContentSchema.safeParse(raw)
  if (parsed.success) return parsed.data
  const r = (raw && typeof raw === 'object' ? raw : {}) as { intro?: unknown; prompts?: unknown }
  const prompts = Array.isArray(r.prompts)
    ? r.prompts.flatMap((p) => {
        const one = exercisePromptSchema.safeParse(p)
        return one.success ? [one.data] : []
      })
    : []
  return { intro: typeof r.intro === 'string' ? r.intro : undefined, prompts }
}

/**
 * Keeps only answers that fit the prompts: unknown prompt ids are dropped, text is trimmed to the limit,
 * choices must be real options. Never throws.
 */
export function cleanAnswers(content: ExerciseContent, raw: unknown): ExerciseAnswers {
  const input = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>
  const out: ExerciseAnswers = {}
  for (const p of content.prompts) {
    const v = input[p.id]
    if (p.kind === 'text') {
      if (typeof v === 'string') out[p.id] = v.slice(0, MAX_ANSWER_CHARS)
    } else if (p.kind === 'single') {
      if (typeof v === 'string' && p.options?.includes(v)) out[p.id] = v
    } else {
      if (Array.isArray(v)) {
        const picked = (p.options ?? []).filter((o) => v.includes(o))
        out[p.id] = picked
      }
    }
  }
  return out
}

export function isPromptAnswered(p: ExercisePrompt, answers: ExerciseAnswers): boolean {
  const v = answers[p.id]
  if (p.kind === 'multi') return Array.isArray(v) && v.length > 0
  return typeof v === 'string' && v.trim().length > 0
}

/** Every prompt answered. An exercise with no prompts is never "complete". */
export function isExerciseComplete(content: ExerciseContent, answers: ExerciseAnswers): boolean {
  return content.prompts.length > 0 && content.prompts.every((p) => isPromptAnswered(p, answers))
}

export function answeredCount(content: ExerciseContent, answers: ExerciseAnswers): number {
  return content.prompts.filter((p) => isPromptAnswered(p, answers)).length
}
