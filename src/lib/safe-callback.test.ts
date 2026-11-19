import { describe, expect, it } from 'vitest'
import { loginPath, safeCallbackPath } from './safe-callback'

describe('safeCallbackPath', () => {
  it('keeps same-site program links with their query', () => {
    expect(safeCallbackPath('/coach/programs/abc/check?version=2', '/')).toBe('/coach/programs/abc/check?version=2')
    expect(safeCallbackPath('/ambassador/programs/x', '/')).toBe('/ambassador/programs/x')
    expect(safeCallbackPath('/admin/program-pages/p1', '/')).toBe('/admin/program-pages/p1')
  })
  it('refuses anything that leaves the site', () => {
    for (const bad of ['https://evil.example/x', '//evil.example', '/\\evil.example', 'javascript:alert(1)', '/\t/evil.example', 'coach/programs', '']) {
      expect(safeCallbackPath(bad, '/')).toBe('/')
    }
    expect(safeCallbackPath(null, '/ambassador')).toBe('/ambassador')
  })
  it('refuses dot-segment and encoded tricks that normalise to another site', () => {
    for (const bad of ['/.//evil.com', '/..//evil.com/x', '/./\\evil.com', '/\\evil.com', '/%2F%2Fevil.com', '/%5C%5Cevil.com', '/.%2F%2Fevil.com', '/a/..//evil.com']) {
      const out = safeCallbackPath(bad, '/')
      expect(out.startsWith('//') || out.includes('\\')).toBe(false)
      expect(new URL(out, 'http://same.invalid').origin).toBe('http://same.invalid')
    }
    expect(safeCallbackPath('/.//evil.com', '/')).toBe('/')
    expect(safeCallbackPath('/..//evil.com/x', '/')).toBe('/')
  })
  it('never loops back to sign-in', () => {
    expect(safeCallbackPath('/login?callbackUrl=/x', '/')).toBe('/')
    expect(safeCallbackPath('/api/auth/signout', '/')).toBe('/')
  })
})

describe('loginPath', () => {
  it('passes a safe deep link as callbackUrl', () => {
    expect(loginPath('/coach/programs/abc/check?version=2')).toBe('/login?callbackUrl=%2Fcoach%2Fprograms%2Fabc%2Fcheck%3Fversion%3D2')
  })
  it('falls back to plain /login', () => {
    for (const bad of [null, undefined, '', 'https://evil.example/x', '/login']) expect(loginPath(bad)).toBe('/login')
  })
})
