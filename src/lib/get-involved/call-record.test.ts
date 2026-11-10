import { describe, it, expect } from 'vitest'
import { CallRecordInput, callRecordSubmitLabel, validateCallRecord } from './call-record'

const base: CallRecordInput = { outcome: 'KEPT', role: 'COACH', topics: ['Mission and vision'], notes: '', parentAttended: null, parentName: '', parentRelationship: '' }
const adult = { minor: false, started: true, allowedRoles: ['COACH', 'VOLUNTEER', 'SPONSOR'] }
const minor = { minor: true, started: true, allowedRoles: ['YOUTH_AMBASSADOR', 'VOLUNTEER'] }

describe('validateCallRecord', () => {
  it('accepts a kept call with an allowed role', () => {
    expect(validateCallRecord(base, adult)).toEqual({})
  })
  it('accepts a kept call with the role decided later', () => {
    expect(validateCallRecord({ ...base, role: null }, adult)).toEqual({})
  })
  it('rejects a role not open to the age range', () => {
    expect(validateCallRecord({ ...base, role: 'BUSINESS_AFFILIATE' }, adult).role).toBeTruthy()
    expect(validateCallRecord({ ...base, role: 'COACH', parentAttended: true, parentName: 'Renee', parentRelationship: 'Parent' }, minor).role).toBeTruthy()
  })
  it('rejects junk role values and unknown topics', () => {
    expect(validateCallRecord({ ...base, role: 'ADMIN' as never }, adult).role).toBeTruthy()
    expect(validateCallRecord({ ...base, topics: ['Something else'] }, adult).topics).toBeTruthy()
  })
  it('needs the call to have started for Kept and No-show, not for Not a fit or Reschedule', () => {
    const early = { ...adult, started: false }
    expect(validateCallRecord(base, early).outcome).toBeTruthy()
    expect(validateCallRecord({ ...base, outcome: 'NO_SHOW' }, early).outcome).toBeTruthy()
    expect(validateCallRecord({ ...base, outcome: 'NOT_A_FIT' }, early)).toEqual({})
    expect(validateCallRecord({ ...base, outcome: 'RESCHEDULE' }, early)).toEqual({})
  })
  it('keeps the 17-and-under parent rule', () => {
    const k = { ...base, role: 'YOUTH_AMBASSADOR' as const }
    const e = validateCallRecord(k, minor)
    expect(e.parentAttended).toBeTruthy()
    expect(e.parentName).toBeTruthy()
    expect(e.parentRelationship).toBeTruthy()
    expect(validateCallRecord({ ...k, parentAttended: false, parentName: 'Renee Ellis', parentRelationship: 'Parent' }, minor).parentAttended).toBeTruthy()
    expect(validateCallRecord({ ...k, parentAttended: true, parentName: 'Renee Ellis', parentRelationship: 'Legal guardian' }, minor)).toEqual({})
  })
  it('does not ask about the parent for a no-show or not a fit', () => {
    expect(validateCallRecord({ ...base, outcome: 'NO_SHOW' }, minor)).toEqual({})
    expect(validateCallRecord({ ...base, outcome: 'NOT_A_FIT' }, minor)).toEqual({})
  })
  it('limits notes to 4000 characters', () => {
    expect(validateCallRecord({ ...base, notes: 'x'.repeat(4001) }, adult).notes).toBeTruthy()
  })
})

describe('callRecordSubmitLabel', () => {
  it('names the role and the step', () => {
    expect(callRecordSubmitLabel({ outcome: 'KEPT', role: 'COACH' }, 'Coach', false)).toBe('Save and send Coach assessment')
    expect(callRecordSubmitLabel({ outcome: 'KEPT', role: 'YOUTH_AMBASSADOR' }, 'Youth ambassador', true)).toBe('Save and send Youth ambassador questions')
    expect(callRecordSubmitLabel({ outcome: 'KEPT', role: 'SPONSOR' }, 'Sponsor', false)).toMatch(/giving/)
    expect(callRecordSubmitLabel({ outcome: 'KEPT', role: null }, null, false)).toMatch(/role later/)
    expect(callRecordSubmitLabel({ outcome: 'NOT_A_FIT', role: null }, null, false)).toMatch(/not a fit/)
  })
})
