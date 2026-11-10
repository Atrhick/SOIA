import { describe, expect, it } from 'vitest'
import {
  ageOn, boardHref, boardToCsv, businessDayStart, isYouthAmbassador, memberKind, onBoard, parseBoard, parsePeriod, periodOptions, streakAsOf,
} from './leaderboard-period'

// 2026-11-09 15:00 UTC = 09:00 Central.
const NOW = new Date('2026-11-09T15:00:00Z')

describe('parsePeriod', () => {
  it('defaults to the current month (also for the old "month" value and junk)', () => {
    for (const v of [undefined, '', 'month', 'nonsense', '2026-13']) {
      const p = parsePeriod(v, NOW)
      expect(p.key).toBe('2026-11')
      expect(p.current).toBe(true)
      expect(p.to).toBeNull()
      expect(p.from?.toISOString()).toBe('2026-11-01T05:00:00.000Z') // midnight Central (CDT ends Nov 1 at 2 AM)
    }
  })
  it('all time has no bounds', () => {
    expect(parsePeriod('all', NOW)).toMatchObject({ key: 'all', from: null, to: null, label: 'All time' })
  })
  it('a past month is bounded by Central-time month starts', () => {
    const p = parsePeriod('2026-10', NOW)
    expect(p).toMatchObject({ key: '2026-10', label: 'October 2026', current: false })
    expect(p.from?.toISOString()).toBe('2026-10-01T05:00:00.000Z')
    expect(p.to?.toISOString()).toBe('2026-11-01T05:00:00.000Z')
  })
  it('December rolls into the next year', () => {
    const p = parsePeriod('2025-12', NOW)
    expect(p.to?.toISOString()).toBe('2026-01-01T06:00:00.000Z')
  })
  it('a future month falls back to the current one', () => {
    expect(parsePeriod('2027-01', NOW).key).toBe('2026-11')
  })
  it('uses the Central-time month at a UTC month boundary', () => {
    // 2026-12-01 03:00 UTC is still Nov 30 in Central time.
    expect(parsePeriod(undefined, new Date('2026-12-01T03:00:00Z')).key).toBe('2026-11')
  })
})

describe('streakAsOf', () => {
  it('is now for the current month and the last moment of a past month', () => {
    expect(streakAsOf(parsePeriod(undefined, NOW), NOW)).toBe(NOW)
    expect(streakAsOf(parsePeriod('all', NOW), NOW)).toBe(NOW)
    expect(streakAsOf(parsePeriod('2026-10', NOW), NOW).toISOString()).toBe('2026-11-01T04:59:59.999Z')
  })
})

describe('periodOptions', () => {
  it('lists months newest first from the first invite, then All time', () => {
    const o = periodOptions(new Date('2026-09-15T12:00:00Z'), NOW)
    expect(o.map((x) => x.value)).toEqual(['2026-11', '2026-10', '2026-09', 'all'])
    expect(o[0].label).toBe('November 2026')
  })
  it('caps the list and handles no invites', () => {
    expect(periodOptions(new Date('2020-01-01T12:00:00Z'), NOW, 3).map((x) => x.value)).toEqual(['2026-11', '2026-10', '2026-09', 'all'])
    expect(periodOptions(null, NOW).map((x) => x.value)).toEqual(['2026-11', 'all'])
  })
  it('always offers the month on screen, in date order', () => {
    expect(periodOptions(null, NOW, 24, parsePeriod('2026-08', NOW)).map((x) => x.value)).toEqual(['2026-11', '2026-08', 'all'])
    expect(periodOptions(null, NOW, 24, parsePeriod('all', NOW)).map((x) => x.value)).toEqual(['2026-11', 'all'])
  })
})

describe('boards', () => {
  it('parses the board and falls back to Overall', () => {
    expect(parseBoard('YOUTH')).toBe('YOUTH')
    expect(parseBoard('PARENT')).toBe('ALL')
    expect(parseBoard(undefined)).toBe('ALL')
  })
  it('youth = joined as Youth ambassador or 17 and under; coaches never', () => {
    expect(isYouthAmbassador({ role: 'AMBASSADOR', journeyRole: 'YOUTH_AMBASSADOR', dateOfBirth: null }, NOW)).toBe(true)
    expect(isYouthAmbassador({ role: 'AMBASSADOR', journeyRole: null, dateOfBirth: new Date('2010-01-01') }, NOW)).toBe(true)
    expect(isYouthAmbassador({ role: 'AMBASSADOR', journeyRole: 'AMBASSADOR', dateOfBirth: new Date('2000-01-01') }, NOW)).toBe(false)
    expect(isYouthAmbassador({ role: 'COACH', journeyRole: 'YOUTH_AMBASSADOR', dateOfBirth: null }, NOW)).toBe(false)
    expect(memberKind({ role: 'COACH', journeyRole: null, dateOfBirth: null }, NOW)).toBe('COACH')
  })
  it('turns 18 on the birthday', () => {
    expect(ageOn(new Date('2008-11-09'), NOW)).toBe(18)
    expect(ageOn(new Date('2008-11-10'), NOW)).toBe(17)
  })
  it('tabs do not overlap; Overall shows everyone', () => {
    expect(onBoard('AMBASSADOR', 'YOUTH')).toBe(false)
    expect(onBoard('YOUTH', 'YOUTH')).toBe(true)
    expect(onBoard('ALL', 'COACH')).toBe(true)
  })
  it('builds encoded URLs', () => {
    expect(boardHref('/admin/one-a-day/export', 'YOUTH', '2026-10')).toBe('/admin/one-a-day/export?role=YOUTH&period=2026-10')
  })
})

describe('businessDayStart', () => {
  it('is midnight Central today', () => {
    expect(businessDayStart(NOW).toISOString()).toBe('2026-11-09T06:00:00.000Z')
    expect(businessDayStart(new Date('2026-11-10T03:00:00Z')).toISOString()).toBe('2026-11-09T06:00:00.000Z')
  })
})

describe('boardToCsv', () => {
  it('quotes every cell, defuses formulas and uses CRLF with a BOM', () => {
    const csv = boardToCsv([
      { userId: 'u1', rank: 1, name: '=HYPERLINK("http://x")', kind: 'YOUTH', joined: 2, forms: 5, callsKept: 1, streak: 3, teamSize: 4 },
      { userId: 'u2', rank: 2, name: 'Ann "A" Lee', kind: 'COACH', joined: 0, forms: 1, callsKept: 0, streak: 0, teamSize: 0 },
    ], 'October 2026', 'Overall')
    expect(csv.startsWith('﻿')).toBe(true)
    const lines = csv.slice(1).split('\r\n')
    expect(lines[0]).toBe('"One-A-Day leaderboard","Overall","October 2026"')
    expect(lines[1]).toBe('"Rank","Name","Role","Joined","Forms","Calls kept","Streak (days)","Team size"')
    expect(lines[2]).toBe('"1","\'=HYPERLINK(""http://x"")","Youth ambassador","2","5","1","3","4"')
    expect(lines[3]).toBe('"2","Ann ""A"" Lee","Coach","0","1","0","0","0"')
    expect(lines[4]).toBe('')
  })
})
