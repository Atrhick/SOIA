/**
 * Pure helpers for the admin One-A-Day leaderboard: which period and board are shown (from the URL),
 * the month list, "today" in business time, the youth-ambassador rule and the CSV. No database access,
 * so the page, the export route and the tests share it (see leaderboard-period.test.ts).
 */
import { TZDate } from '@date-fns/tz'
import { BUSINESS_TZ } from './core'
import { csvCell } from '../../app/(dashboard)/admin/prospects/journey-list'

// ---------- boards ----------

/** The admin boards. YOUTH = youth ambassadors; AMBASSADOR = every other ambassador, so the tabs don't overlap. */
export type AdminBoard = 'ALL' | 'COACH' | 'AMBASSADOR' | 'YOUTH'

export const ADMIN_BOARDS: { value: AdminBoard; label: string }[] = [
  { value: 'ALL', label: 'Overall' },
  { value: 'COACH', label: 'Coaches' },
  { value: 'AMBASSADOR', label: 'Ambassadors' },
  { value: 'YOUTH', label: 'Youth ambassadors' },
]

export function parseBoard(v: string | null | undefined): AdminBoard {
  return ADMIN_BOARDS.find((b) => b.value === v)?.value ?? 'ALL'
}

/** The row label for the Role column. */
export type BoardMemberKind = 'COACH' | 'AMBASSADOR' | 'YOUTH'
export function memberKindLabel(k: BoardMemberKind): string {
  return k === 'COACH' ? 'Coach' : k === 'YOUTH' ? 'Youth ambassador' : 'Ambassador'
}

/**
 * A youth ambassador is an AMBASSADOR login that joined through the Youth ambassador role, or one whose
 * ambassador profile says they are 17 or under today.
 */
export function isYouthAmbassador(m: { role: string; journeyRole: string | null; dateOfBirth: Date | null }, now: Date): boolean {
  if (m.role !== 'AMBASSADOR') return false
  if (m.journeyRole === 'YOUTH_AMBASSADOR') return true
  if (!m.dateOfBirth) return false
  return ageOn(m.dateOfBirth, now) < 18
}

/** Whole years between a date of birth and a day (UTC calendar, which is how dates of birth are stored). */
export function ageOn(dob: Date, now: Date): number {
  let age = now.getUTCFullYear() - dob.getUTCFullYear()
  const m = now.getUTCMonth() - dob.getUTCMonth()
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) age--
  return age
}

export function memberKind(m: { role: string; journeyRole: string | null; dateOfBirth: Date | null }, now: Date): BoardMemberKind {
  if (m.role === 'COACH') return 'COACH'
  return isYouthAmbassador(m, now) ? 'YOUTH' : 'AMBASSADOR'
}

export function onBoard(board: AdminBoard, kind: BoardMemberKind): boolean {
  return board === 'ALL' || board === kind
}

// ---------- periods ----------

export interface Period {
  /** 'all' or 'YYYY-MM' (business time zone). */
  key: string
  /** Inclusive start, null = all time. */
  from: Date | null
  /** Exclusive end, null = up to now. */
  to: Date | null
  label: string
  /** The current month (or all time): streaks run to today. A past month: streaks as of its last day. */
  current: boolean
}

const MONTH_KEY = /^(\d{4})-(0[1-9]|1[0-2])$/

function businessYearMonth(d: Date): { y: number; m: number } {
  const z = new TZDate(d.getTime(), BUSINESS_TZ)
  return { y: z.getFullYear(), m: z.getMonth() }
}

/** Midnight on the 1st of a month in business time (m is 0-based and may overflow). */
export function businessMonthStart(y: number, m: number): Date {
  return new Date(new TZDate(y, m, 1, 0, 0, 0, BUSINESS_TZ).getTime())
}

export function monthKey(y: number, m: number): string {
  const d = new Date(Date.UTC(y, m, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export function monthLabel(y: number, m: number): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m, 1)))
}

/**
 * The period from the `period` URL param: 'all', 'YYYY-MM', or anything else (including the old
 * 'month') = the current month. A month in the future falls back to the current month.
 */
