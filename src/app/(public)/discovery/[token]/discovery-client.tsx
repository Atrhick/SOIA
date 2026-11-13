'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { requestNewLink } from '@/lib/actions/get-involved'
import { Book, BookView, btn } from '@/components/get-involved/signup/booking'

export type { BookView }
export type DiscoveryView =
  | { kind: 'expired' }
  | { kind: 'message'; title: string; body: string }
  | BookView

export function DiscoveryClient({ token, view, framed = false }: { token: string; view: DiscoveryView; framed?: boolean }) {
  // Inside the journey frame the grid column sets the width; on its own the card is centred.
  const card = `${framed ? '' : 'max-w-2xl mx-auto '}min-w-0 bg-white border border-gray-200 rounded-2xl p-6 md:p-8 space-y-5`
  if (view.kind === 'expired') return <Expired card={card} />
  if (view.kind === 'message') return <div className={card}><h1 className="text-2xl font-bold text-gray-900">{view.title}</h1><p className="text-gray-700">{view.body}</p></div>
  return <Book token={token} v={view} card={card} variant="manage" />
}

/** Public "send me my booking link" form (also used at /book-call, linked from members' follow-up messages). */
export function GetBookingLink({ card }: { card: string }) {
  return (
    <Expired card={card} title="Pick a time for your free call"
      intro="Enter the email you signed up with and we'll send you your own link to pick a time. It only takes a minute." />
  )
}

function Expired({ card, title = 'This link has expired', intro = "For your privacy, links in our emails work for 14 days. Enter your email and we'll send a fresh one that picks up where you left off." }: { card: string; title?: string; intro?: string }) {
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <div className={card}>
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      <p className="text-gray-700">{intro}</p>
      {sent ? (
        <p role="status" className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-green-800">If that email is in our system, a new link is on its way.</p>
      ) : (
        <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setError(null); const r = await requestNewLink(new FormData(e.currentTarget)); setBusy(false); if ('error' in r) setError(r.error); else setSent(true) }}>
          <label htmlFor="em" className="block text-sm font-semibold text-gray-700">Email</label>
          <input id="em" name="email" type="email" required placeholder="name@example.com" aria-describedby={error ? 'em-err' : undefined} aria-invalid={!!error} className="w-full h-12 rounded-lg border border-gray-300 px-3 text-base" />
          {error && <p id="em-err" role="alert" className="text-sm text-red-700">{error}</p>}
          <button className={btn} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Send me a new link</button>
        </form>
      )}
    </div>
  )
}
