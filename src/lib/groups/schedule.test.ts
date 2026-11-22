import { describe, it, expect } from 'vitest'
import { buildWeeklySchedule, zonedTimeToUtc, parseHHMM } from './schedule'

describe('zonedTimeToUtc', () => {
  it('handles New York winter and summer', () => {
    expect(zonedTimeToUtc(2026, 1, 15, 18, 0, 'America/New_York').toISOString()).toBe('2026-01-15T23:00:00.000Z')
    expect(zonedTimeToUtc(2026, 7, 15, 18, 0, 'America/New_York').toISOString()).toBe('2026-07-15T22:00:00.000Z')
  })
  it('handles zones east of UTC', () => {
    expect(zonedTimeToUtc(2026, 1, 15, 9, 30, 'Asia/Kolkata').toISOString()).toBe('2026-01-15T04:00:00.000Z')
  })
})

describe('buildWeeklySchedule', () => {
  it('starts on the first matching weekday and makes 8 weeks by default count', () => {
    // 2026-11-22 is a Sunday; Tuesday = 2
    const s = buildWeeklySchedule({ startDate: '2026-11-22', weekday: 2, time: '18:00', timezone: 'America/New_York', durationMin: 60, weeks: 8 })
    expect(s).toHaveLength(8)
    expect(s[0].weekNo).toBe(1)
    expect(s[0].startsAt.toISOString()).toBe('2026-11-24T23:00:00.000Z')
    expect(s[0].endsAt.toISOString()).toBe('2026-11-25T00:00:00.000Z')
    expect(s[7].startsAt.toISOString()).toBe('2027-01-12T23:00:00.000Z')
  })
  it('keeps the same local time across the spring DST change', () => {
    // US DST starts Sunday 2027-03-14. Thursdays 18:00 New York.
    const s = buildWeeklySchedule({ startDate: '2027-03-04', weekday: 4, time: '18:00', timezone: 'America/New_York', durationMin: 90, weeks: 3 })
    expect(s.map((m) => m.startsAt.toISOString())).toEqual([
      '2027-03-04T23:00:00.000Z',
      '2027-03-11T23:00:00.000Z',
      '2027-03-18T22:00:00.000Z',
    ])
    expect(s[2].endsAt.toISOString()).toBe('2027-03-18T23:30:00.000Z')
  })
  it('keeps the same local time across the autumn DST change (meeting on the change day)', () => {
    // US DST ends Sunday 2026-11-01. Sundays 10:00 Los Angeles.
    const s = buildWeeklySchedule({ startDate: '2026-10-25', weekday: 0, time: '10:00', timezone: 'America/Los_Angeles', durationMin: 60, weeks: 2 })
    expect(s[0].startsAt.toISOString()).toBe('2026-10-25T17:00:00.000Z')
    expect(s[1].startsAt.toISOString()).toBe('2026-11-01T18:00:00.000Z')
  })
  it('rejects bad input', () => {
    expect(() => buildWeeklySchedule({ startDate: '2026-11-22', weekday: 1, time: '25:00', timezone: 'America/New_York', durationMin: 60, weeks: 1 })).toThrow()
    expect(() => buildWeeklySchedule({ startDate: '2026-11-22', weekday: 1, time: '10:00', timezone: 'Nowhere/Land', durationMin: 60, weeks: 1 })).toThrow()
    expect(parseHHMM('7:00')).toBeNull()
  })
})
