'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { markJourneyPaymentReceived } from '@/lib/actions/journey-join'

export interface PaymentRow {
  prospectId: string; name: string; email: string; phone: string | null; role: string; amount: string; method: string; status: string
  prospectStatus: string; loginCreated: boolean; acceptedAt: string | null; paidAt: string | null; reference: string | null; failureReason: string | null; inviter: string | null
}

const day = (iso: string | null) => (iso ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso)) : '–')
const BADGE: Record<string, string> = { PENDING: 'bg-amber-100 text-amber-800', PROCESSING: 'bg-sky-100 text-sky-800', COMPLETED: 'bg-green-100 text-green-800', FAILED: 'bg-red-100 text-red-800', REFUNDED: 'bg-gray-100 text-gray-700' }
const LABEL: Record<string, string> = { PENDING: 'Waiting', PROCESSING: 'Processing', COMPLETED: 'Paid', FAILED: 'Closed', REFUNDED: 'Refunded' }

export function JourneyPaymentsClient({ rows }: { rows: PaymentRow[] }) {
  const waiting = rows.filter((r) => r.status === 'PENDING' || r.status === 'PROCESSING')
  const recent = rows.filter((r) => r.status !== 'PENDING' && r.status !== 'PROCESSING').reverse()
  const [done, setDone] = useState<string | null>(null)
  return (
    <div className="space-y-6">
      <div role="status" aria-live="polite">
        {done && <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{done}</p>}
      </div>
      <section className={`bg-white border rounded-xl p-5 ${waiting.length ? 'border-orange-300' : 'border-gray-200'}`}>
        <h2 className="font-bold text-gray-900">Waiting for payment ({waiting.length})</h2>
        {waiting.length === 0
          ? <p className="text-sm text-gray-600 mt-2">Nobody is waiting. When someone accepts the terms for a paid role, they appear here.</p>
          : <ul className="mt-3 space-y-3">{waiting.map((r) => <WaitingCard key={r.prospectId} r={r} onDone={setDone} />)}</ul>}
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-bold text-gray-900">Last 30 days</h2>
        {recent.length === 0 ? <p className="text-sm text-gray-600 mt-2">No payments recorded yet.</p> : (
          <ul className="mt-3 divide-y divide-gray-100">
            {recent.map((r) => (
              <li key={r.prospectId} className="py-3 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900"><Link href={`/admin/prospects/${r.prospectId}`} className="hover:underline">{r.name}</Link></p>
                  <p className="text-xs text-gray-600 break-words">{r.role} · {r.amount}{r.paidAt ? ` · Paid ${day(r.paidAt)}` : ''}{r.reference ? ` · Ref: ${r.reference}` : ''}{r.failureReason ? ` · ${r.failureReason}` : ''}</p>
                  {r.status === 'COMPLETED' && !r.loginCreated && <p className="text-xs text-orange-800">Login not created yet: they can finish from their Join link.</p>}
                </div>
                <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${BADGE[r.status] ?? 'bg-gray-100 text-gray-700'}`}>{LABEL[r.status] ?? r.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function WaitingCard({ r, onDone }: { r: PaymentRow; onDone: (msg: string) => void }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reference, setReference] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const ref = `ref-${r.prospectId}`

  async function confirm() {
    setBusy(true); setErr(null)
    try {
      const res = await markJourneyPaymentReceived({ prospectId: r.prospectId, reference })
      if ('error' in res) setErr(res.error)
      else { onDone(res.message); setOpen(false); router.refresh() }
    } catch { setErr('Something went wrong. Please try again.') }
    setBusy(false)
  }

  return (
    <li className="rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900"><Link href={`/admin/prospects/${r.prospectId}`} className="hover:underline">{r.name}</Link></p>
          <p className="text-sm text-gray-700">{r.role} · <strong>{r.amount}</strong></p>
          <p className="text-xs text-gray-600 break-all">
            <a className="text-primary-700 hover:underline" href={`mailto:${r.email}`}>{r.email}</a>{r.phone && <> · <a className="text-primary-700 hover:underline" href={`tel:${r.phone}`}>{r.phone}</a></>}
          </p>
          <p className="text-xs text-gray-600">Terms accepted {day(r.acceptedAt)}{r.inviter ? ` · Invited by ${r.inviter}` : ''}{r.method === 'INVO' ? ' · Paying online (Invo)' : ''}</p>
        </div>
        <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${BADGE[r.status]}`}>{LABEL[r.status]}</span>
      </div>
      {!open ? (
        <button type="button" onClick={() => { setOpen(true); setErr(null) }} aria-expanded={false}
          className="h-10 px-4 rounded-lg bg-primary-700 hover:bg-primary-800 text-white text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2">
          Mark payment received
        </button>
      ) : (
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 space-y-3">
          <div>
            <label htmlFor={ref} className="block text-sm font-semibold text-gray-700 mb-1">Reference (optional)</label>
            <input id={ref} value={reference} onChange={(e) => setReference(e.target.value)} maxLength={200} placeholder="e.g. Cheque 1042 or Zelle confirmation"
              className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-600" />
          </div>
          <p className="text-sm text-gray-700">This records {r.amount} as paid, creates {r.name.split(' ')[0]}&apos;s login and emails them how to sign in.</p>
          {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={confirm} disabled={busy}
              className="h-10 px-4 rounded-lg bg-green-700 hover:bg-green-800 text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2">
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Yes, payment received
            </button>
            <button type="button" onClick={() => setOpen(false)} disabled={busy}
              className="h-10 px-4 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600">Cancel</button>
          </div>
        </div>
      )}
    </li>
  )
}
