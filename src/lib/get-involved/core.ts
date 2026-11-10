/**
 * Pure logic for the Get Involved journey: age ranges, discovery-call slots,
 * host picking, and One-A-Day streaks. No database access here, so it can be
 * unit tested (see core.test.ts).
 */
import { TZDate } from '@date-fns/tz'

export type AgeRangeValue = 'UNDER_18' | 'AGE_18_24' | 'AGE_25_55' | 'AGE_56_PLUS'

export const AGE_RANGES: { value: AgeRangeValue; label: string }[] = [
  { value: 'UNDER_18', label: '17 and under' },
  { value: 'AGE_18_24', label: '18–24' },
  { value: 'AGE_25_55', label: '25–55' },
  { value: 'AGE_56_PLUS', label: '56+' },
]

export function ageRangeLabel(v: string | null | undefined): string {
  return AGE_RANGES.find((a) => a.value === v)?.label ?? 'Not given'
}

export const CALL_MINUTES = 30
export const BOOKING_WINDOW_DAYS = 21
export const MIN_NOTICE_HOURS = 12
/** Prospects can change or cancel up to this long before the call. */
export const CHANGE_CUTOFF_HOURS = 2
/** Links in emails work this long. */
export const LINK_VALID_DAYS = 14
/** After this many missed calls the prospect is paused. */
export const MAX_NO_SHOWS = 2
/** Business timezone for streaks and "today". */
export const BUSINESS_TZ = 'America/Chicago'

export interface HostWindow {
  dayOfWeek: number // 0 = Sunday, in the host's timezone
  startMinute: number
  endMinute: number
}

export interface HostForSlots {
  id: string // user id
  timezone: string
  availability: HostWindow[]
  /** Whole days off, as yyyy-mm-dd in the host's own timezone (DiscoveryBlockedDate.day). No slots on these days. */
  blockedDays?: readonly string[]
}

