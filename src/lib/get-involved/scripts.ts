/**
 * One-A-Day v2: messages by situation ("scenario"), per program. PURE (no database, no Node APIs), so
 * pages, the owner's editor and tests can all use it in the browser.
 *
 * Where a message comes from (first match wins), see resolveScript():
 *   1. the program owner's own version (ProgramScript.owner*)
 *   2. the program's default, written by NowTransformed (ProgramScript.default*)
 *   3. the general message for that situation (GENERAL_SCRIPTS in scripts-defaults.ts)
 *
 * Fill-ins (all optional except where a check says otherwise):
 *   {intro}         the right opening for who is sending (see introLine): "I run DreamIt LiveIt, and one
 *                   of our programs is Vision Development, a 4-week ..." for owners; "I'm part of NowTransformed,
 *                   a youth leadership development program ..." for the main link. General messages should use {intro}, not "I run {business}".
 *   {first name}    the person being invited
 *   {personal line} the sender's own line ("You mentioned ...")
 *   {my name}       the sender's first name
 *   {business}      the owner's business ("DreamIt LiveIt"); falls back to the program name
 *   {program}       the program name ("Vision Development")
 *   {program line}  one line on what it does ("a 4-week online program that helps ...")
 *   {link}          the sign-up link (tracked per channel)
 *   {sponsor line}  "Families who are a good fit may qualify for a NowTransformed sponsored seat."
 *                   Renders EMPTY when the program has no sponsored seats, so no message promises one.
 *
 * Wording rules: "sponsorship" / "sponsored seat", never "grant". Never promise a seat: the admin team
 * qualifies on the free call and offers it.
 */

// ---------- situations ----------

export type ScriptGroup = 'FIRST' | 'REPLY' | 'FOLLOW'
export type ScriptVariant = 'SHORT' | 'EMAIL' | 'POST'

export interface Scenario {
  key: string
  group: ScriptGroup
  /** Plain words, shown on buttons. */
  label: string
  /** One line under the label: when to use it. */
  hint: string
  variants: ScriptVariant[]
  /** Only the program's owner sees it (organizations: caseworkers, agencies, groups). */
  ownerOnly?: boolean
  /** Never shown to members under 18 (no cold contact by minors). */
  adultsOnly?: boolean
}

export const SCENARIOS = [
  { key: 'KNOW', group: 'FIRST', label: 'Someone I know', hint: "A friend, family member or someone you've talked with before.", variants: ['SHORT', 'EMAIL'] },
  { key: 'INTRO', group: 'FIRST', label: 'Someone I was introduced to', hint: 'A friend or contact suggested you get in touch.', variants: ['SHORT', 'EMAIL'] },
  { key: 'GROUP', group: 'FIRST', label: "Someone from a group I'm in", hint: 'Church, school, a parents’ group or an online community.', variants: ['SHORT', 'EMAIL'] },
  { key: 'NEW', group: 'FIRST', label: "Someone I haven't met", hint: "You haven't spoken before. Ask before you send anything.", variants: ['SHORT', 'EMAIL'], adultsOnly: true },
  { key: 'PARENT', group: 'FIRST', label: 'A parent of a teen', hint: 'For anyone under 18 we always talk to the parent first.', variants: ['SHORT', 'EMAIL'] },
  { key: 'ORG', group: 'FIRST', label: 'An organization', hint: 'A caseworker, agency, school or group that knows many people who could benefit.', variants: ['SHORT', 'EMAIL'], ownerOnly: true },
  { key: 'POST', group: 'FIRST', label: 'A public post', hint: 'For your social media. Never name or tag anyone under 18.', variants: ['POST'] },
  { key: 'YES', group: 'REPLY', label: 'They said yes', hint: 'Send the link to book the free call.', variants: ['SHORT'] },
  { key: 'ASK_PRICE', group: 'REPLY', label: 'They asked how much it costs', hint: 'Keep it about the free call; the team talks about sponsorship there.', variants: ['SHORT'] },
  { key: 'ASK_TIME', group: 'REPLY', label: "They're worried about time", hint: 'Make the next step feel small.', variants: ['SHORT'] },
  { key: 'ASK_TEEN', group: 'REPLY', label: "They think their teen won't want to", hint: 'Invite them to the free call together.', variants: ['SHORT'] },
  { key: 'ASK_LEGIT', group: 'REPLY', label: 'They asked if this is legit', hint: 'Who we are, who runs the call, where to look.', variants: ['SHORT'] },
  { key: 'ASK_INFO', group: 'REPLY', label: 'They said "send me info"', hint: 'One link, then a check-in in 3 days.', variants: ['SHORT'] },
  { key: 'FOLLOW_UP', group: 'FOLLOW', label: 'No reply after 3–4 days', hint: 'A friendly check-in with something new. No link.', variants: ['SHORT'] },
  { key: 'LAST', group: 'FOLLOW', label: 'Last check-in (day 10–14)', hint: 'Let them go kindly. The door stays open.', variants: ['SHORT'] },
  { key: 'NO_CALL', group: 'FOLLOW', label: "Signed up but didn't book a call", hint: 'Help them get their booking link again.', variants: ['SHORT'] },
  { key: 'THANKS', group: 'FOLLOW', label: 'They joined: say thanks', hint: 'Thank them and ask who else might benefit.', variants: ['SHORT'] },
] as const satisfies readonly Scenario[]

