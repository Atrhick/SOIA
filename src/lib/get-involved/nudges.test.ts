import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  OutreachFacts, WELCOME_CUTOFF, checkInDate, checkInDue, nudgeDue, threeDayReminderDue, welcomeDue,
} from './nudges'
import { emailActionPath, signEmailToken, verifyEmailToken } from './email-links'
import { footerHtml, layout, setEmailFooterAddress } from './emails'
import { welcomeCallEmail } from './emails/welcome'
import { nudge2Email } from './emails/nudges'
import { callRange, dayBeforeReminderEmail, dayWord } from './emails/reminders'

const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR
const created = new Date('2026-11-20T15:00:00Z')
const at = (ms: number) => new Date(created.getTime() + ms)

function prospect(over: Partial<OutreachFacts> = {}): OutreachFacts {
  return {
    createdAt: created, ageRange: 'AGE_25_55', status: 'FORM_SUBMITTED', journeyToken: 'tok_abcdefghijklmnop', emailOptOutAt: null,
    welcomeEmailSentAt: null, nudge1SentAt: null, nudge2SentAt: null, checkInAt: null, checkInSentAt: null, callCount: 0, bookedCallCount: 0,
    ...over,
  }
}

describe('welcome (E9) timing', () => {
  it('waits 20 minutes after the form', () => {
    expect(welcomeDue(prospect(), at(19 * MIN))).toBe(false)
    expect(welcomeDue(prospect(), at(20 * MIN))).toBe(true)
  })
  it('only for prospects created after the cutoff', () => {
    expect(welcomeDue(prospect({ createdAt: WELCOME_CUTOFF }), new Date(WELCOME_CUTOFF.getTime() + DAY))).toBe(false)
    expect(welcomeDue(prospect({ createdAt: new Date(WELCOME_CUTOFF.getTime() + 1) }), new Date(WELCOME_CUTOFF.getTime() + DAY))).toBe(true)
  })
  it('skips minors, opted out, already sent, any call, other statuses, no token', () => {
    const now = at(HOUR)
    expect(welcomeDue(prospect({ ageRange: 'UNDER_18' }), now)).toBe(false)
    expect(welcomeDue(prospect({ ageRange: null }), now)).toBe(true)
    expect(welcomeDue(prospect({ emailOptOutAt: at(MIN) }), now)).toBe(false)
    expect(welcomeDue(prospect({ welcomeEmailSentAt: at(MIN) }), now)).toBe(false)
    expect(welcomeDue(prospect({ callCount: 1 }), now)).toBe(false)
    expect(welcomeDue(prospect({ status: 'DISCOVERY_BOOKED' }), now)).toBe(false)
    expect(welcomeDue(prospect({ journeyToken: null }), now)).toBe(false)
  })
})

describe('nudges (E11) timing', () => {
  it('nudge 1 from day 2 until day 7, nudge 2 from day 7 until day 14', () => {
    expect(nudgeDue(prospect(), at(2 * DAY - MIN))).toBeNull()
    expect(nudgeDue(prospect(), at(2 * DAY))).toBe(1)
    expect(nudgeDue(prospect({ nudge1SentAt: at(2 * DAY) }), at(3 * DAY))).toBeNull()
    expect(nudgeDue(prospect({ nudge1SentAt: at(2 * DAY) }), at(7 * DAY - MIN))).toBeNull()
    expect(nudgeDue(prospect({ nudge1SentAt: at(2 * DAY) }), at(7 * DAY))).toBe(2)
    expect(nudgeDue(prospect({ nudge2SentAt: at(7 * DAY) }), at(8 * DAY))).toBeNull()
    expect(nudgeDue(prospect(), at(14 * DAY))).toBeNull()
  })
  it('never sends nudge 1 late: a missed nudge 1 gives way to nudge 2', () => {
    expect(nudgeDue(prospect(), at(7 * DAY + HOUR))).toBe(2)
  })
  it('stops for opt-out, a booked call, maybe later, minors, booked status and old prospects', () => {
    const now = at(2 * DAY + HOUR)
    expect(nudgeDue(prospect({ emailOptOutAt: at(DAY) }), now)).toBeNull()
    expect(nudgeDue(prospect({ bookedCallCount: 1, callCount: 1 }), now)).toBeNull()
    expect(nudgeDue(prospect({ callCount: 1 }), now)).toBe(1) // a cancelled call doesn't stop the nudge
    expect(nudgeDue(prospect({ checkInAt: at(30 * DAY) }), now)).toBeNull()
    expect(nudgeDue(prospect({ ageRange: 'UNDER_18' }), now)).toBeNull()
    expect(nudgeDue(prospect({ status: 'DISCOVERY_BOOKED' }), now)).toBeNull()
    expect(nudgeDue(prospect({ createdAt: new Date('2026-11-01T00:00:00Z') }), new Date('2026-11-03T12:00:00Z'))).toBeNull()
  })
})

