import { describe, expect, it } from 'vitest'
import { decideInvites, decisionText, isValidEmail, normaliseEmail, parsePastedList, summaryText, withoutClosingQuestion, type InviteContext } from './outreach-invites'

const ctx = (o: Partial<InviteContext> = {}): InviteContext => ({ usedToday: 0, recent: new Set(), stopped: new Set(), onList: new Map(), ...o })

describe('parsePastedList', () => {
  it('reads the common shapes', () => {
    const r = parsePastedList('Maria, Maria@X.com\nmaria2@x.com\nJames Lee <james@x.com>\njo@x.com, Jo\nliz\tliz@x.com\n\nno email here')
    expect(r.people).toEqual([
      { firstName: 'Maria', email: 'maria@x.com' },
      { firstName: '', email: 'maria2@x.com' },
      { firstName: 'James', email: 'james@x.com' },
      { firstName: 'Jo', email: 'jo@x.com' },
      { firstName: 'Liz', email: 'liz@x.com' },
    ])
    expect(r.unreadable).toEqual(['no email here'])
  })
})

describe('emails', () => {
  it('normalises and validates', () => {
    expect(normaliseEmail('  A@B.COM ')).toBe('a@b.com')
    expect(isValidEmail('a@b.com')).toBe(true)
    expect(isValidEmail('a@b')).toBe(false)
    expect(isValidEmail('a b@c.com')).toBe(false)
  })
})

describe('decideInvites', () => {
  it('sends, flags fixable problems and dedupes', () => {
    const d = decideInvites([
      { firstName: 'maria', email: 'Maria@x.com' },
      { firstName: 'Maria', email: 'maria@x.com' },
      { firstName: '', email: 'n@x.com' },
      { firstName: 'Bad', email: 'bad@' },
      { firstName: 'Liz', email: 'liz@gmial.com' },
    ], ctx())
    expect(d.map((x) => x.action)).toEqual(['SEND', 'FIX', 'FIX', 'FIX', 'FIX'])
    expect(d[0]).toMatchObject({ firstName: 'Maria', email: 'maria@x.com' })
    expect(d[1]).toMatchObject({ problem: 'DUPLICATE' })
    expect(d[2]).toMatchObject({ problem: 'NO_NAME' })
    expect(d[3]).toMatchObject({ problem: 'BAD_EMAIL' })
    expect(d[4]).toMatchObject({ problem: 'TYPO', suggestion: 'liz@gmail.com' })
  })

  it('skips stopped, listed and recent, in that order, and never uses the limit for them', () => {
    const d = decideInvites([
      { firstName: 'A', email: 'a@x.com' }, { firstName: 'B', email: 'b@x.com' }, { firstName: 'C', email: 'c@x.com' }, { firstName: 'D', email: 'd@x.com' }, { firstName: 'E', email: 'e@x.com' },
    ], ctx({ usedToday: 19, stopped: new Set(['a@x.com']), onList: new Map([['b@x.com', false], ['a@x.com', true]]), recent: new Set(['c@x.com']) }))
    expect(d.map((x) => (x.action === 'SKIP' ? x.reason : x.action))).toEqual(['STOPPED', 'ON_LIST', 'RECENT', 'SEND', 'LIMIT'])
  })

  it('at the limit, every address reads LIMIT first, so known addresses cannot be tested for free', () => {
    const d = decideInvites([{ firstName: 'A', email: 'a@x.com' }, { firstName: 'B', email: 'b@x.com' }, { firstName: 'C', email: 'c@x.com' }],
      ctx({ usedToday: 20, stopped: new Set(['a@x.com']), onList: new Map([['b@x.com', false]]) }))
    expect(d.map((x) => (x.action === 'SKIP' ? x.reason : x.action))).toEqual(['LIMIT', 'LIMIT', 'LIMIT'])
  })

  it('member text never reveals stopped or someone else\'s person', () => {
    const d = decideInvites([{ firstName: 'A', email: 'a@x.com' }, { firstName: 'B', email: 'b@x.com' }, { firstName: 'C', email: 'c@x.com' }, { firstName: 'M', email: 'm@x.com' }],
      ctx({ stopped: new Set(['a@x.com']), onList: new Map([['b@x.com', false], ['m@x.com', true]]), recent: new Set(['c@x.com']) }))
    const t = d.map((x) => decisionText(x).text.replace(/^\w+: /, ''))
    expect(t[0]).toBe(t[1])
    expect(t[1]).toBe(t[2])
    expect(t[3]).toMatch(/your list/)
  })

  it('limit reached says so', () => {
    const d = decideInvites([{ firstName: 'A', email: 'a@x.com' }], ctx({ usedToday: 20 }))
    expect(decisionText(d[0]).text).toMatch(/limit reached/i)
  })
})

describe('summaryText', () => {
  it('names up to two people', () => {
    const d = decideInvites([{ firstName: 'Maria', email: 'm@x.com' }, { firstName: 'James', email: 'j@x.com' }, { firstName: 'X', email: 'bad' }], ctx())
    expect(summaryText(d)).toEqual({ ok: true, text: 'Sent to Maria and James ✓ · 1 not sent (see below)' })
  })
})

describe('withoutClosingQuestion', () => {
  it('drops only the final question sentence', () => {
    expect(withoutClosingQuestion('Hi Maria,\n\nIt is great. The first step is a free call. Would you be open to it?')).toBe('Hi Maria,\n\nIt is great. The first step is a free call.')
    expect(withoutClosingQuestion('Hi,\n\nText.\n\nWould you be open to a quick call?\nElizabeth')).toBe('Hi,\n\nText.\n\nWould you be open to a quick call?\nElizabeth')
    expect(withoutClosingQuestion('Hi,\n\nText.\n\nWould you be open to it?')).toBe('Hi,\n\nText.')
    expect(withoutClosingQuestion('No question here.')).toBe('No question here.')
  })
})
