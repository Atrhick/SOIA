import { describe, expect, it } from 'vitest'
import { InviterPersonFacts, inviterPersonStage } from './inviter-people'

const NOW = new Date('2026-11-09T15:00:00Z') // Mon 9 AM Central
const base: InviterPersonFacts = {
  status: 'FORM_SUBMITTED', userId: null, noShowCount: 0, createdAt: new Date('2026-11-06T15:00:00Z'), added: false,
  bookedCallAt: null, missedCallAt: null, orientationRemindAt: null, paymentStatus: null, joinedAt: null,
}
const at = (over: Partial<InviterPersonFacts>) => inviterPersonStage({ ...base, ...over }, NOW)

describe('inviterPersonStage', () => {
  it('gives every later journey status its own stage (never a generic "In progress")', () => {
    const statuses = ['FORM_SUBMITTED', 'AWAITING_PARENT_CONSENT', 'DISCOVERY_BOOKED', 'DISCOVERY_COMPLETED', 'ASSESSMENT_PENDING', 'ASSESSMENT_COMPLETED',
      'ORIENTATION_SCHEDULED', 'ORIENTATION_COMPLETED', 'PAYMENT_PENDING', 'PAYMENT_COMPLETED', 'DONATION_HANDOFF', 'PAUSED', 'NOT_A_FIT', 'ACCOUNT_CREATED']
    for (const s of statuses) expect(at({ status: s }).label).not.toBe('In progress')
  })
  it('uses the admin list labels', () => {
    expect(at({ status: 'ASSESSMENT_PENDING' })).toMatchObject({ label: 'Assessment', detail: 'Answer 3 questions' })
    expect(at({ status: 'ASSESSMENT_COMPLETED' })).toMatchObject({ label: 'Orientation', detail: 'Watch the orientation' })
    expect(at({ status: 'ORIENTATION_COMPLETED' })).toMatchObject({ label: 'Terms / payment', detail: 'Accept the terms and create a login' })
    expect(at({ status: 'PAYMENT_PENDING' }).detail).toBe('Finishing payment')
    expect(at({ status: 'PAYMENT_PENDING', paymentStatus: 'FAILED' }).detail).toBe('Payment did not go through')
    expect(at({ status: 'PAYMENT_COMPLETED' }).detail).toBe('Paid · login being set up')
    expect(at({ status: 'DONATION_HANDOFF' }).label).toBe('Sent to donate')
    expect(at({ status: 'NOT_A_FIT' }).label).toBe('Not a fit')
  })
  it('form, parent and call wording', () => {
    expect(at({}).detail).toBe('Signed up 3 days ago · needs to book a call')
    expect(at({ added: true }).detail).toBe('Added 3 days ago · needs to book a call')
    expect(at({ status: 'AWAITING_PARENT_CONSENT' })).toMatchObject({ label: 'Waiting on parent', detail: "Signed up 3 days ago · needs a parent's okay" })
    expect(at({ status: 'DISCOVERY_BOOKED', bookedCallAt: new Date('2026-11-12T20:00:00Z') })).toMatchObject({ label: 'Call booked', detail: 'Call Thu 2 PM' })
  })
  it('no-shows and pauses', () => {
    expect(at({ noShowCount: 1, missedCallAt: new Date('2026-11-06T20:00:00Z') })).toMatchObject({ label: 'No-show', detail: 'Missed call Fri 2 PM' })
    expect(at({ status: 'PAUSED', noShowCount: 2 })).toMatchObject({ label: 'Paused', detail: 'Paused after missed calls' })
  })
  it('orientation scheduled for later', () => {
    expect(at({ status: 'ORIENTATION_SCHEDULED', orientationRemindAt: new Date('2026-11-10T00:00:00Z') }).detail).toBe('Watching orientation today 6 PM')
    expect(at({ status: 'ORIENTATION_SCHEDULED', orientationRemindAt: new Date('2026-11-11T00:00:00Z') }).detail).toBe('Watching orientation tomorrow 6 PM')
    expect(at({ status: 'ORIENTATION_SCHEDULED', orientationRemindAt: new Date('2026-11-01T00:00:00Z') }).detail).toBe('Watch the orientation')
  })
})
