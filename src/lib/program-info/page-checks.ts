/**
 * Checks on a program page (CoachProgram offerPage) while it is written. PURE: shared by the team's page
 * editor (/admin/program-pages/[id]/edit) and the tests (offer-page.test.ts runs the saved pages through it),
 * so the editor and the tests never disagree.
 *
 * pageWarnings(page) lists every problem, each with the field it belongs to (`path`, dotted, list positions
 * from 0: "why.paragraphs.1"), a plain-English message ("Headline: at most 120 letters") and whether it stops
 * the page being saved (`blocking`). House-style notes (dashes, "!") and text copied from another page do not.
 */
import { OfferPageSchema } from '../get-involved/offer-page'

/** The sentence every sponsorship box must contain, word for word. */
export const SPONSORSHIP_LINE = "If you're a good fit, you may qualify for a NowTRANSFORMED sponsorship toward this offer."

export type PageWarningKind = 'format' | 'sponsorship' | 'placeholder' | 'style' | 'nonprofit' | 'copied'

export interface PageWarning {
  /** The field, dotted ("hook", "faqs.2.a"); a list or a part when the problem is the whole thing ("bullets"). */
  path: string
  message: string
  /** True = the page can't be saved until it is fixed. */
  blocking: boolean
  kind: PageWarningKind
}

/** Text on other programs' live pages, for the "copied word for word" check. */
export interface OtherPageText {
  name: string
  texts: string[]
}

// ---------- labels ----------

/** Plain names of the page's parts, as the editor shows them. */
export const PART_LABELS: Record<string, string> = {
  theme: 'Colours',
  eyebrow: 'Small line above the headline',
  hook: 'Headline',
  intro: 'Opening paragraph',
  bullets: 'Top of the page',
  hostNote: 'Line under the host’s name',
  heroImage: 'Main photo',
  showcase: 'Showcase',
  why: 'Why it matters',
  options: '"Is this you?" cards',
  callout: 'Business callout',
  story: 'The story',
  sponsorship: 'Sponsorship box',
  steps: 'How it works',
  gallery: 'Photos row',
  testimonials: 'What people say',
  faqs: 'Questions',
  closing: 'Closing',
  partnerLine: 'Partner line in the footer',
}

const ITEM_LABELS: Record<string, string> = {
  bullets: 'point',
  paragraphs: 'paragraph',
  points: 'point',
  items: 'card',
  steps: 'step',
  images: 'photo',
  testimonials: 'quote',
  faqs: 'question',
  pins: 'pin',
}

const FIELD_LABELS: Record<string, string> = {
  title: 'Title',
  text: 'Text',
  lead: 'Bold start',
  cta: 'Button text',
  label: 'Label',
  featured: 'Highlighted',
  footnote: 'Small print',
  eyebrow: 'Small line above the title',
  caption: 'Caption',
  quote: 'Quote',
  name: 'Name',
  role: 'Who they are',
  photo: 'Photo address',
  q: 'Question',
  a: 'Answer',
  image: 'Photo',
  desktop: 'Computer screenshot',
  phone: 'Phone screenshot',
  soon: 'Coming soon note',
  note: 'Handwritten note',
  handNote: 'Second handwritten note',
  focus: 'Photo focus',
  left: 'From the left',
  top: 'From the top',
  accent: 'Buttons and links',
  accentDark: 'Button hover',
  tint: 'Top background',
  deep: 'Dark band',
  deepText: 'Text on the dark band',
}

const IMAGE_KEYS = new Set(['heroImage', 'image', 'desktop', 'phone'])

/** "why.paragraphs.1" -> "Why it matters, paragraph 2". */
export function labelFor(path: string | (string | number)[]): string {
  const parts = (Array.isArray(path) ? path : path.split('.')).map((p) => (typeof p === 'number' ? p : /^\d+$/.test(p) ? Number(p) : p))
  if (parts.length === 0) return 'The page'
  const out: string[] = [PART_LABELS[String(parts[0])] ?? String(parts[0])]
  let prev: string | number = parts[0]
  for (let i = 1; i < parts.length; i++) {
    const p = parts[i]
    if (typeof p === 'number') {
      const noun = typeof prev === 'string' ? ITEM_LABELS[prev] ?? 'item' : 'item'
      out.push(`${noun} ${p + 1}`)
    } else if (p === 'src' && (typeof prev === 'number' || IMAGE_KEYS.has(String(prev)))) {
      // the photo itself: the label so far already names it
      if (typeof prev === 'number') out.push('photo')
    } else if (p === 'alt') {
      out.push('photo description')
    } else if (p === 'paragraphs' || p === 'items' || p === 'points' || p === 'images' || p === 'pins') {
      // the list name: the item number that follows says enough
      if (i === parts.length - 1) out.push(p === 'items' ? 'cards' : p === 'images' ? 'photos' : p)
    } else {
      out.push(FIELD_LABELS[p] ?? p)
    }
    prev = p
  }
  return out.join(', ')
}

