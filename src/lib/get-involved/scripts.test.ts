import { describe, expect, it } from 'vitest'
import { LINE_SLOT, PRICE_BLANK, lineLabelFor, lineSlotFor, splitOnSlot, fillPrice, hasBlank, introLine, renderScript, withoutLineSlot } from './scripts'

describe('introLine / {intro}', () => {
  const base = { business: 'DreamIt LiveIt', program: 'Vision Development', programLine: 'a 4-week online program for teens in foster care' }
  it('owner: business first, then the program', () => {
    expect(introLine(base)).toBe('I run DreamIt LiveIt, and one of our programs is Vision Development, a 4-week online program for teens in foster care')
  })
  it('same business and program name: no repetition', () => {
    expect(introLine({ ...base, business: 'Vision Development' })).toBe('I run Vision Development, a 4-week online program for teens in foster care')
  })
  it('main link: NowTransformed, not "I run"', () => {
    expect(introLine({ ...base, mainLink: true })).toMatch(/^I'm part of NowTransformed/)
  })
  it('someone else sharing: names the owner', () => {
    expect(introLine({ ...base, owns: false, ownerFirstName: 'Elizabeth' })).toBe('My friend Elizabeth runs DreamIt LiveIt, and one of their programs is Vision Development, a 4-week online program for teens in foster care')
  })
  it('renders inside a message', () => {
    const v = { ...base, firstName: 'Maria', personalLine: '', myName: 'Liz', link: '', sponsorship: false }
    expect(renderScript('Hi {first name}! {intro}. Would you be open to it?', v)).toBe('Hi Maria! I run DreamIt LiveIt, and one of our programs is Vision Development, a 4-week online program for teens in foster care. Would you be open to it?')
  })
})

describe('[[sponsor: ...]] blocks', () => {
  const v = { firstName: 'Maria', personalLine: '', myName: 'Liz', business: 'B', program: 'P', programLine: '', link: '', sponsorship: true }
  it('keeps the words when seats exist and drops them when not', () => {
    const t = "Free call first. [[sponsor: Some families get a sponsored seat, so ask about it.]] Want me to set it up?"
    expect(renderScript(t, v)).toBe('Free call first. Some families get a sponsored seat, so ask about it. Want me to set it up?')
    expect(renderScript(t, { ...v, sponsorship: false })).toBe('Free call first. Want me to set it up?')
  })
  it('a whole line that is only a block disappears cleanly', () => {
    expect(renderScript('Hi Maria\n[[sponsor: Seats may be sponsored.]]\nSee you?', { ...v, sponsorship: false })).toBe('Hi Maria\nSee you?')
  })
  it('checks flag promised seats and unknown blocks', async () => {
    const { scriptChecks } = await import('./scripts')
    const c = (body: string) => scriptChecks('POST', 'POST', { body: body + ' {link}' }).find((x) => x.id === 'blocks')
    expect(c('[[sponsor: You get a free sponsored seat.]]')?.ok).toBe(false)
    expect(c('[[sponsor: You might qualify for a sponsored seat.]]')?.ok).toBe(true)
    expect(c('[[other: x]]')?.ok).toBe(false)
  })
})

describe('endsWithQuestion', () => {
  it('texts must end on the question; emails may sign off after it', async () => {
    const { endsWithQuestion } = await import('./scripts')
    expect(endsWithQuestion('Hi\nWant the details?', 'SHORT')).toBe(true)
    expect(endsWithQuestion('Hi\nWant the details?\nThanks', 'SHORT')).toBe(false)
    expect(endsWithQuestion('Hi\n\nWant the details?\n\nThanks,\n{my name}', 'EMAIL')).toBe(true)
    expect(endsWithQuestion('Hi\n\nWant the details?\n\nThis is a much longer closing paragraph that is not a sign-off', 'EMAIL')).toBe(false)
  })
})

describe('{regular price}', () => {
  const base = { firstName: 'Maria', personalLine: '', myName: 'Ben', business: 'B', program: 'P', programLine: '', link: '', sponsorship: false }
  it('fills the owner price, or leaves a blank that blocks sending', () => {
    expect(renderScript('The regular price is {regular price}.', { ...base, regularPrice: '$200' })).toBe('The regular price is $200.')
    const blank = renderScript('The regular price is {regular price}.', base)
    expect(blank).toBe(`The regular price is ${PRICE_BLANK}.`)
    expect(hasBlank(blank)).toBe(true)
  })
  it('fills guide text too', () => {
    expect(fillPrice('It is {regular price} a month.', '$40')).toBe('It is $40 a month.')
    expect(fillPrice('It is {regular price}.', '  ')).toBe(`It is ${PRICE_BLANK}.`)
  })
})

describe('the "Why you thought of them" slot', () => {
  const base = { firstName: 'Maria', personalLine: LINE_SLOT, myName: 'Pervis', business: 'Verily Academy', program: 'Verily Academy', programLine: '', link: '', sponsorship: false }
  it('shows where the line goes while it is empty, and blocks sending as a blank', () => {
    const shown = renderScript('Hi {first name},\n\n{personal line}\n\nI run {program}.', base)
    expect(shown).toBe(`Hi Maria,\n\n${LINE_SLOT}\n\nI run Verily Academy.`)
    expect(hasBlank(shown)).toBe(true)
  })
  it('is taken out cleanly when the line is optional', () => {
    expect(withoutLineSlot(`Hi Maria,\n\n${LINE_SLOT}\n\nI run Verily Academy.`)).toBe('Hi Maria,\n\nI run Verily Academy.')
    expect(withoutLineSlot(`Hi Maria,\n\nI'm Pervis. ${LINE_SLOT}\n\nI run it.`)).toBe("Hi Maria,\n\nI'm Pervis.\n\nI run it.")
    expect(withoutLineSlot('No slot here.')).toBe('No slot here.')
  })
})

describe('a line of your own in every message type', () => {
  it('labels the spot for the situation', () => {
    expect(lineSlotFor('KNOW')).toBe(LINE_SLOT)
    expect(lineLabelFor('NEW')).toBe('How you came across them')
    expect(lineLabelFor('ASK_PRICE')).toBe(lineLabelFor('YES'))
    expect(lineSlotFor('FOLLOW_UP')).toBe('[Something new for them]')
  })
  it('takes out any unused spot, and highlights it in previews', () => {
    expect(withoutLineSlot(`Hi Maria, ${lineSlotFor('FOLLOW_UP')}\nJust checking in.`)).toBe('Hi Maria,\nJust checking in.')
    expect(splitOnSlot(`a ${lineSlotFor('LAST')} b`, lineSlotFor('LAST')).map((x) => x.slot)).toEqual([false, true, false])
  })
})
