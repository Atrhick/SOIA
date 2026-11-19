/**
 * Program info workflow: the questions a page owner answers. ONE source of truth for the coach screens,
 * the team screen, progress, validation and the plain-text export. PURE (no database, no '@/' imports)
 * so tests and scripts can use it.
 *
 * Storage: a page's answers live in CoachProgram.infoAnswers (keys = question ids below). Keys marked
 * `shared` live on the ROOT row's sharedAnswers and are used by every page of the program, as are the
 * two names (programName, companyName) set on "Names and groups".
 */
import { z } from 'zod'

export const SECTION_IDS = ['short', 'who', 'offer', 'yes', 'about'] as const
export type SectionId = (typeof SECTION_IDS)[number]

/** Every answer key. `zoomUrl`, `quotePermission` and `flyerLink` are extras that sit beside a question. */
export const ANSWER_KEYS = [
  'summary',
  'audience',
  'problem',
  'moments',
  'offerings',
  'howItRuns',
  'zoomUrl',
  'cost',
  'faqs',
  'quote',
  'quotePermission',
  'aboutYou',
  'mustNotSay',
  'photosLink',
  'flyerLink',
] as const
export type AnswerKey = (typeof ANSWER_KEYS)[number]

/** Keys stored on the root row's sharedAnswers (About you + the names). */
export const SHARED_KEYS = ['aboutYou', 'mustNotSay', 'photosLink', 'programName', 'companyName'] as const
export type SharedKey = (typeof SHARED_KEYS)[number]

/** How the answer is entered and stored. */
export type QuestionKind = 'text' | 'longtext' | 'url' | 'cost' | 'checkbox'

export const COST_FREQUENCIES = ['once', 'monthly', 'yearly'] as const
export type CostFrequency = (typeof COST_FREQUENCIES)[number]
export const COST_FREQUENCY_LABELS: Record<CostFrequency, string> = { once: 'Once', monthly: 'Monthly', yearly: 'Yearly' }

/** The `cost` answer. Saves into CoachProgram.offerFullPrice / offerSponsoredPrice (see costToPriceStrings). */
export interface CostAnswer {
  price: string
  frequency: CostFrequency | null
  sponsoredPrice?: string
}

export interface InfoQuestion {
  id: AnswerKey
  section: SectionId
  label: string
  /** Shown under the label (never as a placeholder). */
  hint: string
  /** "Example: ..." hint text. */
  example: string
  required: boolean
  shared: boolean
  kind: QuestionKind
  maxLength: number
  /** An extra field shown with another question (zoomUrl with howItRuns, quotePermission with quote). */
  extraOf?: AnswerKey
}

export interface InfoSection {
  id: SectionId
  number: number
  title: string
  /** True for About you: answered once, used by every page of the program. */
  shared: boolean
  questions: InfoQuestion[]
}

const q = (o: Omit<InfoQuestion, 'shared' | 'maxLength'> & { shared?: boolean; maxLength?: number }): InfoQuestion => ({
  shared: false,
  maxLength: o.kind === 'url' ? 500 : o.kind === 'text' ? 300 : 4000,
  ...o,
})