describe('check-in after "Maybe later"', () => {
  it('is due once, on the date, while still not booked and not opted out', () => {
    const later = checkInDate(at(7 * DAY))
    expect(later.getTime() - at(7 * DAY).getTime()).toBe(30 * DAY)
    expect(checkInDue(prospect({ checkInAt: later }), new Date(later.getTime() - MIN))).toBe(false)
    expect(checkInDue(prospect({ checkInAt: later }), later)).toBe(true)
    expect(checkInDue(prospect({ checkInAt: later, checkInSentAt: later }), later)).toBe(false)
    expect(checkInDue(prospect({ checkInAt: later, emailOptOutAt: later }), later)).toBe(false)
    expect(checkInDue(prospect({ checkInAt: later, bookedCallCount: 1 }), later)).toBe(false)
  })
})

describe('3-day reminder', () => {
  const starts = new Date('2026-12-10T17:00:00Z')
  const call = (over: Partial<{ status: string; createdAt: Date; reminder3dSentAt: Date | null }> = {}) => ({ status: 'BOOKED', startsAt: starts, createdAt: new Date(starts.getTime() - 10 * DAY), reminder3dSentAt: null, ...over })
  const p = { status: 'DISCOVERY_BOOKED', emailOptOutAt: null }
  const before = (ms: number) => new Date(starts.getTime() - ms)

  it('goes out between 72h and 26h before', () => {
    expect(threeDayReminderDue(call(), p, before(72 * HOUR + MIN))).toBe(false)
    expect(threeDayReminderDue(call(), p, before(72 * HOUR))).toBe(true)
    expect(threeDayReminderDue(call(), p, before(27 * HOUR))).toBe(true)
    expect(threeDayReminderDue(call(), p, before(26 * HOUR))).toBe(false)
  })
  it('is skipped when the call was booked less than 3 days ahead', () => {
    expect(threeDayReminderDue(call({ createdAt: before(72 * HOUR - MIN) }), p, before(60 * HOUR))).toBe(false)
    expect(threeDayReminderDue(call({ createdAt: before(72 * HOUR) }), p, before(60 * HOUR))).toBe(true)
  })
  it('respects opt-out, sent, and cancelled calls', () => {
    const now = before(48 * HOUR)
    expect(threeDayReminderDue(call(), { ...p, emailOptOutAt: new Date() }, now)).toBe(false)
    expect(threeDayReminderDue(call({ reminder3dSentAt: new Date() }), p, now)).toBe(false)
    expect(threeDayReminderDue(call({ status: 'CANCELLED' }), p, now)).toBe(false)
  })
})

describe('signed email links', () => {
  beforeEach(() => { vi.stubEnv('NEXTAUTH_SECRET', 'test-secret-0123456789abcdef') })
  afterEach(() => { vi.unstubAllEnvs() })

  it('round-trips and rejects tampering', () => {
    const t = signEmailToken('stop', 'cm3abcdef123')!
    expect(verifyEmailToken(t)).toEqual({ action: 'stop', id: 'cm3abcdef123' })
    expect(verifyEmailToken(t.replace('stop.', 'delete.'))).toBeNull()
    expect(verifyEmailToken(t.replace('cm3abcdef123', 'cm3abcdef124'))).toBeNull()
    expect(verifyEmailToken(`${t}x`)).toBeNull()
    expect(verifyEmailToken('garbage')).toBeNull()
  })
  it('is off without a secret', () => {
    vi.stubEnv('NEXTAUTH_SECRET', '')
    vi.stubEnv('AUTH_SECRET', '')
    expect(emailActionPath('stop', 'cm3abcdef123')).toBeNull()
  })
  it('footer carries the links only when the prospect is known, and never for team emails', () => {
    setEmailFooterAddress('12 Main St <Suite 4>')
    const f = footerHtml({ prospectId: 'cm3abcdef123' })
    expect(f).toContain('Stop emails about this')
    expect(f).toContain('Delete my details')
    expect(f).toContain('NowTransformed · 12 Main St &lt;Suite 4&gt;')
    expect(f).toContain("You're getting this because you asked about a NowTransformed program at")
    expect(footerHtml({})).not.toContain('Stop emails')
    const team = footerHtml({ prospectId: 'cm3abcdef123', audience: 'team' })
    expect(team).not.toContain('Stop emails')
    expect(team).not.toContain('You&#39;re getting this')
    expect(team).not.toContain("You're getting this")
    setEmailFooterAddress('')
    expect(layout('x')).toContain('<p style="text-align:center;color:#6b7280;font-size:12px;line-height:1.6;margin:4px 0 0">NowTransformed</p>')
  })
})

