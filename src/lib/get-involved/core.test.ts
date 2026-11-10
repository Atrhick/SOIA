import { describe, it, expect } from 'vitest'
import {
  generateSlots, pickHost, computeStreak, rankLeaderboard, linkStillValid,
  canProspectChange, slugifyName, businessDay, formatCallTime, journeyOpen,
} from './core'

const CT = 'America/Chicago'
// Monday 2026-11-09 08:00 Central (14:00 UTC; CST = UTC-6)
const NOW = new Date('2026-11-09T14:00:00Z')

describe('generateSlots', () => {
  const lina = { id: 'lina', timezone: CT, availability: [{ dayOfWeek: 4, startMinute: 14 * 60, endMinute: 15 * 60 }] } // Thu 2-3 PM CT

  it('builds slots in the host timezone', () => {
    const slots = generateSlots([lina], [], NOW, { days: 7 })
    expect(slots.map((s) => s.startsAt.toISOString())).toEqual([
      '2026-11-12T20:00:00.000Z', // 2:00 PM CST
      '2026-11-12T20:30:00.000Z', // 2:30 PM CST
    ])
  })

  it('handles the DST change (CDT is UTC-5 in October)', () => {
    const oct = new Date('2026-10-26T14:00:00Z') // Mon Oct 26
    const slots = generateSlots([lina], [], oct, { days: 4 })
    expect(slots[0].startsAt.toISOString()).toBe('2026-10-29T19:00:00.000Z') // 2:00 PM CDT
  })

  it('skips busy times and slots inside the minimum notice', () => {
    const busy = [{ hostId: 'lina', startsAt: new Date('2026-11-12T20:00:00Z'), endsAt: new Date('2026-11-12T20:30:00Z') }]
    expect(generateSlots([lina], busy, NOW, { days: 7 }).map((s) => s.startsAt.toISOString())).toEqual(['2026-11-12T20:30:00.000Z'])
    // 2:00 PM Thu is 6 hours away at 8 AM Thu, inside the 12 h notice
    expect(generateSlots([lina], [], new Date('2026-11-12T14:00:00Z'), { days: 1 })).toEqual([])
  })

  it('merges hosts offering the same time', () => {
    const eliz = { id: 'eliz', timezone: 'America/New_York', availability: [{ dayOfWeek: 4, startMinute: 15 * 60, endMinute: 15 * 60 + 30 }] } // 3 PM ET = 2 PM CT
    const slots = generateSlots([lina, eliz], [], NOW, { days: 7 })
    expect(slots[0]).toEqual({ startsAt: new Date('2026-11-12T20:00:00Z'), hostIds: ['eliz', 'lina'] })
    expect(slots[1].hostIds).toEqual(['lina'])
  })
})

describe('pickHost', () => {
  it('picks the least busy host, stable on ties', () => {
    expect(pickHost(['a', 'b'], { a: 3, b: 1 })).toBe('b')
    expect(pickHost(['b', 'a'], {})).toBe('a')
    expect(pickHost([], {})).toBeNull()
  })
})

describe('computeStreak', () => {
  it('counts consecutive business days and allows today to be pending', () => {
    const d = (iso: string) => new Date(iso)
    // Nov 7, 8 (CT) done; today Nov 9 not yet
    const r = computeStreak([d('2026-11-07T18:00:00Z'), d('2026-11-08T23:00:00Z')], NOW)
    expect(r).toEqual({ streak: 2, doneToday: false })
    const r2 = computeStreak([d('2026-11-08T23:00:00Z'), d('2026-11-09T15:00:00Z')], NOW)
    expect(r2).toEqual({ streak: 2, doneToday: true })
    expect(computeStreak([d('2026-11-06T18:00:00Z')], NOW).streak).toBe(0)
  })

  it('uses Central time for the day boundary', () => {
    // 2026-11-09T03:00Z is still Nov 8 in Chicago
    expect(businessDay(new Date('2026-11-09T03:00:00Z'))).toBe('2026-11-08')
  })
})

describe('rankLeaderboard', () => {
  it('ranks by joined, then forms', () => {
    const rows = rankLeaderboard([
      { userId: '1', name: 'A', role: 'COACH', forms: 9, joined: 1 },
      { userId: '2', name: 'B', role: 'COACH', forms: 3, joined: 2 },
      { userId: '3', name: 'C', role: 'AMBASSADOR', forms: 12, joined: 1 },
    ])
    expect(rows.map((r) => [r.userId, r.rank])).toEqual([['2', 1], ['3', 2], ['1', 3]])
  })
})

describe('small rules', () => {
  it('links expire after 14 days', () => {
    expect(linkStillValid(new Date('2026-10-27T14:00:00Z'), NOW)).toBe(true)
    expect(linkStillValid(new Date('2026-10-25T13:00:00Z'), NOW)).toBe(false)
    expect(linkStillValid(null, NOW)).toBe(false)
  })
  it('changes allowed until 2 hours before', () => {
    expect(canProspectChange(new Date('2026-11-09T16:00:00Z'), NOW)).toBe(true)
    expect(canProspectChange(new Date('2026-11-09T15:59:00Z'), NOW)).toBe(false)
  })
  it('slugifies names', () => {
    expect(slugifyName('Daniella Munéne')).toBe('daniella-munene')
    expect(slugifyName('***')).toBe('member')
  })
  it('formats call times in a timezone', () => {
    expect(formatCallTime(new Date('2026-11-12T20:00:00Z'), CT)).toBe('Thu, Nov 12 · 2:00 PM CST')
  })
})

describe('journeyOpen', () => {
  it('lets only new and booked prospects book, cancel or get a new link', () => {
    expect(journeyOpen('FORM_SUBMITTED')).toBe(true)
    expect(journeyOpen('DISCOVERY_BOOKED')).toBe(true)
    for (const s of ['AWAITING_PARENT_CONSENT', 'DISCOVERY_COMPLETED', 'ACCOUNT_CREATED', 'PAUSED', 'NOT_A_FIT', 'ORIENTATION_SCHEDULED']) {
      expect(journeyOpen(s)).toBe(false)
    }
  })
})
