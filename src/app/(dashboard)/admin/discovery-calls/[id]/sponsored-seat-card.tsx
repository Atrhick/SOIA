'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Armchair, Loader2 } from 'lucide-react'
import { kit } from '@/components/ui/kit/styles'
import { useToast } from '@/components/ui/kit/toast'
import { HelpTip } from '@/components/ui/kit/help-tip'
import { offerSponsoredSeat, resendPartnerCode, undoSponsoredSeatOffer } from '@/lib/actions/sponsored-seat'
import type { SeatCardData } from './sponsored-seat-data'

const day = (iso: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso))

/**
 * "Sponsorship" on the call record. Prices are for the host only (the person never sees them before
 * the call). Offering uses one of this month's seats; "Undo offer" gives it back within the same month.
 */
export function SponsoredSeatCard({ d, readOnly = false }: { d: SeatCardData; readOnly?: boolean }) {
  const router = useRouter()
  const toast = useToast()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState<'offer' | 'undo' | 'resend' | null>(null)
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
  async function resend() {
    setBusy('resend')
    const r = await resendPartnerCode(d.prospectId)
    setBusy(null)
    if (!r.ok) { toast.error(r.error); return }
    toast.success(r.message)
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
            Sponsorship
            <HelpTip label="How sponsorships work">
              <p>{d.programName} has {d.seatsPerMonth} NowTransformed sponsorship{d.seatsPerMonth === 1 ? '' : 's'} a month.</p>
              <p>A sponsorship counts when you offer it here, not when a call is booked. Undo gives it back (same month only).</p>
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
          {d.partnerCode && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 space-y-1.5">
              <p className="text-sm font-semibold text-gray-900">{d.partnerName ?? 'Partner'} founding-rate code</p>
              {d.partnerCode.code && <p className="font-mono text-lg font-bold tracking-wider text-gray-900 break-all">{d.partnerCode.code}</p>}
              <p className="text-sm text-gray-700">
                {d.partnerCode.label}
                {d.partnerCode.emailedAt ? ` · emailed ${day(d.partnerCode.emailedAt)}` : ' · not emailed yet'}
                {d.partnerCode.expiresAt && (d.partnerCode.status === 'SENT' || d.partnerCode.status === 'HELD') ? ` · use by ${day(d.partnerCode.expiresAt)}` : ''}
              </p>
              {d.partnerCode.canResend && !readOnly && (
                <button type="button" className={kit.secondary} disabled={busy !== null} onClick={resend}>
                  {busy === 'resend' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Email the code again
                </button>
              )}
            </div>
          )}
          <p className="text-sm text-gray-600">{d.seatsLeft} of {d.seatsPerMonth} sponsorships left this month.</p>
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
            {d.seatsLeft} of {d.seatsPerMonth} sponsorships left this month
          </p>
          <p className="text-sm text-gray-700">Qualify first. If {first} is a good fit, offer the sponsorship on the call.</p>
          {!readOnly && (d.seatsLeft > 0 ? (
            confirming ? (
              <div role="group" aria-label="Confirm the offer" className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
                <p className="text-base text-gray-900">Offer {first} a sponsorship{d.sponsoredPrice ? ` at ${d.sponsoredPrice}` : ''}? This uses 1 of this month&apos;s sponsorships.</p>
                {d.partnerName && <p className="text-sm text-gray-700">We&apos;ll get {first}&apos;s founding-rate code from {d.partnerName} and email it to them. If {d.partnerName} doesn&apos;t answer, nothing is offered and the seat isn&apos;t used.</p>}
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={kit.primary} disabled={busy !== null} onClick={offer}>
                    {busy === 'offer' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Yes, offer the sponsorship
                  </button>
                  <button type="button" className={kit.secondary} disabled={busy !== null} onClick={() => setConfirming(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <button type="button" className={kit.primary} onClick={() => setConfirming(true)}>Offer a sponsorship</button>
            )
          ) : (
            <p className="text-sm text-gray-700">All sponsorships for this month have been offered. They reset on the 1st.</p>
          ))}
        </>
      )}
    </section>
  )
}
