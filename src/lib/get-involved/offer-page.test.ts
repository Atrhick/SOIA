import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseOfferPage } from './offer-page'

const en = JSON.parse(readFileSync(join(process.cwd(), 'scripts/offer-pages/explorenation.json'), 'utf8'))
const minimal = { hook: 'A hook', intro: 'An intro.', steps: [{ title: 'Book', text: 'Pick a time.' }], closing: { title: 'Ready?', cta: 'Book my free call' } }

describe('offer pages', () => {
  it('accepts the ExploreNation page', () => {
    const p = parseOfferPage(en)
    expect(p?.hook).toBe('Be the business your neighbors read about.')
    expect(p?.showcase?.pins).toHaveLength(3)
    expect(p?.testimonials).toEqual([])
    expect(p?.options?.soon?.label).toBe('Also planned: print')
    expect(p?.options?.soon?.images).toHaveLength(2)
    expect(p?.faqs.some((f) => f.q === 'Will there be a printed magazine?')).toBe(true)
  })

  it('accepts a minimal page and fills empty lists', () => {
    expect(parseOfferPage(minimal)).toMatchObject({ bullets: [], faqs: [], testimonials: [] })
  })

  it('no page, or a page that fails the check, means the plain sign-up page', () => {
    expect(parseOfferPage(null)).toBeNull()
    expect(parseOfferPage({ ...minimal, hook: '' })).toBeNull()
    expect(parseOfferPage({ ...minimal, steps: [] })).toBeNull()
  })

  it('every saved page passes the check, has no [placeholders] and only uses images that exist', () => {
    const dir = join(process.cwd(), 'scripts/offer-pages')
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'))
    expect(files.length).toBeGreaterThanOrEqual(5)
    for (const f of files) {
      const raw = JSON.parse(readFileSync(join(dir, f), 'utf8'))
      const page = parseOfferPage(raw)
      expect(page, f).not.toBeNull()
      const srcs: string[] = []
      const walk = (v: unknown) => {
        if (typeof v === 'string' && /\[[^\]]+\]/.test(v)) throw new Error(`${f}: placeholder left: ${v}`)
        if (v && typeof v === 'object') {
          const o = v as Record<string, unknown>
          if (typeof o.src === 'string') srcs.push(o.src)
          Object.values(o).forEach(walk)
        }
      }
      walk(raw)
      for (const s of srcs) if (s.startsWith('/')) expect(existsSync(join(process.cwd(), 'public', s)), `${f}: ${s}`).toBe(true)
    }
  })

  it('every saved page leads with the sponsorship: a hero bullet and a full section with the exact line', () => {
    const LINE = "If you're a good fit, you may qualify for a NowTRANSFORMED sponsorship toward this offer."
    const dir = join(process.cwd(), 'scripts/offer-pages')
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      const page = parseOfferPage(JSON.parse(readFileSync(join(dir, f), 'utf8')))!
      expect(page.sponsorship?.text, f).toContain(LINE)
      expect(page.sponsorship?.points, f).toHaveLength(3)
      expect(page.bullets.some((b) => /sponsorship/i.test(`${b.lead} ${b.text}`)), `${f}: hero bullet`).toBe(true)
      const words = JSON.stringify(page.sponsorship) + JSON.stringify(page.bullets)
      expect(words, f).not.toMatch(/\$\d|\bgrant\b|\bseats?\b|nonprofit/i)
    }
  })

  it('sponsorship points are optional and capped at three', () => {
    const spon = { title: 'T', text: 'X.', cta: 'Go' }
    expect(parseOfferPage({ ...minimal, sponsorship: spon })?.sponsorship?.points).toEqual([])
    const pt = { lead: 'L', text: 'T' }
    expect(parseOfferPage({ ...minimal, sponsorship: { ...spon, points: [pt, pt, pt, pt] } })).toBeNull()
  })

  it('a page may set its own colours; bad colours fail the check', () => {
    const theme = { accent: '#9d174d', accentDark: '#831843', tint: '#fdf2f8', deep: '#500724', deepText: '#fce7f3' }
    expect(parseOfferPage({ ...minimal, theme })?.theme).toEqual(theme)
    expect(parseOfferPage({ ...minimal, theme: { ...theme, accent: 'red' } })).toBeNull()
    expect(parseOfferPage({ ...minimal, theme: { ...theme, accent: '#fff;}' } })).toBeNull()
    expect(parseOfferPage(minimal)?.theme).toBeUndefined()
  })

  it('images only from our own /offers files or https links', () => {
    const withImg = (src: string) => parseOfferPage({ ...minimal, heroImage: { src, alt: 'x' } })
    expect(withImg('/offers/explorenation/listing-phone.webp')).not.toBeNull()
    expect(withImg('https://images.example.com/a.jpg')).not.toBeNull()
    expect(withImg('javascript:alert(1)')).toBeNull()
    expect(withImg('http://example.com/a.jpg')).toBeNull()
    expect(withImg('/offers/"onerror="x')).toBeNull()
  })
})