/** yyyy-mm-dd for a calendar date given its year, 0-based month and day. */
export function dayKey(y: number, monthIndex: number, d: number): string {
  return `${y}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** True for a real calendar date written yyyy-mm-dd. */
export function isDayKey(v: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  if (!m) return false
  const dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  return dt.getUTCFullYear() === +m[1] && dt.getUTCMonth() === +m[2] - 1 && dt.getUTCDate() === +m[3]
}

/** The yyyy-mm-dd an instant falls on in a timezone (the host's "day" for blocked dates). */
export function dayKeyIn(d: Date, tz: string): string {
  const z = new TZDate(d.getTime(), tz)
  return dayKey(z.getFullYear(), z.getMonth(), z.getDate())
}

export interface BusyBlock {
  hostId: string
  startsAt: Date
  endsAt: Date
}

export interface Slot {
  startsAt: Date
  hostIds: string[]
}

/**
 * All open 30-minute slots across the given hosts. A slot is open for a host
 * when it falls inside one of their weekly windows (in their own timezone),
 * is at least MIN_NOTICE_HOURS away, within the booking window, not on one of the
 * host's blocked days, and does not overlap a busy block for that host.
 */
export function generateSlots(
  hosts: HostForSlots[],
  busy: BusyBlock[],
  now: Date,
  opts: { days?: number; minNoticeHours?: number; minutes?: number } = {},
): Slot[] {
  const days = opts.days ?? BOOKING_WINDOW_DAYS
  const minutes = opts.minutes ?? CALL_MINUTES
  const earliest = now.getTime() + (opts.minNoticeHours ?? MIN_NOTICE_HOURS) * 3600_000
  const latest = now.getTime() + days * 86400_000
  const byStart = new Map<number, Set<string>>()

  for (const host of hosts) {
    const hostBusy = busy.filter((b) => b.hostId === host.id)
    const blocked = new Set(host.blockedDays ?? [])
    const today = new TZDate(now.getTime(), host.timezone)
    for (let d = 0; d <= days; d++) {
      const day = new TZDate(today.getFullYear(), today.getMonth(), today.getDate() + d, 0, 0, 0, host.timezone)
      if (blocked.has(dayKey(day.getFullYear(), day.getMonth(), day.getDate()))) continue
      const dow = day.getDay()
      for (const w of host.availability) {
        if (w.dayOfWeek !== dow) continue
        for (let m = w.startMinute; m + minutes <= w.endMinute; m += minutes) {
          const start = new TZDate(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(m / 60), m % 60, 0, host.timezone)
          const t = start.getTime()
          if (t < earliest || t > latest) continue
          const end = t + minutes * 60_000
          if (hostBusy.some((b) => b.startsAt.getTime() < end && b.endsAt.getTime() > t)) continue
          if (!byStart.has(t)) byStart.set(t, new Set())
          byStart.get(t)!.add(host.id)
        }
      }
    }
  }

  return Array.from(byStart.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([t, ids]) => ({ startsAt: new Date(t), hostIds: Array.from(ids).sort() }))
}

/** Pick the host with the fewest upcoming calls; ties go to the lowest id so it is stable. */
export function pickHost(hostIds: string[], upcomingCounts: Record<string, number>): string | null {
  if (hostIds.length === 0) return null
  return [...hostIds].sort((a, b) => (upcomingCounts[a] ?? 0) - (upcomingCounts[b] ?? 0) || a.localeCompare(b))[0]
}

/** yyyy-mm-dd of an instant in the business timezone. */
export function businessDay(d: Date, tz = BUSINESS_TZ): string {
  const z = new TZDate(d.getTime(), tz)
  return `${z.getFullYear()}-${String(z.getMonth() + 1).padStart(2, '0')}-${String(z.getDate()).padStart(2, '0')}`
}

function prevDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d - 1))
  return dt.toISOString().slice(0, 10)
}

/**
 * Days in a row with at least one invite. A streak still counts if today has
 * nothing yet but yesterday did (the person has until midnight).
 */
export function computeStreak(inviteDates: Date[], now: Date, tz = BUSINESS_TZ): { streak: number; doneToday: boolean } {
  const days = new Set(inviteDates.map((d) => businessDay(d, tz)))
  const today = businessDay(now, tz)
  const doneToday = days.has(today)
  let cursor = doneToday ? today : prevDay(today)
  let streak = 0
  while (days.has(cursor)) {
    streak++
    cursor = prevDay(cursor)
  }
  return { streak, doneToday }
}

export interface LeaderRow {
  userId: string
  name: string
  role: string
  forms: number
  joined: number
}

/** Ranked by people who joined, then forms, then name. */
export function rankLeaderboard<T extends LeaderRow>(rows: T[]): (T & { rank: number })[] {
  return [...rows]
    .sort((a, b) => b.joined - a.joined || b.forms - a.forms || a.name.localeCompare(b.name))
    .map((r, i) => ({ ...r, rank: i + 1 }))
}


/** Only these statuses can book, move or cancel a call, or be sent a new journey link. */
export const JOURNEY_OPEN_STATUSES: readonly string[] = ['FORM_SUBMITTED', 'DISCOVERY_BOOKED']
export function journeyOpen(status: string): boolean {
  return JOURNEY_OPEN_STATUSES.includes(status)
}

export function linkStillValid(issuedAt: Date | null | undefined, now: Date): boolean {
  if (!issuedAt) return false
  return now.getTime() - issuedAt.getTime() <= LINK_VALID_DAYS * 86400_000
}

/** Whether a booked call can still be changed or cancelled by the prospect. */
export function canProspectChange(startsAt: Date, now: Date): boolean {
  return startsAt.getTime() - now.getTime() >= CHANGE_CUTOFF_HOURS * 3600_000
}

/** A short, url-safe invite slug from a name, e.g. "daniella-munene". */
export function slugifyName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'member'
}

/** Format an instant for emails/pages, e.g. "Thu, Nov 12 · 2:00 PM CST". */
export function formatCallTime(d: Date, tz: string): string {
  const date = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: tz }).format(d)
  const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short', timeZone: tz }).format(d)
  return `${date} · ${time}`
}

// =====================================================================
// Phase 2/3: roles, journey stages, progress rail. Still pure: no DB.
// =====================================================================

export type GetInvolvedRoleValue =
  | 'COACH' | 'SERVICE_PROVIDER' | 'COACH_SERVICE_PROVIDER' | 'BUSINESS_AFFILIATE' | 'RESOURCE_CENTER_OWNER'
  | 'AMBASSADOR' | 'YOUTH_AMBASSADOR' | 'VOLUNTEER' | 'SPONSOR'
export type RoleBillingValue = 'ONE_TIME' | 'MONTHLY' | 'YEARLY' | 'FREE' | 'GIFT'
export type AnswerTypeValue = 'SHORT_TEXT' | 'CHOICE' | 'SCALE_1_5'

/** Display order everywhere (Role Settings, call record, filters). */
export const GET_INVOLVED_ROLES: readonly GetInvolvedRoleValue[] = [
  'COACH', 'SERVICE_PROVIDER', 'COACH_SERVICE_PROVIDER', 'BUSINESS_AFFILIATE', 'RESOURCE_CENTER_OWNER',
  'AMBASSADOR', 'YOUTH_AMBASSADOR', 'VOLUNTEER', 'SPONSOR',
]
export function isGetInvolvedRole(v: unknown): v is GetInvolvedRoleValue {
  return typeof v === 'string' && (GET_INVOLVED_ROLES as readonly string[]).includes(v)
}
export const ROLE_BILLINGS: { value: RoleBillingValue; label: string }[] = [
  { value: 'ONE_TIME', label: 'One time' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'YEARLY', label: 'Yearly' },
  { value: 'FREE', label: 'Free' },
  { value: 'GIFT', label: 'Gift' },
]
export const ANSWER_TYPES: { value: AnswerTypeValue; label: string }[] = [
  { value: 'SHORT_TEXT', label: 'Short text' },
  { value: 'CHOICE', label: 'Choice' },
  { value: 'SCALE_1_5', label: '1–5 scale' },
]
/** Every role has exactly this many assessment questions. */
export const QUESTION_COUNT = 3
/** Days after the assessment email before one automatic reminder. */
export const ASSESSMENT_REMINDER_DAYS = 2
/** If the orientation still isn't watched, the reminder repeats after this many days. */
export const ORIENTATION_REPEAT_DAYS = 3
/** "Remind me later" can be at most this far ahead. */
export const ORIENTATION_LATER_MAX_DAYS = 14

export interface AssessmentQuestion {
  text: string
  type: AnswerTypeValue
  /** Only used when type is CHOICE (2 to 8 options). Empty otherwise. */
  choices: string[]
}

/** A stored answer. Prospect.assessmentAnswers is an array of these, in question order. */
export interface StoredAnswer {
  question: string
  type: AnswerTypeValue
  answer: string
}

/** What every page reads for a role. Same fields as a GetInvolvedRoleConfig row, minus ids and dates. */
export interface RoleConfig {
  role: GetInvolvedRoleValue
  label: string
  whoFor: string
  ageRanges: AgeRangeValue[]
  active: boolean
  priceCents: number
  /** Optional display override for the price, e.g. "$29–399/mo". */
  priceNote: string | null
  billing: RoleBillingValue
  questions: AssessmentQuestion[]
  orientationUrl: string | null
  orientationMinutes: number | null
  orientationPoints: string[]
  comprehensionCheck: boolean
  comprehensionQuestion: string | null
  /** SPONSOR: where the donation hand-off sends them. */
  handoffUrl: string | null
  /** false when the values are the built-in defaults (no row saved yet). */
  saved: boolean
}

const ADULT: AgeRangeValue[] = ['AGE_18_24', 'AGE_25_55', 'AGE_56_PLUS']

function makeDefault(role: GetInvolvedRoleValue, label: string, whoFor: string, ageRanges: AgeRangeValue[], priceCents: number, billing: RoleBillingValue, priceNote: string | null = null): RoleConfig {
  return {
    role, label, whoFor, ageRanges, active: true, priceCents, priceNote, billing,
    questions: [1, 2, 3].map((n) => ({ text: `[${label} question ${n}: being rewritten]`, type: 'SHORT_TEXT' as const, choices: [] })),
    orientationUrl: null,
    orientationMinutes: role === 'COACH' ? 40 : null,
    orientationPoints: ['[Key point 1 about the role]', '[Key point 2 about the role]', '[Key point 3 about the role]'],
    comprehensionCheck: false,
    comprehensionQuestion: null,
    handoffUrl: null,
    saved: false,
  }
}

/** Built-in settings used until an admin saves the role in Role Settings (taken from the mockups). */
export const DEFAULT_ROLE_CONFIGS: Record<GetInvolvedRoleValue, RoleConfig> = {
  COACH: makeDefault('COACH', 'Coach', 'Teaches the personal development program', ADULT, 9900, 'ONE_TIME'),
  SERVICE_PROVIDER: makeDefault('SERVICE_PROVIDER', 'Service provider', '[Who the service provider role is for]', ADULT, 2900, 'MONTHLY', '$29–399/mo'),
  COACH_SERVICE_PROVIDER: makeDefault('COACH_SERVICE_PROVIDER', 'Coach + service provider', '[Who the coach + service provider role is for]', ADULT, 9900, 'ONE_TIME', '$99 + sub'),
  BUSINESS_AFFILIATE: makeDefault('BUSINESS_AFFILIATE', 'Business affiliate', '[Who the business affiliate role is for]', ADULT, 25000, 'YEARLY'),
  RESOURCE_CENTER_OWNER: makeDefault('RESOURCE_CENTER_OWNER', 'Resource center owner', '[Who the resource center owner role is for]', ADULT, 25000, 'ONE_TIME'),
  AMBASSADOR: makeDefault('AMBASSADOR', 'Ambassador', '[Who the ambassador role is for]', ADULT, 0, 'FREE'),
  YOUTH_AMBASSADOR: makeDefault('YOUTH_AMBASSADOR', 'Youth ambassador', '[Who the youth ambassador role is for]', ['UNDER_18'], 0, 'FREE'),
  VOLUNTEER: makeDefault('VOLUNTEER', 'Volunteer', '[Who the volunteer role is for]', ['UNDER_18', ...ADULT], 0, 'FREE'),
  SPONSOR: makeDefault('SPONSOR', 'Sponsor / donor', '[Who the sponsor / donor role is for]', ADULT, 0, 'GIFT'),
}

/** Placeholder terms used until an admin saves version 1 (version 0 = never saved). */
export function defaultTermsBody(role: GetInvolvedRoleValue): string {
  if (role === 'VOLUNTEER') {
    return '[Volunteer terms: to be written]\n1. What volunteers do and how often.\n2. Code of conduct and working with young people.\n3. Background check where required.\n4. Privacy: how we use your details.\n5. How to step back at any time.'
  }
  return `[${DEFAULT_ROLE_CONFIGS[role].label} terms: expectations, code of conduct, refund policy. To be written.]`
}

/** Default label for a role value; prefer RoleConfig.label when you have the config. */
export function roleLabel(role: string | null | undefined): string {
  return isGetInvolvedRole(role) ? DEFAULT_ROLE_CONFIGS[role].label : 'No role yet'
}

/** Paid roles go through the payment step. FREE and GIFT never do, nor does a price of 0. */
export function isPaidRole(cfg: Pick<RoleConfig, 'billing' | 'priceCents'>): boolean {
  return (cfg.billing === 'ONE_TIME' || cfg.billing === 'MONTHLY' || cfg.billing === 'YEARLY') && cfg.priceCents > 0
}

/** SPONSOR gets no login: they are handed to the donation page instead. */
export function roleHasLogin(role: GetInvolvedRoleValue): boolean {
  return role !== 'SPONSOR'
}

/** "$99", "$29.50", "$1,250". */
export function formatDollars(cents: number): string {
  const d = cents / 100
  return Number.isInteger(d) ? `$${d.toLocaleString('en-US')}` : `$${d.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Short price for lists: "$99 once", "$29/mo", "$250/yr", "Free", "Gift", or the admin's priceNote. */
export function priceLabel(cfg: Pick<RoleConfig, 'billing' | 'priceCents' | 'priceNote'>): string {
  if (cfg.priceNote) return cfg.priceNote
  switch (cfg.billing) {
    case 'FREE': return 'Free'
    case 'GIFT': return 'Gift'
    case 'MONTHLY': return `${formatDollars(cfg.priceCents)}/mo`
    case 'YEARLY': return `${formatDollars(cfg.priceCents)}/yr`
    default: return cfg.priceCents > 0 ? `${formatDollars(cfg.priceCents)} once` : 'Free'
  }
}

/** "one time", "monthly", "yearly", "free", "gift" (as in "Coach fee · one time"). */
export function billingLabel(b: RoleBillingValue): string {
  return ({ ONE_TIME: 'one time', MONTHLY: 'monthly', YEARLY: 'yearly', FREE: 'free', GIFT: 'gift' } as const)[b]
}

/**
 * Roles an interviewer may pick for someone in this age range: active, allowed for the range,
 * and for 17 and under only free roles. Keeps the order of GET_INVOLVED_ROLES.
 */
export function rolesForAge(configs: RoleConfig[], ageRange: string | null | undefined): RoleConfig[] {
  const range = (ageRange ?? 'AGE_25_55') as AgeRangeValue
  return GET_INVOLVED_ROLES
    .map((r) => configs.find((c) => c.role === r))
    .filter((c): c is RoleConfig => !!c && c.active && c.ageRanges.includes(range) && (range !== 'UNDER_18' || !isPaidRole(c)))
}

/** The login role a finished journey creates. SPONSOR gets none. */
export function userRoleFor(role: GetInvolvedRoleValue): 'COACH' | 'AMBASSADOR' | 'SERVICE_PROVIDER' | 'BUSINESS_AFFILIATE' | 'VOLUNTEER' | null {
  switch (role) {
    case 'COACH':
    case 'COACH_SERVICE_PROVIDER':
    case 'RESOURCE_CENTER_OWNER':
      return 'COACH'
    case 'AMBASSADOR':
    case 'YOUTH_AMBASSADOR':
      return 'AMBASSADOR'
    case 'SERVICE_PROVIDER':
    case 'BUSINESS_AFFILIATE':
    case 'VOLUNTEER':
      return role
    default:
      return null
  }
}

// ---------- parsing stored JSON (Role Settings rows, snapshots, answers) ----------

const str = (v: unknown, max = 2000) => (typeof v === 'string' ? v.slice(0, max) : '')

/** Always returns exactly QUESTION_COUNT questions; missing or blank ones come from `fallback`. */
export function parseQuestions(json: unknown, fallback: AssessmentQuestion[]): AssessmentQuestion[] {
  const arr = Array.isArray(json) ? json : []
  return Array.from({ length: QUESTION_COUNT }, (_, i) => {
    const q = arr[i] as Record<string, unknown> | undefined
    const fb = fallback[i] ?? { text: `[Question ${i + 1}]`, type: 'SHORT_TEXT' as const, choices: [] }
    if (!q || typeof q !== 'object' || !str(q.text).trim()) return { ...fb, choices: [...fb.choices] }
    const type = (['SHORT_TEXT', 'CHOICE', 'SCALE_1_5'] as const).find((t) => t === q.type) ?? 'SHORT_TEXT'
    const choices = type === 'CHOICE' && Array.isArray(q.choices) ? q.choices.map((c) => str(c, 200).trim()).filter(Boolean).slice(0, 8) : []
    // A choice question needs at least two options; otherwise treat it as short text.
    if (type === 'CHOICE' && choices.length < 2) return { text: str(q.text).trim(), type: 'SHORT_TEXT', choices: [] }
    return { text: str(q.text).trim(), type, choices }
  })
}

/**
 * A saved row (or null) merged over the defaults. Pass the Prisma GetInvolvedRoleConfig row as-is,
 * or a parsed Prospect.roleConfigSnapshot. `saved` is true when a row was given.
 */
export function roleConfigFromRow(role: GetInvolvedRoleValue, row: Record<string, unknown> | null | undefined): RoleConfig {
  const d = DEFAULT_ROLE_CONFIGS[role]
  if (!row || typeof row !== 'object') return { ...d, ageRanges: [...d.ageRanges], orientationPoints: [...d.orientationPoints], questions: parseQuestions(null, d.questions) }
  const text = (v: unknown, fb: string) => (typeof v === 'string' && v.trim() ? v : fb)
  const opt = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null)
  const ages = Array.isArray(row.ageRanges) ? (row.ageRanges as unknown[]).filter((a): a is AgeRangeValue => AGE_RANGES.some((r) => r.value === a)) : d.ageRanges
  return {
    role,
    label: text(row.label, d.label),
    whoFor: text(row.whoFor, d.whoFor),
    ageRanges: ages,
    active: typeof row.active === 'boolean' ? row.active : d.active,
    priceCents: typeof row.priceCents === 'number' && row.priceCents >= 0 ? Math.round(row.priceCents) : d.priceCents,
    priceNote: 'priceNote' in row ? opt(row.priceNote) : d.priceNote,
    billing: ROLE_BILLINGS.find((b) => b.value === row.billing)?.value ?? d.billing,
    questions: parseQuestions(row.questions, d.questions),
    orientationUrl: opt(row.orientationUrl),
    orientationMinutes: typeof row.orientationMinutes === 'number' && row.orientationMinutes > 0 ? Math.round(row.orientationMinutes) : 'orientationMinutes' in row ? null : d.orientationMinutes,
    orientationPoints: Array.isArray(row.orientationPoints) ? (row.orientationPoints as unknown[]).map((p) => str(p, 300).trim()).filter(Boolean) : d.orientationPoints,
    comprehensionCheck: typeof row.comprehensionCheck === 'boolean' ? row.comprehensionCheck : d.comprehensionCheck,
    comprehensionQuestion: opt(row.comprehensionQuestion),
    handoffUrl: opt(row.handoffUrl),
    saved: true,
  }
}

/** What goes into Prospect.roleConfigSnapshot when a role is chosen (plain JSON). */
export function roleConfigSnapshot(cfg: RoleConfig): Record<string, unknown> {
  const copy: Record<string, unknown> = JSON.parse(JSON.stringify(cfg))
  delete copy.saved
  return copy
}

/**
 * Check a prospect's answers against the questions. `answers[i]` is the raw value for question i.
 * Errors are keyed by question index, ready to show next to each field.
 */
export function validateAnswers(questions: AssessmentQuestion[], answers: unknown[]):
  | { ok: true; answers: StoredAnswer[] }
  | { ok: false; errors: Record<number, string> } {
  const errors: Record<number, string> = {}
  const out: StoredAnswer[] = []
  questions.forEach((q, i) => {
    const v = answers[i]
    const raw = typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : ''
    if (!raw) { errors[i] = 'Please answer this question'; return }
    if (q.type === 'SHORT_TEXT' && raw.length > 2000) { errors[i] = 'Please keep this under 2000 characters'; return }
    if (q.type === 'CHOICE' && !q.choices.includes(raw)) { errors[i] = 'Please pick one of the options'; return }
    if (q.type === 'SCALE_1_5' && !['1', '2', '3', '4', '5'].includes(raw)) { errors[i] = 'Please pick a number from 1 to 5'; return }
    out.push({ question: q.text, type: q.type, answer: raw })
  })
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, answers: out }
}

