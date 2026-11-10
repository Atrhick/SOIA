/**
 * Pure helpers for the Get Involved prospects list (admin): list stages, filters, "last activity"
 * wording and CSV. No database access and no Node APIs, so the client list, the CSV export route
 * and the tests all share it (see journey-list.test.ts).
 */
// Relative import so vitest (no path aliases configured) can load this file.
import { BUSINESS_TZ } from '../../../../lib/get-involved/core'

/** The stages the list groups people into (the mockup's stage filter). */
export type ListStage =
  | 'FORM' | 'CALL_BOOKED' | 'CALL_KEPT' | 'ASSESSMENT' | 'ORIENTATION' | 'TERMS_PAYMENT'
  | 'JOINED' | 'DONATION' | 'NO_SHOW' | 'NOT_A_FIT'

export const LIST_STAGES: { value: ListStage; label: string; badge: string }[] = [
  { value: 'FORM', label: 'Form', badge: 'bg-gray-100 text-gray-800' },
  { value: 'CALL_BOOKED', label: 'Call booked', badge: 'bg-sky-100 text-sky-800' },
  { value: 'CALL_KEPT', label: 'Call kept', badge: 'bg-blue-100 text-blue-800' },
  { value: 'ASSESSMENT', label: 'Assessment', badge: 'bg-purple-100 text-purple-800' },
  { value: 'ORIENTATION', label: 'Orientation', badge: 'bg-purple-100 text-purple-800' },
  { value: 'TERMS_PAYMENT', label: 'Terms / payment', badge: 'bg-orange-100 text-orange-800' },
  { value: 'JOINED', label: 'Joined', badge: 'bg-green-100 text-green-800' },
  { value: 'DONATION', label: 'Sent to donate', badge: 'bg-emerald-100 text-emerald-800' },
  { value: 'NO_SHOW', label: 'No-show / paused', badge: 'bg-red-100 text-red-800' },
  { value: 'NOT_A_FIT', label: 'Not a fit', badge: 'bg-gray-100 text-gray-700' },
]

/** Stages shown as count tiles above the list, in order. JOINED counts the last 30 days. */
export const COUNT_STAGES: ListStage[] = ['FORM', 'CALL_BOOKED', 'CALL_KEPT', 'ASSESSMENT', 'ORIENTATION', 'TERMS_PAYMENT', 'JOINED']

export function isListStage(v: unknown): v is ListStage {
  return typeof v === 'string' && LIST_STAGES.some((s) => s.value === v)
}

export function stageInfo(stage: ListStage) {
  return LIST_STAGES.find((s) => s.value === stage)!
}

/** Which list stage a journey prospect is in, from the status (and a few fields). */
export function listStageFor(p: { status: string; userId: string | null; noShowCount: number }): ListStage {
  const s = p.status
  if (s === 'NOT_A_FIT' || s === 'REJECTED') return 'NOT_A_FIT'
  if (s === 'PAUSED') return 'NO_SHOW'
  if (p.userId || s === 'ACCOUNT_CREATED') return 'JOINED'
  if (s === 'DONATION_HANDOFF') return 'DONATION'
  if (s === 'FORM_SUBMITTED') return p.noShowCount > 0 ? 'NO_SHOW' : 'FORM'
  if (s === 'AWAITING_PARENT_CONSENT') return 'FORM'
  if (s === 'DISCOVERY_BOOKED') return 'CALL_BOOKED'
  if (s === 'DISCOVERY_COMPLETED') return 'CALL_KEPT'
  if (s === 'ASSESSMENT_PENDING') return 'ASSESSMENT'
  if (s === 'ASSESSMENT_COMPLETED' || s === 'ORIENTATION_SCHEDULED') return 'ORIENTATION'
  if (s === 'ORIENTATION_COMPLETED' || s === 'PAYMENT_PENDING' || s === 'PAYMENT_COMPLETED') return 'TERMS_PAYMENT'
  return 'FORM'
}

/** The badge text: the stage label, except "Waiting on parent" and "No-show" for the cases the mockup names. */
export function stageBadgeLabel(stage: ListStage, status: string): string {
  if (status === 'AWAITING_PARENT_CONSENT') return 'Waiting on parent'
  if (stage === 'NO_SHOW') return status === 'PAUSED' ? 'Paused' : 'No-show'
  return stageInfo(stage).label
}
export function stageBadgeClass(stage: ListStage, status: string): string {
  if (status === 'AWAITING_PARENT_CONSENT') return 'bg-amber-100 text-amber-900'
  return stageInfo(stage).badge
}

// ---------- dates ----------

const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
const dayNumber = (d: Date) => Math.round(Date.parse(`${dayKey(d)}T00:00:00Z`) / 86400_000)

