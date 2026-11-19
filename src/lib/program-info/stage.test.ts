import { describe, expect, it } from 'vitest'
import { canMoveStage, coachView, compareQueue, enterStageData, reminderDue, stallDue, teamView, waitingSinceDate, type StageFacts } from './stage'

const facts = (o: Partial<StageFacts>): StageFacts => ({
  stage: 'ANSWERING', isLive: false, offline: false, offlineByTeam: false, started: true, sectionsDone: 3, sectionsTotal: 5,
  nextSectionTitle: 'What you offer', openQuestionId: null, readyVersionId: null, hasDraft: false, hasUnsentChanges: false,
  everApproved: false, stalled: false, needsSetup: false, ...o,
})
const NOW = new Date('2026-11-18T18:00:00Z')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400_000)

describe('coach view', () => {
  it('asks a new program to set up first (A1)', () => {
    expect(coachView(facts({ needsSetup: true, started: false }))).toMatchObject({ label: 'Not started', nextAction: { label: 'Set up my program', hrefSuffix: '/setup' } })
  })
  it('shows answer progress', () => {
    expect(coachView(facts({}))).toMatchObject({ label: '3 of 5 sections done', detail: 'Next: What you offer.', nextAction: { label: 'Continue my answers', hrefSuffix: '' } })
    expect(coachView(facts({ started: false }))).toMatchObject({ label: 'Not started', nextAction: { label: 'Start my answers' } })
  })
  it('labels every stage', () => {
    expect(coachView(facts({ stage: 'WITH_TEAM' }))).toMatchObject({ label: 'Answers sent, page being written', nextAction: null })
    expect(coachView(facts({ stage: 'WITH_TEAM', isLive: true })).label).toBe('Live, new version being written')
    expect(coachView(facts({ stage: 'QUESTION_OPEN', openQuestionId: 'q1' }))).toMatchObject({ label: 'Question from the team', nextAction: { hrefSuffix: '/question/q1' } })
    expect(coachView(facts({ stage: 'READY_TO_CHECK', readyVersionId: 'v1' }))).toMatchObject({ label: 'Ready for you to check', nextAction: { label: 'Check my page', hrefSuffix: '/check' } })
    expect(coachView(facts({ stage: 'CHANGES_ASKED' }))).toMatchObject({ label: 'Changes asked for, being fixed', nextAction: null })
    expect(coachView(facts({ stage: 'DONE', isLive: true }))).toMatchObject({ label: 'Live', nextAction: { label: 'Copy my link', hrefSuffix: '/live' } })
    expect(coachView(facts({ stage: 'DONE', isLive: true, hasUnsentChanges: true })).nextAction).toEqual({ label: 'Send my changes', hrefSuffix: '/update' })
  })
  it('offline: only the owner who took it down can put it back', () => {
    expect(coachView(facts({ stage: 'DONE', offline: true })).nextAction).toEqual({ label: 'Put it back online', hrefSuffix: '/live' })
    expect(coachView(facts({ stage: 'DONE', offline: true, offlineByTeam: true })).nextAction).toBeNull()
  })
  it('a check waiting beats offline', () => {
    expect(coachView(facts({ stage: 'READY_TO_CHECK', readyVersionId: 'v', offline: true })).label).toBe('Ready for you to check')
  })
})

describe('team view', () => {
  it('buckets by who acts next', () => {
    expect(teamView(facts({ stage: 'WITH_TEAM' }))).toEqual({ bucket: 'OUR_MOVE', label: 'Answers received' })
    expect(teamView(facts({ stage: 'WITH_TEAM', hasDraft: true })).label).toBe('Draft ready to send')
    expect(teamView(facts({ stage: 'WITH_TEAM', isLive: true })).label).toBe('New version needed')
    expect(teamView(facts({ stage: 'CHANGES_ASKED' }))).toEqual({ bucket: 'OUR_MOVE', label: 'Changes asked for' })
    expect(teamView(facts({ stage: 'QUESTION_OPEN', openQuestionId: 'q' })).bucket).toBe('WAITING_ON_COACH')
    expect(teamView(facts({ started: false })).label).toBe('Not started')
    expect(teamView(facts({ stalled: true }))).toEqual({ bucket: 'STALLED', label: 'Stalled' })
    expect(teamView(facts({ stage: 'DONE', isLive: true })).bucket).toBe('LIVE')
    expect(teamView(facts({ stage: 'DONE', offline: true })).bucket).toBe('OFFLINE')
    expect(teamView(facts({ noOwner: true })).label).toBe('No owner')
  })
  it('sorts our move first, then longest waiting', () => {
    const items = [
      { bucket: 'LIVE' as const, waitingSince: '2026-01-01T00:00:00.000Z' },
      { bucket: 'OUR_MOVE' as const, waitingSince: '2026-11-10T00:00:00.000Z' },
      { bucket: 'OUR_MOVE' as const, waitingSince: '2026-11-01T00:00:00.000Z' },
      { bucket: 'WAITING_ON_COACH' as const, waitingSince: '2026-10-01T00:00:00.000Z' },
    ]
    expect(items.sort(compareQueue).map((i) => `${i.bucket}:${i.waitingSince.slice(5, 10)}`)).toEqual(['OUR_MOVE:11-01', 'OUR_MOVE:11-10', 'WAITING_ON_COACH:10-01', 'LIVE:01-01'])
  })
})

