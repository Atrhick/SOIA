import { describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/prisma', () => ({ default: {} }))
import { parseDraftInput } from './drafts'
import { pageName, yourPageName, publicPagePath } from './paths'

const NOTE = 'Bright Futures helps teens find direction and confidence through weekly group sessions and check-ins.'

describe('draft input', () => {
  it('needs something', () => {
    expect(parseDraftInput({})).toEqual({ ok: false, error: 'The draft is empty' })
  })
  it('checks the page against the page format', () => {
    const r = parseDraftInput({ offerPage: { hook: 'x' } })
    expect(r.ok).toBe(false)
  })
  it('cleans the welcome paragraph and the invitation line', () => {
    const r = parseDraftInput({ welcomeNote: `"${NOTE}"`, messageLine: '  a program for teens.  ' })
    expect(r).toEqual({ ok: true, data: { welcomeNote: NOTE, messageLine: 'a program for teens' } })
  })
  it('refuses a too-short paragraph or a long line', () => {
    expect(parseDraftInput({ welcomeNote: 'Too short' }).ok).toBe(false)
    expect(parseDraftInput({ messageLine: 'x'.repeat(161) }).ok).toBe(false)
  })
})

describe('names and links', () => {
  it('never says "null page" (A2)', () => {
    expect(pageName(null, 'Financial Empowerment')).toBe('Financial Empowerment page')
    expect(yourPageName({ audienceLabel: 'Families', programName: 'X' })).toBe('your Families page')
    expect(yourPageName({ audienceLabel: '  ', programName: 'X' })).toBe('your X page')
  })
  it('prefers the /join link', () => {
    expect(publicPagePath('fin-families', 'justin')).toBe('/join/justin/fin-families')
    expect(publicPagePath('fin', null)).toBe('/p/fin')
  })
})