// ---------- journey stages ----------

export type JourneyStage =
  | 'FORM' | 'PARENT_CONSENT' | 'BOOK_CALL' | 'DISCOVERY_CALL'
  | 'ASSESSMENT' | 'ORIENTATION' | 'TERMS' | 'PAYMENT' | 'LOGIN'
  | 'DONATION' | 'DONE' | 'CLOSED'

/** Staff-facing names (admin prospect record: Form, Discovery call, Assessment, Orientation, Terms, Payment, Login). */
export const STAGE_LABELS: Record<JourneyStage, string> = {
  FORM: 'Form',
  PARENT_CONSENT: 'Parent consent',
  BOOK_CALL: 'Book a call',
  DISCOVERY_CALL: 'Discovery call',
  ASSESSMENT: 'Assessment',
  ORIENTATION: 'Orientation',
  TERMS: 'Terms',
  PAYMENT: 'Payment',
  LOGIN: 'Login',
  DONATION: 'Donation',
  DONE: 'Joined',
  CLOSED: 'Closed',
}

/**
 * The ordered stages for a role (DONE and CLOSED are not listed). Before a role is chosen pass null to
 * get the generic path. Free roles skip PAYMENT; SPONSOR stops at DONATION.
 */
export function journeyStages(role: GetInvolvedRoleValue | null, opts: { minor: boolean; paid: boolean }): JourneyStage[] {
  const start: JourneyStage[] = ['FORM', ...(opts.minor ? ['PARENT_CONSENT' as const] : []), 'BOOK_CALL', 'DISCOVERY_CALL']
  if (role === 'SPONSOR') return [...start, 'DONATION']
  return [...start, 'ASSESSMENT', 'ORIENTATION', 'TERMS', ...(opts.paid && role ? ['PAYMENT' as const] : []), 'LOGIN']
}