export type ScenarioKey = (typeof SCENARIOS)[number]['key']
export const SCENARIO_KEYS = SCENARIOS.map((s) => s.key) as ScenarioKey[]
export const isScenarioKey = (v: unknown): v is ScenarioKey => typeof v === 'string' && (SCENARIO_KEYS as string[]).includes(v)
export const isScriptVariant = (v: unknown): v is ScriptVariant => v === 'SHORT' || v === 'EMAIL' || v === 'POST'
export const scenarioOf = (key: ScenarioKey): Scenario => SCENARIOS.find((s) => s.key === key) as Scenario

export const GROUP_LABELS: Record<ScriptGroup, string> = {
  FIRST: 'First message',
  REPLY: 'When they reply',
  FOLLOW: 'Following up',
}

export const VARIANT_LABELS: Record<ScriptVariant, string> = {
  SHORT: 'Text, WhatsApp or DM',
  EMAIL: 'Email',
  POST: 'Social post',
}

/** The situations a member may see. Owners see organization messages; under-18s never see cold ones. */
export function visibleScenarios(viewer: { owns: boolean; minor: boolean }): Scenario[] {
  return (SCENARIOS as readonly Scenario[]).filter((s) => (!s.ownerOnly || viewer.owns) && (!s.adultsOnly || !viewer.minor))
}

// ---------- the thinking ("How to pitch") ----------

export interface PlaybookSection {
  title: string
  points: string[]
}
/** One idea for the {personal line} box: when to use it, and a sentence to start from ([brackets] = fill in). */
export interface LineIdea {
  when: string
  line: string
}
/** Ideas per first-contact scenario (KNOW, PARENT, POST, ...). */
export type LineIdeas = Partial<Record<string, LineIdea[]>>

export interface PlaybookGuide {
  /** One or two sentences: who this program is for and what the pitch is. */
  summary: string
  sections: PlaybookSection[]
  /** Ideas for the "why you thought of them" line, written for this program. */
  lineIdeas?: LineIdeas
}

export function isLineIdeas(v: unknown): v is LineIdeas {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false
  return Object.values(v as Record<string, unknown>).every((list) => Array.isArray(list) && list.every((i) => i && typeof i === 'object' && typeof (i as LineIdea).when === 'string' && typeof (i as LineIdea).line === 'string'))
}

/** True while a line still has a [fill this in] part the sender hasn't replaced. */
export const hasBlank = (s: string) => /\[[^\]\n]{1,80}\]/.test(s)

