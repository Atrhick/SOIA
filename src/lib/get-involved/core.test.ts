import { describe, it, expect } from 'vitest'
import {
  generateSlots, pickHost, computeStreak, rankLeaderboard, linkStillValid,
  canProspectChange, slugifyName, businessDay, formatCallTime, journeyOpen, dayKey, dayKeyIn, isDayKey,
} from './core'
import {
  DEFAULT_ROLE_CONFIGS, GET_INVOLVED_ROLES, JourneyFacts, canAcceptTerms, canAnswerAssessment, canChooseRole, canCreateLogin,
  canDoOrientation, canMarkNotAFit, canTransition, isPaidRole, journeyPosition, journeyStages, laterJourneyOpen,
  parseQuestions, priceLabel, railSteps, roleConfigFromRow, roleConfigSnapshot, rolesForAge, stagePath, statusAfterRoleChosen,
  userRoleFor, validateAnswers,
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

  it('skips a host\'s blocked days (in the host timezone) but keeps other hosts and other weeks', () => {
    const blocked = { ...lina, blockedDays: ['2026-11-12'] }
    expect(generateSlots([blocked], [], NOW, { days: 7 })).toEqual([])
    expect(generateSlots([blocked], [], NOW, { days: 10 }).map((s) => s.startsAt.toISOString())).toEqual([])
    expect(generateSlots([blocked], [], NOW, { days: 14 }).map((s) => s.startsAt.toISOString())).toEqual([
      '2026-11-19T20:00:00.000Z', '2026-11-19T20:30:00.000Z',
    ])
    const eliz = { id: 'eliz', timezone: 'America/New_York', availability: [{ dayOfWeek: 4, startMinute: 15 * 60, endMinute: 15 * 60 + 30 }] }
    expect(generateSlots([blocked, eliz], [], NOW, { days: 7 })).toEqual([{ startsAt: new Date('2026-11-12T20:00:00Z'), hostIds: ['eliz'] }])
  })

  it('reads the blocked day in the host timezone, not UTC', () => {
    // Thu 7:00-7:30 PM Central is already Friday in UTC; blocking Thursday must hide it.
    const late = { id: 'late', timezone: CT, availability: [{ dayOfWeek: 4, startMinute: 19 * 60, endMinute: 19 * 60 + 30 }] }
    expect(generateSlots([late], [], NOW, { days: 7 }).map((s) => s.startsAt.toISOString())).toEqual(['2026-11-13T01:00:00.000Z'])
    expect(generateSlots([{ ...late, blockedDays: ['2026-11-13'] }], [], NOW, { days: 7 })).toHaveLength(1)
    expect(generateSlots([{ ...late, blockedDays: ['2026-11-12'] }], [], NOW, { days: 7 })).toEqual([])
  })
})

