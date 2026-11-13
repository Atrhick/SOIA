import { describe, expect, it } from 'vitest'
import { homeForRole, rolesOf, splitRoles } from './roles'

describe('one login, several roles', () => {
  it('lists every role held, highest first, once each', () => {
    expect(rolesOf({ role: 'COACH', extraRoles: ['AMBASSADOR', 'ADMIN', 'COACH'] })).toEqual(['ADMIN', 'COACH', 'AMBASSADOR'])
    expect(rolesOf({ role: 'PARENT', extraRoles: null })).toEqual(['PARENT'])
  })
  it('stores the highest role as the main one so admin lists still find them', () => {
    expect(splitRoles(['AMBASSADOR', 'ADMIN'])).toEqual({ role: 'ADMIN', extraRoles: ['AMBASSADOR'] })
    expect(splitRoles(['COACH'])).toEqual({ role: 'COACH', extraRoles: [] })
    expect(splitRoles(['PARENT'])).toBeNull()
  })
  it('sends each view to its own start page', () => {
    expect(homeForRole('ADMIN')).toBe('/admin')
    expect(homeForRole('AMBASSADOR')).toBe('/ambassador')
    expect(homeForRole('VOLUNTEER')).toBe('/associate')
  })
})
