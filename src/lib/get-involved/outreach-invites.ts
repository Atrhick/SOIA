/**
 * One-A-Day v2 "Email them for me": the PURE rules (no database), shared by the server action and the
 * Invite page, tested in outreach-invites.test.ts.
 *
 * Rules (owner approved):
 * - at most INVITES_PER_DAY people a day per member (invitations sent in the last 24 hours, plus people
 *   they added by hand with "Add someone");
 * - one invitation per email address per INVITE_REPEAT_DAYS days, whoever sends it;
 * - an address that clicked Stop (EmailSuppression) or opted out as a prospect is skipped silently;
 * - an address that is already someone's prospect is skipped. The member is only ever told "already
 *   invited", never whose person it is or whether they stopped emails.
 */
import { suggestEmail } from './email-typo'
import { renderScript, type ScriptValues } from './scripts'

export const INVITES_PER_DAY = 20
export const INVITE_REPEAT_DAYS = 30
/** People per "Send invitations" press (never more than the daily limit). */
export const MAX_PER_SEND = INVITES_PER_DAY

export interface InvitePerson {
  firstName: string
  email: string
}

const EMAIL_RE = /^[^\s@<>(),;:"[\]]+@[^\s@<>(),;:"[\]]+\.[a-z]{2,}$/i

/** Trim + lowercase. Stored and compared this way everywhere. */
export const normaliseEmail = (raw: string) => (raw ?? '').trim().replace(/^mailto:/i, '').toLowerCase()

export function isValidEmail(raw: string): boolean {
  const e = normaliseEmail(raw)
  return e.length <= 254 && EMAIL_RE.test(e)
}

/** "maria" -> "Maria", "  mary-jane " -> "Mary-jane". Keeps names the member typed with capitals. */
export function tidyFirstName(raw: string): string {
  const n = (raw ?? '').trim().replace(/\s+/g, ' ').slice(0, 60)
  if (!n) return ''
  return n === n.toLowerCase() ? n[0].toUpperCase() + n.slice(1) : n
}

/**
 * A pasted list, one person per line. Understands:
 *   Maria, maria@x.com      Maria Lopez <maria@x.com>      maria@x.com      maria@x.com, Maria
 *   Maria	maria@x.com (tab, e.g. from a spreadsheet)        Maria maria@x.com
 * Only the first word of a name is kept (it's a first name field). Lines without an email are returned
 * in `unreadable` so the page can say which ones it skipped.
 */