// ---------- schema problems in plain English ----------

interface LooseIssue {
  code: string
  path: PropertyKey[]
  message: string
  origin?: string
  type?: string
  minimum?: number | bigint
  maximum?: number | bigint
  expected?: string
}

function issueText(i: LooseIssue): string {
  const last = String(i.path[i.path.length - 1] ?? '')
  const origin = i.origin ?? i.type
  if (i.code === 'too_big' && origin === 'string') return `at most ${Number(i.maximum)} letters`
  if (i.code === 'too_big' && origin === 'array') return `at most ${Number(i.maximum)}`
  if (i.code === 'too_big' && origin === 'number') return `at most ${Number(i.maximum)}`
  if (i.code === 'too_small' && origin === 'string') {
    if (last === 'alt') return 'describe the photo in a few words, for people who can’t see it'
    if (last === 'src') return 'add a photo, or switch the photo off'
    return 'can’t be empty'
  }
  if (i.code === 'too_small' && origin === 'array') return Number(i.minimum) === 1 ? 'needs at least one' : `needs at least ${Number(i.minimum)}`
  if (i.code === 'too_small' && origin === 'number') return `at least ${Number(i.minimum)}`
  if (i.code === 'invalid_type') return /undefined/.test(i.message) ? 'is missing' : 'has the wrong kind of value'
  if (i.code === 'invalid_format' || i.code === 'invalid_string') return /^Invalid/.test(i.message) ? 'is not in the right form' : i.message
  if (i.code === 'custom') return i.message
  return i.message
}

// ---------- walking the page ----------

type Visit = (value: string, path: string) => void

/** Calls `visit` for every piece of text a visitor reads (photo addresses and colours left out). */
function eachText(v: unknown, path: string, visit: Visit) {
  if (typeof v === 'string') {
    visit(v, path)
    return
  }
  if (Array.isArray(v)) {
    v.forEach((x, i) => eachText(x, path ? `${path}.${i}` : String(i), visit))
    return
  }
  if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (k === 'theme' || k === 'src' || k === 'photo' || k === 'focus') continue
      eachText(x, path ? `${path}.${k}` : k, visit)
    }
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const valueAt = (v: unknown, path: PropertyKey[]): unknown =>
  path.reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<PropertyKey, unknown>)[k as string] : undefined), v)
const str = (v: unknown) => (typeof v === 'string' ? v : '')