export function isPlaybookGuide(v: unknown): v is PlaybookGuide {
  if (!v || typeof v !== 'object') return false
  const g = v as PlaybookGuide
  return typeof g.summary === 'string' && Array.isArray(g.sections) && g.sections.every((s) => s && typeof s.title === 'string' && Array.isArray(s.points) && s.points.every((p) => typeof p === 'string')) && (g.lineIdeas === undefined || isLineIdeas(g.lineIdeas))
}

// ---------- fill-ins and rendering ----------

export const SCRIPT_FILL_INS = ['{intro}', '{first name}', '{personal line}', '{my name}', '{business}', '{program}', '{program line}', '{link}', '{sponsor line}', '{regular price}'] as const

export interface ScriptValues {
  firstName: string
  personalLine: string
  myName: string
  business: string
  program: string
  programLine: string
  link: string
  /** The program offers sponsored seats this month (seats > 0). */
  sponsorship: boolean
  /** The program's regular price as the owner set it (empty = a [blank] the sender must fill). */
  regularPrice?: string
  /** The sender owns the program. Default true. */
  owns?: boolean
  /** Sharing the main NowTransformed link, not a program. */
  mainLink?: boolean
  /** The program owner's first name, for {intro} when someone else shares it. */
  ownerFirstName?: string
}

export const MAIN_LINK_INTRO = "I'm part of NowTransformed, a youth leadership development program"

/** The opening sentence (no final full stop) for {intro}. */
export function introLine(v: Pick<ScriptValues, 'business' | 'program' | 'programLine' | 'owns' | 'mainLink' | 'ownerFirstName'>): string {
  if (v.mainLink) return MAIN_LINK_INTRO
  const program = v.program.trim()
  const business = (v.business || '').trim()
  const line = v.programLine.trim()
  const what = line ? `${program}, ${line}` : program
  const sameName = !business || business.toLowerCase() === program.toLowerCase()
  if (v.owns === false) {
    const who = v.ownerFirstName?.trim()
    if (who) return sameName ? `My friend ${who} runs ${what}` : `My friend ${who} runs ${business}, and one of their programs is ${what}`
    return `I'm part of NowTransformed, and one of our programs is ${what}`
  }
  return sameName ? `I run ${what}` : `I run ${business}, and one of our programs is ${what}`
}

/**
 * Every message type has a spot for one line of the member's own ({personal line}). The box is labelled
 * for the situation, and while it's empty the message shows "[label]" where the line will go, so it's
 * clear the line belongs in the message and where. The first four types need the line (the [bracket]
 * blocks sending); on the rest it's optional and an empty spot is taken out (withoutLineSlot).
 */
const WHY = 'Why you thought of them'
const TOLD = 'Something from what they told you'
const NOTE = 'A personal note'
const LINE_LABELS: Record<string, string> = {
  KNOW: WHY, INTRO: WHY, GROUP: WHY, PARENT: WHY,
  NEW: 'How you came across them',
  ORG: 'Why you thought of this group',
  POST: 'Why this matters to you',
  YES: TOLD, ASK_PRICE: TOLD, ASK_TIME: TOLD, ASK_TEEN: TOLD, ASK_LEGIT: TOLD, ASK_INFO: TOLD,
  FOLLOW_UP: 'Something new for them',
  LAST: NOTE, NO_CALL: NOTE, THANKS: NOTE,
}
/** Types where the line is required before sending. */
export const LINE_REQUIRED = ['KNOW', 'INTRO', 'GROUP', 'PARENT']

export const lineLabelFor = (scenario: string | null | undefined): string => LINE_LABELS[scenario ?? 'KNOW'] ?? WHY
export const lineSlotFor = (scenario: string | null | undefined): string => `[${lineLabelFor(scenario)}]`
/** The marker for the four "people you know" types (also used by "Email them for me"). */
export const LINE_SLOT = lineSlotFor('KNOW')
const ALL_SLOTS = Array.from(new Set(Object.values(LINE_LABELS))).map((l) => `[${l}]`)

