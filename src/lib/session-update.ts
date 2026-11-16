import { getCsrfToken } from 'next-auth/react'

export type UpdatedSession = { user?: { role?: string; isImpersonating?: boolean } }

/**
 * Changes the signed-in session: switch view, view as someone, stop viewing as someone.
 * Client only. Use this instead of useSession().update(): that one quietly does nothing
 * (returns undefined) while the page is still loading the session, which made "Switch to
 * Coach view" show "We couldn't switch your view" when tapped soon after a page opened.
 * Tries twice for a shaky phone connection. Returns the new session, or null.
 */
export async function updateSession(data: Record<string, unknown>): Promise<UpdatedSession | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const csrfToken = await getCsrfToken()
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ csrfToken, data }),
      })
      if (res.ok) {
        const s = (await res.json()) as UpdatedSession | null
        if (s?.user) return s
      }
    } catch {
      // try again
    }
  }
  return null
}
