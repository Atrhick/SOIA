import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ default: {} }))
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn() }))
vi.mock('next/headers', () => ({ headers: vi.fn() }))

import { StatusConflictError, isStatusConflict, mustTransition, transitionStatus } from './server'
import type { Prisma } from '@prisma/client'
import {
  assessmentMarkerMatches, canInvite, canMoveStatus, canResendLink, defaultTermsBody, termsStillMatch,
} from './core'

/** A fake transaction whose prospect row behaves like Postgres' conditional UPDATE. */
function fakeTx(row: Record<string, unknown>) {
  const history: unknown[] = []
  const tx = {
    prospect: {
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const match = Object.entries(where).every(([k, v]) => row[k] === v)
        if (!match) return { count: 0 }
        Object.assign(row, data)
        return { count: 1 }
      }),
    },
    prospectStatusHistory: { create: vi.fn(async (a: { data: unknown }) => { history.push(a.data) }) },
  }
  return { tx: tx as unknown as Prisma.TransactionClient, history, row }
}

describe('transitionStatus', () => {
  it('moves the status, writes the extra data and one history row', async () => {
    const { tx, history, row } = fakeTx({ id: 'p1', status: 'AWAITING_PARENT_CONSENT', parentConsentAt: null })
    const ok = await transitionStatus(tx, 'p1', 'AWAITING_PARENT_CONSENT', 'FORM_SUBMITTED', null, 'consent', { where: { parentConsentAt: null }, data: { parentConsentSignature: 'Ann' } })
    expect(ok).toBe(true)
    expect(row.status).toBe('FORM_SUBMITTED')
    expect(row.parentConsentSignature).toBe('Ann')
    expect(history).toHaveLength(1)
  })

  it('writes nothing when the status already changed (e.g. closed as Not a fit)', async () => {
    const { tx, history, row } = fakeTx({ id: 'p1', status: 'NOT_A_FIT', parentConsentAt: null })
    const ok = await transitionStatus(tx, 'p1', 'AWAITING_PARENT_CONSENT', 'FORM_SUBMITTED', null)
    expect(ok).toBe(false)
    expect(row.status).toBe('NOT_A_FIT')
    expect(history).toHaveLength(0)
  })

  it('of two concurrent moves from the same status only the first wins', async () => {
    const { tx, history, row } = fakeTx({ id: 'p1', status: 'PAYMENT_PENDING' })
    const a = await transitionStatus(tx, 'p1', 'PAYMENT_PENDING', 'NOT_A_FIT', 'admin1')
    const b = await transitionStatus(tx, 'p1', 'PAYMENT_PENDING', 'PAYMENT_COMPLETED', 'admin2')
    expect([a, b]).toEqual([true, false])
    expect(row.status).toBe('NOT_A_FIT')
    expect(history).toHaveLength(1)
  })

  it('refuses moves the journey does not allow, without touching the row', async () => {
    const { tx, row } = fakeTx({ id: 'p1', status: 'NOT_A_FIT' })
    expect(await transitionStatus(tx, 'p1', 'NOT_A_FIT', 'FORM_SUBMITTED', null)).toBe(false)
    expect(row.status).toBe('NOT_A_FIT')
  })

  it('the extra where clause must also match', async () => {
    const { tx, row } = fakeTx({ id: 'p1', status: 'ORIENTATION_COMPLETED', userId: 'u1' })
    expect(await transitionStatus(tx, 'p1', 'ORIENTATION_COMPLETED', 'ACCOUNT_CREATED', null, undefined, { where: { userId: null } })).toBe(false)
    expect(row.status).toBe('ORIENTATION_COMPLETED')
  })

  it('same-status moves need no history row', async () => {
    const { tx, history } = fakeTx({ id: 'p1', status: 'ASSESSMENT_PENDING' })
    expect(await transitionStatus(tx, 'p1', 'ASSESSMENT_PENDING', 'ASSESSMENT_PENDING', 'a')).toBe(true)
    expect(history).toHaveLength(0)
  })

  it('mustTransition throws a StatusConflictError so the transaction rolls back', async () => {
    const { tx } = fakeTx({ id: 'p1', status: 'NOT_A_FIT' })
    const err = await mustTransition(tx, 'p1', 'FORM_SUBMITTED', 'DISCOVERY_BOOKED', null).catch((e) => e)
    expect(err).toBeInstanceOf(StatusConflictError)
    expect(isStatusConflict(err)).toBe(true)
    expect(isStatusConflict(new Error('x'))).toBe(false)
  })
})

