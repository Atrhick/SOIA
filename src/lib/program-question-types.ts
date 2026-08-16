// Question types for the program qualification form.
// Plain module (no 'use server') so both server actions and client components
// can import it - same rationale as feature-names.ts.

export const PROGRAM_QUESTION_TYPES = ['LIKERT', 'TEXT_LONG', 'DROPDOWN', 'RADIO'] as const

export type ProgramQuestionType = (typeof PROGRAM_QUESTION_TYPES)[number]

export interface ProgramLikertConfig {
  min: number
  max: number
  minLabel: string
  maxLabel: string
}

export interface ProgramQuestion {
  id: string
  type: ProgramQuestionType
  label: string
  required: boolean
  /** Required for DROPDOWN and RADIO. At least 2 entries. */
  options?: string[]
  /** Required for LIKERT. */
  likert?: ProgramLikertConfig
}

/** A single stored answer. Label and type are snapshotted at submit time so
 *  later edits to the questions never rewrite historical responses. */
export interface ProgramAnswer {
  questionId: string
  label: string
  type: ProgramQuestionType
  value: string | number
}

export const QUESTION_TYPE_LABELS: Record<ProgramQuestionType, string> = {
  LIKERT: 'Rating scale',
  TEXT_LONG: 'Long answer',
  DROPDOWN: 'Dropdown',
  RADIO: 'Radio buttons',
}

export const DEFAULT_LIKERT: ProgramLikertConfig = {
  min: 1,
  max: 5,
  minLabel: 'Not at all',
  maxLabel: 'Very much',
}

export const MAX_EXTRA_QUESTIONS = 20
export const MAX_TEXT_LONG_LENGTH = 5000

/**
 * Core qualification questions every program asks, in order, before the
 * coach's own additions. Defined in code rather than the database so leads
 * stay comparable across coaches.
 *
 * Ids are stable strings prefixed `core_`. Do not renumber or reuse an id -
 * stored answers reference them.
 */
export const CORE_QUESTIONS: ProgramQuestion[] = [
  {
    id: 'core_interest',
    type: 'RADIO',
    label: 'What brings you to this program?',
    required: true,
    options: [
      'I want to become an ambassador',
      'I want to become a coach',
      'I offer a service the program could use',
      'I represent a business interested in partnering',
      'I want to volunteer',
      'Just exploring for now',
    ],
  },
  {
    id: 'core_timeline',
    type: 'DROPDOWN',
    label: 'How soon are you looking to get started?',
    required: true,
    options: [
      'Immediately',
      'Within the next month',
      'In the next 2-3 months',
      'Later this year',
      'No particular timeline',
    ],
  },
  {
    id: 'core_commitment',
    type: 'LIKERT',
    label: 'How ready are you to commit time each week to this?',
    required: true,
    likert: { min: 1, max: 5, minLabel: 'Not ready yet', maxLabel: 'Fully ready' },
  },
  {
    id: 'core_goals',
    type: 'TEXT_LONG',
    label: 'What are you hoping to get out of the program?',
    required: true,
  },
  {
    id: 'core_community',
    type: 'TEXT_LONG',
    label: 'Is there anything about your community or situation we should know?',
    required: false,
  },
]

/** Slugify a program name for its public URL. */
export function slugifyProgramName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}
