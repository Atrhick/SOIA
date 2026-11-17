import { describe, expect, it } from 'vitest'
import { createHmac } from 'crypto'
import { canMove, codeEmail, CODE_RE, mapStatus, parseWebhook, signature, signedHeaders, verifySignature, WEBHOOK_PATH } from './core'

const SECRET = 'a'.repeat(64)
const NOW = 1_800_000_000

describe('signing', () => {
  it('matches the agreed formula: HMAC-SHA256 of ts.METHOD.path.body, hex', () => {
    const want = createHmac('sha256', SECRET).update(`${NOW}.POST./wp-json/en-nt/v1/codes.{"a":1}`).digest('hex')
    expect(signature(SECRET, NOW, 'post', '/wp-json/en-nt/v1/codes', '{"a":1}')).toBe(want)
  })
  it('accepts its own signed headers', () => {
    const h = signedHeaders(SECRET, 'POST', WEBHOOK_PATH, '{}', NOW)
    expect(verifySignature(SECRET, h['X-NT-Timestamp'], h['X-NT-Signature'], 'POST', WEBHOOK_PATH, '{}', NOW)).toBe(true)
    expect(verifySignature(SECRET, h['X-NT-Timestamp'], h['X-NT-Signature'].toUpperCase(), 'POST', WEBHOOK_PATH, '{}', NOW)).toBe(true)
  })
  it('rejects a changed body, path, method, secret or a stale clock', () => {
    const h = signedHeaders(SECRET, 'POST', WEBHOOK_PATH, '{}', NOW)
    const ts = h['X-NT-Timestamp'], sig = h['X-NT-Signature']
    expect(verifySignature(SECRET, ts, sig, 'POST', WEBHOOK_PATH, '{ }', NOW)).toBe(false)
    expect(verifySignature(SECRET, ts, sig, 'POST', '/api/other', '{}', NOW)).toBe(false)
    expect(verifySignature(SECRET, ts, sig, 'GET', WEBHOOK_PATH, '{}', NOW)).toBe(false)
    expect(verifySignature('b'.repeat(64), ts, sig, 'POST', WEBHOOK_PATH, '{}', NOW)).toBe(false)
    expect(verifySignature(SECRET, ts, sig, 'POST', WEBHOOK_PATH, '{}', NOW + 301)).toBe(false)
    expect(verifySignature(SECRET, ts, sig, 'POST', WEBHOOK_PATH, '{}', NOW - 301)).toBe(false)
    expect(verifySignature(SECRET, ts, sig, 'POST', WEBHOOK_PATH, '{}', NOW + 300)).toBe(true)
  })
  it('rejects missing or malformed headers and an empty secret', () => {
    const h = signedHeaders(SECRET, 'POST', WEBHOOK_PATH, '{}', NOW)
    expect(verifySignature(SECRET, null, h['X-NT-Signature'], 'POST', WEBHOOK_PATH, '{}', NOW)).toBe(false)
    expect(verifySignature(SECRET, h['X-NT-Timestamp'], null, 'POST', WEBHOOK_PATH, '{}', NOW)).toBe(false)
    expect(verifySignature(SECRET, 'abc', h['X-NT-Signature'], 'POST', WEBHOOK_PATH, '{}', NOW)).toBe(false)
    expect(verifySignature(SECRET, h['X-NT-Timestamp'], 'zz', 'POST', WEBHOOK_PATH, '{}', NOW)).toBe(false)
    expect(verifySignature('', h['X-NT-Timestamp'], h['X-NT-Signature'], 'POST', WEBHOOK_PATH, '{}', NOW)).toBe(false)
  })
})

describe('codes and statuses', () => {
  it('accepts the agreed code shape only', () => {
    expect(CODE_RE.test('EN-FR-7K3M-Q9TD')).toBe(true)
    expect(CODE_RE.test('EN-FR-7K3M-Q9T0')).toBe(false) // 0 not in the alphabet
    expect(CODE_RE.test('EN-FR-7K3M-Q9TI')).toBe(false) // I not in the alphabet
    expect(CODE_RE.test('en-fr-7k3m-q9td')).toBe(false)
  })
  it('maps statuses', () => {
    expect(mapStatus('held')).toBe('HELD')
    expect(mapStatus('USED')).toBe('USED')
    expect(mapStatus('nope')).toBeNull()
  })
  it('never moves back from final states or out-of-order', () => {
    expect(canMove('SENT', 'HELD')).toBe(true)
    expect(canMove('HELD', 'USED')).toBe(true)
    expect(canMove('HELD', 'EXPIRED')).toBe(true)
    expect(canMove('USED', 'EXPIRED')).toBe(false)
    expect(canMove('REVOKED', 'HELD')).toBe(false)
    expect(canMove('EXPIRED', 'HELD')).toBe(false)
    expect(canMove('HELD', 'SENT')).toBe(false)
    expect(canMove('HELD', 'HELD')).toBe(false)
  })
  it('parses webhooks by code or requestId', () => {
    const e = parseWebhook(JSON.stringify({ event: 'code.used', code: 'en-fr-7k3m-q9td', requestId: 'nt_x_1', status: 'used', package: 'Partner A', at: '2026-11-20T10:00:00Z' }))
    expect(e).toMatchObject({ code: 'EN-FR-7K3M-Q9TD', requestId: 'nt_x_1', status: 'USED', package: 'Partner A' })
    expect(parseWebhook(JSON.stringify({ event: 'code.held', requestId: 'nt_x_1' }))?.status).toBe('HELD')
    expect(parseWebhook(JSON.stringify({ event: 'code.used' }))).toBeNull()
    expect(parseWebhook('not json')).toBeNull()
  })
})

describe('code email', () => {
  it('escapes names and shows code, date and steps', () => {
    const m = codeEmail({ firstName: '<b>Maria</b>', code: 'EN-FR-7K3M-Q9TD', expiresAt: new Date('2026-12-16T20:00:00Z'), hostName: 'Pervis & Co', siteUrl: 'https://goexplorenation.com/advertise/' })
    expect(m.html).toContain('&lt;b&gt;Maria&lt;/b&gt;')
    expect(m.html).toContain('EN-FR-7K3M-Q9TD')
    expect(m.html).toContain('Wednesday, December 16, 2026')
    expect(m.html).toContain('Founding-rate code (optional)')
    expect(m.html).toContain('Pervis &amp; Co')
    expect(m.html).toContain('href="https://goexplorenation.com/advertise/"'); expect(m.html).toContain('Advertise page')
  })
})
