/**
 * Team screen (admin /admin/program-pages): small formatting helpers. Client-safe (no prisma).
 */
import { costText, questionById, type CostAnswer } from '@/lib/program-info/questions'
import type { TeamBucket } from '@/lib/program-info/stage'

/** Times read in US Central, the team's clock; fixed so server and browser render the same text. */
const DATE_TIME = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' })
const DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago' })

/** "Nov 18, 2:05 p.m." */
export function when(iso: string | null | undefined): string {
  if (!iso) return ''
  return DATE_TIME.format(new Date(iso)).replace(/\s?AM$/, ' a.m.').replace(/\s?PM$/, ' p.m.')
}

/** Ends the text with a period unless it already has one ("3:37 p.m." stays as is, never "p.m.."). */
export function endSentence(text: string): string {
  return text.endsWith('.') ? text : `${text}.`
}

export function day(iso: string | null | undefined): string {
  return iso ? DATE.format(new Date(iso)) : ''
}

export function waitingText(days: number): string {
  if (days <= 0) return 'waiting since today'
  return `waiting ${days} day${days === 1 ? '' : 's'}`
}

/** Any stored answer as plain text (cost object, checkbox, text). */
export function answerToText(key: string, value: unknown): string {
  if (value === null || value === undefined) return ''
  const def = questionById(key)
  if (def?.kind === 'cost' && typeof value === 'object') return costText(value as CostAnswer)
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value)
  return ''
}

export const BUCKET_PILL: Record<TeamBucket, string> = {
  OUR_MOVE: 'bg-amber-100 text-amber-900',
  STALLED: 'bg-red-100 text-red-900',
  WAITING_ON_COACH: 'bg-blue-100 text-blue-900',
  OFFLINE: 'bg-gray-200 text-gray-800',
  LIVE: 'bg-green-100 text-green-900',
}

/** "Version 3" status words. */
export const VERSION_STATUS: Record<string, string> = {
  DRAFT: 'Draft, not sent',
  SENT: 'Sent to check',
  APPROVED: 'Approved',
  CHANGES_ASKED: 'Changes asked for',
  SUPERSEDED: 'Replaced by a later version',
}

type Ev = { kind: string; actorName: string | null; detail: unknown }

const quote = (s: unknown, max = 160) => {
  if (typeof s !== 'string' || !s.trim()) return ''
  const t = s.trim().replace(/\s+/g, ' ')
  return `“${t.length > max ? `${t.slice(0, max - 1)}…` : t}”`
}

/** One line of the page's history. */
export function eventSentence(e: Ev, ownerFirst: string): string {
  const d = (e.detail && typeof e.detail === 'object' ? e.detail : {}) as Record<string, unknown>
  const who = e.actorName || 'The system'
  const n = typeof d.number === 'number' ? ` ${d.number}` : ''
  switch (e.kind) {
    case 'ANSWERS_SENT': {
      const note = typeof d.note === 'string' && d.note.trim() ? `, with a note: ${quote(d.note)}` : ''
      const shared = d.sharedFrom ? ' (their About you answers changed on another page)' : ''
      return `${who} sent the answers${shared}${note}`
    }
    case 'QUESTION_ASKED':
      return `${who} asked: ${quote(d.question)}`
    case 'QUESTION_ANSWERED':
      return `${who} answered a question`
    case 'DRAFT_SAVED':
      return `${who} saved draft version${n}`
    case 'SENT_TO_CHECK':
      return `${who} sent version${n} to ${ownerFirst} to check`
    case 'CHANGES_ASKED':
      return `${who} asked for changes${d.onLive ? ' to the live page' : ` to version${n}`}: ${quote(d.text)}`
    case 'APPROVED':
      return `${who} approved version${n}. The page went live`
    case 'PUBLISHED_ON_BEHALF':
      return `${who} put version${n} live for the owner${d.reason ? `. Reason: ${quote(d.reason)}` : ''}`
    case 'TAKEN_OFFLINE':
      return `${who} took the page offline${d.by === 'team' ? ' (team)' : ''}${d.reason ? `. Reason: ${quote(d.reason)}` : ''}`
    case 'BACK_ONLINE':
      return `${who} put the page back online${d.reason ? `. Reason: ${quote(d.reason)}` : ''}`
    case 'GROUP_ADDED':
      return `${who} added a group page: ${typeof d.label === 'string' ? d.label : ''}`
    case 'NAMES_CHANGED':
      return `${who} changed the names or groups${Array.isArray(d.summary) && d.summary.length ? ` (${d.summary.join('; ')})` : ''}`
    case 'REMINDER_SENT':
      return `Reminder sent to ${ownerFirst}`
    case 'STALLED':
      return 'Marked as stalled'
    case 'MIGRATED':
      return `Brought over from the old page as approved version${n}`
    case 'EDITED_FOR_OWNER': {
      const keys = Array.isArray(d.keys) ? (d.keys as unknown[]).filter((k): k is string => typeof k === 'string') : []
      const undo = keys.includes('undo')
      const count = keys.filter((k) => k !== 'undo').length
      const parts = [count ? `changed ${count} answer${count === 1 ? '' : 's'}` : '', undo ? 'undid the changes' : ''].filter(Boolean).join(' and ')
      return `${who} ${parts || 'changed answers'} while viewing as ${ownerFirst}`
    }
    case 'SUGGESTIONS_ADDED':
      return `The team filled ${typeof d.count === 'number' ? d.count : 'some'} empty answers from the live page, for the owner to check`
    default:
      return `${who}: ${e.kind.toLowerCase().replace(/_/g, ' ')}`
  }
}

/** URL value of each chip (?show=...). */
export const BUCKET_PARAM: Record<TeamBucket, string> = {
  OUR_MOVE: 'our-move',
  WAITING_ON_COACH: 'waiting',
  STALLED: 'stalled',
  LIVE: 'live',
  OFFLINE: 'offline',
}

/** Chip order in the mockup. */
export const CHIPS: TeamBucket[] = ['OUR_MOVE', 'WAITING_ON_COACH', 'STALLED', 'LIVE', 'OFFLINE']

export function bucketFromParam(v: string | string[] | undefined): TeamBucket | null {
  const s = Array.isArray(v) ? v[0] : v
  return CHIPS.find((b) => BUCKET_PARAM[b] === s) ?? null
}

/** First chip that has pages (Our move when everything is empty). */
export function defaultBucket(counts: Record<TeamBucket, number>): TeamBucket {
  return CHIPS.find((b) => (counts[b] ?? 0) > 0) ?? 'OUR_MOVE'
}
