import { describe, expect, it } from 'vitest'
import { groupLabels, nextStep } from './results-rules'

const p = (id: string, first: string, last: string, city: string | null = null, me = false) => ({ id, first, last, city, me })

describe('groupLabels', () => {
  it('shows first name and last initial, (you) for me', () => {
    const m = groupLabels([p('a', 'Andre', 'pierce', null, true), p('b', 'Lia', '')])
    expect(m.get('a')).toBe('Andre P. (you)')
    expect(m.get('b')).toBe('Lia')
  })

  it('tells two people with the same short name apart by city, then by number', () => {
    const m = groupLabels([p('a', 'Abe', 'Adams', 'Dallas'), p('b', 'Abe', 'Allen', 'Austin'), p('c', 'Kim', 'Lo')])
    expect([m.get('a'), m.get('b'), m.get('c')]).toEqual(['Abe A. (Dallas)', 'Abe A. (Austin)', 'Kim L.'])
    const n = groupLabels([p('x', 'Abe', 'Adams'), p('y', 'abe', 'Allen'), p('z', 'Abe', 'Ash', null, true)])
    expect([n.get('x'), n.get('y'), n.get('z')]).toEqual(['Abe A. 1', 'abe A. 2', 'Abe A. (you)'])
  })
})

describe('nextStep', () => {
  const base = { daysInARow: 0, doneToday: false, followUpsDue: 0, noCall: 0, invitedThisMonth: 0 }
  it('puts people who signed up without a call first', () => {
    expect(nextStep({ ...base, followUpsDue: 3, noCall: 2 })).toMatchObject({ to: 'follow-ups', sentence: "2 people signed up but haven't booked a call yet." })
  })
  it('then other follow-ups, then today', () => {
    expect(nextStep({ ...base, followUpsDue: 1 }).sentence).toBe('1 person is ready for a short check-in today.')
    expect(nextStep({ ...base, daysInARow: 3 })).toMatchObject({ to: 'invite', sentence: "You've invited someone 3 days in a row. Keep it going." })
    expect(nextStep({ ...base, daysInARow: 3, doneToday: true }).to).toBe('playbook')
    expect(nextStep(base).sentence).toMatch(/haven't invited anyone this month/)
    expect(nextStep({ ...base, invitedThisMonth: 4 }).sentence).toMatch(/start a new run/)
  })
})
