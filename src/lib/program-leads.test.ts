import { describe, expect, it } from 'vitest'
import { flattenProgramLeads, toProgramLeadRow, type ProgramLeadSource } from './program-leads'

function lead(overrides: Partial<ProgramLeadSource> = {}): ProgramLeadSource {
  return {
    id: 'l1',
    fullName: 'Pat Doe',
    email: 'pat@example.com',
    profession: 'Teacher',
    registeredAt: new Date('2026-11-01T10:00:00Z'),
    qualifiedAt: null,
    interestedAt: null,
    association: 'UNCLASSIFIED',
    audience: 'SELF',
    children: null,
    phone: null,
    familyStage: null,
    token: 'pl_abc',
    answers: null,
    ...overrides,
  }
}

describe('toProgramLeadRow', () => {
  it('serializes dates and builds the joining link', () => {
    const row = toProgramLeadRow(
      { name: 'Youth Lab', slug: 'youth-lab' },
      lead({ interestedAt: new Date('2026-11-02T00:00:00Z') })
    )
    expect(row.programName).toBe('Youth Lab')
    expect(row.registeredAt).toBe('2026-11-01T10:00:00.000Z')
    expect(row.interestedAt).toBe('2026-11-02T00:00:00.000Z')
    expect(row.qualifiedAt).toBeNull()
    expect(row.joiningPath).toBe('/p/youth-lab/r/pl_abc')
  })

  it('keeps children and answers, and tolerates missing or malformed JSON', () => {
    const kids = [{ firstName: 'Sam', ageBand: '10_13' }]
    const answers = [{ label: 'Why?', value: 'Because' }]
    const row = toProgramLeadRow({ name: 'P', slug: 'p' }, lead({ children: kids, answers }))
    expect(row.children).toEqual(kids)
    expect(row.answers).toEqual(answers)

    const empty = toProgramLeadRow({ name: 'P', slug: 'p' }, lead({ children: { bad: 1 }, answers: 'x' }))
    expect(empty.children).toEqual([])
    expect(empty.answers).toEqual([])
  })
})

describe('flattenProgramLeads', () => {
  it('merges programs and sorts newest signup first', () => {
    const rows = flattenProgramLeads([
      { name: 'A', slug: 'a', leads: [lead({ id: 'old', registeredAt: new Date('2026-10-01') })] },
      {
        name: 'B',
        slug: 'b',
        leads: [
          lead({ id: 'new', registeredAt: new Date('2026-11-05') }),
          lead({ id: 'mid', registeredAt: new Date('2026-10-15') }),
        ],
      },
    ])
    expect(rows.map((r) => r.id)).toEqual(['new', 'mid', 'old'])
    expect(rows.map((r) => r.programName)).toEqual(['B', 'B', 'A'])
  })

  it('returns nothing for no programs', () => {
    expect(flattenProgramLeads([])).toEqual([])
  })
})
