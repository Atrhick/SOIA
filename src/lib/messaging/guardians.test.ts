import { describe, it, expect } from 'vitest'
import { ageOn, isMinor, requiredParents, MINOR_NEEDS_PARENT_LOGIN, type AmbassadorAgeInfo } from './guardians'

const today = new Date(2026, 10, 22)
const amb = (userId: string, dob: Date | null, parentUserId: string | null, extra: Partial<AmbassadorAgeInfo> = {}): AmbassadorAgeInfo => ({
  userId,
  dateOfBirth: dob,
  parentUserId,
  ...extra,
})

describe('ageOn / isMinor', () => {
  it('turns 18 on the birthday, not before', () => {
    expect(ageOn(new Date(2008, 10, 22), today)).toBe(18)
    expect(ageOn(new Date(2008, 10, 23), today)).toBe(17)
    expect(isMinor(amb('a', new Date(2008, 10, 23), null), today)).toBe(true)
    expect(isMinor(amb('a', new Date(2008, 10, 22), null), today)).toBe(false)
  })
  it('no date of birth: minor only when parent details are on file', () => {
    expect(isMinor(amb('a', null, null), today)).toBe(false)
    expect(isMinor(amb('a', null, null, { parentEmail: 'p@example.com' }), today)).toBe(true)
    expect(isMinor(amb('a', null, 'p1'), today)).toBe(true)
    expect(isMinor(amb('a', null, null, { parentEmail: '  ' }), today)).toBe(false)
  })
})

describe('requiredParents', () => {
  const kid = amb('kid', new Date(2012, 0, 1), 'mom')
  const kid2 = amb('kid2', new Date(2013, 0, 1), 'dad')
  const orphan = amb('orphan', new Date(2012, 0, 1), null, { parentFirstName: 'Ann' })
  const grown = amb('grown', new Date(2000, 0, 1), null)

  it('adds the parent when an adult messages a minor', () => {
    expect(requiredParents(['coach', 'kid'], [kid], today)).toEqual({ ok: true, parentIds: ['mom'], memberIds: ['coach', 'kid', 'mom'] })
  })
  it('nothing to add when the parent is already in it, or between adults', () => {
    expect(requiredParents(['coach', 'kid', 'mom'], [kid], today)).toMatchObject({ ok: true, parentIds: [] })
    expect(requiredParents(['coach', 'grown'], [grown], today)).toMatchObject({ ok: true, parentIds: [] })
  })
  it('a minor alone with their own parent needs nobody else', () => {
    expect(requiredParents(['kid', 'mom'], [kid], today)).toMatchObject({ ok: true, parentIds: [] })
  })
  it('two minors together need no parents', () => {
    expect(requiredParents(['kid', 'kid2'], [kid, kid2], today)).toMatchObject({ ok: true, parentIds: [] })
  })
  it('one parent added makes the other minor need theirs too', () => {
    const r = requiredParents(['kid', 'kid2', 'mom'], [kid, kid2], today)
    expect(r).toMatchObject({ ok: true, parentIds: ['dad'] })
  })
  it('refuses when the minor has no parent login', () => {
    expect(requiredParents(['coach', 'orphan'], [orphan], today)).toEqual({ ok: false, error: MINOR_NEEDS_PARENT_LOGIN, minorUserIds: ['orphan'] })
  })
})
