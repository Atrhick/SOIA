import { describe, expect, it } from 'vitest'
import { messagePreview } from './message-preview'

describe('messagePreview', () => {
  it('names the business first, then the program and its line', () => {
    expect(messagePreview({ businessName: 'DreamIt LiveIt', programName: 'Vision Development', messageLine: 'a 4-week online program for teens.' }))
      .toBe('I run DreamIt LiveIt, and one of our programs is Vision Development: a 4-week online program for teens.')
  })
  it('falls back to the program name and leaves out an empty line', () => {
    expect(messagePreview({ businessName: '  ', programName: 'Vision Development', messageLine: '' }))
      .toBe('I run Vision Development, and one of our programs is Vision Development.')
  })
  it('tidies spaces', () => {
    expect(messagePreview({ businessName: ' A  B ', programName: 'P', messageLine: ' x   y ' })).toBe('I run A B, and one of our programs is P: x y.')
  })
})
