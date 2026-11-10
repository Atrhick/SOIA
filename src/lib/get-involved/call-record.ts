/**
 * Pure rules for recording a discovery call (the admin "call record" page). Client-safe: no
 * database, no server imports. Tested in call-record.test.ts.
 */
import { GetInvolvedRoleValue, isGetInvolvedRole } from './core'

/** What the host can tick under "Covered on the call". Stored in DiscoveryCall.topicsCovered. */
export const CALL_TOPICS = ['Mission and vision', 'Ways to get involved', 'Their goals (discovery)'] as const
export type CallTopic = (typeof CALL_TOPICS)[number]

export const PARENT_RELATIONSHIPS = ['Parent', 'Legal guardian'] as const

/** The outcomes on the call record page. RESCHEDULE cancels the call and emails a link to pick a new time. */
export type CallOutcome = 'KEPT' | 'NO_SHOW' | 'NOT_A_FIT' | 'RESCHEDULE'
export const CALL_OUTCOMES: { value: CallOutcome; label: string }[] = [
  { value: 'KEPT', label: 'Call kept' },
  { value: 'NO_SHOW', label: 'No-show' },
  { value: 'NOT_A_FIT', label: 'Not a fit' },
  { value: 'RESCHEDULE', label: 'Reschedule' },
]

export interface CallRecordInput {
  outcome: CallOutcome
  /** null = kept, but the role is decided later. */
  role: GetInvolvedRoleValue | null
  topics: string[]
  notes: string
  /** Only for 17 and under. */
  parentAttended: boolean | null
  parentName: string
  parentRelationship: string
}

export interface CallRecordContext {
  minor: boolean
  /** The call's start time has passed. Kept and No-show need this. */
  started: boolean
  /** Roles open to this prospect's age range (rolesForAge). */
  allowedRoles: readonly string[]
}

/** Field errors keyed by field name, so each message can sit next to its field. Empty = valid. */
export function validateCallRecord(i: CallRecordInput, ctx: CallRecordContext): Record<string, string> {
  const e: Record<string, string> = {}
  if (!CALL_OUTCOMES.some((o) => o.value === i.outcome)) e.outcome = 'Choose how the call went.'
  if ((i.outcome === 'KEPT' || i.outcome === 'NO_SHOW') && !ctx.started) e.outcome = "This call hasn't started yet. You can record Kept or No-show once it has."
  if (i.notes.length > 4000) e.notes = 'Notes can be up to 4,000 characters.'
  if (i.topics.some((t) => !(CALL_TOPICS as readonly string[]).includes(t))) e.topics = 'Unknown topic.'

  if (i.outcome === 'KEPT') {
    if (ctx.minor) {
      if (i.parentAttended !== true) e.parentAttended = 'A parent or guardian must be on the whole call for someone 17 and under. If they were not, choose Reschedule.'
      if (!i.parentName.trim()) e.parentName = 'Enter the name of the adult on the call.'
      else if (i.parentName.trim().length > 120) e.parentName = 'Keep the name under 120 characters.'
      if (!(PARENT_RELATIONSHIPS as readonly string[]).includes(i.parentRelationship)) e.parentRelationship = 'Choose Parent or Legal guardian.'
    }
    if (i.role !== null && (!isGetInvolvedRole(i.role) || !ctx.allowedRoles.includes(i.role))) e.role = 'That role is not open to this age range.'
  }
  return e
}

/** The submit button's wording for the chosen outcome and role. */
export function callRecordSubmitLabel(i: Pick<CallRecordInput, 'outcome' | 'role'>, roleName: string | null, minor: boolean): string {
  switch (i.outcome) {
    case 'KEPT':
      if (!i.role) return 'Save: call kept, role later'
      if (i.role === 'SPONSOR') return 'Save and send the giving page'
      return `Save and send ${roleName ?? 'role'} ${minor ? 'questions' : 'assessment'}`
    case 'NO_SHOW': return 'Save no-show and send a rebook link'
    case 'NOT_A_FIT': return 'Close as not a fit and send a kind email'
    case 'RESCHEDULE': return 'Cancel this call and send new times'
  }
}
