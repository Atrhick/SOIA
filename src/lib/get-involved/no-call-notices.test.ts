import { describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/prisma', () => ({ prisma: {}, withPushTag: vi.fn() }))
vi.mock('./server', () => ({ dashboardPathFor: () => '/coach/one-a-day' }))
import { noCallNoticeStage, noCallNoticeText } from './no-call-notices'

const DAY = 86400_000
const created = new Date('2026-11-12T11:20:00Z')
const at = (d: number) => new Date(created.getTime() + d * DAY)

describe('team notices when no call is booked', () => {
  it('first notice from day 2, second from day 10, none from day 14', () => {
    expect(noCallNoticeStage(created, at(1.9))).toBeNull()
    expect(noCallNoticeStage(created, at(2))).toBe(2)
    expect(noCallNoticeStage(created, at(9.9))).toBe(2)
    expect(noCallNoticeStage(created, at(10))).toBe(10)
    expect(noCallNoticeStage(created, at(13.9))).toBe(10)
    expect(noCallNoticeStage(created, at(14))).toBeNull()
  })

  it('tells the inviter and the admins different things', () => {
    const base = { first: 'Laiza', full: 'Laiza Gweru', days: 2, linkEndsAt: at(14), optedOut: false }
    const inv = noCallNoticeText({ ...base, stage: 2, forInviter: true })
    expect(inv.title).toBe("Laiza hasn't booked a call yet")
    expect(inv.message).toContain('from your link 2 days ago')
    const adm = noCallNoticeText({ ...base, stage: 10, days: 12, forInviter: false })
    expect(adm.title).toBe('Laiza Gweru: booking link stops working Thursday, Nov 26')
    expect(adm.message).toContain('Send booking link')
  })

  it('does not warn about the link when a fresh one was just sent', () => {
    const now = at(12)
    const adm = noCallNoticeText({ first: 'Laiza', full: 'Laiza Gweru', days: 12, linkEndsAt: new Date(now.getTime() + 14 * DAY), optedOut: false, stage: 10, forInviter: false, now })
    expect(adm.title).toBe("Laiza Gweru still hasn't booked a call")
    expect(adm.message).toContain('fresh booking link was sent')
  })

  it('says to phone when they asked for no emails', () => {
    const adm = noCallNoticeText({ first: 'A', full: 'A B', days: 3, linkEndsAt: null, optedOut: true, stage: 2, forInviter: false })
    expect(adm.message).toContain('phone call or text')
  })
})