/** The message with any unused line marker taken out and the spacing tidied. */
export function withoutLineSlot(text: string): string {
  const slots = ALL_SLOTS.filter((s) => text.includes(s))
  if (!slots.length) return text
  const out: string[] = []
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    const hit = slots.filter((s) => line.includes(s))
    if (!hit.length) { out.push(line); continue }
    const rest = hit.reduce((l, s) => l.split(s).join(''), line).replace(/[ \t]{2,}/g, ' ').replace(/ +([.,?!:;])/g, '$1').trim()
    if (rest) out.push(rest)
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/** A message with the marker shown in a highlight, for read-only previews. */
export function splitOnSlot(text: string, slot: string): { text: string; slot: boolean }[] {
  if (!text.includes(slot)) return [{ text, slot: false }]
  return text.split(slot).flatMap((t, i) => (i ? [{ text: slot, slot: true }, { text: t, slot: false }] : [{ text: t, slot: false }]))
}

/** Shown for {regular price} when the owner hasn't set a price: a [bracket], so sending is blocked until it's filled. */
export const PRICE_BLANK = '[your regular price]'

/** Guide text with {regular price} filled in (guides are read, not sent, but the same rule applies). */
export function fillPrice(text: string, price: string | null | undefined): string {
  return text.split('{regular price}').join(price?.trim() || PRICE_BLANK)
}

export const SPONSOR_LINE = 'Families who are a good fit may qualify for a NowTransformed sponsored seat.'

const TOKEN_RE = /\{[^{}\n]{1,40}\}/g

function fill(token: string, v: ScriptValues): string {
  switch (token) {
    case '{intro}': return introLine(v)
    case '{first name}': return v.firstName.trim()
    case '{personal line}': return v.personalLine.trim()
    case '{my name}': return v.myName.trim()
    case '{business}': return (v.business || v.program).trim()
    case '{program}': return v.program.trim()
    case '{program line}': return v.programLine.trim()
    case '{link}': return v.link.trim()
    case '{sponsor line}': return v.sponsorship ? SPONSOR_LINE : ''
    case '{regular price}': return v.regularPrice?.trim() || PRICE_BLANK
    default: return token
  }
}

/** Fills every fill-in, drops lines that only held an empty fill-in, and tidies spacing. */
/**
 * [[sponsor: any wording]] lets a writer mention sponsorship in their own words. The block is kept
 * (without the brackets) when the program has sponsored seats this month, and removed when it doesn't.
 */
export const SPONSOR_BLOCK_RE = /\[\[sponsor:\s*([^\]]*?)\s*\]\]/g
const ANY_BLOCK_RE = /\[\[[^\]]*\]\]/g
/** Sponsorship wording must leave the decision with the team: "may", "might", "could", "some families", "ask". */
const SPONSOR_HEDGE_RE = /\b(may|might|could|some|ask|possible|possibly|qualif)/i

export function renderScript(text: string, v: ScriptValues): string {
  const out: string[] = []
  const withBlocks = (v.sponsorship ? text : text.replace(/^[ \t]*\[\[sponsor:[^\]]*\]\][ \t]*(\r?\n|$)/gm, ''))
    .replace(SPONSOR_BLOCK_RE, (_m, t: string) => (v.sponsorship ? t : ''))
  for (const line of withBlocks.replace(/\r\n/g, '\n').split('\n')) {
    const onlyTokens = line.trim() !== '' && line.replace(TOKEN_RE, '').trim() === ''
    const filled = line.replace(TOKEN_RE, (t) => fill(t, v))
    if (onlyTokens && filled.trim() === '') continue
    out.push(filled.replace(/[ \t]{2,}/g, ' ').replace(/ +([.,?!:;])/g, '$1').trim())
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/** "Helping teens in foster care." -> "helping teens in foster care" so it reads inside a sentence. */
export function lineFromHeadline(headline: string | null | undefined): string | null {
  const h = (headline ?? '').trim().replace(/[.!?]+$/, '')
  if (!h || h.length > 160) return null
  return /^[A-Z][a-z]/.test(h) ? h[0].toLowerCase() + h.slice(1) : h
}

// ---------- automatic checks (owners' edits go live when these pass) ----------

export interface ScriptCheck {
  id: string
  label: string
  ok: boolean
}

const URL_RE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|org|net|io|co|app|link|ly)\b)/i
const PROMISE_RE = /\b(cure[sd]?|curing|guarantee[sd]?|guaranteed|get rich|passive income|financial freedom|miracle|risk[- ]free|100% results|lose \d+ ?(pounds|lbs|kg))\b|earn \$|make \$/i
const GRANT_RE = /\bgrants?\b/i

