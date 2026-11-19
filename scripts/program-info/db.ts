/**
 * Shared by the program-info scripts: finds DATABASE_URL (environment, else .env like the Prisma CLI),
 * prints the host (never the credentials) and refuses to write to a non-local database without --remote-ok.
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'

export function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  try {
    const line = readFileSync(resolve(__dirname, '..', '..', '.env'), 'utf8').split(/\r?\n/).find((l) => /^\s*DATABASE_URL\s*=/.test(l))
    const v = line?.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '')
    if (v) { process.env.DATABASE_URL = v; return v }
  } catch { /* fall through */ }
  throw new Error('DATABASE_URL is not set (environment or .env).')
}

/** Prints the database host. Returns false (and says why) when a write would go to a remote DB without --remote-ok. */
export function checkDatabase(apply: boolean, remoteOk: boolean): boolean {
  const url = new URL(databaseUrl())
  const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
  console.log(`Database: ${url.hostname}:${url.port || '5432'}${url.pathname} (${local ? 'local' : 'REMOTE'})`)
  if (apply && !local && !remoteOk) {
    console.log('Refusing to write to a non-local database without --remote-ok.')
    return false
  }
  return true
}