export const INFO_SECTIONS: InfoSection[] = [
  {
    id: 'short',
    number: 1,
    title: 'Your program in short',
    shared: false,
    questions: [
      q({
        id: 'summary', section: 'short', kind: 'longtext', required: true, maxLength: 1000,
        label: 'What do you do, in one or two sentences?',
        hint: 'Say it the way you would to a friend.',
        example: 'I help families and small business owners protect what they have, with legal plans and identity protection.',
      }),
    ],
  },
  {
    id: 'who',
    number: 2,
    title: "Who it's for",
    shared: false,
    questions: [
      q({
        id: 'audience', section: 'who', kind: 'longtext', required: true, maxLength: 1000,
        label: 'Who is it for?',
        hint: 'The people this page is for. Age, situation, where they live, if it matters.',
        example: 'Parents with kids at home, mostly in Houston, many working two jobs.',
      }),
      q({
        id: 'problem', section: 'who', kind: 'longtext', required: true,
        label: "What's going wrong for them before they find you, and what's better after?",
        hint: 'Before and after, in their words if you can.',
        example: 'Before: one letter from a landlord or the IRS and they panic. After: they call a lawyer the same day and sleep at night.',
      }),
      q({
        id: 'moments', section: 'who', kind: 'longtext', required: true,
        label: 'When do people usually come to you? What just happened in their life?',
        hint: 'The moments that make someone look for help.',
        example: 'A new baby, buying a first home, a scary letter, starting a business.',
      }),
    ],
  },
  {
    id: 'offer',
    number: 3,
    title: 'What you offer',
    shared: false,
    questions: [
      q({
        id: 'offerings', section: 'offer', kind: 'longtext', required: true,
        label: 'What do people get?',
        hint: 'Each thing you offer, one per line. Include brand or company names.',
        example: 'LegalShield small business plan, from PPLSI',
      }),
      q({
        id: 'howItRuns', section: 'offer', kind: 'longtext', required: true,
        label: 'How does it run, and how do people get started after the free call?',
        hint: 'How often, how long, online or in person, which languages. Then the first step after the call.',
        example: 'One 45-minute session on Zoom, in English or Vietnamese. After the call, you book a time and fill in a short form.',
      }),
      q({
        id: 'zoomUrl', section: 'offer', kind: 'url', required: false, extraOf: 'howItRuns',
        label: 'Zoom link, if people join a regular session',
        hint: 'Only if people join the same link every time.',
        example: 'https://zoom.us/j/1234567890',
      }),
      q({
        id: 'cost', section: 'offer', kind: 'cost', required: true, maxLength: 40,
        label: 'What does it cost?',
        hint: 'Visitors never see prices. Only you and the NowTRANSFORMED team do.',
        example: '$197. A range is fine: $30 to $50.',
      }),
    ],
  },
  {
    id: 'yes',
    number: 4,
    title: 'Before they say yes',
    shared: false,
    questions: [
      q({
        id: 'faqs', section: 'yes', kind: 'longtext', required: true,
        label: 'What do people ask you first, and what do you tell them?',
        hint: 'The questions you hear on almost every call, with your usual answer.',
        example: '"Is there a contract?" No. You can cancel any month.',
      }),
      q({
        id: 'quote', section: 'yes', kind: 'longtext', required: false, maxLength: 1000,
        label: "A short quote from someone you've helped",
        hint: 'Their words and first name. We only use it if you tick the box below.',
        example: '"I finally understood my lease before signing it." Maria',
      }),
      q({
        id: 'quotePermission', section: 'yes', kind: 'checkbox', required: false, extraOf: 'quote', maxLength: 0,
        label: 'They said I can use their quote and first name.',
        hint: '',
        example: '',
      }),
    ],
  },
  {
    id: 'about',
    number: 5,
    title: 'About you',
    shared: true,
    questions: [
      q({
        id: 'aboutYou', section: 'about', kind: 'longtext', required: true, shared: true,
        label: 'About you',
        hint: 'Who you are and why you do this. A few sentences is plenty.',
        example: 'I grew up translating letters for my parents. Now I make sure no family has to guess what a paper means.',
      }),
      q({
        id: 'mustNotSay', section: 'about', kind: 'longtext', required: true, shared: true, maxLength: 2000,
        label: 'Anything we must not say or promise?',
        hint: 'Rules from your company, or things you never want to claim. Write "Nothing" if there is nothing.',
        example: 'No legal advice. Never promise savings on insurance.',
      }),
      q({
        id: 'photosLink', section: 'about', kind: 'url', required: false, shared: true,
        label: 'Photos: a link to them',
        hint: 'A shared folder or album. Or reply to our email with the photos.',
        example: 'https://photos.app.goo.gl/...',
      }),
    ],
  },
]

/** Shown on the page hub, outside the 5 sections. Optional. */
export const FLYER_QUESTION: InfoQuestion = q({
  id: 'flyerLink', section: 'short', kind: 'url', required: false,
  label: 'A flyer or website we can read',
  hint: "Paste a link and we'll use it to fill any gaps.",
  example: 'Your Facebook page.',
})

export const ALL_QUESTIONS: InfoQuestion[] = [...INFO_SECTIONS.flatMap((s) => s.questions), FLYER_QUESTION]
const BY_ID = new Map<string, InfoQuestion>(ALL_QUESTIONS.map((x) => [x.id, x]))

export const SECTIONS_TOTAL = INFO_SECTIONS.length
export const REQUIRED_KEYS: AnswerKey[] = ALL_QUESTIONS.filter((x) => x.required).map((x) => x.id)

export function questionById(id: string): InfoQuestion | undefined {
  return BY_ID.get(id)
}
export function sectionById(id: string): InfoSection | undefined {
  return INFO_SECTIONS.find((s) => s.id === id)
}
export function isAnswerKey(v: unknown): v is AnswerKey {
  return typeof v === 'string' && BY_ID.has(v)
}
export function isSharedKey(k: string): k is SharedKey {
  return (SHARED_KEYS as readonly string[]).includes(k)
}
export function isSectionId(v: unknown): v is SectionId {
  return typeof v === 'string' && (SECTION_IDS as readonly string[]).includes(v)
}

// ---------- validation ----------

