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

// ── Family signups ───────────────────────────────────────────────────────────
// A visitor can be exploring a program for themself, for their children, or
// both. When children are involved the visitor is treated as the parent or
// guardian and is the only person contacted.

export const PROGRAM_AUDIENCES = ['SELF', 'CHILDREN', 'BOTH'] as const
export type ProgramAudience = (typeof PROGRAM_AUDIENCES)[number]

export const AUDIENCE_LABELS: Record<ProgramAudience, string> = {
  SELF: 'Myself',
  CHILDREN: 'My child or children',
  BOTH: 'Myself and my children',
}

export function audienceIncludesChildren(audience: string | null | undefined): boolean {
  return audience === 'CHILDREN' || audience === 'BOTH'
}

/**
 * Age bands rather than dates of birth: enough to judge fit, and far less
 * personal data about a minor. The 10 and 18 boundaries follow the Ambassador
 * program (ages 10-24, parental consent under 18); 13 is the usual line for
 * children's-privacy rules.
 */
export const CHILD_AGE_BANDS = ['UNDER_10', '10_12', '13_15', '16_17', '18_24', '25_PLUS'] as const
export type ChildAgeBand = (typeof CHILD_AGE_BANDS)[number]

export const AGE_BAND_LABELS: Record<ChildAgeBand, string> = {
  UNDER_10: 'Under 10',
  '10_12': '10-12',
  '13_15': '13-15',
  '16_17': '16-17',
  '18_24': '18-24',
  '25_PLUS': '25 or older',
}

/** Bands that fall inside the Ambassador program's 10-24 range. */
export const AMBASSADOR_ELIGIBLE_BANDS: readonly ChildAgeBand[] = ['10_12', '13_15', '16_17', '18_24']

export const MAX_CHILDREN = 6

export interface ProgramChild {
  firstName: string
  ageBand: ChildAgeBand
}

export const FAMILY_STAGES = [
  'NEW',
  'PARENT_CONTACTED',
  'INTRO_CALL_HELD',
  'ENROLLING',
  'ENROLLED',
  'NOT_A_FIT',
] as const
export type FamilyStage = (typeof FAMILY_STAGES)[number]

export const FAMILY_STAGE_LABELS: Record<FamilyStage, string> = {
  NEW: 'New - contact the parent',
  PARENT_CONTACTED: 'Parent contacted',
  INTRO_CALL_HELD: 'Intro call held',
  ENROLLING: 'Enrolling (consent in progress)',
  ENROLLED: 'Enrolled',
  NOT_A_FIT: 'Not a fit right now',
}

/**
 * Asked in addition to the core and coach questions whenever a signup
 * includes children. Written to the parent, about the child, so the coach's
 * first call already knows what matters to the family.
 *
 * Ids use the reserved `family_` prefix. Do not renumber or reuse them.
 */
export const FAMILY_QUESTIONS: ProgramQuestion[] = [
  {
    id: 'family_child_interests',
    type: 'TEXT_LONG',
    label: 'What is your child interested in, or hoping to get out of this?',
    required: true,
  },
  {
    id: 'family_child_involvement',
    type: 'RADIO',
    label: 'How involved would your child like to be?',
    required: true,
    options: [
      'They are keen to get started',
      'They are curious and would like to learn more',
      'This is my idea - I have not asked them yet',
    ],
  },
  {
    id: 'family_sponsorship',
    type: 'RADIO',
    label: 'Would your family like to hear about sponsorship to help with program costs?',
    required: true,
    options: ['Yes please', 'Maybe - tell me more', 'No, thank you'],
  },
  {
    id: 'family_contact_time',
    type: 'DROPDOWN',
    label: 'When is the best time for the coach to reach you?',
    required: true,
    options: ['Weekday mornings', 'Weekday afternoons', 'Weekday evenings', 'Weekends', 'Any time'],
  },
]

/** Question id prefixes owned by the system. Coach questions may not use them. */
export const RESERVED_QUESTION_PREFIXES = ['core_', 'family_'] as const

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
