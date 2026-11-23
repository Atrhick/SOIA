import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SPONSORSHIP_LINE, blockingWarnings, labelFor, longTextsOf, normalizeWords, pageWarnings } from './page-checks'

const good = () => ({
  hook: 'Grow a business you are proud of',
  intro: 'We help young people start small and grow.',
  bullets: [{ lead: 'A sponsorship', text: 'may cover part of it.' }],
  sponsorship: {
    title: 'A sponsorship toward this offer',
    text: `${SPONSORSHIP_LINE} We talk about it on the call.`,
    points: [{ lead: 'Who', text: 'Young people.' }, { lead: 'What', text: 'Part of the cost.' }, { lead: 'How', text: 'Book a call.' }],
    cta: 'Book my free call',
  },
  steps: [{ title: 'Book', text: 'Pick a time.' }],
  closing: { title: 'Ready?', cta: 'Book my free call' },
})

const paths = (ws: { path: string }[]) => ws.map((w) => w.path)

describe('page checks', () => {
  it('a complete page has no problems', () => {
    expect(pageWarnings(good())).toEqual([])
  })

  it('every saved ExploreNation-style page passes (the files the live pages came from)', () => {
    const en = JSON.parse(readFileSync(join(process.cwd(), 'scripts/offer-pages/explorenation.json'), 'utf8'))
    expect(blockingWarnings(pageWarnings(en))).toEqual([])
  })

  it('format problems are blocking and in plain English', () => {
    const ws = pageWarnings({ ...good(), hook: 'x'.repeat(121), intro: '' })
    expect(ws).toContainEqual({ path: 'hook', message: 'Headline: at most 120 letters', blocking: true, kind: 'format' })
    expect(ws).toContainEqual({ path: 'intro', message: 'Opening paragraph: can’t be empty', blocking: true, kind: 'format' })
    const why = pageWarnings({ ...good(), why: { title: 'T', paragraphs: ['ok', 'y'.repeat(601)] } })
    expect(why.find((w) => w.path === 'why.paragraphs.1')?.message).toBe('Why it matters, paragraph 2: at most 600 letters')
    const steps = pageWarnings({ ...good(), steps: [] })
    expect(steps.find((w) => w.path === 'steps')?.message).toBe('How it works: needs at least one')
  })

  it('photos need a description; an empty photo says add one or switch it off', () => {
    const ws = pageWarnings({ ...good(), heroImage: { src: '/offers/x/a.webp', alt: '' }, story: { title: 'T', paragraphs: ['p'], image: { src: '', alt: 'A' } } })
    const alt = ws.find((w) => w.path === 'heroImage.alt')
    expect(alt?.blocking).toBe(true)
    expect(alt?.message).toMatch(/^Main photo, photo description: describe the photo/)
    expect(ws.find((w) => w.path === 'story.image.src')?.message).toBe('The story, Photo: add a photo, or switch the photo off')
  })

  it('the sponsorship rule: exact sentence, 3 points, a hero bullet, no prices/grants/seats/nonprofit', () => {
    const p = good()
    expect(paths(pageWarnings({ ...p, sponsorship: { ...p.sponsorship, text: 'You may get help.' } }))).toContain('sponsorship.text')
    expect(paths(pageWarnings({ ...p, sponsorship: { ...p.sponsorship, points: p.sponsorship.points.slice(0, 2) } }))).toContain('sponsorship.points')
    expect(paths(pageWarnings({ ...p, bullets: [{ lead: 'Fast', text: 'start' }] }))).toContain('bullets')
    const { sponsorship: _s, ...noBox } = p
    void _s
    expect(pageWarnings(noBox).find((w) => w.path === 'sponsorship')?.blocking).toBe(true)
    for (const bad of ['Worth $50 a month', 'A grant for you', 'Save a seat', 'Only 3 seats', 'Our nonprofit pays']) {
      const ws = pageWarnings({ ...p, sponsorship: { ...p.sponsorship, points: [{ lead: 'Who', text: bad }, ...p.sponsorship.points.slice(1)] } })
      const w = ws.find((x) => x.path === 'sponsorship.points.0.text')
      expect(w?.blocking, bad).toBe(true)
      expect(w?.kind, bad).toBe('sponsorship')
    }
    expect(pageWarnings({ ...p, bullets: [...p.bullets, { lead: 'Grant', text: 'x' }] }).find((w) => w.path === 'bullets.1.lead')?.message).toMatch(/not "grant"/)
  })

  it('placeholders block; dashes and "!" are house style only', () => {
    const ws = pageWarnings({ ...good(), intro: 'Hi [first name] — welcome!' })
    expect(ws.filter((w) => w.path === 'intro').map((w) => [w.kind, w.blocking])).toEqual([['placeholder', true], ['style', false], ['style', false]])
  })

  it('"nonprofit" blocks only in a sentence that also names NowTRANSFORMED', () => {
    const why = (s: string) => pageWarnings({ ...good(), why: { title: 'Why', paragraphs: [s] } }).filter((w) => w.kind === 'nonprofit')
    expect(why('NowTRANSFORMED is a nonprofit that helps.')).toHaveLength(1)
    expect(why('Many of our clients go on to form a nonprofit. NowTRANSFORMED helps them plan.')).toHaveLength(0)
  })

  it('a long paragraph copied word for word from another live page is a warning, not a block', () => {
    const para = 'We meet every Thursday evening online and work through one real problem your business has right now.'
    const other = [{ name: 'Lina', texts: [`Intro. ${para.toUpperCase()} More.`] }]
    const ws = pageWarnings({ ...good(), intro: para }, { otherPages: other })
    expect(ws).toContainEqual({ path: 'intro', message: expect.stringContaining("Lina's live page"), blocking: false, kind: 'copied' })
    // short lines (under 12 words) are never flagged
    expect(pageWarnings({ ...good(), intro: 'Book a free call.' }, { otherPages: [{ name: 'L', texts: ['Book a free call.'] }] }).filter((w) => w.kind === 'copied')).toEqual([])
  })

  it('labels and helpers', () => {
    expect(labelFor('faqs.2.a')).toBe('Questions, question 3, Answer')
    expect(labelFor('options.items.0.image.alt')).toBe('"Is this you?" cards, card 1, Photo, photo description')
    expect(labelFor('gallery.images.1.src')).toBe('Photos row, photo 2, photo')
    expect(normalizeWords('Don’t  STOP, now!')).toBe("don't stop now")
    expect(longTextsOf({ a: 'one two', b: ['one two three four five six seven eight nine ten eleven twelve'], heroImage: { src: '/x' } })).toHaveLength(1)
    expect(pageWarnings(null)[0].blocking).toBe(true)
  })
})
