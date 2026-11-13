import { describe, expect, it } from 'vitest'
import { formToGuide, generalKey, guideProblem, guideToForm, insertAt, isMinorOn, linkFor, parseGeneralKey, sourceLabel } from './helpers'

describe('general keys', () => {
  it('round-trips scenario:variant', () => {
    expect(parseGeneralKey(generalKey('KNOW', 'EMAIL'))).toEqual({ scenario: 'KNOW', variant: 'EMAIL' })
  })
  it('ignores old channel keys and junk', () => {
    expect(parseGeneralKey('TEXT')).toBeNull()
    expect(parseGeneralKey('AFTER_YES')).toBeNull()
    expect(parseGeneralKey('KNOW:SMS')).toBeNull()
    expect(parseGeneralKey('NOPE:SHORT')).toBeNull()
  })
})

describe('isMinorOn', () => {
  const now = new Date('2026-11-12T12:00:00Z')
  it('is false without a date of birth', () => expect(isMinorOn(null, now)).toBe(false))
  it('turns 18 on the birthday', () => {
    expect(isMinorOn('2008-11-12T00:00:00Z', now)).toBe(false)
    expect(isMinorOn('2008-11-13T00:00:00Z', now)).toBe(true)
  })
  it('handles teens and adults', () => {
    expect(isMinorOn(new Date('2012-01-01'), now)).toBe(true)
    expect(isMinorOn(new Date('1990-06-01'), now)).toBe(false)
  })
  it('ignores bad dates', () => expect(isMinorOn('not a date', now)).toBe(false))
})

describe('sourceLabel', () => {
  it('says who wrote it', () => {
    expect(sourceLabel('OWNER', 'Vision Development')).toBe('Written by you')
    expect(sourceLabel('PROGRAM', 'Vision Development')).toBe('Written for Vision Development')
    expect(sourceLabel('GENERAL', 'Vision Development')).toBe('General message')
    expect(sourceLabel('PROGRAM', null)).toBe('General message')
  })
})

describe('guide form', () => {
  it('round-trips and tidies points', () => {
    const g = formToGuide({ summary: '  For foster parents. ', sections: [{ title: ' Who decides ', points: '- The parent\n\n• The teen takes part \n' }, { title: '', points: '  ' }] })
    expect(g).toEqual({ summary: 'For foster parents.', sections: [{ title: 'Who decides', points: ['The parent', 'The teen takes part'] }] })
    expect(formToGuide(guideToForm(g))).toEqual(g)
  })
  it('starts empty with one section', () => {
    expect(guideToForm(null)).toEqual({ summary: '', sections: [{ title: '', points: '' }] })
  })
})

describe('guideProblem', () => {
  const ok = { summary: 'Who it is for.', sections: [{ title: 'Pitch', points: ['Sell the call.'] }] }
  it('accepts a good guide', () => expect(guideProblem(ok)).toBeNull())
  it('says what is missing', () => {
    expect(guideProblem({ ...ok, summary: ' ' })).toMatch(/summary/)
    expect(guideProblem({ ...ok, sections: [] })).toMatch(/at least one section/)
    expect(guideProblem({ ...ok, sections: [{ title: '', points: ['x'] }] })).toMatch(/Section 1 needs a title/)
    expect(guideProblem({ ...ok, sections: [{ title: 'Pitch', points: [] }] })).toMatch(/"Pitch" needs at least one point/)
    expect(guideProblem({ ...ok, summary: 'x'.repeat(601) })).toMatch(/under 600/)
    expect(guideProblem({ summary: 1 })).toMatch(/shape/)
  })
})

describe('insertAt', () => {
  it('adds spaces around a fill-in when needed', () => {
    expect(insertAt('Hi!', 2, 2, '{first name}')).toEqual({ text: 'Hi {first name}!', cursor: 15 })
    expect(insertAt('Hi ', 3, 3, '{first name}').text).toBe('Hi {first name}')
    expect(insertAt('', 0, 0, '{link}')).toEqual({ text: '{link}', cursor: 6 })
  })
  it('replaces a selection', () => {
    expect(insertAt('Hi NAME, hello', 3, 7, '{first name}').text).toBe('Hi {first name}, hello')
  })
})

describe('linkFor', () => {
  it('adds the channel and drops an old query', () => {
    expect(linkFor('https://x.org/join/a/b?via=dm', 'EMAIL')).toBe('https://x.org/join/a/b?via=email')
    expect(linkFor('https://x.org/join/a', 'SHORT')).toBe('https://x.org/join/a?via=text')
  })
})
