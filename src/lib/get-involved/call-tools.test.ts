import { describe, it, expect } from 'vitest'
import { buildIcs, callStats, icsEscape, startOfBusinessDay } from './call-tools'

// Monday 2026-11-09 08:00 Central (14:00 UTC)
const NOW = new Date('2026-11-09T14:00:00Z')

describe('buildIcs', () => {
  const ics = buildIcs({
    uid: 'discovery-abc@nowtransformed',
    startsAt: new Date('2026-11-12T20:00:00Z'),
    endsAt: new Date('2026-11-12T20:30:00Z'),
    title: 'Discovery call with Lina Lopez',
    description: 'Line one, with comma; and semicolon\nJoin: https://zoom.us/j/1',
    url: 'https://zoom.us/j/1',
    now: NOW,
  })

  it('is a valid single-event calendar with UTC times and CRLF lines', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true)
    expect(ics).toContain('DTSTART:20261112T200000Z\r\n')
    expect(ics).toContain('DTEND:20261112T203000Z\r\n')
    expect(ics).toContain('DTSTAMP:20261109T140000Z\r\n')
    expect(ics).toContain('LOCATION:https://zoom.us/j/1')
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true)
    expect(ics.split('\r\n').every((l) => l.length <= 75)).toBe(true)
  })

  it('escapes text values', () => {
    expect(icsEscape('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne')
    expect(ics).toContain('Line one\\, with comma\\; and semicolon\\nJoin')
  })

  it('leaves out the location when there is no link', () => {
    const plain = buildIcs({ uid: 'x', startsAt: NOW, endsAt: NOW, title: 't', description: 'd', url: null, now: NOW })
    expect(plain).not.toContain('LOCATION')
  })
})

describe('callStats', () => {
  const c = (startsAt: string, status: string) => ({ startsAt, status })
  it('counts today, this week, needs an outcome and show-up rate in Central time', () => {
    const s = callStats([
      c('2026-11-09T13:00:00Z', 'BOOKED'), // today 7 AM, started: needs an outcome
      c('2026-11-09T20:00:00Z', 'BOOKED'), // today 2 PM
      c('2026-11-10T03:00:00Z', 'BOOKED'), // Mon 9 PM CT: still today
      c('2026-11-15T20:00:00Z', 'BOOKED'), // Sunday: this week
      c('2026-11-16T20:00:00Z', 'BOOKED'), // next Monday
      c('2026-11-05T20:00:00Z', 'KEPT'),
      c('2026-11-04T20:00:00Z', 'KEPT'),
      c('2026-11-03T20:00:00Z', 'KEPT'),
      c('2026-11-02T20:00:00Z', 'NO_SHOW'),
      c('2026-11-01T20:00:00Z', 'CANCELLED'),
      c('2026-09-01T20:00:00Z', 'NO_SHOW'), // older than 30 days
    ], NOW)
    expect(s).toEqual({ today: 3, thisWeek: 4, needOutcome: 1, showUpRate: 75 })
  })

  it('has no show-up rate without finished calls', () => {
    expect(callStats([], NOW).showUpRate).toBeNull()
  })
})

describe('startOfBusinessDay', () => {
  it('is Central midnight', () => {
    expect(startOfBusinessDay(NOW).toISOString()).toBe('2026-11-09T06:00:00.000Z')
    // 2026-11-09T03:00Z is still Nov 8 in Chicago
    expect(startOfBusinessDay(new Date('2026-11-09T03:00:00Z')).toISOString()).toBe('2026-11-08T06:00:00.000Z')
  })
})