describe('outreach templates', () => {
  it('welcome: "may qualify" line only with seats left, never prices; note escaped', () => {
    const base = { firstName: 'Sarah', bookUrl: 'https://x.test/discovery/t', inviter: { name: 'Maya Johnson', roleLabel: 'NowTransformed coach', photoUrl: null }, program: { name: 'Health & Stress', note: 'You <b>grow</b>.' } }
    const m = welcomeCallEmail({ ...base, offer: { sponsoredPrice: '$49', fullPrice: '$199', seatsLeft: 3 } })
    expect(m.subject).toBe('Sarah, pick a time for your free call with NowTransformed')
    expect(m.html).toContain('Pick a call time')
    expect(m.html).toContain('may qualify for a NowTransformed sponsored seat')
    expect(m.html).not.toContain('$49')
    expect(m.html).not.toContain('$199')
    expect(m.html).not.toContain('seats left')
    expect(m.html.toLowerCase()).not.toContain('grant')
    expect(m.html).toContain('&lt;b&gt;grow&lt;/b&gt;')
    expect(m.html).toContain('Maya shared it with you')
    expect(m.html).toContain('>MJ<')
    expect(welcomeCallEmail({ ...base, offer: { sponsoredPrice: '$49', fullPrice: '$199', seatsLeft: 0 } }).html).not.toContain('sponsored seat')
    expect(welcomeCallEmail({ ...base, offer: null }).html).not.toContain('sponsored')
  })
  it('nudge 2: "may qualify" line only with seats left; no counts, no seat promise in the subject', () => {
    const b = { firstName: 'Sarah', bookUrl: 'https://x.test/b', laterUrl: 'https://x.test/l', stopUrl: 'https://x.test/s' }
    const withSeats = nudge2Email({ ...b, offer: { sponsoredPrice: '$49', fullPrice: null, seatsLeft: 2 } })
    expect(withSeats.subject).toBe('Sarah, should we keep a call time for you?')
    expect(withSeats.html).toContain('may qualify for a NowTransformed sponsored seat')
    expect(withSeats.html).not.toContain('$49')
    expect(withSeats.html).not.toMatch(/\d+ sponsored seats? left/)
    const none = nudge2Email({ ...b, offer: null })
    expect(none.subject).not.toContain('sponsored')
    expect(none.html).toContain('Maybe later: check in next month')
  })
  it('day-before reminder says Tomorrow in the prospect zone', () => {
    const starts = new Date('2026-12-10T19:00:00Z') // 11:00 AM Pacific
    const now = new Date('2026-12-09T19:00:00Z')
    expect(dayWord(starts, 'America/Los_Angeles', now)).toBe('Tomorrow')
    expect(callRange(starts, new Date(starts.getTime() + 30 * MIN), 'America/Los_Angeles')).toMatch(/^Thursday, Dec 10 · 11:00\s?–\s?11:30\sAM PST$/)
    const m = dayBeforeReminderEmail({ firstName: 'Sarah', startsAt: starts, endsAt: new Date(starts.getTime() + 30 * MIN), tz: 'America/Los_Angeles', hostFirst: 'Jordan', meetingUrl: 'https://zoom.us/j/1', manageUrl: 'https://x.test/m' }, now)
    expect(m.subject).toMatch(/^Tomorrow 11:00\sAM: your call with Jordan$/)
    expect(m.html).toContain('think about one thing you')
  })
})
