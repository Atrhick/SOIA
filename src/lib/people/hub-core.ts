/**
 * Admin person page ("everything this person is part of"): pure wording, grouping and small sums.
 * No database here (tested in hub-core.test.ts); hub.ts loads the data.
 */

/** The admin person page for a login. */
export const personPath = (userId: string) => `/admin/people/${encodeURIComponent(userId)}`

/** The person page of whoever owns a program page (the queue only has the page id). */
export const programOwnerPath = (programId: string) => `/admin/people/program-owner/${encodeURIComponent(programId)}`

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  SUB_ADMIN: 'Support team',
  COACH: 'Coach',
  AMBASSADOR: 'Ambassador',
  PARENT: 'Parent',
  SERVICE_PROVIDER: 'Service provider',
  BUSINESS_AFFILIATE: 'Business affiliate',
  VOLUNTEER: 'Volunteer',
}

export const roleLabel = (r: string): string => ROLE_LABELS[r] ?? sentenceCase(r)

export const ACCOUNT_STATUS_LABELS: Record<string, string> = { ACTIVE: 'Active', INACTIVE: 'Inactive', SUSPENDED: 'Suspended' }

export const AMBASSADOR_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Waiting for approval',
  APPROVED: 'Approved',
  INACTIVE: 'Inactive',
  COMPLETED: 'Completed',
  ON_HOLD: 'On hold',
}

export const BUSINESS_IDEA_LABELS: Record<string, string> = {
  DRAFT: 'Draft (not sent yet)',
  SUBMITTED: 'Sent for review',
  UNDER_REVIEW: 'Being reviewed',
  APPROVED: 'Approved',
  NEEDS_REVISION: 'Sent back for changes',
  REJECTED: 'Not approved',
}

export const SPONSORSHIP_LABELS: Record<string, string> = {
  SUBMITTED: 'Sent',
  UNDER_REVIEW: 'Being reviewed',
  APPROVED_FULL: 'Approved in full',
  APPROVED_PARTIAL: 'Partly approved',
  PAYMENT_PLAN: 'Payment plan',
  NOT_APPROVED: 'Not approved',
}

export const SUPPORT_STATUS_LABELS: Record<string, string> = {
  NEW: 'New',
  ASSIGNED: 'Being handled',
  WAITING_ON_SENDER: 'Waiting on them',
  DONE: 'Done',
}

export function sentenceCase(s: string): string {
  const t = s.replace(/_/g, ' ').toLowerCase().trim()
  return t ? t[0].toUpperCase() + t.slice(1) : t
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

/** "Wendy" from a full name, else the part of the email before @. */
export function firstNameOf(name: string | null | undefined, email: string): string {
  const f = (name ?? '').trim().split(/\s+/)[0]
  return f || email.split('@')[0]
}

/** Whole years between a date of birth and now. */
export function ageOn(dob: Date | null | undefined, now: Date): number | null {
  if (!dob) return null
  let age = now.getUTCFullYear() - dob.getUTCFullYear()
  const m = now.getUTCMonth() - dob.getUTCMonth()
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) age--
  return age
}

/** Wall-clock parts of an instant in `tz`, and that zone's offset (ms) at the instant. */
function wallIn(at: Date, tz: string): { y: number; m: number; offset: number } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' })
      .formatToParts(at)
      .map((x) => [x.type, x.value]),
  )
  const wallAsUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
  return { y: +p.year, m: +p.month, offset: wallAsUtc - Math.floor(at.getTime() / 1000) * 1000 }
}

/** The instant the current calendar month began in `tz` (e.g. America/Chicago), daylight saving included. */
export function monthStartIn(now: Date, tz: string): Date {
  const { y, m, offset } = wallIn(now, tz)
  const midnightUtc = Date.UTC(y, m - 1, 1)
  // First guess with today's offset, then correct with the offset in force at that midnight.
  const guess = new Date(midnightUtc - offset)
  return new Date(midnightUtc - wallIn(guess, tz).offset)
}

/** Hours worked from time entries; a running timer counts up to `now`. Rounded to 0.1. */
export function hoursFrom(entries: { startTime: Date; endTime: Date | null }[], now: Date): number {
  let ms = 0
  for (const e of entries) {
    const end = (e.endTime ?? now).getTime()
    if (end > e.startTime.getTime()) ms += end - e.startTime.getTime()
  }
  return Math.round(ms / 360_000) / 10
}

