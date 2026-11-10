import { describe, expect, it } from 'vitest'
import {
  UNASSIGNED_OWNER,
  decodeOwnerChoice,
  encodeOwnerChoice,
  hasProgramOwner,
  isProgramOwnedBy,
  ownerAssignment,
  ownerTerm,
  ownerWhere,
  programOwnerRole,
  programsBasePath,
} from './program-owner'

const coachOwned = { coachId: 'c1', ambassadorId: null }
const ambassadorOwned = { coachId: null, ambassadorId: 'a1' }
const unowned = { coachId: null, ambassadorId: null }
const both = { coachId: 'c1', ambassadorId: 'a1' }

describe('programOwnerRole / hasProgramOwner', () => {
  it('names the single owner', () => {
    expect(programOwnerRole(coachOwned)).toBe('COACH')
    expect(programOwnerRole(ambassadorOwned)).toBe('AMBASSADOR')
    expect(hasProgramOwner(coachOwned)).toBe(true)
    expect(hasProgramOwner(ambassadorOwned)).toBe(true)
  })

  it('treats no owner as unowned', () => {
    expect(programOwnerRole(unowned)).toBeNull()
    expect(hasProgramOwner(unowned)).toBe(false)
  })

  it('fails closed when both owners are set', () => {
    expect(programOwnerRole(both)).toBeNull()
    expect(hasProgramOwner(both)).toBe(false)
  })
})

describe('isProgramOwnedBy', () => {
  it('matches a coach on their coach profile id', () => {
    expect(isProgramOwnedBy(coachOwned, { role: 'COACH', coachId: 'c1' })).toBe(true)
    expect(isProgramOwnedBy(coachOwned, { role: 'COACH', coachId: 'c2' })).toBe(false)
  })

  it('matches an ambassador on their ambassador id', () => {
    expect(isProgramOwnedBy(ambassadorOwned, { role: 'AMBASSADOR', ambassadorId: 'a1' })).toBe(true)
    expect(isProgramOwnedBy(ambassadorOwned, { role: 'AMBASSADOR', ambassadorId: 'a2' })).toBe(false)
  })

  it('never lets a coach own an ambassador program or the reverse', () => {
    expect(isProgramOwnedBy(ambassadorOwned, { role: 'COACH', coachId: 'a1' })).toBe(false)
    expect(isProgramOwnedBy(coachOwned, { role: 'AMBASSADOR', ambassadorId: 'c1' })).toBe(false)
  })

  it('gives nobody an unowned or doubly-owned program', () => {
    expect(isProgramOwnedBy(unowned, { role: 'COACH', coachId: 'c1' })).toBe(false)
    expect(isProgramOwnedBy(both, { role: 'COACH', coachId: 'c1' })).toBe(false)
    expect(isProgramOwnedBy(both, { role: 'AMBASSADOR', ambassadorId: 'a1' })).toBe(false)
  })
})

describe('ownerWhere', () => {
  it('selects only programs with this owner and no other', () => {
    expect(ownerWhere({ role: 'COACH', coachId: 'c1' })).toEqual({ coachId: 'c1', ambassadorId: null })
    expect(ownerWhere({ role: 'AMBASSADOR', ambassadorId: 'a1' })).toEqual({
      coachId: null,
      ambassadorId: 'a1',
    })
  })
})

describe('paths and wording', () => {
  it('routes each role to its own editor', () => {
    expect(programsBasePath('COACH')).toBe('/coach/programs')
    expect(programsBasePath('AMBASSADOR')).toBe('/ambassador/programs')
  })

  it('calls the owner coach unless it is an ambassador', () => {
    expect(ownerTerm('AMBASSADOR')).toBe('ambassador')
    expect(ownerTerm('COACH')).toBe('coach')
    expect(ownerTerm(null)).toBe('coach')
  })
})

describe('owner picker encoding', () => {
  it('round-trips each kind of owner', () => {
    for (const p of [coachOwned, ambassadorOwned, unowned]) {
      const decoded = decodeOwnerChoice(encodeOwnerChoice(p))
      expect(decoded === undefined).toBe(false)
      expect(ownerAssignment(decoded ?? null)).toEqual(p)
    }
  })

  it('encodes a doubly-owned program as unassigned', () => {
    expect(encodeOwnerChoice(both)).toBe(UNASSIGNED_OWNER)
  })

  it('rejects malformed values', () => {
    expect(decodeOwnerChoice('')).toBeUndefined()
    expect(decodeOwnerChoice('c1')).toBeUndefined()
    expect(decodeOwnerChoice('ADMIN:x')).toBeUndefined()
    expect(decodeOwnerChoice('COACH:')).toBeUndefined()
  })

  it('assignment sets one owner and clears the other', () => {
    expect(ownerAssignment({ role: 'COACH', id: 'c9' })).toEqual({ coachId: 'c9', ambassadorId: null })
    expect(ownerAssignment({ role: 'AMBASSADOR', id: 'a9' })).toEqual({
      coachId: null,
      ambassadorId: 'a9',
    })
    expect(ownerAssignment(null)).toEqual({ coachId: null, ambassadorId: null })
  })
})
