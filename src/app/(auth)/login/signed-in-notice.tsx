'use client'

import { useState } from 'react'
import { signOut, useSession } from 'next-auth/react'
import { callbackFromLocation } from '@/lib/safe-callback'
import { updateSession } from '@/lib/session-update'

/** Which view a page belongs to, from its path ("/coach/..." -> COACH). Null = any signed-in person. */
export function viewForPath(path: string): { role: string; label: string } | null {
  if (path.startsWith('/coach')) return { role: 'COACH', label: 'coach' }
  if (path.startsWith('/ambassador')) return { role: 'AMBASSADOR', label: 'ambassador' }
  if (path.startsWith('/admin')) return { role: 'ADMIN', label: 'admin' }
  if (path.startsWith('/team')) return { role: 'SUB_ADMIN', label: 'team member' }
  return null
}

/**
 * Shown on the sign-in page to someone who is ALREADY signed in. They usually got here because a page
 * for another kind of account (a coach page opened while in the admin view) sent them back to sign-in,
 * which looked like a sign-in that didn't work. Says so, and offers what they can do.
 */
export function SignedInNotice({ onSignInAgain }: { onSignInAgain: () => void }) {
  const { data: session, status } = useSession()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (status !== 'authenticated' || !session?.user) return null

  const target = callbackFromLocation('')
  const need = target ? viewForPath(target) : null
  const wrongView = need && session.user.role !== need.role

  const switchAndOpen = async () => {
    if (!need) return
    setBusy(true)
    setError('')
    const s = await updateSession({ switchRole: need.role })
    if (s?.user?.role === need.role) { window.location.assign(target); return }
    setBusy(false)
    setError(`This account isn't a ${need.label} account, so it can't open that page. Sign in with the ${need.label}'s own account instead.`)
  }

  return (
    <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950" role="status">
      <p className="font-semibold">You&rsquo;re already signed in as {session.user.email}.</p>
      {wrongView ? (
        <p>
          The page you tried to open is for a {need.label} account, so it sent you back here. If this login is also a {need.label},
          switch to your {need.label} view to open it. Otherwise, sign in with the {need.label}&rsquo;s own account.
        </p>
      ) : (
        <p>You can go straight to your dashboard.</p>
      )}
      {error && <p className="rounded-lg bg-white/70 p-3 text-red-700">{error}</p>}
      <div className="flex flex-col gap-2">
        {wrongView && (
          <button type="button" onClick={switchAndOpen} disabled={busy}
            className="h-11 rounded-xl bg-amber-600 px-4 font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
            {busy ? 'Switching...' : `Switch to my ${need.label} view and open the page`}
          </button>
        )}
        <a href="/" className="flex h-11 items-center justify-center rounded-xl border border-amber-300 bg-white px-4 font-semibold text-amber-900 hover:bg-amber-100">
          Go to my dashboard
        </a>
        <button type="button" disabled={busy}
          onClick={async () => { setBusy(true); await signOut({ redirect: false }); setBusy(false); onSignInAgain() }}
          className="h-11 rounded-xl px-4 font-semibold text-amber-900 underline-offset-2 hover:underline">
          Sign in with a different account
        </button>
      </div>
    </div>
  )
}
