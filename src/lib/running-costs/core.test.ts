import { describe, expect, it } from 'vitest'
import { computeTotals, filledAmounts, formatMoney, groupByCategory, inScope } from './core'
import { aiRange, costPerTry, estimateAiMonthly, RETRY_FACTOR } from './ai'

const row = (status: string, lo: number | null, ex: number | null, hi: number | null) => ({
  status, monthlyLow: lo, monthlyExpected: ex, monthlyHigh: hi,
})

describe('filledAmounts', () => {
  it('keeps all three when given', () => {
    expect(filledAmounts(row('IN_USE', 1, 2, 3))).toEqual({ low: 1, expected: 2, high: 3 })
  })
  it('uses the middle of low and high when expected is blank', () => {
    expect(filledAmounts(row('IN_USE', 10, null, 30))).toEqual({ low: 10, expected: 20, high: 30 })
  })
  it('fills low and high from expected', () => {
    expect(filledAmounts(row('IN_USE', null, 5, null))).toEqual({ low: 5, expected: 5, high: 5 })
  })
  it('counts an empty row as zero', () => {
    expect(filledAmounts(row('IN_USE', null, null, null))).toEqual({ low: 0, expected: 0, high: 0 })
  })
})

describe('computeTotals', () => {
  const rows = [row('IN_USE', 1, 2, 3), row('PLANNED', 10, 20, 30), row('SUGGESTED', 100, 200, 300)]
  it('defaults to in use + planned', () => {
    expect(computeTotals(rows)).toEqual({ low: 11, expected: 22, high: 33, yearlyExpected: 264, count: 2 })
  })
  it('in use only', () => {
    expect(computeTotals(rows, 'IN_USE')).toMatchObject({ expected: 2, count: 1 })
  })
  it('everything', () => {
    expect(computeTotals(rows, 'ALL')).toMatchObject({ low: 111, expected: 222, high: 333, yearlyExpected: 2664 })
  })
  it('rounds to cents', () => {
    expect(computeTotals([row('IN_USE', 0.1, 0.1, 0.2), row('IN_USE', 0.2, 0.2, 0.1)]).expected).toBe(0.3)
  })
  it('inScope', () => {
    expect(inScope('SUGGESTED', 'IN_USE_AND_PLANNED')).toBe(false)
    expect(inScope('PLANNED', 'IN_USE')).toBe(false)
  })
})

describe('groupByCategory', () => {
  it('keeps the fixed order, sorts rows, puts unknown categories last', () => {
    const groups = groupByCategory([
      { category: 'AI', sortOrder: 2, service: 'b' },
      { category: 'OTHER', sortOrder: 0, service: 'x' },
      { category: 'HOSTING', sortOrder: 0, service: 'a' },
      { category: 'AI', sortOrder: 1, service: 'c' },
    ])
    expect(groups.map((g) => g.key)).toEqual(['HOSTING', 'AI', 'OTHER'])
    expect(groups[1].rows.map((r) => r.service)).toEqual(['c', 'b'])
    expect(groups[0].label).toBe('Hosting')
  })
})

describe('formatMoney', () => {
  it('formats', () => {
    expect(formatMoney(12)).toBe('$12')
    expect(formatMoney(1234.5)).toBe('$1,234.50')
    expect(formatMoney(0.4)).toBe('$0.40')
    expect(formatMoney(0)).toBe('$0')
  })
})

describe('AI calculator', () => {
  it('prices one try from tokens', () => {
    // 1M in at $2 + 1M out at $10
    expect(costPerTry({ inputTokens: 1_000_000, outputTokens: 1_000_000 }, { inputPerMillion: 2, outputPerMillion: 10 })).toBe(12)
  })
  it('estimates a month on Sonnet 5.5', () => {
    const e = estimateAiMonthly({ pages: 1, welcome: 0, messages: 0 }, 'claude-sonnet-5-5')
    // page: 6,000 in x $2 + 5,000 out x $10 = $0.062, times the retry factor
    expect(e.lines[0].cost).toBeCloseTo(0.062 * RETRY_FACTOR, 6)
    expect(e.total).toBeCloseTo(0.093, 6)
  })
  it('ignores negative, blank and fractional counts', () => {
    const e = estimateAiMonthly({ pages: -3, welcome: Number.NaN, messages: 2.7 }, 'claude-haiku-5-5')
    expect(e.lines.map((l) => l.count)).toEqual([0, 0, 2])
  })
  it('falls back to the default model for an unknown id', () => {
    expect(estimateAiMonthly({}, 'nope').model.id).toBe('claude-sonnet-5-5')
  })
  it('Opus costs twice Sonnet, ranges go up', () => {
    const s = aiRange('claude-sonnet-5-5')
    const o = aiRange('claude-opus-5-5')
    expect(o.expected).toBeCloseTo(s.expected * 2, 1)
    expect(s.low).toBeLessThan(s.expected)
    expect(s.expected).toBeLessThan(s.high)
  })
})
