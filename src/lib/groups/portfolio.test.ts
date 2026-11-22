import { describe, it, expect } from 'vitest'
import { currentWeek } from './current-week'
import { checkPortfolioFile, sniffPortfolioFile } from './portfolio-file'

const day = 24 * 60 * 60 * 1000
const start = new Date('2026-11-02T18:00:00Z')

describe('currentWeek', () => {
  it('is null before the start', () => {
    expect(currentWeek(start, 8, new Date(start.getTime() - 1))).toBeNull()
  })
  it('is week 1 on the start and for 7 days', () => {
    expect(currentWeek(start, 8, start)).toBe(1)
    expect(currentWeek(start, 8, new Date(start.getTime() + 7 * day - 1))).toBe(1)
  })
  it('moves to week 2 after 7 days', () => {
    expect(currentWeek(start, 8, new Date(start.getTime() + 7 * day))).toBe(2)
  })
  it('is the last week up to its end, then null', () => {
    expect(currentWeek(start, 8, new Date(start.getTime() + 56 * day - 1))).toBe(8)
    expect(currentWeek(start, 8, new Date(start.getTime() + 56 * day))).toBeNull()
  })
  it('handles zero weeks and bad dates', () => {
    expect(currentWeek(start, 0, start)).toBeNull()
    expect(currentWeek(new Date('nope'), 8, start)).toBeNull()
  })
})

const bytes = (...b: (number | string)[]) =>
  new Uint8Array(b.flatMap((x) => (typeof x === 'string' ? x.split('').map((c) => c.charCodeAt(0)) : [x])))

describe('portfolio file checks', () => {
  const jpg = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0)
  const png = bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a)
  const webp = bytes('RIFF', 0, 0, 0, 0, 'WEBP')
  const pdf = bytes('%PDF-1.7')
  it('sniffs each allowed type', () => {
    expect(sniffPortfolioFile(jpg)?.ext).toBe('jpg')
    expect(sniffPortfolioFile(png)?.ext).toBe('png')
    expect(sniffPortfolioFile(webp)?.ext).toBe('webp')
    expect(sniffPortfolioFile(pdf)?.ext).toBe('pdf')
    expect(sniffPortfolioFile(bytes('<html>'))).toBeNull()
  })
  it('accepts matching name and content', () => {
    expect(checkPortfolioFile('me.JPEG', jpg)).toEqual({ ext: 'jpg', contentType: 'image/jpeg' })
    expect(checkPortfolioFile('essay.pdf', pdf)).toMatchObject({ ext: 'pdf' })
  })
  it('rejects wrong extension, renamed files, empty and too big', () => {
    expect(checkPortfolioFile('x.exe', jpg)).toHaveProperty('error')
    expect(checkPortfolioFile('x.pdf', jpg)).toHaveProperty('error')
    expect(checkPortfolioFile('x.png', bytes('<svg>'))).toHaveProperty('error')
    expect(checkPortfolioFile('x.png', new Uint8Array())).toHaveProperty('error')
    expect(checkPortfolioFile('x.pdf', new Uint8Array(10 * 1024 * 1024 + 1))).toHaveProperty('error')
  })
})
