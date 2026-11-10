import { describe, expect, it } from 'vitest'
import { adminCallWhen, adminClock } from './admin-time'

describe('admin call times', () => {
  // 01:39 UTC on Nov 10 = 8:39 PM Eastern / 7:39 PM Central on Nov 9.
  const call = new Date('2026-11-10T01:39:00Z')

  it('shows the call in Central Time with a zone label, whatever zone the prospect booked from', () => {
    expect(adminCallWhen(call)).toBe('Mon, Nov 9, 7:39 PM CST')
  })

  it('labels daylight time as CDT', () => {
    expect(adminCallWhen(new Date('2026-07-01T15:00:00Z'))).toBe('Wed, Jul 1, 10:00 AM CDT')
  })

  it('clock matches the call-notes card', () => {
    expect(adminClock(call)).toBe('7:39 PM CST')
  })
})