describe('day keys', () => {
  it('validates real yyyy-mm-dd dates', () => {
    expect(isDayKey('2026-11-12')).toBe(true)
    expect(isDayKey('2026-02-30')).toBe(false)
    expect(isDayKey('2026-1-2')).toBe(false)
    expect(isDayKey('x')).toBe(false)
    expect(dayKey(2026, 0, 5)).toBe('2026-01-05')
    expect(dayKeyIn(new Date('2026-11-13T01:00:00Z'), CT)).toBe('2026-11-12')
    expect(dayKeyIn(new Date('2026-11-13T01:00:00Z'), 'UTC')).toBe('2026-11-13')
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

// ---------- phase 2/3 ----------

const base: JourneyFacts = { status: 'ASSESSMENT_PENDING', journeyRole: 'COACH', assessmentSubmittedAt: null, orientationWatchedAt: null, roleTermsAcceptedAt: null, userId: null, paymentStatus: null, paid: true }
const d = new Date('2026-11-09T14:00:00Z')

describe('role defaults', () => {
  it('has all nine roles with the mockup prices', () => {
    expect(GET_INVOLVED_ROLES).toHaveLength(9)
    expect(priceLabel(DEFAULT_ROLE_CONFIGS.COACH)).toBe('$99 once')
    expect(priceLabel(DEFAULT_ROLE_CONFIGS.SERVICE_PROVIDER)).toBe('$29–399/mo')
    expect(priceLabel(DEFAULT_ROLE_CONFIGS.BUSINESS_AFFILIATE)).toBe('$250/yr')
    expect(priceLabel(DEFAULT_ROLE_CONFIGS.RESOURCE_CENTER_OWNER)).toBe('$250 once')
    expect(priceLabel(DEFAULT_ROLE_CONFIGS.VOLUNTEER)).toBe('Free')
    expect(priceLabel(DEFAULT_ROLE_CONFIGS.SPONSOR)).toBe('Gift')
    for (const r of GET_INVOLVED_ROLES) expect(DEFAULT_ROLE_CONFIGS[r].questions).toHaveLength(3)
  })
  it('knows paid and free roles', () => {
    expect(isPaidRole(DEFAULT_ROLE_CONFIGS.COACH)).toBe(true)
    expect(isPaidRole(DEFAULT_ROLE_CONFIGS.AMBASSADOR)).toBe(false)
    expect(isPaidRole(DEFAULT_ROLE_CONFIGS.SPONSOR)).toBe(false)
    expect(isPaidRole({ billing: 'MONTHLY', priceCents: 0 })).toBe(false)
  })
  it('offers 17 and under only free roles open to them', () => {
    const all = GET_INVOLVED_ROLES.map((r) => DEFAULT_ROLE_CONFIGS[r])
    expect(rolesForAge(all, 'UNDER_18').map((c) => c.role)).toEqual(['YOUTH_AMBASSADOR', 'VOLUNTEER'])
    expect(rolesForAge(all, 'AGE_25_55').map((c) => c.role)).not.toContain('YOUTH_AMBASSADOR')
    const paidForKids = { ...DEFAULT_ROLE_CONFIGS.COACH, ageRanges: ['UNDER_18' as const] }
    expect(rolesForAge([paidForKids], 'UNDER_18')).toEqual([])
    expect(rolesForAge([{ ...DEFAULT_ROLE_CONFIGS.VOLUNTEER, active: false }], 'AGE_25_55')).toEqual([])
  })
  it('maps roles to logins', () => {
    expect(userRoleFor('COACH_SERVICE_PROVIDER')).toBe('COACH')
    expect(userRoleFor('YOUTH_AMBASSADOR')).toBe('AMBASSADOR')
    expect(userRoleFor('VOLUNTEER')).toBe('VOLUNTEER')
    expect(userRoleFor('SPONSOR')).toBeNull()
  })
})

describe('stored settings', () => {
  it('merges a row over the defaults and always gives 3 questions', () => {
    const cfg = roleConfigFromRow('COACH', { label: 'Coach', priceCents: 12000, billing: 'ONE_TIME', priceNote: null, questions: [{ text: 'Why?', type: 'CHOICE', choices: ['a'] }], ageRanges: ['AGE_25_55', 'BAD'] })
    expect(cfg.priceCents).toBe(12000)
    expect(cfg.ageRanges).toEqual(['AGE_25_55'])
    expect(cfg.questions).toHaveLength(3)
    expect(cfg.questions[0]).toEqual({ text: 'Why?', type: 'SHORT_TEXT', choices: [] }) // one option is not enough for a choice
    expect(cfg.questions[1].text).toContain('being rewritten')
    expect(cfg.saved).toBe(true)
    expect(roleConfigFromRow('COACH', null).saved).toBe(false)
  })
  it('round-trips through a snapshot', () => {
    const snap = roleConfigSnapshot(DEFAULT_ROLE_CONFIGS.BUSINESS_AFFILIATE)
    expect(snap).not.toHaveProperty('saved')
    const back = roleConfigFromRow('BUSINESS_AFFILIATE', snap)
    expect({ ...back, saved: false }).toEqual(DEFAULT_ROLE_CONFIGS.BUSINESS_AFFILIATE)
  })
  it('parses choice questions', () => {
    expect(parseQuestions([{ text: 'Pick', type: 'CHOICE', choices: ['x', ' y ', ''] }], [])[0]).toEqual({ text: 'Pick', type: 'CHOICE', choices: ['x', 'y'] })
  })
  it('validates answers per type', () => {
    const qs = [{ text: 'A', type: 'SHORT_TEXT' as const, choices: [] }, { text: 'B', type: 'CHOICE' as const, choices: ['x', 'y'] }, { text: 'C', type: 'SCALE_1_5' as const, choices: [] }]
    expect(validateAnswers(qs, ['hi', 'x', 3])).toEqual({ ok: true, answers: [{ question: 'A', type: 'SHORT_TEXT', answer: 'hi' }, { question: 'B', type: 'CHOICE', answer: 'x' }, { question: 'C', type: 'SCALE_1_5', answer: '3' }] })
    const bad = validateAnswers(qs, ['  ', 'z', '6'])
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(Object.keys(bad.errors)).toEqual(['0', '1', '2'])
  })
})

describe('journey stages', () => {
  it('lists stages per role', () => {
    expect(journeyStages('COACH', { minor: false, paid: true })).toEqual(['FORM', 'BOOK_CALL', 'DISCOVERY_CALL', 'ASSESSMENT', 'ORIENTATION', 'TERMS', 'PAYMENT', 'LOGIN'])
    expect(journeyStages('VOLUNTEER', { minor: true, paid: false })).toEqual(['FORM', 'PARENT_CONSENT', 'BOOK_CALL', 'DISCOVERY_CALL', 'ASSESSMENT', 'ORIENTATION', 'TERMS', 'LOGIN'])
    expect(journeyStages('SPONSOR', { minor: false, paid: false })).toEqual(['FORM', 'BOOK_CALL', 'DISCOVERY_CALL', 'DONATION'])
  })
  it('finds the current stage from the fields', () => {
    expect(journeyPosition({ ...base, status: 'FORM_SUBMITTED', journeyRole: null }).stage).toBe('BOOK_CALL')
    expect(journeyPosition({ ...base, status: 'AWAITING_PARENT_CONSENT', journeyRole: null }).waitingOn).toBe('PARENT')
    expect(journeyPosition({ ...base, status: 'DISCOVERY_COMPLETED', journeyRole: null })).toMatchObject({ stage: 'DISCOVERY_CALL', waitingOn: 'STAFF' })
    expect(journeyPosition(base).stage).toBe('ASSESSMENT')
    expect(journeyPosition({ ...base, assessmentSubmittedAt: d }).stage).toBe('ORIENTATION')
    expect(journeyPosition({ ...base, assessmentSubmittedAt: d, orientationWatchedAt: d }).stage).toBe('TERMS')
    expect(journeyPosition({ ...base, assessmentSubmittedAt: d, orientationWatchedAt: d, roleTermsAcceptedAt: d, paymentStatus: 'PENDING' }).stage).toBe('PAYMENT')
    expect(journeyPosition({ ...base, assessmentSubmittedAt: d, orientationWatchedAt: d, roleTermsAcceptedAt: d, paymentStatus: 'COMPLETED' }).stage).toBe('LOGIN')
    expect(journeyPosition({ ...base, paid: false, assessmentSubmittedAt: d, orientationWatchedAt: d, roleTermsAcceptedAt: d }).stage).toBe('LOGIN')
    expect(journeyPosition({ ...base, status: 'ACCOUNT_CREATED', userId: 'u' }).stage).toBe('DONE')
    expect(journeyPosition({ ...base, status: 'NOT_A_FIT' }).stage).toBe('CLOSED')
    expect(journeyPosition({ ...base, status: 'DONATION_HANDOFF', journeyRole: 'SPONSOR' }).stage).toBe('DONATION')
  })
  it('points each stage at its page', () => {
    expect(stagePath('BOOK_CALL', 'tok')).toBe('/discovery/tok')
    expect(stagePath('ASSESSMENT', 'tok')).toBe('/journey/tok/assessment')
    expect(stagePath('PAYMENT', 'tok')).toBe('/journey/tok/join')
    expect(stagePath('CLOSED', 'tok')).toBeNull()
  })
})

describe('what each status may do', () => {
  it('keeps phase 1 booking limited to new and booked prospects', () => {
    for (const s of ['ASSESSMENT_PENDING', 'ORIENTATION_COMPLETED', 'PAYMENT_PENDING', 'DONATION_HANDOFF']) expect(journeyOpen(s)).toBe(false)
  })
  it('gates each later step on one status', () => {
    expect(canAnswerAssessment('ASSESSMENT_PENDING')).toBe(true)
    expect(canAnswerAssessment('ASSESSMENT_COMPLETED')).toBe(false)
    expect(canDoOrientation('ORIENTATION_SCHEDULED')).toBe(true)
    expect(canDoOrientation('ASSESSMENT_PENDING')).toBe(false)
    expect(canAcceptTerms('ORIENTATION_COMPLETED')).toBe(true)
    expect(canAcceptTerms('PAYMENT_PENDING')).toBe(false)
    expect(laterJourneyOpen('PAYMENT_PENDING')).toBe(true)
    expect(laterJourneyOpen('FORM_SUBMITTED')).toBe(false)
  })
  it('lets staff change the role only before the terms', () => {
    expect(canChooseRole('DISCOVERY_BOOKED', false)).toBe(true)
    expect(canChooseRole('ORIENTATION_COMPLETED', false)).toBe(true)
    expect(canChooseRole('ORIENTATION_COMPLETED', true)).toBe(false)
    expect(canChooseRole('FORM_SUBMITTED', false)).toBe(false)
    expect(statusAfterRoleChosen('SPONSOR')).toBe('DONATION_HANDOFF')
    expect(statusAfterRoleChosen('VOLUNTEER')).toBe('ASSESSMENT_PENDING')
  })
  it('creates logins at the right moment', () => {
    expect(canCreateLogin({ status: 'ORIENTATION_COMPLETED', paid: false, userId: null, journeyRole: 'VOLUNTEER' })).toBe(true)
    expect(canCreateLogin({ status: 'ORIENTATION_COMPLETED', paid: true, userId: null, journeyRole: 'COACH' })).toBe(false)
    expect(canCreateLogin({ status: 'PAYMENT_COMPLETED', paid: true, userId: null, journeyRole: 'COACH' })).toBe(true)
    expect(canCreateLogin({ status: 'PAYMENT_COMPLETED', paid: true, userId: 'u', journeyRole: 'COACH' })).toBe(false)
    expect(canCreateLogin({ status: 'ORIENTATION_COMPLETED', paid: false, userId: null, journeyRole: 'SPONSOR' })).toBe(false)
  })
  it('allows not a fit until money or a login exists', () => {
    expect(canMarkNotAFit('DISCOVERY_BOOKED')).toBe(true)
    expect(canMarkNotAFit('PAYMENT_PENDING')).toBe(true)
    expect(canMarkNotAFit('PAYMENT_COMPLETED')).toBe(false)
    expect(canMarkNotAFit('ACCOUNT_CREATED')).toBe(false)
    expect(canTransition('ASSESSMENT_PENDING', 'NOT_A_FIT')).toBe(true)
    expect(canTransition('ASSESSMENT_PENDING', 'ORIENTATION_COMPLETED')).toBe(false)
    expect(canTransition('PAYMENT_PENDING', 'PAYMENT_COMPLETED')).toBe(true)
  })
})

describe('railSteps', () => {
  it('shows 7 steps, with Join covering terms, payment and login', () => {
    const r = railSteps({ role: 'COACH', ageRange: 'AGE_25_55', stage: 'PAYMENT' })
    expect(r.map((s) => s.label)).toEqual(['Your info', 'Book a call', 'Discovery call', 'Assessment', 'Orientation', 'Join', 'Welcome'])
    expect(r.map((s) => s.state)).toEqual(['done', 'done', 'done', 'done', 'done', 'current', 'todo'])
  })
  it('adds the parent step for 17 and under and ends sponsors at Give', () => {
    expect(railSteps({ role: null, ageRange: 'UNDER_18', stage: 'PARENT_CONSENT' })[1]).toEqual({ key: 'PARENT', label: "Parent's okay", state: 'current' })
    expect(railSteps({ role: 'SPONSOR', ageRange: 'AGE_25_55', stage: 'DONATION' }).map((s) => s.label)).toEqual(['Your info', 'Book a call', 'Discovery call', 'Give'])
    expect(railSteps({ role: 'COACH', ageRange: null, stage: 'CLOSED' }).every((s) => s.state === 'todo')).toBe(true)
    const done = railSteps({ role: 'COACH', ageRange: null, stage: 'DONE' })
    expect(done[done.length - 1].state).toBe('current')
  })
})
