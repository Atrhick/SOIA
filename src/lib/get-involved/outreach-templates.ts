/**
 * Outreach round 2: share-kit message templates. PURE (no database), so the share kit, the admin editor
 * and the follow-ups page can all use it in the browser too. Database reads go through
 * `outreach-templates-server.ts` (`getOutreachTemplates`), which falls back to DEFAULT_TEMPLATES here
 * when no row exists (same pattern as role settings).
 *
 * Fill-ins: {first name} {personal line} {program} {one-line description} {link} {seats left} {seat line}
 * - {seat line} is the sponsored-seat sentence. It renders EMPTY when the program has no offer (or no
 *   seats left), so defaults never mention sponsored seats that don't exist.
 * - A line that only held a fill-in which rendered empty is dropped.
 *
 * Checks (templateChecks) by key:
 * - First messages TEXT/WHATSAPP/EMAIL/DM/PARENT: end with a question, no link and no {link}, must have
 *   {personal line}. Words: TEXT/WHATSAPP/DM/PARENT under 80, EMAIL under 120 (EMAIL needs a subject).
 * - POST: may include {link}; {personal line} optional; under 150 words.
 * - AFTER_YES and FORM_NO_CALL: must include {link} (that is their job); under 60 words.
 * - NUDGE and CLOSE: no link (a follow-up never pushes the link again); under 60 words.
 * - Every template: not empty, no unknown fill-ins, no promised results or earnings words.
 */

export const FIRST_KEYS = ['TEXT', 'WHATSAPP', 'EMAIL', 'DM', 'POST', 'PARENT'] as const
export const AFTER_KEYS = ['AFTER_YES', 'NUDGE', 'CLOSE', 'FORM_NO_CALL'] as const
export const TEMPLATE_KEYS = [...FIRST_KEYS, ...AFTER_KEYS] as const
export type ShareChannel = (typeof FIRST_KEYS)[number]
export type TemplateKey = (typeof TEMPLATE_KEYS)[number]
export const AUDIENCES = ['ALL', 'COACH', 'AMBASSADOR'] as const
export type TemplateAudience = (typeof AUDIENCES)[number]
export type TemplateStatus = 'LIVE' | 'DRAFT'

export const isTemplateKey = (v: unknown): v is TemplateKey => typeof v === 'string' && (TEMPLATE_KEYS as readonly string[]).includes(v)
export const isShareChannel = (v: unknown): v is ShareChannel => typeof v === 'string' && (FIRST_KEYS as readonly string[]).includes(v)

export const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  TEXT: 'Text',
  WHATSAPP: 'WhatsApp',
  EMAIL: 'Email',
  DM: 'DM',
  POST: 'Social post',
  PARENT: 'To a parent (under 18)',
  AFTER_YES: 'After a yes',
  NUDGE: 'Nudge, day 3–4',
  CLOSE: 'Close, day 10–14',
  FORM_NO_CALL: 'Form but no call',
}

export const AUDIENCE_LABELS: Record<TemplateAudience, string> = {
  ALL: 'Coaches and ambassadors',
  COACH: 'Coaches only',
  AMBASSADOR: 'Ambassadors only',
}

export interface TemplateText {
  subject: string | null
  body: string
}

