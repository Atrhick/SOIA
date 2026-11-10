import { describe, expect, it } from 'vitest'
import { JourneyRow, csvCell, filterRows, filtersFrom, lastActivity, listStageFor, relativeDay, rowsToCsv, callWhen, exportHref } from './journey-list'

const base = { userId: null, noShowCount: 0 }

describe('listStageFor', () => {
  it('maps journey statuses to list stages', () => {
    expect(listStageFor({ ...base, status: 'FORM_SUBMITTED' })).toBe('FORM')
    expect(listStageFor({ ...base, status: 'AWAITING_PARENT_CONSENT' })).toBe('FORM')
    expect(listStageFor({ ...base, status: 'FORM_SUBMITTED', noShowCount: 1 })).toBe('NO_SHOW')
    expect(listStageFor({ ...base, status: 'PAUSED' })).toBe('NO_SHOW')
    expect(listStageFor({ ...base, status: 'DISCOVERY_BOOKED' })).toBe('CALL_BOOKED')
    expect(listStageFor({ ...base, status: 'DISCOVERY_COMPLETED' })).toBe('CALL_KEPT')
    expect(listStageFor({ ...base, status: 'ASSESSMENT_PENDING' })).toBe('ASSESSMENT')
    expect(listStageFor({ ...base, status: 'ASSESSMENT_COMPLETED' })).toBe('ORIENTATION')
    expect(listStageFor({ ...base, status: 'ORIENTATION_SCHEDULED' })).toBe('ORIENTATION')
    expect(listStageFor({ ...base, status: 'ORIENTATION_COMPLETED' })).toBe('TERMS_PAYMENT')
    expect(listStageFor({ ...base, status: 'PAYMENT_PENDING' })).toBe('TERMS_PAYMENT')
    expect(listStageFor({ ...base, status: 'PAYMENT_COMPLETED' })).toBe('TERMS_PAYMENT')
    expect(listStageFor({ ...base, status: 'ACCOUNT_CREATED' })).toBe('JOINED')
    expect(listStageFor({ ...base, status: 'PAYMENT_COMPLETED', userId: 'u1' })).toBe('JOINED')
    expect(listStageFor({ ...base, status: 'DONATION_HANDOFF' })).toBe('DONATION')
    expect(listStageFor({ ...base, status: 'NOT_A_FIT' })).toBe('NOT_A_FIT')
  })
})

describe('csvCell', () => {
  it('neutralises formula-looking cells and quotes everything', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(csvCell('+1 555')).toBe(`"'+1 555"`)
    expect(csvCell('-2')).toBe(`"'-2"`)
    expect(csvCell('@SUM(A1)')).toBe(`"'@SUM(A1)"`)
    expect(csvCell('\tx')).toBe(`"'\tx"`)
    expect(csvCell('Jo, "Jr"')).toBe(`"Jo, ""Jr"""`)
    expect(csvCell(null)).toBe('""')
  })
})

const row = (o: Partial<JourneyRow>): JourneyRow => ({
  id: 'p', name: 'Sam Patel', email: 'sam@example.com', phone: '(678) 555-0123', city: null, ageRange: 'AGE_25_55', ageLabel: '25–55',
  inviterId: 'u1', inviterName: 'Daniella Munene', role: 'COACH', roleLabel: 'Coach', status: 'ASSESSMENT_PENDING', stage: 'ASSESSMENT',
  stageLabel: 'Assessment', stageClass: '', nextStep: '', lastActivity: 'Questions sent today', lastActivityAt: '2026-11-09T16:00:00.000Z', createdAt: '2026-11-04T02:12:00.000Z',
  ...o,
})

