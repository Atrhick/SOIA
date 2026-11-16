import { describe, it, expect, vi } from 'vitest'
vi.mock('@/lib/prisma', () => ({ default: {} }))
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn() }))
vi.mock('./server', () => ({ userDisplayName: vi.fn() }))
import { adminDigestEmail, centralDayAndHour, type DigestData } from './admin-digest'

const empty: DigestData = { newSignups: [], waiting: [], waitingTotal: 0, reachOut: 0, callsNext24h: 0 }

describe('admin daily summary', () => {
  it('sends nothing when there is nothing to act on', () => {
    expect(adminDigestEmail({ ...empty, callsNext24h: 3 }, 'Ana')).toBeNull()
  })

  it('lists new sign-ups and people waiting, with links to their records', () => {
    const m = adminDigestEmail({
      ...empty,
      newSignups: [{ id: 'p1', name: 'Laiza Gweru', age: '25–55', inviter: 'Joseph Muchamaya', booked: false }],
      waiting: [{ id: 'p2', name: 'Chantel <b>Ncube</b>', age: '18–24', inviter: null, days: 4 }],
      waitingTotal: 12,
    }, 'Ana')!
    expect(m.subject).toBe('NowTransformed daily summary: 1 new, 12 waiting for a call')
    expect(m.html).toContain('/admin/prospects/p1')
    expect(m.html).toContain('invited by Joseph Muchamaya')
    expect(m.html).toContain('No call booked yet')
    expect(m.html).toContain('Signed up 4 days ago')
    expect(m.html).toContain('And 11 more on the Prospects page')
    expect(m.html).not.toContain('<b>Ncube</b>')
  })

  it('uses the Central-time day and hour', () => {
    // 13:30 UTC on 15 Nov = 07:30 Central (CST, UTC-6)
    expect(centralDayAndHour(new Date('2026-11-15T13:30:00Z'))).toEqual({ day: '2026-11-15', hour: 7 })
    // 03:00 UTC on 16 Nov = 21:00 on 15 Nov in Central
    expect(centralDayAndHour(new Date('2026-11-16T03:00:00Z'))).toEqual({ day: '2026-11-15', hour: 21 })
  })
})