/** "today", "yesterday", "3 days ago", "in 2 days", else "Oct 29" (business time zone). */
export function relativeDay(d: Date, now: Date): string {
  const diff = dayNumber(now) - dayNumber(d)
  if (diff === 0) return 'today'
  if (diff === 1) return 'yesterday'
  if (diff === -1) return 'tomorrow'
  if (diff > 1 && diff < 7) return `${diff} days ago`
  if (diff < -1 && diff > -7) return `in ${-diff} days`
  return shortDate(d, now)
}

export function shortDate(d: Date, now: Date): string {
  const sameYear = new Intl.DateTimeFormat('en-US', { timeZone: BUSINESS_TZ, year: 'numeric' }).format(d) === new Intl.DateTimeFormat('en-US', { timeZone: BUSINESS_TZ, year: 'numeric' }).format(now)
  return new Intl.DateTimeFormat('en-US', { timeZone: BUSINESS_TZ, month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) }).format(d)
}

/** "2 PM" or "2:30 PM". */
export function shortTime(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: BUSINESS_TZ, hour: 'numeric', minute: '2-digit' }).format(d)
  return parts.replace(':00', '')
}

/** "today 2 PM", "Thu 2 PM" (within a week), else "Nov 18 2 PM". */
export function callWhen(d: Date, now: Date): string {
  const diff = dayNumber(d) - dayNumber(now)
  const day = diff === 0 ? 'today' : diff === 1 ? 'tomorrow' : diff === -1 ? 'yesterday' : Math.abs(diff) < 7
    ? new Intl.DateTimeFormat('en-US', { timeZone: BUSINESS_TZ, weekday: 'short' }).format(d)
    : shortDate(d, now)
  return `${day} ${shortTime(d)}`
}

// ---------- last activity ----------

export interface ActivityFacts {
  status: string
  stage: ListStage
  createdAt: Date
  updatedAt: Date
  parentConsentRequestedAt: Date | null
  journeyRoleChosenAt: Date | null
  assessmentSentAt: Date | null
  assessmentSubmittedAt: Date | null
  orientationRemindAt: Date | null
  orientationWatchedAt: Date | null
  roleTermsAcceptedAt: Date | null
  paidAt: Date | null
  joinedAt: Date | null
  notAFitAt: Date | null
  /** The next booked call, if any. */
  bookedCallAt: Date | null
  /** The most recent missed call, if any. */
  missedCallAt: Date | null
  /** The newest status-history entry. */
  lastHistoryAt: Date | null
}

/** One short line for the "Last activity" column, plus the time it refers to (for sorting). */
export function lastActivity(f: ActivityFacts, now: Date): { text: string; at: Date } {
  const pick = (text: string, at: Date | null) => ({ text, at: at ?? f.lastHistoryAt ?? f.updatedAt })
  switch (f.stage) {
    case 'FORM':
      if (f.status === 'AWAITING_PARENT_CONSENT') return pick(`Parent emailed ${relativeDay(f.parentConsentRequestedAt ?? f.createdAt, now)}`, f.parentConsentRequestedAt ?? f.createdAt)
      return pick(`Form ${relativeDay(f.lastHistoryAt ?? f.createdAt, now)}`, f.lastHistoryAt ?? f.createdAt)
    case 'CALL_BOOKED':
      if (f.bookedCallAt) return { text: f.bookedCallAt.getTime() > now.getTime() ? `Call ${callWhen(f.bookedCallAt, now)}` : `Call was ${callWhen(f.bookedCallAt, now)}: needs outcome`, at: f.lastHistoryAt ?? f.updatedAt }
      return pick('Call booked', f.lastHistoryAt)
    case 'CALL_KEPT':
      return pick(`Call kept ${relativeDay(f.lastHistoryAt ?? f.updatedAt, now)}: choose a role`, f.lastHistoryAt)
    case 'ASSESSMENT':
      if (f.assessmentSentAt) return pick(`Questions sent ${relativeDay(f.assessmentSentAt, now)}`, f.assessmentSentAt)
      return pick(`Role chosen ${relativeDay(f.journeyRoleChosenAt ?? f.updatedAt, now)}`, f.journeyRoleChosenAt)
    case 'ORIENTATION':
      if (f.status === 'ORIENTATION_SCHEDULED' && f.orientationRemindAt) return pick(`Watching ${callWhen(f.orientationRemindAt, now)}`, f.lastHistoryAt)
      return pick(`Answers in ${relativeDay(f.assessmentSubmittedAt ?? f.updatedAt, now)}`, f.assessmentSubmittedAt)
    case 'TERMS_PAYMENT':
      if (f.status === 'PAYMENT_COMPLETED') return pick(`Paid ${relativeDay(f.paidAt ?? f.updatedAt, now)}`, f.paidAt)
      if (f.roleTermsAcceptedAt) return pick('Terms accepted', f.roleTermsAcceptedAt)
      return pick(`Orientation watched ${relativeDay(f.orientationWatchedAt ?? f.updatedAt, now)}`, f.orientationWatchedAt)
    case 'JOINED':
      return pick(`Joined ${relativeDay(f.joinedAt ?? f.updatedAt, now)}`, f.joinedAt)
    case 'DONATION':
      return pick(`Sent to donate ${relativeDay(f.lastHistoryAt ?? f.updatedAt, now)}`, f.lastHistoryAt)
    case 'NO_SHOW':
      if (f.status === 'PAUSED') return pick('Paused after missed calls', f.lastHistoryAt)
      return pick(f.missedCallAt ? `Missed ${callWhen(f.missedCallAt, now)}` : 'Missed the call', f.missedCallAt ?? f.lastHistoryAt)
    case 'NOT_A_FIT':
      return pick(shortDate(f.notAFitAt ?? f.updatedAt, now), f.notAFitAt)
  }
}

