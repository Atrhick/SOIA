/**
 * An offering's landing page (CoachProgram.offerPage). PURE: shared by the page, the editor and tests.
 *
 * Every section except the hero, steps and closing is optional and is left out when empty. The sign-up
 * form is always the real One-A-Day form (signup-page.tsx), shown in the hero; every button jumps to it.
 * The sponsorship box shows only while the program has sponsorships open this month, and testimonials
 * only when there is at least one real one (name and permission are the owner's responsibility).
 */
import { z } from 'zod'

const text = (max: number) => z.string().trim().min(1).max(max)
/** Our own files (/offers/...) or https only. */
const url = z.string().trim().max(500).refine((u) => /^\/[A-Za-z0-9/_.-]+$/.test(u) || /^https:\/\/[^\s"'<>]+$/.test(u), 'Use a /offers/ path or an https link')
const image = z.object({ src: url, alt: text(300) })
/** A screenshot of a sample: shows a SAMPLE tag. */
const shot = image.extend({
  sample: z.boolean().optional(),
  note: z.string().trim().max(60).optional(),
  /** Which part of a tall screenshot shows in a small frame, as "x% y%" (CSS object-position). */
  focus: z.string().regex(/^\d{1,3}% \d{1,3}%$/).optional(),
})

export const OfferPageSchema = z.object({
  eyebrow: z.string().trim().max(120).optional(),
  hook: text(120),
  intro: text(600),
  bullets: z.array(z.object({ lead: text(60), text: z.string().trim().max(200) })).max(4).default([]),
  /** One line under the host's name, e.g. "runs ExploreNation's weekly intro sessions". */
  hostNote: z.string().trim().max(120).optional(),
  heroImage: shot.extend({ handNote: z.string().trim().max(60).optional() }).optional(),
  showcase: z.object({
    eyebrow: z.string().trim().max(60).optional(),
    title: text(120),
    desktop: image,
    phone: image.optional(),
    /** Numbered pins on the desktop picture, matched to points by order. Percentages from the top left. */
    pins: z.array(z.object({ left: z.number().min(0).max(100), top: z.number().min(0).max(100) })).max(4).default([]),
    points: z.array(z.object({ title: text(80), text: text(300) })).max(4).default([]),
    caption: z.string().trim().max(200).optional(),
  }).optional(),
  why: z.object({ title: text(120), paragraphs: z.array(text(600)).min(1).max(3) }).optional(),
  options: z.object({
    title: text(120),
    items: z.array(z.object({ label: text(40), title: text(80), text: text(400), image: shot.optional(), featured: z.boolean().optional() })).min(1).max(4),
    footnote: z.string().trim().max(200).optional(),
    /** Something planned but not on sale yet (e.g. a print magazine), shown as a dashed note under the options. */
    soon: z.object({ label: text(30), text: text(200), images: z.array(shot).max(3).default([]) }).optional(),
    cta: z.string().trim().max(60).optional(),
  }).optional(),
  story: z.object({ title: text(120), paragraphs: z.array(text(600)).min(1).max(3), image: image.optional() }).optional(),
  sponsorship: z.object({ title: text(120), text: text(500), cta: text(40) }).optional(),
  steps: z.array(z.object({ title: text(60), text: text(300) })).min(1).max(4),
  gallery: z.object({ title: text(120), text: z.string().trim().max(300).optional(), images: z.array(image).min(1).max(5), caption: z.string().trim().max(200).optional() }).optional(),
  testimonials: z.array(z.object({ quote: text(500), name: text(80), role: z.string().trim().max(120).optional(), photo: url.optional() })).max(3).default([]),
  faqs: z.array(z.object({ q: text(120), a: text(800) })).max(8).default([]),
  closing: z.object({ title: text(120), text: z.string().trim().max(200).optional(), cta: text(40) }),
  /** Footer line after the NowTRANSFORMED line, e.g. "in partnership with ExploreNation". */
  partnerLine: z.string().trim().max(120).optional(),
})

export type OfferPage = z.infer<typeof OfferPageSchema>

/** The saved JSON as a page, or null (then the plain sign-up page shows). */
export function parseOfferPage(v: unknown): OfferPage | null {
  if (v == null) return null
  const r = OfferPageSchema.safeParse(v)
  return r.success ? r.data : null
}
