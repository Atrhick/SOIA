/**
 * Signed calls to ExploreNation's en-nt API (contract in ./core.ts). Server only: never import from a
 * client component. Off unless EN_API_BASE_URL and EN_API_SECRET are both set.
 */
import { API_PREFIX, CODE_RE, mapStatus, signedHeaders, type CodeStatus } from './core'

const TIMEOUT_MS = 10_000

export function enConfig(): { base: string; secret: string } | null {
  const base = process.env.EN_API_BASE_URL?.trim().replace(/\/+$/, '')
  const secret = process.env.EN_API_SECRET?.trim()
  if (!base || !secret || !/^https?:\/\//.test(base)) return null
  return { base, secret }
}

/** ExploreNation's Advertise page for the code email, e.g. https://goexplorenation.com/advertise/ (optional). */
export function enPublicUrl(): string | null {
  const u = process.env.EN_PUBLIC_URL?.trim()
  return u && /^https:\/\//.test(u) ? u : null
}

export type EnResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string; message: string }

async function call<T>(method: 'GET' | 'POST', path: string, body: unknown, parse: (j: unknown) => T | null): Promise<EnResult<T>> {
  const cfg = enConfig()
  if (!cfg) return { ok: false, status: 0, error: 'not_configured', message: 'The ExploreNation connection is not set up.' }
  const raw = body === undefined ? '' : JSON.stringify(body)
  const headers: Record<string, string> = { Accept: 'application/json', ...signedHeaders(cfg.secret, method, path, raw, Math.floor(Date.now() / 1000)) }
  if (raw) headers['Content-Type'] = 'application/json'
  try {
    const res = await fetch(cfg.base + path, { method, headers, body: raw || undefined, signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' })
    let j: unknown = null
    try { j = await res.json() } catch { /* empty or not JSON */ }
    if (!res.ok) {
      const o = (j && typeof j === 'object' ? j : {}) as Record<string, unknown>
      return { ok: false, status: res.status, error: typeof o.error === 'string' ? o.error : `http_${res.status}`, message: typeof o.message === 'string' ? o.message.slice(0, 300) : '' }
    }
    const data = parse(j)
    if (!data) return { ok: false, status: res.status, error: 'bad_response', message: 'ExploreNation sent an answer we could not read.' }
    return { ok: true, data }
  } catch (e) {
    console.error(`[EN] ${method} ${path} failed:`, e instanceof Error ? e.name : 'error')
    return { ok: false, status: 0, error: 'unreachable', message: 'ExploreNation did not answer.' }
  }
}

export interface EnCode { code: string; status: CodeStatus; expiresAt: Date | null }

function parseCode(j: unknown): EnCode | null {
  if (!j || typeof j !== 'object') return null
  const o = j as Record<string, unknown>
  const code = typeof o.code === 'string' ? o.code.trim().toUpperCase() : ''
  if (!CODE_RE.test(code)) return null
  const status = mapStatus(o.status) ?? 'SENT'
  const expiresAt = typeof o.expiresAt === 'string' && !Number.isNaN(Date.parse(o.expiresAt)) ? new Date(o.expiresAt) : null
  return { code, status, expiresAt }
}

export function createCode(input: {
  requestId: string
  business: { name: string; contactName: string; email: string }
  requestedBy: { name: string; email: string }
}): Promise<EnResult<EnCode>> {
  return call('POST', `${API_PREFIX}/codes`, input, parseCode)
}

export function getCode(code: string): Promise<EnResult<EnCode>> {
  return call('GET', `${API_PREFIX}/codes/${encodeURIComponent(code)}`, undefined, parseCode)
}

export function revokeCode(code: string, reason: string): Promise<EnResult<true>> {
  return call('POST', `${API_PREFIX}/codes/${encodeURIComponent(code)}/revoke`, { reason }, () => true)
}
