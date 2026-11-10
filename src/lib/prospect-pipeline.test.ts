import { describe, expect, it } from 'vitest'
import { isJourneyProspect, PIPELINE_ONLY, upcomingHostCallsError, upcomingHostedCallsWhere } from './prospect-pipeline'

describe('isJourneyProspect', () => {
  it('is false for an older coach-pipeline prospect', () => {
    expect(isJourneyProspect({ journeyToken: null, journeyRole: null, userId: null, payment: { journeyRole: null } })).toBe(false)
    expect(isJourneyProspect({ journeyToken: null, payment: null })).toBe(false)
    expect(isJourneyProspect(null)).toBe(false)
  })
  it('is true when any journey marker is set', () => {
    expect(isJourneyProspect({ journeyToken: 'tok' })).toBe(true)
    expect(isJourneyProspect({ journeyRole: 'VOLUNTEER' })).toBe(true)
    expect(isJourneyProspect({ userId: 'u1' })).toBe(true)
    expect(isJourneyProspect({ payment: { journeyRole: 'BUSINESS_AFFILIATE' } })).toBe(true)
  })
})

describe('pipeline filter', () => {
  it('keeps only prospects without a journey token', () => {
    expect(PIPELINE_ONLY).toEqual({ journeyToken: null })
  })
})

describe('upcoming host calls', () => {
  it('allows deletion with no upcoming calls', () => {
    expect(upcomingHostCallsError(0)).toBeNull()
  })
  it('uses the removeHost wording, singular and plural', () => {
    expect(upcomingHostCallsError(1)).toBe('This host has 1 upcoming call. Turn them off instead (no new bookings), or cancel those calls first.')
    expect(upcomingHostCallsError(3)).toMatch(/^This host has 3 upcoming calls\./)
  })
  it('only counts booked calls that start after now', () => {
    const now = new Date('2026-11-09T12:00:00Z')
    expect(upcomingHostedCallsWhere('u1', now)).toEqual({ hostId: 'u1', status: 'BOOKED', startsAt: { gt: now } })
  })
})