describe('canMoveStatus', () => {
  it('allows the phase 1 moves and the journey moves', () => {
    expect(canMoveStatus('AWAITING_PARENT_CONSENT', 'FORM_SUBMITTED')).toBe(true)
    expect(canMoveStatus('FORM_SUBMITTED', 'DISCOVERY_BOOKED')).toBe(true)
    expect(canMoveStatus('DISCOVERY_BOOKED', 'FORM_SUBMITTED')).toBe(true)
    expect(canMoveStatus('ASSESSMENT_PENDING', 'ASSESSMENT_COMPLETED')).toBe(true)
    expect(canMoveStatus('ORIENTATION_COMPLETED', 'ACCOUNT_CREATED')).toBe(true)
    expect(canMoveStatus('PAYMENT_PENDING', 'NOT_A_FIT')).toBe(true)
  })
  it('never reopens a closed or finished prospect', () => {
    expect(canMoveStatus('NOT_A_FIT', 'FORM_SUBMITTED')).toBe(false)
    expect(canMoveStatus('NOT_A_FIT', 'DISCOVERY_BOOKED')).toBe(false)
    expect(canMoveStatus('ACCOUNT_CREATED', 'NOT_A_FIT')).toBe(false)
    expect(canMoveStatus('PAYMENT_COMPLETED', 'NOT_A_FIT')).toBe(false)
    expect(canMoveStatus('PAUSED', 'FORM_SUBMITTED')).toBe(false)
  })
})

describe('canResendLink', () => {
  it('only for open journeys', () => {
    for (const s of ['FORM_SUBMITTED', 'DISCOVERY_BOOKED', 'ASSESSMENT_PENDING', 'ORIENTATION_COMPLETED', 'PAYMENT_PENDING', 'PAYMENT_COMPLETED']) expect(canResendLink(s)).toBe(true)
    for (const s of ['NOT_A_FIT', 'PAUSED', 'ACCOUNT_CREATED', 'DONATION_HANDOFF', 'AWAITING_PARENT_CONSENT']) expect(canResendLink(s)).toBe(false)
  })
})

describe('termsStillMatch', () => {
  const def = defaultTermsBody('VOLUNTEER')
  it('same version matches', () => expect(termsStillMatch(3, { version: 3, body: 'x' }, def)).toBe(true))
  it('a newer saved version does not', () => expect(termsStillMatch(3, { version: 4, body: 'x' }, def)).toBe(false))
  it('the unsaved default (v0) matches a v1 made from the default text', () => expect(termsStillMatch(0, { version: 1, body: def }, def)).toBe(true))
  it('but not a v1 an admin wrote meanwhile', () => expect(termsStillMatch(0, { version: 1, body: 'New admin text' }, def)).toBe(false))
})

describe('canInvite', () => {
  it('coaches and ambassadors only', () => {
    expect(canInvite('COACH')).toBe(true)
    expect(canInvite('AMBASSADOR')).toBe(true)
    for (const r of ['VOLUNTEER', 'SERVICE_PROVIDER', 'BUSINESS_AFFILIATE', 'PARENT', 'ADMIN', null]) expect(canInvite(r)).toBe(false)
  })
})

describe('assessmentMarkerMatches', () => {
  const at = new Date('2026-11-09T14:00:00.123Z')
  it('matches the role choice the form was built for', () => {
    expect(assessmentMarkerMatches({ journeyRole: 'COACH', journeyRoleChosenAt: at }, { role: 'COACH', chosenAt: at.toISOString() })).toBe(true)
  })
  it('refuses answers after a role change', () => {
    expect(assessmentMarkerMatches({ journeyRole: 'SERVICE_PROVIDER', journeyRoleChosenAt: new Date(at.getTime() + 1) }, { role: 'COACH', chosenAt: at.toISOString() })).toBe(false)
  })
  it('refuses a re-choice of the same role (new questions snapshot)', () => {
    expect(assessmentMarkerMatches({ journeyRole: 'COACH', journeyRoleChosenAt: new Date(at.getTime() + 5000) }, { role: 'COACH', chosenAt: at.toISOString() })).toBe(false)
  })
})