describe('filterRows', () => {
  const rows = [
    row({ id: 'a' }),
    row({ id: 'b', name: 'Maya Ellis', email: 'maya@example.com', phone: null, ageRange: 'UNDER_18', inviterId: null, role: null, stage: 'FORM' }),
  ]
  const none = { q: '', age: '', inviter: '', role: '', stage: '' }
  it('searches name, email and phone digits', () => {
    expect(filterRows(rows, { ...none, q: 'maya' }).map((r) => r.id)).toEqual(['b'])
    expect(filterRows(rows, { ...none, q: 'SAM@' }).map((r) => r.id)).toEqual(['a'])
    expect(filterRows(rows, { ...none, q: '555-0123' }).map((r) => r.id)).toEqual(['a'])
  })
  it('filters by age, inviter, role and stage, with "none" for empty values', () => {
    expect(filterRows(rows, { ...none, age: 'UNDER_18' }).map((r) => r.id)).toEqual(['b'])
    expect(filterRows(rows, { ...none, inviter: 'none' }).map((r) => r.id)).toEqual(['b'])
    expect(filterRows(rows, { ...none, inviter: 'u1' }).map((r) => r.id)).toEqual(['a'])
    expect(filterRows(rows, { ...none, role: 'none' }).map((r) => r.id)).toEqual(['b'])
    expect(filterRows(rows, { ...none, role: 'COACH', stage: 'ASSESSMENT' }).map((r) => r.id)).toEqual(['a'])
    expect(filterRows(rows, { ...none, stage: 'JOINED' })).toEqual([])
  })
  it('reads filters from search params and builds the export link', () => {
    const f = filtersFrom(new URLSearchParams('q=sam&stage=ASSESSMENT&x=1'))
    expect(f).toEqual({ q: 'sam', age: '', inviter: '', role: '', stage: 'ASSESSMENT' })
    expect(filtersFrom({ age: ['UNDER_18', 'x'] }).age).toBe('UNDER_18')
    expect(exportHref(f)).toBe('/admin/prospects/export?q=sam&stage=ASSESSMENT')
  })
  it('writes a CSV with a header, a BOM and CRLF lines', () => {
    const csv = rowsToCsv([row({ name: '=cmd' })])
    expect(csv.startsWith('﻿"Name"')).toBe(true)
    expect(csv).toContain(`"'=cmd"`)
    expect(csv.split('\r\n')).toHaveLength(3)
  })
})

describe('dates and last activity', () => {
  const now = new Date('2026-11-09T18:00:00Z') // Mon Nov 9, noon in Chicago
  it('relativeDay uses the business time zone', () => {
    expect(relativeDay(new Date('2026-11-09T15:00:00Z'), now)).toBe('today')
    expect(relativeDay(new Date('2026-11-08T15:00:00Z'), now)).toBe('yesterday')
    expect(relativeDay(new Date('2026-11-07T15:00:00Z'), now)).toBe('2 days ago')
    expect(relativeDay(new Date('2026-10-29T15:00:00Z'), now)).toBe('Oct 29')
  })
  it('callWhen names the weekday within a week', () => {
    expect(callWhen(new Date('2026-11-12T20:00:00Z'), now)).toBe('Thu 2 PM')
    expect(callWhen(new Date('2026-11-09T20:30:00Z'), now)).toBe('today 2:30 PM')
  })
  const facts = {
    status: 'ASSESSMENT_PENDING', stage: 'ASSESSMENT' as const, createdAt: now, updatedAt: now, parentConsentRequestedAt: null,
    journeyRoleChosenAt: null, assessmentSentAt: new Date('2026-11-09T16:41:00Z'), assessmentSubmittedAt: null, orientationRemindAt: null,
    orientationWatchedAt: null, roleTermsAcceptedAt: null, paidAt: null, joinedAt: null, notAFitAt: null, bookedCallAt: null, missedCallAt: null, lastHistoryAt: null,
  }
  it('describes the latest step', () => {
    expect(lastActivity(facts, now).text).toBe('Questions sent today')
    expect(lastActivity({ ...facts, status: 'DISCOVERY_BOOKED', stage: 'CALL_BOOKED', bookedCallAt: new Date('2026-11-12T20:00:00Z') }, now).text).toBe('Call Thu 2 PM')
    expect(lastActivity({ ...facts, status: 'AWAITING_PARENT_CONSENT', stage: 'FORM', parentConsentRequestedAt: new Date('2026-11-07T15:00:00Z') }, now).text).toBe('Parent emailed 2 days ago')
    expect(lastActivity({ ...facts, status: 'NOT_A_FIT', stage: 'NOT_A_FIT', notAFitAt: new Date('2026-10-29T15:00:00Z') }, now).text).toBe('Oct 29')
  })
})