export function parsePastedList(text: string): { people: InvitePerson[]; unreadable: string[] } {
  const people: InvitePerson[] = []
  const unreadable: string[] = []
  for (const raw of (text ?? '').replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const m = line.match(/<?\s*([^\s<>,;]+@[^\s<>,;]+)\s*>?/)
    if (!m) { unreadable.push(line); continue }
    const email = normaliseEmail(m[1])
    const rest = (line.slice(0, m.index) + ' ' + line.slice((m.index ?? 0) + m[0].length)).replace(/[,;\t"']+/g, ' ').trim()
    const first = rest.split(/\s+/)[0] ?? ''
    people.push({ firstName: tidyFirstName(first), email })
  }
  return { people, unreadable }
}

export type InviteSkip = 'RECENT' | 'STOPPED' | 'ON_LIST' | 'LIMIT'
export type InviteProblem = 'NO_NAME' | 'BAD_EMAIL' | 'TYPO' | 'DUPLICATE'

export type InviteDecision =
  | { email: string; firstName: string; action: 'SEND' }
  | { email: string; firstName: string; action: 'SKIP'; reason: InviteSkip; mine?: boolean }
  | { email: string; firstName: string; action: 'FIX'; problem: InviteProblem; suggestion?: string }

export interface InviteContext {
  /** People this member already emailed or added in the last 24 hours. */
  usedToday: number
  limit?: number
  /** Addresses (lowercased) any member invited in the last INVITE_REPEAT_DAYS days. */
  recent: Set<string>
  /** Addresses (lowercased) that asked not to be emailed. */
  stopped: Set<string>
  /** Addresses (lowercased) that are already a prospect -> true when they are this member's own. */
  onList: Map<string, boolean>
}

/**
 * What to do with each person, in the order given. Problems the member can fix (no name, bad or
 * mistyped address, listed twice) come back as FIX and never use up the daily limit. Everyone else
 * is SEND until the limit is reached, then SKIP LIMIT.
 */
export function decideInvites(people: InvitePerson[], ctx: InviteContext): InviteDecision[] {
  const limit = ctx.limit ?? INVITES_PER_DAY
  let left = Math.max(0, limit - ctx.usedToday)
  const seen = new Set<string>()
  return people.map((p): InviteDecision => {
    const email = normaliseEmail(p.email)
    const firstName = tidyFirstName(p.firstName)
    if (!firstName) return { email, firstName, action: 'FIX', problem: 'NO_NAME' }
    if (!isValidEmail(email)) return { email, firstName, action: 'FIX', problem: 'BAD_EMAIL' }
    const typo = suggestEmail(email)
    if (typo) return { email, firstName, action: 'FIX', problem: 'TYPO', suggestion: typo }
    if (seen.has(email)) return { email, firstName, action: 'FIX', problem: 'DUPLICATE' }
    seen.add(email)
    // At the limit, every address reads "limit reached" BEFORE any other check, so a member who has
    // used up the day can't test which addresses are already known.
    if (left <= 0) return { email, firstName, action: 'SKIP', reason: 'LIMIT' }
    if (ctx.stopped.has(email)) return { email, firstName, action: 'SKIP', reason: 'STOPPED' }
    if (ctx.onList.has(email)) return { email, firstName, action: 'SKIP', reason: 'ON_LIST', mine: ctx.onList.get(email) === true }
    if (ctx.recent.has(email)) return { email, firstName, action: 'SKIP', reason: 'RECENT' }
    left--
    return { email, firstName, action: 'SEND' }
  })
}

/**
 * The line the member sees for one person. STOPPED, RECENT and someone else's ON_LIST all read the
 * same, so nobody can learn whether an address stopped emails or belongs to another member.
 */
export function decisionText(d: InviteDecision, limit = INVITES_PER_DAY): { ok: boolean; text: string } {
  const n = d.firstName || d.email
  if (d.action === 'SEND') return { ok: true, text: `Sent to ${n} ✓` }
  if (d.action === 'FIX') {
    switch (d.problem) {
      case 'NO_NAME': return { ok: false, text: `${d.email || 'This person'}: add their first name.` }
      case 'BAD_EMAIL': return { ok: false, text: `${n}: that email address isn't complete. Check it and try again.` }
      case 'TYPO': return { ok: false, text: `${n}: that email looks mistyped. Did you mean ${d.suggestion?.split('@')[1] ?? 'something else'}?` }
      case 'DUPLICATE': return { ok: false, text: `${n}: listed twice. We only email each person once.` }
    }
  }
  switch (d.reason) {
    case 'LIMIT': return { ok: false, text: `${n}: limit reached. You can send to ${limit} people a day. Try again tomorrow.` }
    case 'ON_LIST': if (d.mine) return { ok: false, text: `${n}: already on your list, so we didn't email them again.` }
    // falls through: someone else's person reads like any other "already invited"
    default: return { ok: false, text: `${n}: already invited in the last ${INVITE_REPEAT_DAYS} days, so we didn't email them again.` }
  }
}

/** Toast summary: "Sent to Maria and James ✓" / "Sent to 3 people ✓ · 1 not sent (see below)". */
export function summaryText(ds: InviteDecision[]): { ok: boolean; text: string } {
  const sent = ds.filter((d) => d.action === 'SEND')
  const notSent = ds.length - sent.length
  if (!sent.length) return { ok: false, text: notSent === 1 ? decisionText(ds[0]).text : `Nothing sent. ${notSent} people need a look (see below).` }
  const names = sent.length <= 2 ? sent.map((d) => d.firstName).join(' and ') : `${sent.length} people`
  return { ok: true, text: `Sent to ${names} ✓${notSent ? ` · ${notSent} not sent (see below)` : ''}` }
}

/**
 * The invitation's main text: the program's email with its closing question removed, because the email
 * ends with a button instead ("See if it's a fit"). Only the final sentence goes, and only if it is a
 * question; a paragraph left empty is dropped.
 */
export function withoutClosingQuestion(body: string): string {
  const paras = body.trim().split(/\n\s*\n/)
  const last = paras[paras.length - 1] ?? ''
  if (!last.trim().endsWith('?')) return body.trim()
  const lines = last.split('\n')
  const tail = lines[lines.length - 1]
  const cut = tail.replace(/(^|[.!?…]\s+)[^.!?…]*\?\s*$/, '$1').trim()
  lines[lines.length - 1] = cut
  const kept = lines.filter((l) => l.trim()).join('\n')
  paras[paras.length - 1] = kept
  return paras.filter((p) => p.trim()).join('\n\n').trim()
}

// ---------- the invitation's words (shared by the email and the page's live preview) ----------

export const INVITE_BUTTON = "See if it's a fit: book a free 15-minute call"
/** Used only when a program has no email message for the situation yet. */
export const FALLBACK_SUBJECT = '{first name}, thought of you'

export interface InviteText {
  subject: string
  /** Plain-text paragraphs, in order. */
  paragraphs: string[]
  button: string
  /** "Maria Lopez" — shown above the sign-off and in the footer. */
  from: string
}

/**
 * The invitation for one person: the program's email for the situation, filled in, with the personal
 * line where the message puts it (or after the greeting if it has no slot), the closing question
 * swapped for the button, and the "I get credit" line when the program isn't the sender's own.
 */
export function buildInviteText(input: {
  script: { subject: string | null; body: string }
  values: ScriptValues
  disclosure: string | null
  senderFullName: string
}): InviteText {
  const { script, values } = input
  const personal = values.personalLine.trim()
  let body = script.body
  if (personal && !body.includes('{personal line}')) {
    const lines = body.split('\n')
    lines.splice(1, 0, '{personal line}')
    body = lines.join('\n')
  }
  const rendered = withoutClosingQuestion(renderScript(body, { ...values, link: '' }))
  const paragraphs = rendered.split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean)
  if (input.disclosure) paragraphs.push(input.disclosure)
  const subject = renderScript(script.subject?.trim() || FALLBACK_SUBJECT, { ...values, personalLine: '' }).replace(/\s+/g, ' ').trim() || 'Thought of you'
  return { subject: subject.slice(0, 150), paragraphs, button: INVITE_BUTTON, from: input.senderFullName.trim() }
}

/** The message an invitation uses: the email for a parent or someone you know, falling back to the text version. */
export function pickInviteScript(get: (key: 'KNOW:EMAIL' | 'PARENT:EMAIL' | 'KNOW:SHORT' | 'PARENT:SHORT') => { subject: string | null; body: string } | null | undefined, parent: boolean): { subject: string | null; body: string } | null {
  const order = parent ? (['PARENT:EMAIL', 'KNOW:EMAIL', 'PARENT:SHORT', 'KNOW:SHORT'] as const) : (['KNOW:EMAIL', 'KNOW:SHORT'] as const)
  for (const k of order) {
    const s = get(k)
    if (s?.body?.trim()) return k.endsWith(':SHORT') ? { subject: null, body: s.body } : s
  }
  return null
}