export const DEFAULT_TEMPLATES: Record<TemplateKey, TemplateText> = {
  TEXT: {
    subject: null,
    body: "Hi {first name}!\n{personal line}\nI'm involved with {program}, {one-line description}. {seat line} Would you be open to hearing about it?",
  },
  WHATSAPP: {
    subject: null,
    body: "Hi {first name}!\n{personal line}\nI'm involved with {program}, {one-line description}. {seat line} Would you be open to hearing about it?",
  },
  EMAIL: {
    subject: '{first name}, thought of you',
    body: "Hi {first name},\n\n{personal line}\n\nI'm involved with {program}, {one-line description}. {seat line} The first step is a free 30-minute call.\n\nIf you're curious, just reply and I'll send the details. Would you be open to hearing about it?",
  },
  DM: {
    subject: null,
    body: "Hey {first name}!\n{personal line}\nQuick one: I'm involved with {program}, {one-line description}. {seat line} Open to hearing about it?",
  },
  POST: {
    subject: null,
    body: "Something I care about:\n{personal line}\n\nI'm involved with {program}, {one-line description}. {seat line}\n\nWant to hear more? Comment or message me, or book a free call here: {link}",
  },
  PARENT: {
    subject: null,
    body: "Hi {first name}!\n{personal line}\nI'm involved with {program}, {one-line description}. For anyone under 18, a parent joins the first call. {seat line} Happy to tell you more. Would your teen be interested?",
  },
  AFTER_YES: {
    subject: null,
    body: 'Great! Here is the 1-minute form. It books a free 30-minute call at a time that suits you: {link}',
  },
  NUDGE: {
    subject: null,
    body: 'Hi {first name}, just bringing this back up in case it got buried. Would you be open to hearing about {program}?',
  },
  CLOSE: {
    subject: null,
    body: "No worries if now isn't the time, {first name}. I won't keep asking. If it's ever useful, just message me.",
  },
  FORM_NO_CALL: {
    subject: null,
    body: "Hi {first name}, glad you signed up! Did you get a chance to pick a call time? Here's the link again: {link}",
  },
}

export const FILL_INS = ['{first name}', '{personal line}', '{program}', '{one-line description}', '{link}', '{seats left}', '{seat line}'] as const

export interface FillValues {
  firstName: string
  personalLine: string
  program: string
  description: string
  link: string
  /** Sponsored seats left this month; null = the program has no offer. */
  seatsLeft: number | null
}

/** Fill-ins used when the sharer picks "Any program (main link)". */
export const MAIN_LINK_PROGRAM = { program: 'NowTransformed', description: 'a nonprofit that helps people grow through small groups and coaching' }

/** The sponsored-seat sentence. Empty when there's no offer or no seats left. */
export function seatLine(key: TemplateKey, seatsLeft: number | null): string {
  if (seatsLeft == null || seatsLeft <= 0) return ''
  if (key === 'POST') return `Thanks to NowTransformed, a nonprofit, there ${seatsLeft === 1 ? 'is 1 sponsored seat' : `are ${seatsLeft} sponsored seats`} this month.`
  // Messages to one person say "a few", so they stay true however many are left.
  return 'NowTransformed, a nonprofit, is sponsoring a few seats this month.'
}

function fillValue(token: string, key: TemplateKey, v: FillValues): string {
  switch (token) {
    case '{first name}': return v.firstName.trim()
    case '{personal line}': return v.personalLine.trim()
    case '{program}': return v.program.trim()
    case '{one-line description}': return v.description.trim()
    case '{link}': return v.link.trim()
    case '{seats left}': return v.seatsLeft == null ? '' : String(Math.max(0, v.seatsLeft))
    case '{seat line}': return seatLine(key, v.seatsLeft)
    default: return token
  }
}

const TOKEN_RE = /\{[^{}\n]{1,40}\}/g