export function wordCount(text: string): number {
  let extra = 0
  const words: Record<string, number> = { '{intro}': 22, '{program line}': 12, '{personal line}': 10, '{sponsor line}': 13 }
  const stripped = text.replace(TOKEN_RE, (t) => { extra += words[t] ?? 1; return ' ' })
  return stripped.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length + extra
}

export function wordLimit(scenario: ScenarioKey, variant: ScriptVariant): number {
  if (variant === 'POST') return 150
  if (variant === 'EMAIL') return 150
  return scenarioOf(scenario).group === 'FIRST' ? 80 : 60
}

const NO_LINK: ScenarioKey[] = ['KNOW', 'INTRO', 'GROUP', 'NEW', 'PARENT', 'FOLLOW_UP', 'LAST']
const NEEDS_LINK: ScenarioKey[] = ['YES', 'NO_CALL']
const NEEDS_QUESTION: ScenarioKey[] = ['KNOW', 'INTRO', 'GROUP', 'NEW', 'PARENT', 'ORG']
const NEEDS_PERSONAL: ScenarioKey[] = ['KNOW', 'INTRO', 'GROUP', 'PARENT']

/**
 * The message ends on its question. Emails may add a short sign-off after it, on its own lines
 * ("Thanks,\n{my name}"), the way real emails do.
 */
export function endsWithQuestion(body: string, variant: ScriptVariant): boolean {
  const lines = body.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (!lines.length) return false
  if (lines[lines.length - 1].endsWith('?')) return true
  if (variant !== 'EMAIL') return false
  // Up to two short trailing lines (each 5 words or fewer, no question of their own), then the question.
  for (let tail = 1; tail <= 2 && tail < lines.length; tail++) {
    const after = lines.slice(lines.length - tail)
    if (after.some((l) => l.split(/\s+/).length > 5 || l.includes('?'))) return false
    if (lines[lines.length - tail - 1].endsWith('?')) return true
  }
  return false
}

