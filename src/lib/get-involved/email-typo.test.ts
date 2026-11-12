import { describe, expect, it } from 'vitest'
import { suggestEmail } from './email-typo'

describe('suggestEmail', () => {
  it('fixes common domain typos and keeps the local part', () => {
    expect(suggestEmail('sarah@gmial.com')).toBe('sarah@gmail.com')
    expect(suggestEmail('Sarah.Lee@gmail.co')).toBe('Sarah.Lee@gmail.com')
    expect(suggestEmail('a@yaho.com')).toBe('a@yahoo.com')
    expect(suggestEmail('a@hotmial.com')).toBe('a@hotmail.com')
    expect(suggestEmail('a@outlok.com')).toBe('a@outlook.com')
  })
  it('ignores case and surrounding spaces in the domain', () => {
    expect(suggestEmail('  bob@GMIAL.COM ')).toBe('bob@gmail.com')
  })
  it('returns null for correct or unknown domains', () => {
    expect(suggestEmail('sarah@gmail.com')).toBeNull()
    expect(suggestEmail('sarah@example.org')).toBeNull()
  })
  it('returns null for incomplete input', () => {
    expect(suggestEmail('')).toBeNull()
    expect(suggestEmail('sarah')).toBeNull()
    expect(suggestEmail('@gmial.com')).toBeNull()
    expect(suggestEmail('sarah@')).toBeNull()
  })
})