/** The prospect fields the journey rules read. */
export interface JourneyFacts {
  status: string
  journeyRole: string | null
  assessmentSubmittedAt: Date | string | null
  orientationWatchedAt: Date | string | null
  roleTermsAcceptedAt: Date | string | null
  userId: string | null
  /** ProspectPayment.status, or null when there is no payment row. */
  paymentStatus: string | null
  /** isPaidRole(prospectRoleConfig(p)). */
  paid: boolean
}

export interface JourneyPosition {
  stage: JourneyStage
  /** Who has to act next. */
  waitingOn: 'PROSPECT' | 'PARENT' | 'STAFF' | 'NONE'
  /** One short line for staff and inviters, e.g. "Waiting for assessment answers". */
  nextStep: string
}

const CLOSED_STATUSES = ['NOT_A_FIT', 'PAUSED', 'REJECTED']

/** Where a Get Involved prospect is now, from their fields. */
export function journeyPosition(f: JourneyFacts): JourneyPosition {
  if (CLOSED_STATUSES.includes(f.status)) return { stage: 'CLOSED', waitingOn: 'NONE', nextStep: f.status === 'PAUSED' ? 'Paused after missed calls' : 'Closed: not a fit' }
  if (f.userId || f.status === 'ACCOUNT_CREATED') return { stage: 'DONE', waitingOn: 'NONE', nextStep: 'Joined' }
  if (f.status === 'DONATION_HANDOFF') return { stage: 'DONATION', waitingOn: 'NONE', nextStep: 'Sent to the donation page' }
  if (f.status === 'AWAITING_PARENT_CONSENT') return { stage: 'PARENT_CONSENT', waitingOn: 'PARENT', nextStep: 'Waiting for parent consent' }
  if (f.status === 'FORM_SUBMITTED') return { stage: 'BOOK_CALL', waitingOn: 'PROSPECT', nextStep: 'Needs to book a discovery call' }
  if (f.status === 'DISCOVERY_BOOKED') return { stage: 'DISCOVERY_CALL', waitingOn: 'STAFF', nextStep: 'Discovery call booked' }
  if (!isGetInvolvedRole(f.journeyRole)) return { stage: 'DISCOVERY_CALL', waitingOn: 'STAFF', nextStep: 'Call done: choose a role' }
  if (f.journeyRole === 'SPONSOR') return { stage: 'DONATION', waitingOn: 'STAFF', nextStep: 'Send to the donation page' }
  if (!f.assessmentSubmittedAt) return { stage: 'ASSESSMENT', waitingOn: 'PROSPECT', nextStep: 'Waiting for assessment answers' }
  if (!f.orientationWatchedAt) return { stage: 'ORIENTATION', waitingOn: 'PROSPECT', nextStep: 'Needs to watch the orientation' }
  if (!f.roleTermsAcceptedAt) return { stage: 'TERMS', waitingOn: 'PROSPECT', nextStep: 'Needs to accept the terms' }
  if (f.paid && f.paymentStatus !== 'COMPLETED') return { stage: 'PAYMENT', waitingOn: 'PROSPECT', nextStep: f.paymentStatus === 'FAILED' ? 'Payment failed' : 'Waiting for payment' }
  return { stage: 'LOGIN', waitingOn: 'PROSPECT', nextStep: 'Needs to create their login' }
}

