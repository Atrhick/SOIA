import { describe, expect, it } from 'vitest'
import { canUndoSeatOffer, monthStart, nextMonthStart, seatLockKey, seatsLeftOf, seatsUsedWhere } from './offer'

const now = new Date('2026-11-12T15:00:00Z')

describe('sponsored seats', () => {
  it('a seat is used when OFFERED in the current month (not when a call is booked)', () => {
    // Months follow US Central time: Nov 1 starts at 05:00 UTC (CDT), Dec 1 at 06:00 UTC (CST).
    expect(seatsUsedWhere(now)).toEqual({ sponsoredSeatOfferedAt: { gte: new Date('2026-11-01T05:00:00Z'), lt: new Date('2026-12-01T06:00:00Z') } })
  })
  it('month bounds roll over the year (Central time)', () => {
    const dec = new Date('2026-12-31T23:59:59Z') // still Dec 31 in Chicago
    expect(monthStart(dec).toISOString()).toBe('2026-12-01T06:00:00.000Z')
    expect(nextMonthStart(dec).toISOString()).toBe('2027-01-01T06:00:00.000Z')
  })
  it('7pm Central on the 31st is still that month, not the next', () => {
    const oct31evening = new Date('2026-11-01T00:00:00Z') // Oct 31, 7pm CDT
    expect(monthStart(oct31evening).toISOString()).toBe('2026-10-01T05:00:00.000Z')
    expect(canUndoSeatOffer(new Date('2026-10-31T23:00:00Z'), oct31evening)).toBe(true)
  })
  it('seats left never goes below 0', () => {
    expect(seatsLeftOf(3, 1)).toBe(2)
    expect(seatsLeftOf(3, 5)).toBe(0)
    expect(seatsLeftOf(null, 0)).toBe(0)
  })
  it('one lock key per program and month', () => {
    expect(seatLockKey('p1', now)).toBe('sponsored-seat:p1:2026-11')
    expect(seatLockKey('p1', new Date('2026-12-01T06:00:00Z'))).toBe('sponsored-seat:p1:2026-12')
    expect(seatLockKey('p1', new Date('2026-12-01T05:59:00Z'))).toBe('sponsored-seat:p1:2026-11')
    expect(seatLockKey('p2', now)).not.toBe(seatLockKey('p1', now))
  })
  it('an offer can be undone only in the month it was made', () => {
    expect(canUndoSeatOffer(new Date('2026-11-01T05:00:00Z'), now)).toBe(true)
    expect(canUndoSeatOffer(new Date('2026-11-01T04:59:59Z'), now)).toBe(false)
    expect(canUndoSeatOffer(null, now)).toBe(false)
  })
})