/** "just now", "5 minutes ago", "3 hours ago", "yesterday", "4 days ago", else a date. */
export function ago(d: Date | string | null | undefined, now: Date): string | null {
  if (!d) return null
  const t = typeof d === 'string' ? new Date(d) : d
  const diff = now.getTime() - t.getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${plural(min, 'minute')} ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${plural(h, 'hour')} ago`
  const days = Math.floor(h / 24)
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  return `on ${t.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`
}

/** Header line: "Last signed in 3 days ago · Last active 2 hours ago", or "Never signed in". */
export function signInLine(lastLoginAt: Date | string | null, lastSeenAt: Date | string | null, now: Date): string {
  const login = ago(lastLoginAt, now)
  const seen = ago(lastSeenAt, now)
  if (!login && !seen) return 'Never signed in'
  const parts: string[] = []
  parts.push(login ? `Last signed in ${login}` : 'Signed in before sign-ins were recorded')
  if (seen) parts.push(`Last active ${seen}`)
  return parts.join(' · ')
}

// ---------- audit log in plain words ----------

const VERBS: Record<string, string> = {
  CREATE: 'Created',
  UPDATE: 'Changed',
  DELETE: 'Deleted',
  REMOVE: 'Removed',
  SUBMIT: 'Sent',
  SAVE: 'Saved',
  RESET: 'Reset',
  REVIEW: 'Reviewed',
  ENROLL: 'Joined',
  PUBLISH: 'Published',
  UNPUBLISH: 'Took down',
  APPROVE: 'Approved',
  REJECT: 'Turned down',
  INVITE: 'Invited',
  SEND: 'Sent',
  MARK: 'Marked',
  MOVE: 'Moved',
  ASSIGN: 'Assigned',
  BLOCK: 'Blocked',
  UNBLOCK: 'Unblocked',
  RESEND: 'Sent again',
}

const SPECIAL: Record<string, string> = {
  IMPERSONATE_USER: 'Viewed the app as this person',
  UPDATE_USER_ROLES: 'Changed roles',
  UPDATE_USER_ROLE: 'Changed role',
  UPDATE_USER_PERMISSIONS: 'Changed tool access',
  RESET_USER_PASSWORD: 'Reset the password',
  RESET_COACH_PASSWORD: 'Reset the password',
  RESET_AMBASSADOR_PASSWORD: 'Reset the password',
  UPDATE_COACH_STATUS: 'Changed account status',
  UPDATE_AMBASSADOR_STATUS: 'Changed ambassador status',
  SUBMIT_BUSINESS_IDEA: 'Sent their business idea for review',
  SAVE_BUSINESS_IDEA: 'Saved their business idea',
  REVIEW_BUSINESS_IDEA: 'Reviewed the business idea',
  SUBMIT_SURVEY: 'Answered a survey or quiz',
  ENROLL_LMS_COURSE: 'Started a course',
  INVITE_TO_POWER_TEAM: 'Invited to the Power Team',
  SUPPORT_ASSIGNED: 'Assigned a support message',
  SUPPORT_REASSIGNED: 'Passed on a support message',
  SUPPORT_STATUS: 'Changed a support message',
  BROADCAST_SENT: 'Sent a notification',
}

const WORDS: Record<string, string> = {
  LMS: '',
  KB: 'knowledge base',
  USER: 'account',
  COACH: 'coach',
  AMBASSADOR: 'ambassador',
}

/** "UPDATE_AMBASSADOR_PROFILE" -> "Changed ambassador profile". */
export function actionWords(action: string): string {
  if (SPECIAL[action]) return SPECIAL[action]
  const [first, ...rest] = action.split('_')
  const verb = VERBS[first]
  const tail = rest.map((w) => WORDS[w] ?? w.toLowerCase()).filter(Boolean).join(' ')
  if (verb) return tail ? `${verb} ${tail}` : verb
  return sentenceCase(action)
}

export interface AuditRow {
  id: string
  userId: string | null
  action: string
  entityType: string
  entityId: string | null
  createdAt: Date
}

export interface ActivityLine {
  id: string
  at: string
  text: string
  /** true = something they did; false = something done to their account by someone else. */
  byThem: boolean
}

/** Audit rows to plain lines: "You…" is avoided; "They …" for their own actions, "<Name>: …" for others. */
export function activityLines(rows: AuditRow[], personUserId: string, names: Map<string, string>): ActivityLine[] {
  return rows.map((r) => {
    const byThem = r.userId === personUserId
    const what = actionWords(r.action)
    const who = r.userId ? names.get(r.userId) ?? 'Someone on the team' : 'The system'
    return { id: r.id, at: r.createdAt.toISOString(), text: byThem ? what : `${who}: ${what.charAt(0).toLowerCase()}${what.slice(1)}`, byThem }
  })
}

// ---------- areas ----------

export interface AreaLink {
  label: string
  href: string
  /** Opens a public page in a new tab. */
  external?: boolean
}

export interface AreaItem {
  label: string
  sub?: string | null
  href?: string | null
  external?: boolean
  /** A second small link on the row, e.g. "See it live". */
  secondary?: AreaLink | null
}

export interface Area {
  key: string
  title: string
  /** One line of status. */
  status: string
  /** Nothing here yet: listed in the "Nothing yet in" line instead of a card. */
  empty: boolean
  links: AreaLink[]
  items?: AreaItem[]
  /** Extra items not shown (the list was cut). */
  more?: number
  /** A plain note under the status, e.g. "This screen shows everyone, not just Wendy." */
  note?: string | null
}

/** Cards to show, and the titles of areas with nothing yet (in the given order). */
export function splitAreas(areas: Area[]): { shown: Area[]; nothingYet: string[] } {
  return { shown: areas.filter((a) => !a.empty), nothingYet: areas.filter((a) => a.empty).map((a) => a.title) }
}

/** "Program pages, Groups and Learning". */
export function listWords(words: string[]): string {
  if (words.length <= 1) return words.join('')
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

/** Weekly checklist line for an ambassador, from a WeekStatus-like object. */
export function weekLine(w: { weekNo: number; doneCount: number }, weeks: number, when: 'live' | 'before' | 'after'): string {
  if (when === 'before') return `The group starts soon · week 1 of ${weeks}`
  if (when === 'after') return `The group has finished · last week: ${w.doneCount} of 5 done`
  return `Week ${w.weekNo} of ${weeks} · ${w.doneCount} of 5 done`
}

export function percent(n: number): string {
  return `${Math.max(0, Math.min(100, Math.round(n)))}%`
}