export function parsePeriod(param: string | null | undefined, now: Date): Period {
  const cur = businessYearMonth(now)
  if (param === 'all') return { key: 'all', from: null, to: null, label: 'All time', current: true }
  const mm = MONTH_KEY.exec(param ?? '')
  let y = cur.y, m = cur.m
  if (mm) {
    const py = Number(mm[1]), pm = Number(mm[2]) - 1
    if (py * 12 + pm <= cur.y * 12 + cur.m) { y = py; m = pm }
  }
  const current = y === cur.y && m === cur.m
  return { key: monthKey(y, m), from: businessMonthStart(y, m), to: current ? null : businessMonthStart(y, m + 1), label: monthLabel(y, m), current }
}

/** The "now" streaks are measured at: now, or the last moment of a past month. */
export function streakAsOf(p: Period, now: Date): Date {
  return p.to && p.to.getTime() <= now.getTime() ? new Date(p.to.getTime() - 1) : now
}

/**
 * Months to offer, newest first, from the earliest activity's month (at most `max`), then All time.
 * `selected` (the period on screen) is always offered, in its place, even if older than the list.
 */
export function periodOptions(earliest: Date | null, now: Date, max = 24, selected?: Period): { value: string; label: string }[] {
  const out = monthOptions(earliest, now, max)
  if (selected && !out.some((o) => o.value === selected.key)) {
    out.push({ value: selected.key, label: selected.label })
    out.sort((a, b) => (a.value === 'all' ? 1 : b.value === 'all' ? -1 : b.value.localeCompare(a.value)))
  }
  return out
}

function monthOptions(earliest: Date | null, now: Date, max: number): { value: string; label: string }[] {
  const cur = businessYearMonth(now)
  const first = earliest ? businessYearMonth(earliest) : cur
  const out: { value: string; label: string }[] = []
  for (let i = 0; i < max; i++) {
    const idx = cur.y * 12 + cur.m - i
    if (idx < first.y * 12 + first.m) break
    const y = Math.floor(idx / 12), m = idx % 12
    out.push({ value: monthKey(y, m), label: monthLabel(y, m) })
  }
  out.push({ value: 'all', label: 'All time' })
  return out
}

/** Start of today in business time. */
export function businessDayStart(now: Date): Date {
  const z = new TZDate(now.getTime(), BUSINESS_TZ)
  return new Date(new TZDate(z.getFullYear(), z.getMonth(), z.getDate(), 0, 0, 0, BUSINESS_TZ).getTime())
}

/** The page and export URL for a board and period. */
export function boardHref(base: '/admin/one-a-day' | '/admin/one-a-day/export', board: AdminBoard, period: string): string {
  return `${base}?role=${board}&period=${encodeURIComponent(period)}`
}

// ---------- CSV ----------

export interface AdminBoardRow {
  userId: string
  rank: number
  name: string
  kind: BoardMemberKind
  joined: number
  forms: number
  callsKept: number
  streak: number
  teamSize: number
  /** Outreach round 2 (share kit): FIRST shares in the period. Optional; the CSV adds the columns when set. */
  messagesSent?: number
  /** Shares in the period with outcome YES or kind AFTER_YES. */
  saidYes?: number
}

export const BOARD_CSV_HEADERS = ['Rank', 'Name', 'Role', 'Joined', 'Forms', 'Calls kept', 'Streak (days)', 'Team size']
export const BOARD_CSV_SHARE_HEADERS = ['Messages sent', 'Said yes']

/** CSV with every cell quoted and formula-looking cells defused (csvCell), CRLF and a BOM for Excel. */
export function boardToCsv(rows: AdminBoardRow[], periodLabel: string, boardLabel: string): string {
  const shares = rows.some((r) => r.messagesSent !== undefined || r.saidYes !== undefined)
  const lines = [
    [`One-A-Day leaderboard`, boardLabel, periodLabel].map(csvCell).join(','),
    [...BOARD_CSV_HEADERS, ...(shares ? BOARD_CSV_SHARE_HEADERS : [])].map(csvCell).join(','),
  ]
  for (const r of rows) {
    const cells: (string | number)[] = [r.rank, r.name, memberKindLabel(r.kind), r.joined, r.forms, r.callsKept, r.streak, r.teamSize]
    if (shares) cells.push(r.messagesSent ?? 0, r.saidYes ?? 0)
    lines.push(cells.map(csvCell).join(','))
  }
  return '﻿' + lines.join('\r\n') + '\r\n'
}
