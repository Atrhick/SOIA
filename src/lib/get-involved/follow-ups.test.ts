import { describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/prisma', () => ({ default: {} }))
import { INVITE_MATCH_MS, calendarDaysBetween, followUpsDue, pairInvites, type FormFacts, type ShareFacts } from './follow-ups'

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

  it('v2: never lists people who asked to stop, or who already signed up from the emailed invite', () => {
    const r = followUpsDue([
      share({ id: 'a', channel: 'EMAIL', email: 'a@x.org' }),
      share({ id: 'b', channel: 'EMAIL', email: 'b@x.org', stopped: true }),
      share({ id: 'c', channel: 'EMAIL', email: 'c@x.org', signedUp: true }),
    ], [form({ id: 'k' }), form({ id: 'out', optedOut: true })], NOW)
    expect(r.map((x) => (x.type === 'FORM' ? x.prospectId : x.shareId))).toEqual(['a', 'k'])
    expect(r[0].email).toBe('a@x.org')
  })

  it('v2: contact details only for people the member added by hand (the parent for under 18); never a booking token', () => {
    const r = followUpsDue([], [
      form({ id: 'k', email: 'kev@x.org', phone: '+1 (702) 555-0123', inviteSource: 'INVITER_ADDED' }),
      form({ id: 'y', ageRange: 'UNDER_18', firstName: 'Sam', parentName: 'Dana Lee', email: 'sam@x.org', parentEmail: 'dana@x.org', parentPhone: '555', inviteSource: 'INVITER_ADDED' }),
      form({ id: 's', firstName: 'Self', email: 'self@x.org', phone: '777', inviteSource: 'INVITE_LINK' }),
    ], NOW)
    expect(r.map((x) => x.type === 'FORM' && [x.name, x.email, x.phone, x.teenName])).toEqual([
      ['Kevin', 'kev@x.org', '+1 (702) 555-0123', null],
      ['Dana', 'dana@x.org', '555', 'Sam'],
      ['Self', null, null, null],
    ])
    expect(r.some((x) => 'journeyToken' in x)).toBe(false)
  })
})

describe('pairInvites', () => {
  it('pairs an EMAIL share with the invite sent at the same moment to the same first name', () => {
    const t = new Date('2026-11-09T15:00:00Z')
    const at = (ms: number) => new Date(t.getTime() + ms)
    const m = pairInvites(
      [
        { id: 's1', channel: 'EMAIL', firstName: 'Maria', sentAt: t },
        { id: 's2', channel: 'EMAIL', firstName: 'maria', sentAt: at(1000) },
        { id: 's3', channel: 'TEXT', firstName: 'Maria', sentAt: t },
        { id: 's4', channel: 'EMAIL', firstName: 'Jo', sentAt: t },
      ],
      [
        { id: 'i1', firstName: 'Maria', email: 'm1@x.org', sentAt: at(200) },
        { id: 'i2', firstName: 'Maria', email: 'm2@x.org', sentAt: at(1100) },
        { id: 'i3', firstName: 'Jo', email: 'jo@x.org', sentAt: at(INVITE_MATCH_MS + 1) },
      ],
    )
    expect(Object.fromEntries(Array.from(m.entries()).map(([k, v]) => [k, v.email]))).toEqual({ s1: 'm1@x.org', s2: 'm2@x.org' })
  })
})
