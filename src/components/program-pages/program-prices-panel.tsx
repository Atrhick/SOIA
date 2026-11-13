'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Tag } from 'lucide-react'
import { kit } from '@/components/ui/kit/styles'
import { useToast } from '@/components/ui/kit/toast'
import { HelpTip } from '@/components/ui/kit/help-tip'
import { saveMyProgramPrices, type MyProgramOffer } from '@/lib/actions/outreach-settings'
import { SaveRule } from './save-rule'

/**
 * The owner's two prices (editable) and the admin-set sponsored seats (read-only), on the program editor.
 * Prices are for the NowTransformed team on the free call; people signing up never see them.
 */
export function ProgramPricesPanel({ programId, offer }: { programId: string; offer: MyProgramOffer }) {
  const router = useRouter()
  const toast = useToast()
  const [fullPrice, setFullPrice] = useState(offer.fullPrice)
  const [sponsoredPrice, setSponsoredPrice] = useState(offer.sponsoredPrice)
  const [busy, setBusy] = useState(false)
  const on = (offer.seatsPerMonth ?? 0) > 0
  const left = on ? Math.max(0, (offer.seatsPerMonth ?? 0) - offer.usedThisMonth) : 0

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (fullPrice === offer.fullPrice && sponsoredPrice === offer.sponsoredPrice) { toast.success('No changes to save.'); return }
    setBusy(true)
    try {
      const r = await saveMyProgramPrices({ programId, fullPrice, sponsoredPrice })
      if (!r.ok) { toast.error(r.error); document.getElementById('pp-sponsored')?.focus(); return }
      toast.success('Prices saved. The team uses them on calls from now on.')
      router.refresh()
    } catch {
      toast.error('That didn’t save. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="prices-h" className={kit.card}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-primary-50 text-primary-700"><Tag className="h-5 w-5" aria-hidden /></span>
        <div className="min-w-0">
          <h2 id="prices-h" className="text-lg font-bold text-gray-900">
            Prices
            <HelpTip label="Who sees these prices?">
              <p>Only the NowTransformed team. People signing up don&apos;t see prices; they read that families who are a good fit may qualify for a sponsored seat.</p>
              <p>On the free call, the team qualifies the family and, if they&apos;re a good fit, offers a sponsored seat at your sponsored price.</p>
            </HelpTip>
          </h2>
          <p className="text-base text-gray-700">What this program costs, and the price with a NowTransformed sponsored seat. The team uses these on the free call.</p>
        </div>
      </div>

      <form onSubmit={save} className="mt-4 space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:max-w-md sm:grid-cols-2">
          <div>
            <label htmlFor="pp-full" className={kit.label}>Full price</label>
            <input id="pp-full" className={kit.input} value={fullPrice} maxLength={40} readOnly={!offer.canEdit} onChange={(e) => setFullPrice(e.target.value)} placeholder="$299" />
          </div>
          <div>
            <label htmlFor="pp-sponsored" className={kit.label}>Sponsored seat price</label>
            <input id="pp-sponsored" className={kit.input} value={sponsoredPrice} maxLength={40} readOnly={!offer.canEdit} onChange={(e) => setSponsoredPrice(e.target.value)} placeholder="$99" />
          </div>
        </div>
        <p className={kit.hint}>What a family pays with a sponsored seat. Keep the reduction moderate; very deep cuts can make a program look less valuable. Payment isn&apos;t taken in this app: you collect the fee as you do today.</p>

        <div className="rounded-lg bg-gray-50 px-3 py-2.5 text-base text-gray-800">
          <strong className="text-gray-900">Sponsored seats</strong> (set by NowTransformed):{' '}
          {on
            ? <>{left} of {offer.seatsPerMonth} left this month. A seat is used when the team offers it on a call.</>
            : <>none for now. Ask an admin if you&apos;d like sponsored seats.</>}
        </div>

        {offer.canEdit && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button type="submit" disabled={busy} className={`${kit.primary} w-full sm:w-auto`}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Save prices
            </button>
            <SaveRule live />
          </div>
        )}
      </form>
    </section>
  )
}