/**
 * Where the prospect's link for a stage points (app-relative). Booking stays on /discovery/[token];
 * everything later lives under /journey/[token]/... null = nothing for the prospect to open.
 */
export function stagePath(stage: JourneyStage, token: string): string | null {
  switch (stage) {
    case 'BOOK_CALL':
    case 'DISCOVERY_CALL': return `/discovery/${token}`
    case 'ASSESSMENT': return `/journey/${token}/assessment`
    case 'ORIENTATION': return `/journey/${token}/orientation`
    case 'TERMS':
    case 'PAYMENT':
    case 'LOGIN': return `/journey/${token}/join`
    case 'DONATION': return `/journey/${token}/give`
    case 'DONE': return `/journey/${token}/welcome`
    default: return null
  }
}

// ---------- what each status may do ----------
// journeyOpen() above stays the Phase 1 rule (book / move / cancel a call). Each later step has its
// own predicate, so a page or action checks exactly one thing.

/** Statuses after the call where the prospect still has steps to do (and may ask for a fresh link). */
export const LATER_JOURNEY_STATUSES: readonly string[] = [
  'ASSESSMENT_PENDING', 'ASSESSMENT_COMPLETED', 'ORIENTATION_SCHEDULED', 'ORIENTATION_COMPLETED', 'PAYMENT_PENDING', 'PAYMENT_COMPLETED',
]
export function laterJourneyOpen(status: string): boolean {
  return LATER_JOURNEY_STATUSES.includes(status)
}