export function scriptChecks(scenario: ScenarioKey, variant: ScriptVariant, t: { subject?: string | null; body: string }): ScriptCheck[] {
  const body = t.body ?? ''
  const all = `${t.subject ?? ''}\n${body}`
  const checks: ScriptCheck[] = [{ id: 'not-empty', label: 'Has a message', ok: body.trim().length > 0 && body.length <= 3000 }]
  if (variant === 'EMAIL') checks.push({ id: 'subject', label: 'Has a subject line', ok: !!t.subject?.trim() && (t.subject?.length ?? 0) <= 120 })
  if (NEEDS_QUESTION.includes(scenario)) checks.push({ id: 'question', label: 'Ends with one easy question', ok: endsWithQuestion(body, variant) })
  if (NO_LINK.includes(scenario)) checks.push({ id: 'no-link', label: scenarioOf(scenario).group === 'FOLLOW' ? 'No link (follow-ups never push the link)' : 'No link yet: ask first, send the link after a yes', ok: !URL_RE.test(all) && !all.includes('{link}') })
  if (NEEDS_LINK.includes(scenario)) checks.push({ id: 'link', label: 'Includes {link}', ok: body.includes('{link}') })
  if (NEEDS_PERSONAL.includes(scenario)) checks.push({ id: 'personal', label: 'Has a {personal line} so it sounds like you', ok: body.includes('{personal line}') })
  const limit = wordLimit(scenario, variant)
  checks.push({ id: 'words', label: `Under ${limit} words`, ok: wordCount(body) < limit })
  checks.push({ id: 'promises', label: 'No promised results or earnings ("guaranteed", "cure", "earn $")', ok: !PROMISE_RE.test(all) })
  checks.push({ id: 'sponsorship', label: 'Says "sponsored seat", not "grant"', ok: !GRANT_RE.test(all) })
  const blocks = all.match(ANY_BLOCK_RE) ?? []
  if (blocks.length) {
    const sponsorTexts = Array.from(all.matchAll(SPONSOR_BLOCK_RE)).map((m) => m[1])
    const bad = blocks.length !== sponsorTexts.length
    checks.push({ id: 'blocks', label: bad ? 'Only [[sponsor: ...]] blocks are allowed' : 'Sponsorship is never promised (say "may", "could" or "some families")', ok: !bad && sponsorTexts.every((t) => SPONSOR_HEDGE_RE.test(t)) })
  }
  const unknown = (all.match(TOKEN_RE) ?? []).filter((x) => !(SCRIPT_FILL_INS as readonly string[]).includes(x))
  checks.push({ id: 'fill-ins', label: unknown.length ? `Unknown fill-in: ${unknown.join(', ')}` : 'Only known fill-ins', ok: unknown.length === 0 })
  return checks
}

export const checksPass = (checks: ScriptCheck[]) => checks.every((c) => c.ok)

// ---------- choosing the message ----------

export interface ScriptText {
  subject: string | null
  body: string
}

export interface ScriptRow {
  scenario: string
  variant: string
  defaultSubject: string | null
  defaultBody: string | null
  ownerSubject: string | null
  ownerBody: string | null
}

export interface ResolvedScript extends ScriptText {
  scenario: ScenarioKey
  variant: ScriptVariant
  /** OWNER = the owner's own words; PROGRAM = NowTransformed's version for this program; GENERAL = the general message. */
  source: 'OWNER' | 'PROGRAM' | 'GENERAL'
}

/** General messages, keyed `${scenario}:${variant}`. Filled in by scripts-defaults.ts. */
export type GeneralScripts = Partial<Record<`${ScenarioKey}:${ScriptVariant}`, ScriptText>>

export function resolveScript(rows: ScriptRow[], general: GeneralScripts, scenario: ScenarioKey, variant: ScriptVariant): ResolvedScript | null {
  const row = rows.find((r) => r.scenario === scenario && r.variant === variant)
  if (row?.ownerBody?.trim()) return { scenario, variant, subject: row.ownerSubject, body: row.ownerBody, source: 'OWNER' }
  if (row?.defaultBody?.trim()) return { scenario, variant, subject: row.defaultSubject, body: row.defaultBody, source: 'PROGRAM' }
  const g = general[`${scenario}:${variant}`]
  return g ? { scenario, variant, ...g, source: 'GENERAL' } : null
}

/** The default an owner's "Reset" goes back to: the program's default, else the general message. */
export function defaultFor(rows: ScriptRow[], general: GeneralScripts, scenario: ScenarioKey, variant: ScriptVariant): ScriptText | null {
  const row = rows.find((r) => r.scenario === scenario && r.variant === variant)
  if (row?.defaultBody?.trim()) return { subject: row.defaultSubject, body: row.defaultBody }
  return general[`${scenario}:${variant}`] ?? null
}

// ---------- email footer (US commercial email rules) ----------

/** Added under every EMAIL message a member copies: our address and an easy way to say no. */
export function emailFooter(mailingAddress: string | null): string {
  const lines = ["If you'd rather not hear about this, just reply \"no thanks\" and I won't email again."]
  if (mailingAddress?.trim()) lines.push(`NowTransformed, ${mailingAddress.trim()}`)
  return lines.join('\n')
}