/** Fills every fill-in, drops lines that only held an empty fill-in and tidies the spacing. */
export function renderTemplate(text: string, key: TemplateKey, values: FillValues): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  for (const line of lines) {
    const onlyTokens = line.trim() !== '' && line.replace(TOKEN_RE, '').trim() === ''
    const filled = line.replace(TOKEN_RE, (t) => fillValue(t, key, values))
    if (onlyTokens && filled.trim() === '') continue
    out.push(filled.replace(/[ \t]{2,}/g, ' ').replace(/ +([.,?!:;])/g, '$1').trim())
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

// ---------- the share kit's personal-line slot ----------

/** Stand-in for {personal line} while rendering, so the share kit can show its own input there. */
export const PERSONAL_MARKER = '⁣PERSONAL⁣'

export interface MessageParts {
  /** Text before the personal line (e.g. "Hi Sarah!"). */
  before: string
  /** Text after it. */
  after: string
  /** Whitespace that separated the slot from the text around it ('\n' or '\n\n'). */
  sepBefore: string
  sepAfter: string
  hasSlot: boolean
}

/** Splits a message rendered with personalLine = PERSONAL_MARKER around the slot. */
export function splitAtPersonalLine(rendered: string): MessageParts {
  const i = rendered.indexOf(PERSONAL_MARKER)
  if (i < 0) return { before: '', after: rendered.trim(), sepBefore: '', sepAfter: '\n', hasSlot: false }
  const rawBefore = rendered.slice(0, i)
  const rawAfter = rendered.slice(i + PERSONAL_MARKER.length)
  const sep = (s: string) => (/\n\s*\n/.test(s) ? '\n\n' : s.includes('\n') ? '\n' : ' ')
  const before = rawBefore.trim()
  const after = rawAfter.trim()
  return {
    before,
    after,
    sepBefore: before ? sep(rawBefore.slice(rawBefore.trimEnd().length)) : '',
    sepAfter: after ? sep(rawAfter.slice(0, rawAfter.length - rawAfter.trimStart().length)) : '',
    hasSlot: true,
  }
}

/** The finished message: the parts, the personal line (skipped when empty) and the disclosure, if any. */
export function joinMessage(parts: Pick<MessageParts, 'before' | 'after' | 'sepBefore' | 'sepAfter'>, personalLine: string, disclosure: string | null): string {
  const pl = personalLine.trim()
  let msg = ''
  if (parts.before.trim()) msg += parts.before.trim()
  if (pl) msg += (msg ? parts.sepBefore || '\n' : '') + pl
  if (parts.after.trim()) msg += (msg ? (pl ? parts.sepAfter || '\n' : parts.sepBefore || parts.sepAfter || '\n') : '') + parts.after.trim()
  if (disclosure) msg += (msg ? '\n\n' : '') + disclosure
  return msg.trim()
}

// ---------- disclosure ----------

/**
 * Added by the app when the sharer gets credit for a program that isn't theirs (an ambassador sharing a
 * coach's program, a coach sharing another coach's program, or anyone sharing the main link, which is
 * not a program of their own). Sharing your own program adds nothing: it's clear you benefit.
 */
export function disclosureLine(sharerRole: string, ownsProgram: boolean): string | null {
  if (ownsProgram) return null
  return sharerRole === 'COACH' ? "I'm a NowTransformed coach and get credit if you join." : "I'm a NowTransformed ambassador and get credit if you join."
}

/** Who must add a personal line before copying / marking sent. */
export function needsPersonalLine(key: TemplateKey): boolean {
  return key === 'TEXT' || key === 'WHATSAPP' || key === 'EMAIL' || key === 'DM' || key === 'PARENT'
}

// ---------- links ----------

/** `?via=` value for a channel (lower case). */
export const viaParam = (channel: ShareChannel) => channel.toLowerCase()

export function shareLinkFor(baseUrl: string, channel: ShareChannel): string {
  const u = baseUrl.replace(/[?#].*$/, '')
  return `${u}?via=${viaParam(channel)}`
}

// ---------- checks ----------

export interface TemplateCheck {
  id: string
  label: string
  ok: boolean
}

const QUESTION_KEYS: TemplateKey[] = ['TEXT', 'WHATSAPP', 'EMAIL', 'DM', 'PARENT']
const NO_LINK_KEYS: TemplateKey[] = ['TEXT', 'WHATSAPP', 'EMAIL', 'DM', 'PARENT', 'NUDGE', 'CLOSE']
const LINK_REQUIRED_KEYS: TemplateKey[] = ['AFTER_YES', 'FORM_NO_CALL']

export function wordLimit(key: TemplateKey): number {
  if (key === 'EMAIL') return 120
  if (key === 'POST') return 150
  if (key === 'TEXT' || key === 'WHATSAPP' || key === 'DM' || key === 'PARENT') return 80
  return 60
}

/** Rough words a fill-in adds once filled. */
const TOKEN_WORDS: Record<string, number> = { '{one-line description}': 12, '{personal line}': 10, '{seat line}': 10 }

export function templateWordCount(text: string): number {
  let extra = 0
  const stripped = text.replace(TOKEN_RE, (t) => { extra += TOKEN_WORDS[t] ?? 1; return ' ' })
  return stripped.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length + extra
}

const URL_RE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|org|net|io|co|app|link|ly)\b)/i
export const hasLink = (text: string) => text.includes('{link}') || URL_RE.test(text)

const PROMISE_RE = /\b(cure[sd]?|curing|guarantee[sd]?|guaranteed|get rich|earn \$|make \$|passive income|financial freedom|miracle|risk[- ]free|100% results|lose \d+ ?(pounds|lbs|kg))\b|earn \$|make \$/i
export const promisesResults = (text: string) => PROMISE_RE.test(text)

export const unknownFillIns = (text: string) => (text.match(TOKEN_RE) ?? []).filter((t) => !(FILL_INS as readonly string[]).includes(t))

export function templateChecks(key: TemplateKey, t: { subject?: string | null; body: string }): TemplateCheck[] {
  const body = t.body ?? ''
  const all = `${t.subject ?? ''}\n${body}`
  const checks: TemplateCheck[] = [{ id: 'not-empty', label: 'Has a message', ok: body.trim().length > 0 && body.length <= 2000 }]
  if (key === 'EMAIL') checks.push({ id: 'subject', label: 'Has a subject line', ok: !!t.subject?.trim() && (t.subject?.length ?? 0) <= 150 })
  if (QUESTION_KEYS.includes(key)) checks.push({ id: 'question', label: 'Ends with a question', ok: body.trim().endsWith('?') })
  if (NO_LINK_KEYS.includes(key)) checks.push({ id: 'no-link', label: key === 'NUDGE' || key === 'CLOSE' ? 'No link (follow-ups never push the link)' : 'No link in the first message', ok: !hasLink(all) })
  if (LINK_REQUIRED_KEYS.includes(key)) checks.push({ id: 'link', label: 'Includes {link}', ok: body.includes('{link}') })
  if (needsPersonalLine(key)) checks.push({ id: 'personal', label: 'Has a {personal line} for the sender', ok: body.includes('{personal line}') })
  const limit = wordLimit(key)
  checks.push({ id: 'words', label: `Under ${limit} words${limit === 80 ? ': short enough for a text' : ''}`, ok: templateWordCount(body) < limit })
  checks.push({ id: 'promises', label: 'No promised results ("cure", "guaranteed") or earnings claims', ok: !promisesResults(all) })
  const unknown = unknownFillIns(all)
  checks.push({ id: 'fill-ins', label: unknown.length ? `Unknown fill-in: ${unknown.join(', ')}` : 'Only known fill-ins', ok: unknown.length === 0 })
  return checks
}

export const checksPass = (checks: TemplateCheck[]) => checks.every((c) => c.ok)

// ---------- choosing a template ----------

export interface TemplateRow {
  key: string
  audience: string
  subject: string | null
  body: string
  status: string
}

export interface ResolvedTemplate extends TemplateText {
  key: TemplateKey
  /** Where the text came from: a saved LIVE row for this role, one for everyone, or the code default. */
  source: 'ROLE' | 'ALL' | 'DEFAULT'
}

/** The text a COACH or AMBASSADOR sees for a key: a LIVE row for their role, else a LIVE row for ALL, else the default. Drafts are never used. */
export function resolveTemplate(rows: TemplateRow[], key: TemplateKey, role: string): ResolvedTemplate {
  const live = rows.filter((r) => r.key === key && r.status === 'LIVE')
  const mine = live.find((r) => r.audience === role)
  if (mine) return { key, subject: mine.subject, body: mine.body, source: 'ROLE' }
  const all = live.find((r) => r.audience === 'ALL')
  if (all) return { key, subject: all.subject, body: all.body, source: 'ALL' }
  return { key, ...DEFAULT_TEMPLATES[key], source: 'DEFAULT' }
}

export function resolveAll(rows: TemplateRow[], role: string): Record<TemplateKey, ResolvedTemplate> {
  return Object.fromEntries(TEMPLATE_KEYS.map((k) => [k, resolveTemplate(rows, k, role)])) as Record<TemplateKey, ResolvedTemplate>
}

/** "Simpler ways to handle stress." -> "simpler ways to handle stress" (keeps acronyms like "NT"). */
export function descriptionFromHeadline(headline: string | null | undefined): string | null {
  const h = (headline ?? '').trim().replace(/[.!?]+$/, '')
  if (!h || h.length > 160) return null
  return /^[A-Z][a-z]/.test(h) ? h[0].toLowerCase() + h.slice(1) : h
}
