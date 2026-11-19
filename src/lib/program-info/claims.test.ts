import { describe, expect, it } from 'vitest'
import { Prisma } from '@prisma/client'
import { publishPageClaimWhere, removableGroupsWhere, sendAnswersClaimWhere } from './claims'

type Row = Record<string, unknown>

/** A tiny stand-in for a conditional updateMany: plain-equality conditions only (what these claims use). */
function matches(row: Row, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([k, v]) => {
    const cur = row[k]
    if (v instanceof Date) return cur instanceof Date && cur.getTime() === v.getTime()
    return cur === v
  })
}
function updateMany(rows: Row[], where: Record<string, unknown>, data: Row): number {
  let n = 0
  for (const r of rows) if (matches(r, where)) { Object.assign(r, data); n++ }
  return n
}

describe('sendAnswers claim', () => {
  it('a double click from the same read: only the first call wins (one T1 email)', () => {
    const rows: Row[] = [{ id: 'p1', infoStage: 'WITH_TEAM', infoAnswersSentAt: new Date('2026-11-17T10:00:00Z') }]
    const read = { ...rows[0] }
    const first = updateMany(rows, sendAnswersClaimWhere('p1', 'WITH_TEAM', read.infoAnswersSentAt as Date), { infoAnswersSentAt: new Date('2026-11-18T10:00:00Z') })
    const second = updateMany(rows, sendAnswersClaimWhere('p1', 'WITH_TEAM', read.infoAnswersSentAt as Date), { infoAnswersSentAt: new Date('2026-11-18T10:00:01Z') })
    expect([first, second]).toEqual([1, 0])
  })

  it('null-safe: a never-sent page matches only while still never sent', () => {
    const rows: Row[] = [{ id: 'p1', infoStage: 'QUESTION_OPEN', infoAnswersSentAt: null }]
    expect(sendAnswersClaimWhere('p1', 'QUESTION_OPEN', null)).toEqual({ id: 'p1', infoStage: 'QUESTION_OPEN', infoAnswersSentAt: null })
    expect(updateMany(rows, sendAnswersClaimWhere('p1', 'QUESTION_OPEN', null), { infoAnswersSentAt: new Date() })).toBe(1)
    expect(updateMany(rows, sendAnswersClaimWhere('p1', 'QUESTION_OPEN', null), { infoAnswersSentAt: new Date() })).toBe(0)
  })
})

describe('publish claim', () => {
  it('owner approval needs READY_TO_CHECK; a question or changes asked since make it lose', () => {
    for (const stage of ['QUESTION_OPEN', 'CHANGES_ASKED', 'WITH_TEAM', 'DONE']) {
      expect(updateMany([{ id: 'p1', infoStage: stage }], publishPageClaimWhere('p1', false), { infoStage: 'DONE' })).toBe(0)
    }
    expect(updateMany([{ id: 'p1', infoStage: 'READY_TO_CHECK' }], publishPageClaimWhere('p1', false), { infoStage: 'DONE' })).toBe(1)
  })

  it('publish on behalf works from any stage', () => {
    for (const stage of ['ANSWERING', 'WITH_TEAM', 'QUESTION_OPEN', 'READY_TO_CHECK', 'CHANGES_ASKED']) {
      expect(updateMany([{ id: 'p1', infoStage: stage }], publishPageClaimWhere('p1', true), { infoStage: 'DONE' })).toBe(1)
    }
  })
})

describe('group removal condition', () => {
  it('puts the never-live / no-sign-ups rule inside the delete', () => {
    const w = removableGroupsWhere('root', ['g1', 'g2'])
    expect(w).toMatchObject({
      id: { in: ['g1', 'g2'] },
      parentProgramId: 'root',
      status: { not: 'PUBLISHED' },
      offlineAt: null,
      pageVersions: { none: { status: 'APPROVED' } },
      leads: { none: {} },
      prospects: { none: {} },
    })
    expect(w.publishedSnapshot).toEqual({ equals: Prisma.DbNull })
  })
})