/** Staff may choose or change the role until the terms are accepted. DISCOVERY_BOOKED = while recording the call as kept. */
export function canChooseRole(status: string, termsAccepted: boolean): boolean {
  return !termsAccepted && ['DISCOVERY_BOOKED', 'DISCOVERY_COMPLETED', 'ASSESSMENT_PENDING', 'ASSESSMENT_COMPLETED', 'ORIENTATION_SCHEDULED', 'ORIENTATION_COMPLETED', 'DONATION_HANDOFF'].includes(status)
}
export function canAnswerAssessment(status: string): boolean {
  return status === 'ASSESSMENT_PENDING'
}
export function canDoOrientation(status: string): boolean {
  return status === 'ASSESSMENT_COMPLETED' || status === 'ORIENTATION_SCHEDULED'
}
export function canAcceptTerms(status: string): boolean {
  return status === 'ORIENTATION_COMPLETED'
}
export function canPay(status: string): boolean {
  return status === 'PAYMENT_PENDING'
}

/** Free roles create the login in the same step as accepting the terms; paid roles after payment. */
export function canCreateLogin(f: { status: string; paid: boolean; userId: string | null; journeyRole: string | null }): boolean {
  if (f.userId || !isGetInvolvedRole(f.journeyRole) || !roleHasLogin(f.journeyRole)) return false
  return f.paid ? f.status === 'PAYMENT_COMPLETED' : f.status === 'ORIENTATION_COMPLETED'
}

