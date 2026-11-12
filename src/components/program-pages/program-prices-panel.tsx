'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Tag } from 'lucide-react'
import { saveMyProgramPrices, type MyProgramOffer } from '@/lib/actions/outreach-settings'

const inp = 'w-full h-10 rounded-lg border border-gray-300 px-3 text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 disabled:bg-gray-100'

/** Program owner's prices (editable) plus the admin-set sponsored seats (read-only), on the program editor page. */
export function ProgramPricesPanel({ programId, offer }: { programId: string; offer: MyProgramOffer }) {
  const router = useRouter()
  const [fullPrice, setFullPrice] = useState(offer.fullPrice)
  const [sponsoredPrice, setSponsoredPrice] = useState(offer.sponsoredPrice)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const on = (offer.seatsPerMonth ?? 0) > 0
  const left = on ? Math.max(0, (offer.seatsPerMonth ?? 0) - offer.usedThisMonth) : 0
  const dirty = fullPrice !== offer.fullPrice || sponsoredPrice !== offer.sponsoredPrice

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setMsg(null)
    try {
      const r = await saveMyProgramPrices({ programId, fullPrice, sponsoredPrice })
      setMsg(r.ok ? { ok: true, text: on ? 'Prices saved. Your sign-up page shows them now.' : "Prices saved. They'll show on your sign-up page once sponsored seats are on." } : { ok: false, text: r.error })
      if (r.ok) router.refresh()
    } catch {
      setMsg({ ok: false, text: 'Something went wrong. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="prices-h" className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-primary-50 text-primary-700"><Tag className="h-5 w-5" aria-hidden /></span>
        <div className="min-w-0">
          <h2 id="prices-h" className="text-lg font-bold text-gray-900">Prices</h2>
          <p className="text-sm text-gray-600">What this program costs. Shown on your sign-up page when sponsored seats are on. You don&apos;t need to submit for review.</p>
        </div>
      </div>

      <form onSubmit={save} className="mt-4 space-y-3">
        <div className="grid max-w-md grid-cols-2 gap-3">
          <div>
            <label htmlFor="pp-full" className="mb-1 block text-sm font-semibold text-gray-800">Full price</label>
            <input id="pp-full" className={inp} value={fullPrice} maxLength={40} disabled={!offer.canEdit} onChange={(e) => setFullPrice(e.target.value)} placeholder="$299" />
          </div>
          <div>
            <label htmlFor="pp-sponsored" className="mb-1 block text-sm font-semibold text-gray-800">Sponsored price</label>
            <input id="pp-sponsored" className={inp} value={sponsoredPrice} maxLength={40} disabled={!offer.canEdit} onChange={(e) => setSponsoredPrice(e.target.value)} placeholder="$99" />
          </div>
        </div>
        <p className="text-xs text-gray-500">The sponsored price is what someone pays with a sponsored seat. Keep the reduction moderate; very deep cuts can make a program look less valuable.</p>

        <div className="rounded-lg bg-gray-50 px-3 py-2.5 text-sm text-gray-700">
          <strong className="text-gray-900">Sponsored seats</strong> (set by NowTransformed):{' '}
          {on ? <>{left} of {offer.seatsPerMonth} left this month.</> : <>off for now, so no offer is shown. Ask an admin if you&apos;d like sponsored seats.</>}
        </div>

        {msg && <p role={msg.ok ? 'status' : 'alert'} className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-700'}`}>{msg.text}</p>}
        {offer.canEdit && (
          <button type="submit" disabled={busy || !dirty}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary-700 px-4 text-sm font-semibold text-white hover:bg-primary-800 disabled:opacity-50">
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Save prices
          </button>
        )}
      </form>
    </section>
  )
}
