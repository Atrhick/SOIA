/**
 * The page editor's data helpers. PURE (no React, no server): the page is kept as a plain object shaped
 * like OfferPage, but fields may be empty while someone is writing. cleanPage() turns it into what is saved.
 */
import { OfferPageSchema, type OfferPage } from '@/lib/get-involved/offer-page'
import { SPONSORSHIP_LINE } from '@/lib/program-info/page-checks'
import type { VersionItem } from '@/lib/program-info/server'

export type Obj = Record<string, unknown>
export type Path = (string | number)[]

export const pathKey = (p: Path) => p.join('.')

export function getAt(o: unknown, p: Path): unknown {
  let v: unknown = o
  for (const k of p) {
    if (v == null || typeof v !== 'object') return undefined
    v = (v as Record<string | number, unknown>)[k]
  }
  return v
}

/** A copy of `o` with `value` at `p` (objects and lists made on the way). `undefined` removes the key. */
export function setAt<T>(o: T, p: Path, value: unknown): T {
  if (p.length === 0) return value as T
  const [k, ...rest] = p
  const base: unknown = o ?? (typeof k === 'number' ? [] : {})
  if (Array.isArray(base)) {
    const copy = base.slice()
    copy[k as number] = setAt(copy[k as number], rest, value)
    return copy as T
  }
  const copy = { ...(base as Obj) }
  const next = setAt(copy[k as string], rest, value)
  if (next === undefined) delete copy[k as string]
  else copy[k as string] = next
  return copy as T
}

/** The version the editor starts from: the draft, else the latest sent / changes asked / approved version. */
export function workingVersionForEditor(versions: VersionItem[]): VersionItem | null {
  return versions.find((v) => v.status === 'DRAFT') ?? versions.find((v) => v.status === 'SENT' || v.status === 'CHANGES_ASKED' || v.status === 'APPROVED') ?? null
}

/** An empty page: the required fields as empty text, and the sponsorship sentence every page must carry. */
export function starterPage(): Obj {
  return {
    hook: '',
    intro: '',
    bullets: [],
    sponsorship: {
      title: '',
      text: SPONSORSHIP_LINE,
      points: [{ lead: '', text: '' }, { lead: '', text: '' }, { lead: '', text: '' }],
      cta: '',
    },
    steps: [{ title: '', text: '' }],
    testimonials: [],
    faqs: [],
    closing: { title: '', text: '', cta: '' },
  }
}

// ---------- what new list items and parts look like ----------

export const emptyImage = () => ({ src: '', alt: '' })

export const NEW_PART: Record<string, () => unknown> = {
  why: () => ({ title: '', paragraphs: [''] }),
  options: () => ({ title: '', items: [{ label: '', title: '', text: '' }] }),
  callout: () => ({ title: '', text: '', points: [] }),
  showcase: () => ({ title: '', desktop: emptyImage(), pins: [], points: [] }),
  story: () => ({ title: '', paragraphs: [''] }),
  gallery: () => ({ title: '', images: [emptyImage()] }),
  heroImage: () => emptyImage(),
  theme: () => ({ accent: '#0369a1', accentDark: '#075985', tint: '#f0f7fb', deep: '#0c4a6e', deepText: '#e0f2fe' }),
}

// ---------- cleaning before save ----------

/** Optional text fields: left out when empty. Numbers in the path are written as *. */
const OPTIONAL_TEXT = new Set([
  'eyebrow', 'hostNote', 'partnerLine',
  'heroImage.note', 'heroImage.handNote', 'heroImage.focus',
  'showcase.eyebrow', 'showcase.caption',
  'options.footnote', 'options.cta', 'options.items.*.image.note', 'options.items.*.image.focus',
  'options.soon.images.*.note', 'options.soon.images.*.focus',
  'callout.eyebrow', 'callout.cta', 'callout.image.note', 'callout.image.focus',
  'gallery.text', 'gallery.caption',
  'testimonials.*.role', 'testimonials.*.photo',
  'closing.text',
])
/** Optional photos: left out when both the photo and its description are empty. */
const OPTIONAL_IMAGES = new Set(['heroImage', 'showcase.phone', 'options.items.*.image', 'callout.image', 'story.image'])

