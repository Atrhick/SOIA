'use client'

/** "This link has expired" with an email-me-a-new-link form (PExpired). Same answer whether or not the email is known. */
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { requestJourneyLink } from '@/lib/actions/journey-join'
import { journeyBtn, journeyCard } from './join-shell'

export function JourneyExpired() {
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <div className={`${journeyCard} max-w-2xl mx-auto`}>
      <h1 className="text-2xl font-bold text-gray-900">This link has expired</h1>
      <p className="text-gray-700">For your privacy, links in our emails work for 14 days. Enter your email and we&apos;ll send a fresh one that picks up where you left off.</p>
      {sent ? (
        <p role="status" className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-green-800">If that email is in our system, a new link is on its way.</p>
      ) : (
        <form className="space-y-3" noValidate onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true); setError(null)
          try {
            const r = await requestJourneyLink(new FormData(e.currentTarget))
            if ('error' in r) setError(r.error); else setSent(true)
          } catch { setError('Something went wrong. Please try again.') }
          setBusy(false)
        }}>
          <label htmlFor="relink-email" className="block text-sm font-semibold text-gray-700">Email</label>
          <input id="relink-email" name="email" type="email" required autoComplete="email" placeholder="name@example.com"
            aria-invalid={!!error} aria-describedby={error ? 'relink-error' : undefined}
            className="w-full h-11 rounded-lg border border-gray-300 px-3 focus:outline-none focus:ring-2 focus:ring-primary-600" />
          {error && <p id="relink-error" role="alert" className="text-sm text-red-700">{error}</p>}
          <button className={journeyBtn} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Send me a new link</button>
        </form>
      )}
      <p className="text-sm text-gray-500">Need help? Reply to any NowTransformed email or contact the person who invited you.</p>
    </div>
  )
}