const httpsish = (max: number) =>
  z.string().trim().max(max).refine((v) => v === '' || /^https?:\/\/[^\s"'<>]+$/i.test(v), 'Paste a full link starting with https://')

export const CostAnswerSchema = z.object({
  price: z.string().trim().max(40, 'Price: at most 40 characters'),
  frequency: z.enum(COST_FREQUENCIES).nullable(),
  sponsoredPrice: z.string().trim().max(40, 'Sponsored price: at most 40 characters').optional(),
})

/** The zod schema for one answer. Empty values are allowed (clearing an answer). */
export function answerSchemaFor(key: AnswerKey): z.ZodType<unknown> {
  const def = BY_ID.get(key)!
  switch (def.kind) {
    case 'cost': return CostAnswerSchema
    case 'checkbox': return z.boolean()
    case 'url': return httpsish(def.maxLength)
    default: return z.string().max(def.maxLength * 2).transform((s) => s.trim()).refine((s) => s.length <= def.maxLength, `At most ${def.maxLength} characters`)
  }
}

/** Validates one answer; returns the cleaned value or an error for the UI. */
export function parseAnswer(key: string, value: unknown): { ok: true; key: AnswerKey; value: unknown } | { ok: false; error: string } {
  if (!isAnswerKey(key)) return { ok: false, error: 'Unknown question' }
  const r = answerSchemaFor(key).safeParse(value)
  if (!r.success) return { ok: false, error: r.error.issues[0]?.message ?? 'Check this answer' }
  return { ok: true, key, value: r.data }
}

/** Is this value a real answer (counts toward "done")? */
export function isAnswered(key: string, value: unknown): boolean {
  const def = BY_ID.get(key)
  if (value === null || value === undefined) return false
  if (def?.kind === 'cost') {
    const c = value as Partial<CostAnswer>
    return typeof c.price === 'string' && c.price.trim() !== '' && !!c.frequency
  }
  if (def?.kind === 'checkbox') return value === true
  return typeof value === 'string' && value.trim() !== ''
}

// ---------- cost <-> price strings ----------

const NUM = String.raw`\$?\s*(\d[\d,]*(?:\.\d{1,2})?)\s*(k)?`
const RANGE_RE = new RegExp(String.raw`^${NUM}\s*(?:-|–|—|to)\s*${NUM}$`, 'i')
const SINGLE_RE = new RegExp(String.raw`^${NUM}$`, 'i')

const money = (n: string, k?: string) => `$${n}${k ? 'k' : ''}`

/** "30-50" -> "$30 to $50", "197" -> "$197", "$1,200" -> "$1,200". Anything else is kept as typed. */
export function normalizePrice(raw: string): string {
  const s = raw.trim().replace(/\s+/g, ' ')
  if (!s) return ''
  const r = RANGE_RE.exec(s)
  if (r) return `${money(r[1], r[2])} to ${money(r[3], r[4])}`
  const one = SINGLE_RE.exec(s)
  if (one) return money(one[1], one[2])
  return s
}

const FREQ_SUFFIX: Record<CostFrequency, string> = { once: '', monthly: ' a month', yearly: ' a year' }
const HAS_PERIOD_RE = /\b(month|monthly|mo|year|yearly|yr|annual|annually|week|weekly|once|one[- ]time)\b|\/\s*(mo|yr|month|year)/i

/** One price + how often -> the stored string, e.g. "$30 to $50 a month". Kept within 40 characters. */
export function priceString(price: string, frequency: CostFrequency | null): string {
  const p = normalizePrice(price)
  if (!p) return ''
  const withPeriod = frequency && !HAS_PERIOD_RE.test(p) ? `${p}${FREQ_SUFFIX[frequency]}` : p
  return withPeriod.length <= 40 ? withPeriod : p.slice(0, 40)
}

/** The cost answer -> CoachProgram.offerFullPrice / offerSponsoredPrice (null = empty). */
export function costToPriceStrings(c: CostAnswer): { offerFullPrice: string | null; offerSponsoredPrice: string | null } {
  return {
    offerFullPrice: priceString(c.price ?? '', c.frequency) || null,
    offerSponsoredPrice: priceString(c.sponsoredPrice ?? '', c.frequency) || null,
  }
}

/** Reads an existing price string back into a cost answer (prefill). Frequency only when the text says it. */
export function priceStringsToCost(full: string | null | undefined, sponsored?: string | null): CostAnswer | null {
  const f = (full ?? '').trim()
  if (!f) return null
  let frequency: CostFrequency | null = null
  if (/\b(month|monthly|mo)\b|\/\s*mo/i.test(f)) frequency = 'monthly'
  else if (/\b(year|yearly|yr|annual|annually)\b|\/\s*yr/i.test(f)) frequency = 'yearly'
  else if (/\b(once|one[- ]time)\b/i.test(f)) frequency = 'once'
  const strip = (s: string) => s.replace(/\s*(?:a|per|\/)\s*(month|mo|year|yr)\b\.?/i, '').replace(/\s*\b(monthly|yearly|annually|once|one[- ]time)\b/i, '').trim()
  const sp = (sponsored ?? '').trim()
  return { price: strip(f), frequency, ...(sp ? { sponsoredPrice: strip(sp) } : {}) }
}

/** How a cost answer reads to people ("$30 to $50 a month; with a sponsorship: $15 a month"). */
export function costText(c: CostAnswer | null | undefined): string {
  if (!c) return ''
  const { offerFullPrice, offerSponsoredPrice } = costToPriceStrings(c)
  if (!offerFullPrice) return ''
  return offerSponsoredPrice ? `${offerFullPrice}; with a sponsorship: ${offerSponsoredPrice}` : offerFullPrice
}

// ---------- prefill from what the program already has ----------

export interface PrefillSource {
  programDescription?: string | null
  headline?: string | null
  targetMarket?: string | null
  servicesDescription?: string | null
  zoomUrl?: string | null
  offerFullPrice?: string | null
  offerSponsoredPrice?: string | null
  coachBio?: string | null
}

/** Page answers started from existing columns. Only non-empty values; never overwrites `existing`. */
export function prefillPageAnswers(src: PrefillSource, existing: Record<string, unknown> = {}): Record<string, unknown> {
  const out: Record<string, unknown> = { ...existing }
  const put = (k: AnswerKey, v: unknown) => {
    if (!isAnswered(k, out[k]) && isAnswered(k, v)) out[k] = v
  }
  put('summary', (src.programDescription?.trim() || src.headline?.trim() || '').slice(0, 1000))
  put('audience', (src.targetMarket ?? '').trim().slice(0, 1000))
  put('offerings', (src.servicesDescription ?? '').trim().slice(0, 4000))
  if (src.zoomUrl && /^https?:\/\//i.test(src.zoomUrl) && !out.zoomUrl) out.zoomUrl = src.zoomUrl.trim()
  const cost = priceStringsToCost(src.offerFullPrice, src.offerSponsoredPrice)
  if (cost && !out.cost) out.cost = cost
  return out
}

/** Shared answers started from existing columns / the invite profile. Never overwrites `existing`. */
export function prefillSharedAnswers(
  src: { name?: string | null; organization?: string | null; coachBio?: string | null; inviteWhy?: string | null },
  existing: Record<string, unknown> = {},
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...existing }
  const put = (k: string, v: string | null | undefined) => {
    const t = (v ?? '').trim()
    if (t && !(typeof out[k] === 'string' && (out[k] as string).trim())) out[k] = t
  }
  put('aboutYou', (src.coachBio || src.inviteWhy || '').slice(0, 4000))
  put('programName', src.name)
  put('companyName', src.organization)
  return out
}

// ---------- plain text (for the team / Claude to write from) ----------

/** Every answer as plain text, section by section. */
export function answersAsText(
  answers: Record<string, unknown>,
  head: { programName: string; companyName?: string | null; audienceLabel?: string | null; ownerName?: string | null },
): string {
  const lines: string[] = []
  lines.push(`Program: ${head.programName}`)
  if (head.companyName) lines.push(`Company: ${head.companyName}`)
  if (head.audienceLabel) lines.push(`Group: ${head.audienceLabel}`)
  if (head.ownerName) lines.push(`Owner: ${head.ownerName}`)
  const show = (x: InfoQuestion): string => {
    const v = answers[x.id]
    if (x.kind === 'cost') return costText(v as CostAnswer) || '(not answered)'
    if (x.kind === 'checkbox') return v === true ? 'Yes' : 'No'
    return typeof v === 'string' && v.trim() ? v.trim() : '(not answered)'
  }
  for (const s of INFO_SECTIONS) {
    lines.push('', `## ${s.number}. ${s.title}${s.shared ? ' (shared by all pages)' : ''}`)
    for (const x of s.questions) {
      if (x.id === 'quote' && answers.quotePermission !== true && isAnswered('quote', answers.quote)) {
        lines.push('', `${x.label}`, `${show(x)}`, '(No permission ticked: do not use this quote.)')
        continue
      }
      lines.push('', `${x.label}${x.required ? '' : ' (optional)'}`, show(x))
    }
  }
  lines.push('', `${FLYER_QUESTION.label} (optional)`, show(FLYER_QUESTION))
  return lines.join('\n')
}