/** Not a fit is allowed any time before money is taken or a login exists. */
export function canMarkNotAFit(status: string): boolean {
  return !['ACCOUNT_CREATED', 'NOT_A_FIT', 'PAYMENT_COMPLETED'].includes(status)
}

/**
 * The status moves the journey makes after the call. Moving back to ASSESSMENT_PENDING (or to
 * DONATION_HANDOFF) = staff changed the role. NOT_A_FIT is governed by canMarkNotAFit.
 */
export const JOURNEY_TRANSITIONS: Record<string, readonly string[]> = {
  DISCOVERY_BOOKED: ['DISCOVERY_COMPLETED', 'ASSESSMENT_PENDING', 'DONATION_HANDOFF'],
  DISCOVERY_COMPLETED: ['ASSESSMENT_PENDING', 'DONATION_HANDOFF'],
  ASSESSMENT_PENDING: ['ASSESSMENT_COMPLETED', 'DONATION_HANDOFF'],
  ASSESSMENT_COMPLETED: ['ORIENTATION_SCHEDULED', 'ORIENTATION_COMPLETED', 'ASSESSMENT_PENDING', 'DONATION_HANDOFF'],
  ORIENTATION_SCHEDULED: ['ORIENTATION_SCHEDULED', 'ORIENTATION_COMPLETED', 'ASSESSMENT_PENDING', 'DONATION_HANDOFF'],
  ORIENTATION_COMPLETED: ['PAYMENT_PENDING', 'ACCOUNT_CREATED', 'ASSESSMENT_PENDING', 'DONATION_HANDOFF'],
  PAYMENT_PENDING: ['PAYMENT_COMPLETED'],
  PAYMENT_COMPLETED: ['ACCOUNT_CREATED'],
  DONATION_HANDOFF: ['ASSESSMENT_PENDING'],
}
export function canTransition(from: string, to: string): boolean {
  if (to === 'NOT_A_FIT') return canMarkNotAFit(from)
  return JOURNEY_TRANSITIONS[from]?.includes(to) ?? false
}

