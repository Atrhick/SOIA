import { describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/prisma', () => ({ default: {} }))
import { calendarDaysBetween, followUpsDue, type FormFacts, type ShareFacts } from './follow-ups'

// Noon Central on Nov 12 2026 (CST = UTC-6).
const NOW = new Date('2026-11-12T18:00:00Z')
const daysAgo = (n: number, hourUtc = 18) => new Date(Date.UTC(2026, 10, 12 - n, hourUtc))

const share = (o: Partial<ShareFacts>): ShareFacts => ({
  id: 's1', firstName: 'Sarah', channel: 'TEXT', kind: 'FIRST', programId: null, sentAt: daysAgo(3), outcome: null, nudgedAt: null, closedAt: null, ...o,
})
const form = (o: Partial<FormFacts>): FormFacts => ({
  id: 'p1', firstName: 'Kevin', ageRange: 'AGE_25_55', parentName: null, programId: null, inviteChannel: 'DM', createdAt: daysAgo(2), status: 'FORM_SUBMITTED', hasCall: false, done: false, ...o,
})

describe('follow-ups due', () => {
  it('counts calendar days in Central time', () => {
    // 11:30 PM Central on Nov 9 is still Nov 9 there (05:30 UTC Nov 10).
    expect(calendarDaysBetween(new Date('2026-11-10T05:30:00Z'), NOW)).toBe(3)
    expect(calendarDaysBetween(new Date('2026-11-10T06:30:00Z'), NOW)).toBe(2)
  })

  it('nudges on day 3-4, closes on day 10-14, nothing in between or after', () => {
    const r = followUpsDue([
      share({ id: 'a', sentAt: daysAgo(3) }),
      share({ id: 'b', sentAt: daysAgo(4) }),
      share({ id: 'c', sentAt: daysAgo(6) }),
      share({ id: 'd', sentAt: daysAgo(12) }),
      share({ id: 'e', sentAt: daysAgo(15) }),
      share({ id: 'f', sentAt: daysAgo(2) }),
    ], [], NOW)
    expect(r.map((x) => [x.type, x.type !== 'FORM' && x.shareId, x.day])).toEqual([['NUDGE', 'b', 4], ['NUDGE', 'a', 3], ['CLOSE', 'd', 12]])
  })

  it('skips nudged/closed, answered, posts and follow-up kinds', () => {
    const r = followUpsDue([
      share({ id: 'a', nudgedAt: daysAgo(0) }),
      share({ id: 'b', sentAt: daysAgo(11), closedAt: daysAgo(0) }),
      share({ id: 'c', outcome: 'NO' }),
      share({ id: 'd', channel: 'POST', firstName: null }),
      share({ id: 'e', kind: 'AFTER_YES' }),
      share({ id: 'f', sentAt: daysAgo(11), nudgedAt: daysAgo(8) }),
    ], [], NOW)
    expect(r.map((x) => x.type !== 'FORM' && x.shareId)).toEqual(['f'])
  })

  it('lists forms with no call after 2 days, the parent for under 18', () => {
    const r = followUpsDue([], [
      form({ id: 'k' }),
      form({ id: 'young', ageRange: 'UNDER_18', firstName: 'Sam', parentName: 'Dana Lee' }),
      form({ id: 'young2', ageRange: 'UNDER_18', parentName: null }),
      form({ id: 'new', createdAt: daysAgo(1) }),
      form({ id: 'call', hasCall: true }),
      form({ id: 'done', done: true }),
      form({ id: 'booked', status: 'DISCOVERY_BOOKED' }),
      form({ id: 'old', createdAt: daysAgo(20) }),
    ], NOW)
    expect(r.map((x) => [x.type === 'FORM' && x.prospectId, x.name, x.channel])).toEqual([['k', 'Kevin', 'DM'], ['young', 'Dana', 'PARENT']])
  })
})
