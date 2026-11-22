import { describe, it, expect } from 'vitest'
import { buildGroupIcs } from './ics'

describe('buildGroupIcs', () => {
  it('writes one event per meeting with UTC times', () => {
    const ics = buildGroupIcs({
      name: 'Spring, group',
      meetingLink: 'https://zoom.us/j/1',
      now: new Date('2026-11-22T00:00:00Z'),
      meetings: [
        { id: 'a', weekNo: 1, startsAt: new Date('2026-11-24T23:00:00Z'), endsAt: new Date('2026-11-25T00:00:00Z'), cancelled: false },
        { id: 'b', weekNo: 2, startsAt: new Date('2026-12-01T23:00:00Z'), endsAt: new Date('2026-12-02T00:00:00Z'), cancelled: true },
      ],
    })
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2)
    expect(ics).toContain('DTSTART:20261124T230000Z')
    expect(ics).toContain('SUMMARY:Spring\\, group: week 1')
    expect(ics).toContain('STATUS:CANCELLED')
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })
})