/** The status right after a role is chosen or changed: sponsors go to the donation hand-off. */
export function statusAfterRoleChosen(role: GetInvolvedRoleValue): 'ASSESSMENT_PENDING' | 'DONATION_HANDOFF' {
  return role === 'SPONSOR' ? 'DONATION_HANDOFF' : 'ASSESSMENT_PENDING'
}

// ---------- progress rail (PRail) ----------

export type RailKey = 'INFO' | 'PARENT' | 'BOOK' | 'CALL' | 'ASSESSMENT' | 'ORIENTATION' | 'JOIN' | 'WELCOME' | 'GIVE'
export interface RailStep {
  key: RailKey
  label: string
  state: 'done' | 'current' | 'todo'
}

const RAIL_LABELS: Record<RailKey, string> = {
  INFO: 'Your info', PARENT: "Parent's okay", BOOK: 'Book a call', CALL: 'Discovery call', ASSESSMENT: 'Assessment',
  ORIENTATION: 'Orientation', JOIN: 'Join', WELCOME: 'Welcome', GIVE: 'Give',
}

const STAGE_TO_RAIL: Record<JourneyStage, RailKey | null> = {
  FORM: 'INFO', PARENT_CONSENT: 'PARENT', BOOK_CALL: 'BOOK', DISCOVERY_CALL: 'CALL', ASSESSMENT: 'ASSESSMENT',
  ORIENTATION: 'ORIENTATION', TERMS: 'JOIN', PAYMENT: 'JOIN', LOGIN: 'JOIN', DONATION: 'GIVE', DONE: 'WELCOME', CLOSED: null,
}

/**
 * The prospect-facing steps (PRail): Your info, [Parent's okay for 17 and under], Book a call,
 * Discovery call, Assessment, Orientation, Join, Welcome. Terms, payment and login are one "Join"
 * step, so free and paid roles have the same rail. Sponsors: ... Discovery call, Give.
 * `stage` is journeyPosition(...).stage. CLOSED gives every step 'todo'.
 */
export function railSteps(opts: { role: string | null; ageRange: string | null; stage: JourneyStage }): RailStep[] {
  const keys: RailKey[] = ['INFO', ...(opts.ageRange === 'UNDER_18' ? ['PARENT' as const] : []), 'BOOK', 'CALL']
  if (opts.role === 'SPONSOR') keys.push('GIVE')
  else keys.push('ASSESSMENT', 'ORIENTATION', 'JOIN', 'WELCOME')
  const cur = STAGE_TO_RAIL[opts.stage]
  const idx = cur ? keys.indexOf(cur) : -1
  return keys.map((key, i) => ({ key, label: RAIL_LABELS[key], state: idx < 0 ? 'todo' : i < idx ? 'done' : i === idx ? 'current' : 'todo' }))
}