// ---------- rows and filters ----------

/** One row of the list, as sent to the client (dates as ISO strings). */
export interface JourneyRow {
  id: string
  name: string
  email: string
  phone: string | null
  city: string | null
  ageRange: string | null
  ageLabel: string
  inviterId: string | null
  inviterName: string | null
  role: string | null
  roleLabel: string | null
  status: string
  stage: ListStage
  stageLabel: string
  stageClass: string
  nextStep: string
  lastActivity: string
  lastActivityAt: string
  createdAt: string
}

export interface ListFilters {
  q: string
  age: string
  inviter: string
  role: string
  stage: string
}

export const EMPTY_FILTERS: ListFilters = { q: '', age: '', inviter: '', role: '', stage: '' }

/** Filters from URL search params (unknown values are ignored by filterRows). */
export function filtersFrom(sp: { get(name: string): string | null } | Record<string, string | string[] | undefined>): ListFilters {
  const get = (k: string): string => {
    if (typeof (sp as { get?: unknown }).get === 'function') return ((sp as { get(n: string): string | null }).get(k) ?? '').slice(0, 200)
    const v = (sp as Record<string, string | string[] | undefined>)[k]
    return (Array.isArray(v) ? v[0] ?? '' : v ?? '').slice(0, 200)
  }
  return { q: get('q'), age: get('age'), inviter: get('inviter'), role: get('role'), stage: get('stage') }
}

const digits = (s: string) => s.replace(/\D/g, '')

/** Search (name, email or phone) plus the four dropdown filters. "none" = no inviter / no role yet. */
export function filterRows(rows: JourneyRow[], f: ListFilters): JourneyRow[] {
  const q = f.q.trim().toLowerCase()
  const qd = digits(q)
  return rows.filter((r) => {
    if (q) {
      const hit = r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || (qd.length >= 3 && !!r.phone && digits(r.phone).includes(qd))
      if (!hit) return false
    }
    if (f.age && r.ageRange !== f.age) return false
    if (f.inviter && (f.inviter === 'none' ? r.inviterId !== null : r.inviterId !== f.inviter)) return false
    if (f.role && (f.role === 'none' ? r.role !== null : r.role !== f.role)) return false
    if (f.stage && r.stage !== f.stage) return false
    return true
  })
}

// ---------- CSV ----------

/**
 * One CSV cell. Cells that a spreadsheet would run as a formula (starting with = + - @, tab or
 * carriage return) get a leading single quote; every cell is quoted with inner quotes doubled.
 */
export function csvCell(v: string | number | null | undefined): string {
  let s = v === null || v === undefined ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

export const CSV_HEADERS = ['Name', 'Email', 'Phone', 'City', 'Age range', 'Invited by', 'Role', 'Stage', 'Next step', 'Last activity', 'Last activity at', 'Form date']

export function rowsToCsv(rows: JourneyRow[]): string {
  const lines = [CSV_HEADERS.map(csvCell).join(',')]
  for (const r of rows) {
    lines.push([
      r.name, r.email, r.phone, r.city, r.ageLabel, r.inviterName, r.roleLabel, r.stageLabel, r.nextStep,
      r.lastActivity, r.lastActivityAt.slice(0, 16).replace('T', ' ') + ' UTC', r.createdAt.slice(0, 10),
    ].map(csvCell).join(','))
  }
  // CRLF line endings and a BOM so Excel opens it as UTF-8 ("18–24" keeps its dash).
  return '﻿' + lines.join('\r\n') + '\r\n'
}

/** The export URL for the current filters. */
export function exportHref(f: ListFilters): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(f)) if (v) sp.set(k, v)
  const qs = sp.toString()
  return `/admin/prospects/export${qs ? `?${qs}` : ''}`
}