const pattern = (p: Path) => p.map((k) => (typeof k === 'number' ? '*' : k)).join('.')

function clean(v: unknown, p: Path): unknown {
  if (Array.isArray(v)) return v.map((x, i) => clean(x, [...p, i]))
  if (v && typeof v === 'object') {
    const pat = pattern(p)
    const o = v as Obj
    if (OPTIONAL_IMAGES.has(pat) && !String(o.src ?? '').trim() && !String(o.alt ?? '').trim()) return undefined
    const out: Obj = {}
    for (const [k, x] of Object.entries(o)) {
      const c = clean(x, [...p, k])
      if (c === undefined) continue
      if (k === 'featured' && c === false) continue
      out[k] = c
    }
    return out
  }
  if (typeof v === 'string' && !v.trim() && OPTIONAL_TEXT.has(pattern(p))) return undefined
  return v
}

/** The page as it is saved: empty optional text and empty optional photos left out. */
export function cleanPage(page: Obj): Obj {
  return (clean(page, []) as Obj) ?? {}
}

// ---------- what the preview can show ----------

const okSrc = (s: unknown) => typeof s === 'string' && (/^\/[A-Za-z0-9/_.-]+$/.test(s) || /^https:\/\/[^\s"'<>]+$/.test(s))

/** Photos with no usable address are dropped from the preview (lists of photos keep only usable ones). */
function previewImages(v: unknown, p: Path): unknown {
  if (Array.isArray(v)) {
    const items = v.map((x, i) => previewImages(x, [...p, i]))
    return items.filter((x) => x !== undefined)
  }
  if (v && typeof v === 'object') {
    const o = v as Obj
    if ('src' in o && !okSrc(o.src)) return undefined
    const out: Obj = {}
    for (const [k, x] of Object.entries(o)) {
      if (k === 'theme') { out[k] = x; continue }
      const c = previewImages(x, [...p, k])
      if (c !== undefined) out[k] = c
    }
    return out
  }
  if (p[p.length - 1] === 'photo' && !okSrc(v)) return undefined
  return v
}

/**
 * The page the live preview renders. A page that passes the check is shown as is; one that doesn't (a field
 * still empty, a word over the limit) is shown as written so far, with lists defaulted and unusable photos
 * left out, so the preview follows the typing. Parts the landing page can't draw yet (e.g. a showcase with no
 * computer screenshot) are left out.
 */
export function previewPage(page: Obj): OfferPage {
  const c = cleanPage(page)
  const ok = OfferPageSchema.safeParse(c)
  if (ok.success) return ok.data
  const p = previewImages(c, []) as Obj
  const arr = (v: unknown) => (Array.isArray(v) ? v : [])
  const objOr = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null)
  const out: Obj = { ...p, bullets: arr(p.bullets), testimonials: arr(p.testimonials), faqs: arr(p.faqs), steps: arr(p.steps) }
  out.closing = objOr(p.closing) ?? { title: '', cta: '' }
  const why = objOr(p.why)
  if (why) out.why = { ...why, paragraphs: arr(why.paragraphs) }
  const story = objOr(p.story)
  if (story) out.story = { ...story, paragraphs: arr(story.paragraphs) }
  const spon = objOr(p.sponsorship)
  if (spon) out.sponsorship = { ...spon, points: arr(spon.points) }
  const options = objOr(p.options)
  if (options) {
    const soon = objOr(options.soon)
    out.options = { ...options, items: arr(options.items), ...(soon ? { soon: { ...soon, images: arr(soon.images) } } : {}) }
  }
  const callout = objOr(p.callout)
  if (callout) out.callout = { ...callout, points: arr(callout.points) }
  const gallery = objOr(p.gallery)
  if (gallery) out.gallery = { ...gallery, images: arr(gallery.images) }
  const showcase = objOr(p.showcase)
  if (showcase) {
    if (objOr(showcase.desktop)) out.showcase = { ...showcase, pins: arr(showcase.pins), points: arr(showcase.points) }
    else delete out.showcase
  }
  const theme = objOr(p.theme)
  if (theme && !Object.values(theme).every((x) => typeof x === 'string' && /^#[0-9a-fA-F]{6}$/.test(x))) delete out.theme
  return out as unknown as OfferPage
}
