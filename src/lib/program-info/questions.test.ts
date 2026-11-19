import { describe, expect, it } from 'vitest'
import {
  ALL_QUESTIONS,
  INFO_SECTIONS,
  REQUIRED_KEYS,
  SHARED_KEYS,
  answersAsText,
  costToPriceStrings,
  isAnswered,
  normalizePrice,
  parseAnswer,
  prefillPageAnswers,
  prefillSharedAnswers,
  priceString,
  priceStringsToCost,
} from './questions'

describe('question definitions', () => {
  it('has 5 sections, 10 required and 2 optional main questions', () => {
    expect(INFO_SECTIONS.map((s) => s.id)).toEqual(['short', 'who', 'offer', 'yes', 'about'])
    const main = INFO_SECTIONS.flatMap((s) => s.questions).filter((q) => !q.extraOf)
    expect(main).toHaveLength(12)
    expect(REQUIRED_KEYS).toHaveLength(10)
    expect(main.filter((q) => !q.required).map((q) => q.id)).toEqual(['quote', 'photosLink'])
  })
  it('gives every question an example except the tick box', () => {
    for (const q of ALL_QUESTIONS) if (q.kind !== 'checkbox') expect(q.example, q.id).not.toBe('')
  })
  it('marks the About you questions shared, and only those', () => {
    const shared = ALL_QUESTIONS.filter((q) => q.shared).map((q) => q.id)
    expect(shared).toEqual(['aboutYou', 'mustNotSay', 'photosLink'])
    for (const k of shared) expect(SHARED_KEYS).toContain(k)
  })
})

describe('answers', () => {
  it('validates by kind', () => {
    expect(parseAnswer('summary', '  Hello  ')).toEqual({ ok: true, key: 'summary', value: 'Hello' })
    expect(parseAnswer('nope', 'x').ok).toBe(false)
    expect(parseAnswer('photosLink', 'not a link').ok).toBe(false)
    expect(parseAnswer('photosLink', '').ok).toBe(true)
    expect(parseAnswer('quotePermission', 'yes').ok).toBe(false)
    expect(parseAnswer('cost', { price: '$30', frequency: 'monthly' }).ok).toBe(true)
    expect(parseAnswer('cost', { price: '$30', frequency: 'weekly' }).ok).toBe(false)
    expect(parseAnswer('summary', 'x'.repeat(1001)).ok).toBe(false)
  })
  it('counts an answer only when it is really filled in', () => {
    expect(isAnswered('summary', '   ')).toBe(false)
    expect(isAnswered('summary', 'Yes')).toBe(true)
    expect(isAnswered('cost', { price: '$30', frequency: null })).toBe(false)
    expect(isAnswered('cost', { price: '', frequency: 'once' })).toBe(false)
    expect(isAnswered('cost', { price: '$30', frequency: 'once' })).toBe(true)
    expect(isAnswered('quotePermission', false)).toBe(false)
  })
})

describe('cost -> price strings', () => {
  it('normalizes numbers and ranges', () => {
    expect(normalizePrice('197')).toBe('$197')
    expect(normalizePrice('$1,200')).toBe('$1,200')
    expect(normalizePrice('30-50')).toBe('$30 to $50')
    expect(normalizePrice('$30 to $50')).toBe('$30 to $50')
    expect(normalizePrice('30 – 50')).toBe('$30 to $50')
    expect(normalizePrice('depends on the plan')).toBe('depends on the plan')
    expect(normalizePrice('  ')).toBe('')
  })
  it('adds how often', () => {
    expect(priceString('30-50', 'monthly')).toBe('$30 to $50 a month')
    expect(priceString('99', 'yearly')).toBe('$99 a year')
    expect(priceString('197', 'once')).toBe('$197')
    expect(priceString('$40/month', 'monthly')).toBe('$40/month')
    expect(priceString('', 'monthly')).toBe('')
  })
  it('maps the answer to both columns, null when empty', () => {
    expect(costToPriceStrings({ price: '30-50', frequency: 'monthly', sponsoredPrice: '15' })).toEqual({ offerFullPrice: '$30 to $50 a month', offerSponsoredPrice: '$15 a month' })
    expect(costToPriceStrings({ price: '197', frequency: 'once' })).toEqual({ offerFullPrice: '$197', offerSponsoredPrice: null })
    expect(costToPriceStrings({ price: '', frequency: null })).toEqual({ offerFullPrice: null, offerSponsoredPrice: null })
  })
  it('stays within the 40-character column limit', () => {
    expect(priceString('x'.repeat(39), 'monthly').length).toBeLessThanOrEqual(40)
  })
  it('reads an existing price back', () => {
    expect(priceStringsToCost('$30 to $50 a month', '$15 a month')).toEqual({ price: '$30 to $50', frequency: 'monthly', sponsoredPrice: '$15' })
    expect(priceStringsToCost('$99 a year')).toEqual({ price: '$99', frequency: 'yearly' })
    expect(priceStringsToCost('$197')).toEqual({ price: '$197', frequency: null })
    expect(priceStringsToCost(null)).toBeNull()
  })
  it('round-trips', () => {
    const c = priceStringsToCost('$30 to $50 a month', '$15 a month')!
    expect(costToPriceStrings(c)).toEqual({ offerFullPrice: '$30 to $50 a month', offerSponsoredPrice: '$15 a month' })
  })
})

describe('prefill', () => {
  it('starts page answers from existing columns without overwriting', () => {
    const a = prefillPageAnswers({ programDescription: 'We help.', targetMarket: 'Parents', zoomUrl: 'https://zoom.us/j/1', offerFullPrice: '$30 a month' }, { audience: 'Teens' })
    expect(a.summary).toBe('We help.')
    expect(a.audience).toBe('Teens')
    expect(a.zoomUrl).toBe('https://zoom.us/j/1')
    expect(a.cost).toEqual({ price: '$30', frequency: 'monthly' })
  })
  it('falls back to the headline', () => {
    expect(prefillPageAnswers({ programDescription: '', headline: 'Short line' }).summary).toBe('Short line')
  })
  it('starts shared answers from the bio, else the invite why', () => {
    expect(prefillSharedAnswers({ name: 'P', organization: 'Co', coachBio: null, inviteWhy: 'Because' })).toEqual({ aboutYou: 'Because', programName: 'P', companyName: 'Co' })
  })
})

describe('plain text export', () => {
  it('lists every section and flags a quote without permission', () => {
    const t = answersAsText({ summary: 'We help.', quote: '"Great" Ana', cost: { price: '30', frequency: 'monthly' } }, { programName: 'Fin', audienceLabel: 'Families' })
    expect(t).toContain('Group: Families')
    expect(t).toContain('## 5. About you (shared by all pages)')
    expect(t).toContain('$30 a month')
    expect(t).toContain('do not use this quote')
  })
})
