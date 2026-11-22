import { describe, it, expect } from 'vitest'
import {
  weekWindow, inWindow, learnDone, meetStatus, showStatus, inviteDone, buildWeekStatus, needsAttention, sortForCoach,
} from './week-status'

const start = new Date('2026-11-03T23:00:00Z')
const day = 24 * 60 * 60 * 1000

describe('weekWindow', () => {
  it('week 1 starts at the start date and lasts 7 days', () => {
    const w = weekWindow(start, 1)
    expect(w.start.getTime()).toBe(start.getTime())
    expect(w.end.getTime()).toBe(start.getTime() + 7 * day)
  })
  it('week 3 starts 14 days in; end is exclusive', () => {
    const w = weekWindow(start, 3)
    expect(w.start.getTime()).toBe(start.getTime() + 14 * day)
    expect(inWindow(w.end, w)).toBe(false)
    expect(inWindow(w.start, w)).toBe(true)
    expect(inWindow(null, w)).toBe(false)
  })
})

describe('learn', () => {
  const w = weekWindow(start, 2)
  it('done when any lesson finished inside the week', () => {
    expect(learnDone([null, new Date(start.getTime() + 8 * day)], w)).toBe(true)
  })
  it('not done for lessons finished in another week or never', () => {
    expect(learnDone([new Date(start.getTime() + day), null], w)).toBe(false)
    expect(learnDone([], w)).toBe(false)
  })
})

describe('meet', () => {
  const s = { startsAt: new Date(), cancelled: false }
  it('no meeting / cancelled are neither done nor missing', () => {
    expect(meetStatus(null, null)).toMatchObject({ state: 'NO_MEETING', done: false, missing: false })
    expect(meetStatus({ ...s, cancelled: true }, 'PRESENT')).toMatchObject({ state: 'CANCELLED', done: false, missing: false })
  })
  it('present and excused are done, absent is missing, unmarked is neither', () => {
    expect(meetStatus(s, 'PRESENT')).toMatchObject({ done: true, missing: false })
    expect(meetStatus(s, 'EXCUSED')).toMatchObject({ done: true, missing: false })
    expect(meetStatus(s, 'ABSENT')).toMatchObject({ done: false, missing: true })
    expect(meetStatus(s, null)).toMatchObject({ state: 'NOT_MARKED', done: false, missing: false })
    expect(meetStatus(s, 'weird')).toMatchObject({ state: 'NOT_MARKED' })
  })
})

describe('show', () => {
  const t = (n: number) => new Date(start.getTime() + n * day)
  it('none', () => expect(showStatus([])).toEqual({ state: 'NONE', done: false }))
  it('handed in, replied, redo', () => {
    expect(showStatus([{ status: 'SUBMITTED', submittedAt: t(1) }])).toEqual({ state: 'HANDED_IN', done: true })
    expect(showStatus([{ status: 'REVIEWED', submittedAt: t(1) }])).toEqual({ state: 'REPLIED', done: true })
    expect(showStatus([{ status: 'REDO', submittedAt: t(1) }])).toEqual({ state: 'REDO', done: false })
  })
  it('latest piece wins', () => {
    expect(showStatus([{ status: 'REDO', submittedAt: t(1) }, { status: 'SUBMITTED', submittedAt: t(2) }]).state).toBe('HANDED_IN')
  })
})

describe('invite', () => {
  const w = weekWindow(start, 1)
  it('needs a SENT invite inside the week', () => {
    expect(inviteDone([{ status: 'SENT', sentAt: new Date(start.getTime() + day) }], w)).toBe(true)
    expect(inviteDone([{ status: 'SKIPPED', sentAt: new Date(start.getTime() + day) }], w)).toBe(false)
    expect(inviteDone([{ status: 'SENT', sentAt: new Date(start.getTime() + 8 * day) }], w)).toBe(false)
  })
})

describe('buildWeekStatus + coach sorting', () => {
  const w = weekWindow(start, 1)
  const inside = new Date(start.getTime() + day)
  it('counts done out of 5 and missing (Do never counts)', () => {
    const all = buildWeekStatus({
      weekNo: 1, window: w, lessonCompletedAts: [inside],
      session: { startsAt: inside, cancelled: false }, attendance: 'PRESENT',
      pieces: [{ status: 'REVIEWED', submittedAt: inside }], invites: [{ status: 'SENT', sentAt: inside }],
    })
    expect(all.doneCount).toBe(4)
    expect(all.missingCount).toBe(0)
    const none = buildWeekStatus({
      weekNo: 1, window: w, lessonCompletedAts: [], session: { startsAt: inside, cancelled: false },
      attendance: 'ABSENT', pieces: [], invites: [],
    })
    expect(none.doneCount).toBe(0)
    expect(none.missingCount).toBe(4)
    expect(needsAttention(none)).toBe(true)
    expect(needsAttention({ missingCount: 1 })).toBe(false)
  })
  it('puts 2+ missing first, most missing first, then by name', () => {
    const rows = [
      { name: 'Ann', status: { missingCount: 0 } },
      { name: 'Ben', status: { missingCount: 2 } },
      { name: 'Cal', status: { missingCount: 4 } },
      { name: 'Aaron', status: { missingCount: 1 } },
    ]
    expect(sortForCoach(rows).map((r) => r.name)).toEqual(['Cal', 'Ben', 'Aaron', 'Ann'])
  })
})
