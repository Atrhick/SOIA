'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Armchair, Loader2 } from 'lucide-react'
import { kit } from '@/components/ui/kit/styles'
import { useToast } from '@/components/ui/kit/toast'
import { HelpTip } from '@/components/ui/kit/help-tip'
import { offerSponsoredSeat, undoSponsoredSeatOffer } from '@/lib/actions/sponsored-seat'
import type { SeatCardData } from './sponsored-seat-data'

const day = (iso: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso))

/**
 * "Sponsored seat" on the call record. Prices are for the host only (the person never sees them before
 * the call). Offering uses one of this month's seats; "Undo offer" gives it back within the same month.
 */
export function SponsoredSeatCard({ d, readOnly = false }: { d: SeatCardData; readOnly?: boolean }) {
  const router = useRouter()
  const toast = useToast()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState<'offer' | 'undo' | null>(null)
  const first = d.firstName

  async function offer() {
    setBusy('offer')
    const r = await offerSponsoredSeat(d.prospectId)
    setBusy(null)
    setConfirming(false)
    if (!r.ok) { toast.error(r.error); return }
    toast.success(r.message, { action: { label: 'Undo', onClick: () => { void undo() } } })
    router.refresh()
  }
  async function undo() {
    setBusy('undo')
    const r = await undoSponsoredSeatOffer(d.prospectId)
    setBusy(null)
    if (!r.ok) { toast.error(r.error); return }
    toast.success(r.message)
    router.refresh()
  }

  const prices = (full: string | null, sponsored: string | null) => (
    <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
      {full && <span className="text-base text-gray-600 line-through">{full}</span>}
      {full && sponsored && <span aria-hidden className="text-gray-500">&rarr;</span>}
      {sponsored ? <span className="text-2xl font-extrabold text-gray-900">{sponsored}</span> : <span className="text-base text-amber-800">No sponsored price set yet</span>}
      <span className="sr-only">{full ? `Full price ${full}, sponsored price ${sponsored ?? 'not set'}` : ''}</span>
    </p>
  )

  return (
    <section aria-labelledby="seat-card-h" className="rounded-xl border-2 border-primary-700 bg-white p-5 space-y-3">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-primary-50 text-primary-700"><Armchair className="h-5 w-5" aria-hidden /></span>
        <div className="min-w-0">
          <h2 id="seat-card-h" className="text-lg font-bold text-gray-900">
            Sponsored seat
            <HelpTip label="How sponsored seats work">
              <p>{d.programName} has {d.seatsPerMonth} NowTransformed sponsored seat{d.seatsPerMonth === 1 ? '' : 's'} a month.</p>
              <p>A seat is used when you offer it here, not when a call is booked. Undo gives it back (same month only).</p>
              <p>Payment isn&apos;t taken in this app: the program owner collects the fee.</p>
            </HelpTip>
          </h2>
          <p className="text-sm text-gray-600">{d.programName}. Prices are for you only; {first} hasn&apos;t seen them.</p>
        </div>
      </div>

      {d.offered ? (
        <>
          {prices(d.offered.fullPrice, d.offered.sponsoredPrice)}
          <p className="rounded-lg bg-green-50 border border-green-200 px-3 py-2.5 text-base text-green-900">
            Offered to {first} on {day(d.offered.at)}{d.offered.by ? ` by ${d.offered.by}` : ''}.
          </p>
          <p className="text-sm text-gray-600">{d.seatsLeft} of {d.seatsPerMonth} sponsored seats left this month.</p>
          {d.offered.canUndo && !readOnly && (
            <button type="button" className={kit.secondary} disabled={busy !== null} onClick={undo}>
              {busy === 'undo' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Undo offer
            </button>
          )}
        </>
      ) : (
        <>
          {prices(d.fullPrice, d.sponsoredPrice)}
          <p className={`text-base font-semibold ${d.seatsLeft > 0 ? 'text-amber-800' : 'text-red-700'}`}>
            {d.seatsLeft} of {d.seatsPerMonth} sponsored seats left this month
          </p>
          <p className="text-sm text-gray-700">Qualify first. If {first} is a good fit, offer the seat on the call.</p>
          {!readOnly && (d.seatsLeft > 0 ? (
            confirming ? (
              <div role="group" aria-label="Confirm the offer" className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
                <p className="text-base text-gray-900">Offer {first} a sponsored seat{d.sponsoredPrice ? ` at ${d.sponsoredPrice}` : ''}? This uses 1 of this month&apos;s seats.</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={kit.primary} disabled={busy !== null} onClick={offer}>
                    {busy === 'offer' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Yes, offer the seat
                  </button>
                  <button type="button" className={kit.secondary} disabled={busy !== null} onClick={() => setConfirming(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <button type="button" className={kit.primary} onClick={() => setConfirming(true)}>Offer a sponsored seat</button>
            )
          ) : (
            <p className="text-sm text-gray-700">All seats for this month have been offered. They reset on the 1st.</p>
          ))}
        </>
      )}
    </section>
  )
}
