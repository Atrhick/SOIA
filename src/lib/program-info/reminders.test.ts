import { describe, it, expect, vi } from 'vitest'
vi.mock('@/lib/prisma', () => ({ default: {} }))
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn() }))
import { claimOwnerReminders, claimStall, inReminderHours, planReminders, type ClaimDb, type ReminderCandidate, type ReminderClaimItem } from './reminders'

const DAY = 86400_000
// 16:00 UTC on Wed 18 Nov 2026 = 10:00 Central (CST)
const NOW = new Date('2026-11-18T16:00:00Z')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY - 60_000)

function cand(over: Partial<ReminderCandidate> & { days?: number } = {}): ReminderCandidate {
  const { days = 3, ...rest } = over
  return {
    pageId: 'p1',
    ownerId: 'u1',
    ownerActive: true,
    facts: { stage: 'READY_TO_CHECK', started: true, openQuestionId: null, readyVersionId: 'v1' },
    remindersSent: 0,
    stalledAt: null,
    waitingSince: daysAgo(days),
    stageAt: daysAgo(days),
    ...rest,
  }
}

describe('reminder hours', () => {
  it('only 9:00 to 19:00 US Central', () => {
    expect(inReminderHours(new Date('2026-11-18T14:59:00Z'))).toBe(false) // 8:59 CST
    expect(inReminderHours(new Date('2026-11-18T15:00:00Z'))).toBe(true) // 9:00
    expect(inReminderHours(new Date('2026-11-19T00:59:00Z'))).toBe(true) // 18:59
    expect(inReminderHours(new Date('2026-11-19T01:00:00Z'))).toBe(false) // 19:00
  })

  it('plans no reminders outside the window but still plans stalls', () => {
    const night = new Date('2026-11-19T04:00:00Z')
    const p = planReminders([cand({ waitingSince: new Date(night.getTime() - 11 * DAY) })], night, new Map())
    expect(p.batches).toEqual([])
    expect(p.stalls.map((s) => s.pageId)).toEqual(['p1'])
  })
})

describe('planReminders', () => {
  it('day 3 and day 7, once each', () => {
    expect(planReminders([cand({ days: 2 })], NOW, new Map()).batches).toEqual([])
    expect(planReminders([cand({ days: 3 })], NOW, new Map()).batches[0].items[0].day).toBe(3)
    expect(planReminders([cand({ days: 5, remindersSent: 1 })], NOW, new Map()).batches).toEqual([])
    expect(planReminders([cand({ days: 7, remindersSent: 1 })], NOW, new Map()).batches[0].items[0].day).toBe(7)
    expect(planReminders([cand({ days: 8, remindersSent: 2 })], NOW, new Map()).batches).toEqual([])
  })

  it('covers answering (started only), open questions and ready to check', () => {
    const answering = cand({ facts: { stage: 'ANSWERING', started: true, openQuestionId: null, readyVersionId: null } })
    const untouched = cand({ pageId: 'p2', ownerId: 'u2', facts: { stage: 'ANSWERING', started: false, openQuestionId: null, readyVersionId: null } })
    const question = cand({ pageId: 'p3', ownerId: 'u3', facts: { stage: 'QUESTION_OPEN', started: true, openQuestionId: 'q', readyVersionId: null } })
    const withTeam = cand({ pageId: 'p4', ownerId: 'u4', facts: { stage: 'WITH_TEAM', started: true, openQuestionId: null, readyVersionId: null } })
    const owners = planReminders([answering, untouched, question, withTeam], NOW, new Map()).batches.map((b) => b.ownerId)
    expect(owners).toEqual(['u1', 'u3'])
  })

  it('batches several due pages into one per owner', () => {
    const p = planReminders([cand(), cand({ pageId: 'p2', days: 7, remindersSent: 1 }), cand({ pageId: 'p3', ownerId: 'u2' })], NOW, new Map())
    expect(p.batches).toHaveLength(2)
    expect(p.batches[0]).toMatchObject({ ownerId: 'u1', items: [{ pageId: 'p1', day: 3 }, { pageId: 'p2', day: 7 }] })
  })

  it('at most one reminder per owner per Central day', () => {
    const earlierToday = new Date('2026-11-18T15:10:00Z') // 9:10 Central today
    const yesterday = new Date('2026-11-18T04:00:00Z') // 22:00 Central on the 17th
    expect(planReminders([cand()], NOW, new Map([['u1', earlierToday]])).batches).toEqual([])
    expect(planReminders([cand()], NOW, new Map([['u1', yesterday]])).batches).toHaveLength(1)
  })

  it('skips pages without an owner, inactive owners and stalled pages', () => {
    const p = planReminders([
      cand({ ownerId: null, days: 11 }),
      cand({ pageId: 'p2', ownerActive: false, days: 11 }),
      cand({ pageId: 'p3', ownerId: 'u3', stalledAt: daysAgo(1), days: 12, remindersSent: 1 }),
    ], NOW, new Map())
    expect(p.batches).toEqual([])
    expect(p.stalls).toEqual([])
  })

  it('stalls on day 10, once', () => {
    expect(planReminders([cand({ days: 9, remindersSent: 2 })], NOW, new Map()).stalls).toEqual([])
    expect(planReminders([cand({ days: 10, remindersSent: 2 })], NOW, new Map()).stalls).toHaveLength(1)
  })
})

