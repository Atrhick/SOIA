/**
 * Program info workflow: how far a page's answers are. PURE. Completion is computed from the question
 * definitions in questions.ts: a section is done when all its required answers are non-empty.
 */
import {
  INFO_SECTIONS,
  SECTIONS_TOTAL,
  SHARED_KEYS,
  isAnswered,
  isSharedKey,
  questionById,
  type AnswerKey,
  type SectionId,
} from './questions'

export type Answers = Record<string, unknown>

/** Reads a Json column as an answers object (anything else = empty). */
export function asAnswers(v: unknown): Answers {
  return v && typeof v === 'object' && !Array.isArray(v) ? { ...(v as Answers) } : {}
}

/** A page's own answers with the program's shared answers on top (shared keys always come from the root). */
export function mergeAnswers(pageAnswers: unknown, sharedAnswers: unknown): Answers {
  const page = asAnswers(pageAnswers)
  const shared = asAnswers(sharedAnswers)
  for (const k of SHARED_KEYS) {
    delete page[k]
    if (k in shared) page[k] = shared[k]
  }
  return page
}

export interface SectionProgress {
  id: SectionId
  number: number
  title: string
  shared: boolean
  requiredTotal: number
  requiredAnswered: number
  /** Required + optional questions answered (extras like the Zoom link not counted). */
  answered: number
  questionCount: number
  done: boolean
  started: boolean
  /** Labels of the required questions still empty. */
  missing: { key: AnswerKey; label: string }[]
}

export function sectionProgress(answers: Answers): SectionProgress[] {
  return INFO_SECTIONS.map((s) => {
    const main = s.questions.filter((x) => !x.extraOf)
    const req = main.filter((x) => x.required)
    const missing = req.filter((x) => !isAnswered(x.id, answers[x.id])).map((x) => ({ key: x.id, label: x.label }))
    const answered = main.filter((x) => isAnswered(x.id, answers[x.id])).length
    return {
      id: s.id,
      number: s.number,
      title: s.title,
      shared: s.shared,
      requiredTotal: req.length,
      requiredAnswered: req.length - missing.length,
      answered,
      questionCount: main.length,
      done: missing.length === 0,
      started: answered > 0,
      missing,
    }
  })
}

export function sectionsDone(answers: Answers): number {
  return sectionProgress(answers).filter((s) => s.done).length
}

export interface MissingAnswer {
  sectionId: SectionId
  sectionTitle: string
  key: AnswerKey
  label: string
}

/** Every required answer still empty, in section order. */
export function missingRequired(answers: Answers): MissingAnswer[] {
  return sectionProgress(answers).flatMap((s) => s.missing.map((m) => ({ sectionId: s.id, sectionTitle: s.title, key: m.key, label: m.label })))
}

/**
 * "What you offer (1 answer) and Before they say yes" - for "Still to do: ...". A section with every
 * required answer missing is named alone; a part-done one says how many answers are left.
 */
export function missingText(answers: Answers): string {
  const parts = sectionProgress(answers)
    .filter((s) => !s.done)
    .map((s) => (s.requiredAnswered > 0 ? `${s.title} (${s.missing.length} ${s.missing.length === 1 ? 'answer' : 'answers'})` : s.title))
  if (parts.length <= 1) return parts.join('')
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/** The first section that is not done, or null when all are. */
export function nextSection(answers: Answers): SectionProgress | null {
  return sectionProgress(answers).find((s) => !s.done) ?? null
}

export interface PageProgress {
  sectionsDone: number
  sectionsTotal: number
  complete: boolean
  nextSectionId: SectionId | null
  nextSectionTitle: string | null
  missing: MissingAnswer[]
  missingText: string
}

export function pageProgress(answers: Answers): PageProgress {
  const secs = sectionProgress(answers)
  const next = secs.find((s) => !s.done) ?? null
  const missing = secs.flatMap((s) => s.missing.map((m) => ({ sectionId: s.id, sectionTitle: s.title, key: m.key, label: m.label })))
  return {
    sectionsDone: secs.filter((s) => s.done).length,
    sectionsTotal: SECTIONS_TOTAL,
    complete: missing.length === 0,
    nextSectionId: next?.id ?? null,
    nextSectionTitle: next?.title ?? null,
    missing,
    missingText: missingText(answers),
  }
}

/** Keys whose value differs between two answer sets (for "2 answers changed"). */
export function changedKeys(before: Answers, after: Answers): string[] {
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
  return keys.filter((k) => JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null))
}

// ---------- change detection (amendment A6/A17) ----------

/** Keys compared for "Changed since sent / since live": every answer except cost (prices never appear on the page; they save straight into the price columns) and the names (Names and groups has its own flow). */
export const DIFF_KEYS: AnswerKey[] = [...INFO_SECTIONS.flatMap((s) => s.questions.map((x): AnswerKey => x.id)), 'flyerLink' as AnswerKey].filter((k) => k !== 'cost')

export interface AnswerChange {
  key: AnswerKey
  label: string
  sectionId: SectionId | null
  before: unknown
  after: unknown
}

const norm = (v: unknown): string => {
  if (v === undefined || v === null) return ''
  if (typeof v === 'string') return v.trim()
  if (v === false) return ''
  return JSON.stringify(v)
}

/** Answer-by-answer differences (cost and names excluded). Empty and missing count as the same. */
export function diffAnswers(before: Answers, after: Answers): AnswerChange[] {
  const out: AnswerChange[] = []
  for (const key of DIFF_KEYS) {
    if (norm(before[key]) === norm(after[key])) continue
    const def = questionById(key)
    out.push({ key, label: def?.label ?? key, sectionId: def && def.id !== 'flyerLink' ? def.section : null, before: before[key] ?? null, after: after[key] ?? null })
  }
  return out
}

/** The stages in which a send is still being worked on, so "Changed since sent" means something. */
export const CHANGED_SINCE_SENT_STAGES: readonly string[] = ['WITH_TEAM', 'QUESTION_OPEN', 'CHANGES_ASKED', 'READY_TO_CHECK']

/**
 * Changes since the answers were last sent (snapshot stored on the ANSWERS_SENT event). Empty when never
 * sent, and outside CHANGED_SINCE_SENT_STAGES: once the page is approved (DONE) edits are measured against
 * the live version instead (changedSinceLive).
 */
export function changedSinceSent(sentSnapshot: Answers | null, current: Answers, stage: string): AnswerChange[] {
  return sentSnapshot && CHANGED_SINCE_SENT_STAGES.includes(stage) ? diffAnswers(sentSnapshot, current) : []
}

/** Changes since the live version (answers snapshot of the latest APPROVED version). Empty when never approved. */
export function changedSinceLive(approvedSnapshot: Answers | null, current: Answers): AnswerChange[] {
  return approvedSnapshot ? diffAnswers(approvedSnapshot, current) : []
}

/** Did a shared answer (About you) change between two snapshots? (A7: other live pages need a new version.) */
export function sharedChanged(before: Answers, after: Answers): boolean {
  return diffAnswers(before, after).some((c) => isSharedKey(c.key))
}
