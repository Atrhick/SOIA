import { describe, expect, it } from 'vitest'
import {
  actionWords, activityLines, ageOn, ago, firstNameOf, hoursFrom, listWords, monthStartIn, plural, roleLabel,
  signInLine, splitAreas, weekLine, type Area,
} from './hub-core'

const NOW = new Date('2026-11-23T15:00:00Z')

describe('names and words', () => {
  it('first name from a full name, else the email', () => {
    expect(firstNameOf('Wendy Manasa Ndebele', 'w@x.com')).toBe('Wendy')
    expect(firstNameOf('  ', 'sam.t@x.com')).toBe('sam.t')
    expect(firstNameOf(null, 'jo@x.com')).toBe('jo')
  })
  it('plural and list', () => {
    expect(plural(1, 'hour')).toBe('1 hour')
    expect(plural(3, 'hour')).toBe('3 hours')
    expect(listWords(['A'])).toBe('A')
    expect(listWords(['A', 'B', 'C'])).toBe('A, B and C')
  })
  it('role labels are plain', () => {
    expect(roleLabel('SERVICE_PROVIDER')).toBe('Service provider')
    expect(roleLabel('SOMETHING_NEW')).toBe('Something new')
  })
})

describe('dates', () => {
  it('age in whole years', () => {
    expect(ageOn(new Date('2010-11-24T00:00:00Z'), NOW)).toBe(15)
    expect(ageOn(new Date('2010-11-23T00:00:00Z'), NOW)).toBe(16)
    expect(ageOn(null, NOW)).toBeNull()
  })
  it('month start in Central time', () => {
    // 1 Nov 2026 00:00 CDT (UTC-5) = 05:00Z
    expect(monthStartIn(NOW, 'America/Chicago').toISOString()).toBe('2026-11-01T05:00:00.000Z')
    expect(monthStartIn(NOW, 'UTC').toISOString()).toBe('2026-11-01T00:00:00.000Z')
    // Late on 30 Nov in Chicago is still November there although December in UTC.
    expect(monthStartIn(new Date('2026-12-01T03:00:00Z'), 'America/Chicago').toISOString()).toBe('2026-11-01T05:00:00.000Z')
  })
  it('hours, running timer counts to now', () => {
    expect(hoursFrom([
      { startTime: new Date('2026-11-23T10:00:00Z'), endTime: new Date('2026-11-23T11:30:00Z') },
      { startTime: new Date('2026-11-23T14:00:00Z'), endTime: null },
    ], NOW)).toBe(2.5)
    expect(hoursFrom([], NOW)).toBe(0)
  })
  it('ago', () => {
    expect(ago(new Date(NOW.getTime() - 20_000), NOW)).toBe('just now')
    expect(ago(new Date(NOW.getTime() - 5 * 60_000), NOW)).toBe('5 minutes ago')
    expect(ago(new Date(NOW.getTime() - 2 * 3600_000), NOW)).toBe('2 hours ago')
    expect(ago(new Date(NOW.getTime() - 30 * 3600_000), NOW)).toBe('yesterday')
    expect(ago(new Date(NOW.getTime() - 3 * 86400_000), NOW)).toBe('3 days ago')
    expect(ago('2026-01-05T12:00:00Z', NOW)).toBe('on Jan 5, 2026')
    expect(ago(null, NOW)).toBeNull()
  })
  it('sign-in line', () => {
    expect(signInLine(null, null, NOW)).toBe('Never signed in')
    expect(signInLine(new Date(NOW.getTime() - 3 * 86400_000), new Date(NOW.getTime() - 2 * 3600_000), NOW))
      .toBe('Last signed in 3 days ago · Last active 2 hours ago')
    expect(signInLine(null, new Date(NOW.getTime() - 2 * 3600_000), NOW)).toBe('Signed in before sign-ins were recorded · Last active 2 hours ago')
  })
})

describe('activity', () => {
  it('action words', () => {
    expect(actionWords('IMPERSONATE_USER')).toBe('Viewed the app as this person')
    expect(actionWords('UPDATE_AMBASSADOR_PROFILE')).toBe('Changed ambassador profile')
    expect(actionWords('CREATE_LMS_COURSE')).toBe('Created course')
    expect(actionWords('PARTNER_CODE_SENT')).toBe('Partner code sent')
  })
  it('their own actions vs things done to them', () => {
    const rows = [
      { id: '1', userId: 'me', action: 'SUBMIT_BUSINESS_IDEA', entityType: 'BusinessIdea', entityId: 'b', createdAt: NOW },
      { id: '2', userId: 'adm', action: 'RESET_USER_PASSWORD', entityType: 'User', entityId: 'me', createdAt: NOW },
      { id: '3', userId: null, action: 'UPDATE_USER_ROLE', entityType: 'User', entityId: 'me', createdAt: NOW },
    ]
    const lines = activityLines(rows, 'me', new Map([['adm', 'Ada Admin']]))
    expect(lines.map((l) => [l.text, l.byThem])).toEqual([
      ['Sent their business idea for review', true],
      ['Ada Admin: reset the password', false],
      ['The system: changed role', false],
    ])
  })
})

describe('areas', () => {
  it('splits shown cards from nothing-yet titles, keeping order', () => {
    const a = (key: string, empty: boolean): Area => ({ key, title: key, status: '', empty, links: [] })
    expect(splitAreas([a('Groups', false), a('Learning', true), a('Time', false), a('Support', true)])).toEqual({
      shown: [a('Groups', false), a('Time', false)],
      nothingYet: ['Learning', 'Support'],
    })
  })
  it('week line', () => {
    expect(weekLine({ weekNo: 3, doneCount: 2 }, 8, 'live')).toBe('Week 3 of 8 · 2 of 5 done')
    expect(weekLine({ weekNo: 1, doneCount: 0 }, 8, 'before')).toBe('The group starts soon · week 1 of 8')
  })
})