/** Lower case, words only: "Don't  stop!" -> "don't stop". */
export function normalizeWords(s: string): string {
  return s.toLowerCase().replace(/[‘’]/g, "'").replace(/[^a-z0-9']+/g, ' ').trim()
}

const wordCount = (s: string) => (normalizeWords(s) ? normalizeWords(s).split(' ').length : 0)

/** Every piece of text on a page with 12 or more words (what the copy check compares). */
export function longTextsOf(page: unknown): string[] {
  const out: string[] = []
  eachText(page, '', (s) => { if (wordCount(s) >= 12) out.push(s) })
  return out
}

// ---------- the rules ----------

/** Words that never go in the sponsorship box or the hero points, and what to say instead. */
const SPONSORSHIP_BANNED: { re: RegExp; message: string }[] = [
  { re: /\$\d/, message: 'no prices here; the price is talked about on the call. Say "you may qualify for a sponsorship" instead' },
  { re: /\bgrants?\b/i, message: 'say "sponsorship", not "grant"' },
  { re: /\bseats?\b/i, message: 'say "sponsorship" or "sponsorships", not "seat"' },
  { re: /non-?profit/i, message: 'don’t say "nonprofit" here. Call NowTRANSFORMED "a youth leadership development program"' },
]

function sponsorshipWarnings(page: Record<string, unknown>): PageWarning[] {
  const out: PageWarning[] = []
  const add = (path: string, message: string) => out.push({ path, message: `${labelFor(path)}: ${message}`, blocking: true, kind: 'sponsorship' })
  const spon = page.sponsorship
  if (!isObj(spon)) {
    add('sponsorship', 'every page needs the sponsorship box')
  } else {
    if (!str(spon.text).includes(SPONSORSHIP_LINE)) add('sponsorship.text', `must include this sentence word for word: "${SPONSORSHIP_LINE}"`)
    const n = Array.isArray(spon.points) ? spon.points.length : 0
    if (n !== 3) add('sponsorship.points', `needs exactly 3 points (it has ${n})`)
  }
  const bullets = Array.isArray(page.bullets) ? page.bullets : []
  if (!bullets.some((b) => isObj(b) && /sponsorship/i.test(`${str(b.lead)} ${str(b.text)}`))) {
    add('bullets', 'one of the points at the top must mention the sponsorship, e.g. "A sponsorship may cover part of it"')
  }
  const scan = (v: unknown, path: string) => eachText(v, path, (s, p) => {
    for (const b of SPONSORSHIP_BANNED) if (b.re.test(s)) add(p, b.message)
  })
  scan(spon, 'sponsorship')
  scan(bullets, 'bullets')
  return out
}

/**
 * Every problem on the page. `otherPages` = text on other programs' live pages (passed in by the server);
 * a paragraph of 12+ words found word for word on one of them is a (non-blocking) warning.
 */
export function pageWarnings(page: unknown, opts: { otherPages?: OtherPageText[] } = {}): PageWarning[] {
  const out: PageWarning[] = []
  if (!isObj(page)) return [{ path: '', message: 'The page is empty.', blocking: true, kind: 'format' }]

  const parsed = OfferPageSchema.safeParse(page)
  if (!parsed.success) {
    for (const i of parsed.error.issues as unknown as LooseIssue[]) {
      const path = i.path.map(String).join('.')
      const last = String(i.path[i.path.length - 1] ?? '')
      const empty = (last === 'src' || last === 'photo') && valueAt(page, i.path) === ''
      out.push({ path, message: `${labelFor(path)}: ${empty ? 'add a photo, or switch the photo off' : issueText(i)}`, blocking: true, kind: 'format' })
    }
  }

  out.push(...sponsorshipWarnings(page))

  const others = (opts.otherPages ?? []).map((o) => ({ name: o.name, text: ` ${o.texts.map(normalizeWords).join(' | ')} ` }))
  eachText(page, '', (s, path) => {
    const label = labelFor(path)
    const ph = s.match(/\[[^\]]+\]/)
    if (ph) out.push({ path, message: `${label}: replace the placeholder ${ph[0]} with the real words`, blocking: true, kind: 'placeholder' })
    if (s.includes('—')) out.push({ path, message: `${label}: house style is no long dashes (—). Use a comma, a full stop or "and" instead`, blocking: false, kind: 'style' })
    if (s.includes('!')) out.push({ path, message: `${label}: house style is no "!". End the sentence with a full stop`, blocking: false, kind: 'style' })
    if (/non-?profit/i.test(s)) {
      const sentences = s.split(/(?<=[.!?])\s+/)
      if (sentences.some((x) => /non-?profit/i.test(x) && /nowtransformed/i.test(x))) {
        out.push({ path, message: `${label}: NowTRANSFORMED is never called a nonprofit. Call it "a youth leadership development program"`, blocking: true, kind: 'nonprofit' })
      }
    }
    if (others.length > 0 && wordCount(s) >= 12) {
      const n = ` ${normalizeWords(s)} `
      const hit = others.find((o) => o.text.includes(n))
      if (hit) out.push({ path, message: `${label}: this is word for word on ${hit.name}'s live page. Write it for this program`, blocking: false, kind: 'copied' })
    }
  })

  // the same message for the same field once (e.g. "nonprofit" in the sponsorship box)
  const seen = new Set<string>()
  return out.filter((w) => {
    const k = `${w.path}|${w.message}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/** Only the problems that stop a save. */
export const blockingWarnings = (ws: PageWarning[]) => ws.filter((w) => w.blocking)
