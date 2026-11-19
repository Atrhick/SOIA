import { describe, expect, it } from 'vitest'
import {
  SENDER_STATUS_LABEL, SUPPORT_CATEGORIES, canAssign, canBeAssigned, categoryLabel, cleanText, inboxWhere, isSenderRole,
  isTeamRole, parseFilter, senderCanView, senderMessagePath, statusAfterAssign, statusAfterSenderReply, takesOnReply,
  teamCanAct, teamCanView, teamMessagePath, teamStatusProblem,
} from './core'

const admin = { id: 'a1', role: 'ADMIN' }
const sub = { id: 's1', role: 'SUB_ADMIN' }
const coach = { id: 'c1', role: 'COACH' }
const newMsg = { senderId: 'c1', assignedToId: null, status: 'NEW' as const }
const subMsg = { senderId: 'c1', assignedToId: 's1', status: 'ASSIGNED' as const }
const otherMsg = { senderId: 'c1', assignedToId: 's2', status: 'ASSIGNED' as const }

describe('categories', () => {
  it('has the six agreed categories', () => {
    expect(SUPPORT_CATEGORIES.map((c) => c.label)).toEqual([
      'Program page', 'Signing in', 'One-A-Day and invites', 'Discovery calls', 'Payments', 'Something else',
    ])
  })
  it('labels unknown keys as Something else', () => {
    expect(categoryLabel('PAYMENTS')).toBe('Payments')
    expect(categoryLabel('nope')).toBe('Something else')
  })
})

describe('roles', () => {
  it('team = admins and sub-admins', () => {
    expect(isTeamRole('ADMIN')).toBe(true)
    expect(isTeamRole('SUB_ADMIN')).toBe(true)
    expect(isTeamRole('COACH')).toBe(false)
  })
  it('senders = coaches, ambassadors, associates', () => {
    for (const r of ['COACH', 'AMBASSADOR', 'SERVICE_PROVIDER', 'BUSINESS_AFFILIATE', 'VOLUNTEER']) expect(isSenderRole(r)).toBe(true)
    for (const r of ['ADMIN', 'SUB_ADMIN', 'PARENT', undefined]) expect(isSenderRole(r)).toBe(false)
  })
  it('only active admins and sub-admins can be assigned', () => {
    expect(canBeAssigned({ role: 'SUB_ADMIN', status: 'ACTIVE' })).toBe(true)
    expect(canBeAssigned({ role: 'ADMIN', status: 'SUSPENDED' })).toBe(false)
    expect(canBeAssigned({ role: 'COACH', status: 'ACTIVE' })).toBe(false)
  })
})

describe('who sees and does what', () => {
  it('admins see and act on everything', () => {
    for (const m of [newMsg, subMsg, otherMsg]) {
      expect(teamCanView(admin, m)).toBe(true)
      expect(teamCanAct(admin, m)).toBe(true)
    }
    expect(canAssign(admin)).toBe(true)
  })
  it('sub-admins see their own and New ones, act only on their own, never assign', () => {
    expect(teamCanView(sub, newMsg)).toBe(true)
    expect(teamCanAct(sub, newMsg)).toBe(false)
    expect(teamCanView(sub, subMsg)).toBe(true)
    expect(teamCanAct(sub, subMsg)).toBe(true)
    expect(teamCanView(sub, otherMsg)).toBe(false)
    expect(teamCanAct(sub, otherMsg)).toBe(false)
    expect(canAssign(sub)).toBe(false)
  })
  it('a sub-admin loses a Done message once it is reassigned away', () => {
    expect(teamCanView(sub, { ...otherMsg, status: 'DONE' })).toBe(false)
  })
  it('senders see only their own; not the team view', () => {
    expect(senderCanView(coach, newMsg)).toBe(true)
    expect(senderCanView({ id: 'c2', role: 'COACH' }, newMsg)).toBe(false)
    expect(teamCanView(coach, newMsg)).toBe(false)
    expect(canAssign(coach)).toBe(false)
  })
})

describe('status moves', () => {
  it('assigning a New message makes it Assigned; others keep their status', () => {
    expect(statusAfterAssign('NEW')).toBe('ASSIGNED')
    expect(statusAfterAssign('WAITING_ON_SENDER')).toBe('WAITING_ON_SENDER')
    expect(statusAfterAssign('DONE')).toBe('DONE')
  })
  it('a sender reply goes back to the team, reopening Done', () => {
    expect(statusAfterSenderReply('WAITING_ON_SENDER', true)).toBe('ASSIGNED')
    expect(statusAfterSenderReply('DONE', true)).toBe('ASSIGNED')
    expect(statusAfterSenderReply('DONE', false)).toBe('NEW')
    expect(statusAfterSenderReply('NEW', false)).toBe('NEW')
    expect(statusAfterSenderReply('ASSIGNED', true)).toBe('ASSIGNED')
  })
  it('team status changes', () => {
    expect(teamStatusProblem('ASSIGNED', 'DONE', true)).toBeNull()
    expect(teamStatusProblem('NEW', 'DONE', false)).toBeNull()
    expect(teamStatusProblem('DONE', 'ASSIGNED', true)).toBeNull()
    expect(teamStatusProblem('NEW', 'WAITING_ON_SENDER', false)).toMatch(/Assign/)
    expect(teamStatusProblem('DONE', 'ASSIGNED', false)).toMatch(/Assign/)
    expect(teamStatusProblem('DONE', 'DONE', true)).toMatch(/already/)
  })
  it('replying to a New message takes it', () => {
    expect(takesOnReply(newMsg)).toBe(true)
    expect(takesOnReply(subMsg)).toBe(false)
  })
  it('the sender never reads a team member name in a status', () => {
    expect(Object.values(SENDER_STATUS_LABEL).join(' ')).not.toMatch(/assigned to [a-z]/i)
  })
})

describe('inbox', () => {
  it('parses filters with New as the default', () => {
    expect(parseFilter('done')).toBe('done')
    expect(parseFilter('x')).toBe('new')
    expect(parseFilter(undefined)).toBe('new')
  })
  it('admins get the plain filter', () => {
    expect(inboxWhere(admin, 'new')).toEqual({ status: 'NEW', assignedToId: null })
    expect(inboxWhere(admin, 'mine')).toEqual({ assignedToId: 'a1', status: { not: 'DONE' } })
    expect(inboxWhere(admin, 'open')).toEqual({ status: { not: 'DONE' } })
  })
  it('sub-admins are limited to their own plus New', () => {
    expect(inboxWhere(sub, 'open')).toEqual({
      AND: [{ status: { not: 'DONE' } }, { OR: [{ assignedToId: 's1' }, { status: 'NEW', assignedToId: null }] }],
    })
  })
})

describe('paths and text', () => {
  it('team and sender paths', () => {
    expect(teamMessagePath('ADMIN', 'm1')).toBe('/admin/support/m1')
    expect(teamMessagePath('SUB_ADMIN', 'm1')).toBe('/team/support/m1')
    expect(senderMessagePath('COACH', 'm1')).toBe('/coach/support/m1')
    expect(senderMessagePath('AMBASSADOR', 'm1')).toBe('/ambassador/support/m1')
    expect(senderMessagePath('VOLUNTEER', 'm1')).toBe('/associate/support/m1')
  })
  it('cleans typed text', () => {
    expect(cleanText('  hi\r\n\r\n\r\n\r\nthere  ')).toBe('hi\n\nthere')
  })
})