/** An in-memory stand-in for the transaction client: conditional updates behave like Postgres. */
function fakeDb(pages: Record<string, { infoStage: string; infoStageAt: Date | null; infoRemindersSent: number; infoStalledAt: Date | null }>) {
  const events: { programId: string; kind: string; detail: Record<string, unknown>; createdAt: Date }[] = []
  const matches = (row: Record<string, unknown>, where: Record<string, unknown>) =>
    Object.entries(where).every(([k, v]) => k === 'id' || (v instanceof Date ? (row[k] as Date | null)?.getTime() === v.getTime() : row[k] === v))
  const db: ClaimDb = {
    $executeRaw: async () => 1,
    programPageEvent: {
      findFirst: async ({ where }) => {
        const ownerId = (where.detail as { equals: string }).equals
        const hit = events.filter((e) => e.kind === where.kind && e.detail.ownerId === ownerId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
        return hit ? { createdAt: hit.createdAt } : null
      },
      create: async ({ data }) => { events.push({ programId: data.programId as string, kind: data.kind as string, detail: data.detail as Record<string, unknown>, createdAt: NOW }) },
    },
    coachProgram: {
      updateMany: async ({ where, data }) => {
        const row = pages[where.id as string]
        if (!row || !matches(row, where as Record<string, unknown>)) return { count: 0 }
        Object.assign(row, data)
        return { count: 1 }
      },
    },
  }
  return { db, events, pages }
}

describe('claims', () => {
  const stageAt = daysAgo(3)
  const item = (pageId: string, over: Partial<ReminderClaimItem> = {}): ReminderClaimItem => ({ pageId, day: 3, stage: 'READY_TO_CHECK', stageAt, remindersSent: 0, ...over })

  it('a second run the same day claims nothing (idempotent)', async () => {
    const f = fakeDb({ p1: { infoStage: 'READY_TO_CHECK', infoStageAt: stageAt, infoRemindersSent: 0, infoStalledAt: null } })
    expect(await claimOwnerReminders(f.db, 'u1', [item('p1')], NOW)).toHaveLength(1)
    expect(f.pages.p1.infoRemindersSent).toBe(1)
    expect(await claimOwnerReminders(f.db, 'u1', [item('p1')], NOW)).toEqual([])
    expect(f.events.filter((e) => e.kind === 'REMINDER_SENT')).toHaveLength(1)
    expect(f.events[0].detail).toMatchObject({ ownerId: 'u1', day: 3, pages: 1 })
  })

  it('a concurrent run with a different page of the same owner is refused once one email was claimed', async () => {
    const f = fakeDb({
      p1: { infoStage: 'READY_TO_CHECK', infoStageAt: stageAt, infoRemindersSent: 0, infoStalledAt: null },
      p2: { infoStage: 'READY_TO_CHECK', infoStageAt: stageAt, infoRemindersSent: 0, infoStalledAt: null },
    })
    expect(await claimOwnerReminders(f.db, 'u1', [item('p1')], NOW)).toHaveLength(1)
    expect(await claimOwnerReminders(f.db, 'u1', [item('p2')], NOW)).toEqual([])
  })

  it('stops when the stage changed since it was read', async () => {
    const f = fakeDb({ p1: { infoStage: 'DONE', infoStageAt: NOW, infoRemindersSent: 0, infoStalledAt: null } })
    expect(await claimOwnerReminders(f.db, 'u1', [item('p1')], NOW)).toEqual([])
    expect(f.events).toEqual([])
  })

  it('day 7 marks both reminders as sent', async () => {
    const f = fakeDb({ p1: { infoStage: 'READY_TO_CHECK', infoStageAt: stageAt, infoRemindersSent: 1, infoStalledAt: null } })
    await claimOwnerReminders(f.db, 'u1', [item('p1', { day: 7, remindersSent: 1 })], NOW)
    expect(f.pages.p1.infoRemindersSent).toBe(2)
  })

  it('a stall is claimed once', async () => {
    const f = fakeDb({ p1: { infoStage: 'QUESTION_OPEN', infoStageAt: stageAt, infoRemindersSent: 2, infoStalledAt: null } })
    const s = { pageId: 'p1', stage: 'QUESTION_OPEN' as const, stageAt }
    expect(await claimStall(f.db, s, 10, NOW)).toBe(true)
    expect(await claimStall(f.db, s, 10, NOW)).toBe(false)
    expect(f.events.map((e) => e.kind)).toEqual(['STALLED'])
  })
})
