/**
 * Shared by the program-info scripts: finds DATABASE_URL (environment, else .env like the Prisma CLI),
 * prints the host (never the credentials) and refuses to write to a non-local database without --remote-ok.
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'

/** DATABASE_URL from the repo's .env file, or null. */
function envFileUrl(): string | null {
  try {
    const line = readFileSync(resolve(__dirname, '..', '..', '.env'), 'utf8').split(/\r?\n/).find((l) => /^\s*DATABASE_URL\s*=/.test(l))
    return line?.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '') || null
  } catch {
    return null
  }
}

export function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const v = envFileUrl()
  if (v) { process.env.DATABASE_URL = v; return v }
  throw new Error('DATABASE_URL is not set (environment or .env).')
}

/**
 * Local = this machine AND the same port and database as the repo's .env. A Cloud SQL proxy also listens on
 * 127.0.0.1 (on another port, e.g. 5434), so the host alone can't tell the live database from the local one.
 */
export function isLocalDatabase(urlText: string, envUrlText: string | null): boolean {
  const url = new URL(urlText)
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return false
  if (!envUrlText) return false
  const env = new URL(envUrlText)
  return (url.port || '5432') === (env.port || '5432') && url.pathname === env.pathname
}

/** Prints the database host. Returns false (and says why) when a write would go to a remote DB without --remote-ok. */
export function checkDatabase(apply: boolean, remoteOk: boolean): boolean {
  const url = new URL(databaseUrl())
  const local = isLocalDatabase(url.toString(), envFileUrl())
  console.log(`Database: ${url.hostname}:${url.port || '5432'}${url.pathname} (${local ? 'local' : 'REMOTE'})`)
  if (apply && !local && !remoteOk) {
    console.log('Refusing to write to a non-local database without --remote-ok.')
    return false
  }
  return true
}
