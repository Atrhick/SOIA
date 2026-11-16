import { describe, it, expect } from 'vitest'
import { broadcastEmail, countsFrom, deliveryPlan, isAppPath, linkFor, normalizeCustomLink, pushBody, rolesForGroups } from './core'

describe('who gets it', () => {
  it('maps groups to roles, admins include sub-admins', () => {
    expect(rolesForGroups(['COACH', 'ADMIN'])).toEqual(['COACH', 'ADMIN', 'SUB_ADMIN'])
    expect(rolesForGroups(['NOPE'])).toEqual([])
  })
})

describe('where a tap goes', () => {
  it('sends One-A-Day to the right view, everyone else home', () => {
    expect(linkFor('one-a-day', { role: 'ADMIN', extraRoles: ['COACH'] })).toBe('/coach/one-a-day')
    expect(linkFor('one-a-day', { role: 'AMBASSADOR' })).toBe('/ambassador/one-a-day')
    expect(linkFor('one-a-day', { role: 'VOLUNTEER' })).toBe('/')
    expect(linkFor('home', { role: 'COACH' })).toBe('/')
    expect(linkFor('/coach/learning', { role: 'COACH' })).toBe('/coach/learning')
  })
  it('only accepts pages inside this app', () => {
    expect(isAppPath('/coach/learning?x=1')).toBe(true)
    expect(isAppPath('//evil.com')).toBe(false)
    expect(isAppPath('/a b')).toBe(false)
    expect(normalizeCustomLink('https://www.nowtransformedleadership.com/coach/learning', 'https://www.nowtransformedleadership.com')).toBe('/coach/learning')
    expect(normalizeCustomLink('https://nowtransformedleadership.com/x', 'https://www.nowtransformedleadership.com')).toBe('/x')
    expect(normalizeCustomLink('https://evil.com/coach', 'https://www.nowtransformedleadership.com')).toBeNull()
    expect(normalizeCustomLink('javascript:alert(1)', 'https://www.nowtransformedleadership.com')).toBeNull()
    expect(linkFor('javascript:alert(1)', { role: 'COACH' })).toBe('/')
  })
})

describe('push text', () => {
  it('keeps short messages and cuts long ones at a word', () => {
    expect(pushBody('Team call\n\nThursday')).toBe('Team call Thursday')
    const long = 'word '.repeat(60)
    const out = pushBody(long, 50)
    expect(out.length).toBeLessThanOrEqual(50)
    expect(out.endsWith('word…')).toBe(true)
  })
})

describe('delivery', () => {
  it('pushes when a device exists, else email only if allowed', () => {
    expect(deliveryPlan(2, false)).toBe('push')
    expect(deliveryPlan(0, true)).toBe('email')
    expect(deliveryPlan(0, false)).toBe('none')
  })
  it('counts statuses', () => {
    const c = countsFrom([{ status: 'PUSH', _count: 3 }, { status: 'EMAIL', _count: 2 }, { status: 'SENDING', _count: 1 }, { status: 'PENDING', _count: 1 }, { status: 'FAILED', _count: 1 }])
    expect(c).toEqual({ total: 8, pending: 2, push: 3, email: 2, noDevice: 0, failed: 1 })
  })
})

describe('fallback email', () => {
  it('escapes the message, keeps paragraphs and uses the title as subject', () => {
    const m = broadcastEmail({ title: ' Call moved ', body: 'Hi <b>team</b>\nline two\n\nSecond para', link: 'one-a-day' }, 'Ana', '/coach/one-a-day')
    expect(m.subject).toBe('Call moved')
    expect(m.html).toContain('Hi Ana,')
    expect(m.html).toContain('Hi &lt;b&gt;team&lt;/b&gt;<br>line two')
    expect(m.html).toContain('Second para</p>')
    expect(m.html).toContain('Open One-A-Day')
    expect(m.html).toContain('/coach/one-a-day')
    expect(m.html).not.toContain('Stop emails about this')
  })
})