describe('moves', () => {
  it('allows the workflow moves and refuses the rest', () => {
    expect(canMoveStage('ANSWERING', 'WITH_TEAM')).toBe(true)
    expect(canMoveStage('READY_TO_CHECK', 'DONE')).toBe(true)
    expect(canMoveStage('DONE', 'CHANGES_ASKED')).toBe(true)
    expect(canMoveStage('ANSWERING', 'QUESTION_OPEN')).toBe(false)
    expect(canMoveStage('ANSWERING', 'CHANGES_ASKED')).toBe(false)
    expect(canMoveStage('DONE', 'DONE')).toBe(true)
  })
  it('restarts the clock on a new stage', () => {
    expect(enterStageData('WITH_TEAM', NOW)).toEqual({ infoStage: 'WITH_TEAM', infoStageAt: NOW, infoRemindersSent: 0, infoLastReminderAt: null, infoStalledAt: null })
  })
})

describe('reminders and stalls', () => {
  const f = (o: Partial<StageFacts>) => facts({ stage: 'READY_TO_CHECK', readyVersionId: 'v', ...o })
  it('day 3 then day 7, once each', () => {
    expect(reminderDue({ facts: f({}), remindersSent: 0, waitingSince: daysAgo(2) }, NOW)).toBeNull()
    expect(reminderDue({ facts: f({}), remindersSent: 0, waitingSince: daysAgo(3) }, NOW)).toBe(3)
    expect(reminderDue({ facts: f({}), remindersSent: 1, waitingSince: daysAgo(5) }, NOW)).toBeNull()
    expect(reminderDue({ facts: f({}), remindersSent: 1, waitingSince: daysAgo(7) }, NOW)).toBe(7)
    expect(reminderDue({ facts: f({}), remindersSent: 0, waitingSince: daysAgo(8) }, NOW)).toBe(7)
    expect(reminderDue({ facts: f({}), remindersSent: 2, waitingSince: daysAgo(9) }, NOW)).toBeNull()
  })
  it('never while the team has the move, or for an untouched page', () => {
    expect(reminderDue({ facts: facts({ stage: 'WITH_TEAM' }), remindersSent: 0, waitingSince: daysAgo(9) }, NOW)).toBeNull()
    expect(reminderDue({ facts: facts({ started: false }), remindersSent: 0, waitingSince: daysAgo(9) }, NOW)).toBeNull()
  })
  it('stalls on day 10, once', () => {
    expect(stallDue({ facts: f({}), stalledAt: null, waitingSince: daysAgo(10) }, NOW)).toBe(true)
    expect(stallDue({ facts: f({}), stalledAt: daysAgo(1), waitingSince: daysAgo(12) }, NOW)).toBe(false)
    expect(stallDue({ facts: f({}), stalledAt: null, waitingSince: daysAgo(9) }, NOW)).toBe(false)
  })
  it('waits from the last edit while answering', () => {
    const edited = daysAgo(1)
    expect(waitingSinceDate({ stage: 'ANSWERING', infoStageAt: daysAgo(5), infoAnswersEditedAt: edited, createdAt: daysAgo(9) })).toBe(edited)
    expect(waitingSinceDate({ stage: 'WITH_TEAM', infoStageAt: null, infoAnswersEditedAt: edited, createdAt: daysAgo(9) }).getTime()).toBe(daysAgo(9).getTime())
  })
})
