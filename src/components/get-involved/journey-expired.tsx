'use client'

/** Expired /journey link: "email me a new link". The answer is the same whether or not the email is known. */
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { requestJourneyLink } from '@/lib/actions/journey-assessment'
import { primaryBtn, stepCard } from './journey-step-frame'

export function JourneyExpired() {
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <div className={`${stepCard} max-w-2xl mx-auto space-y-4`}>
      <h1 className="text-2xl font-bold text-gray-900">This link has expired</h1>
      <p className="text-gray-700">For your privacy, links in our emails work for 14 days. Enter your email and we&apos;ll send a fresh one that picks up where you left off.</p>
      {sent ? (
        <p role="status" className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-green-800">If that email is in our system, a new link is on its way.</p>
      ) : (
        <form
          className="space-y-3"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            if (!String(fd.get('email') ?? '').trim()) { setError('Please enter your email'); return }
            setBusy(true); setError(null)
            try {
              const r = await requestJourneyLink(fd)
              if (r.ok) setSent(true); else setError(r.error)
            } catch {
              setError('Something went wrong. Please try again.')
            } finally {
              setBusy(false)
            }
          }}
        >
          <label htmlFor="relink-email" className="block text-sm font-semibold text-gray-700">Email</label>
          <input id="relink-email" name="email" type="email" autoComplete="email" placeholder="name@example.com" aria-invalid={!!error} aria-describedby={error ? 'relink-err' : undefined}
            className="w-full h-11 rounded-lg border border-gray-300 px-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600" />
          {error && <p id="relink-err" role="alert" className="text-sm text-red-700">{error}</p>}
          <button className={primaryBtn} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Send me a new link</button>
        </form>
      )}
    </div>
  )
}
