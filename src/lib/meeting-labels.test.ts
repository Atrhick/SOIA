import { describe, expect, it } from 'vitest'
import { twoSessions } from './meeting-labels'

describe('twoSessions', () => {
  it('two named sessions are different sessions', () => {
    expect(twoSessions('Intro for Ambassadors', 'Intro for Businesses')).toBe(true)
  })
  it('app names or a missing label mean one session', () => {
    expect(twoSessions('Zoom', 'Google Meet')).toBe(false)
    expect(twoSessions('Intro for Ambassadors', '')).toBe(false)
    expect(twoSessions(null, 'Second link')).toBe(false)
    expect(twoSessions('Weekly call', 'weekly call')).toBe(false)
  })
})
