'use client'

import { useState } from 'react'
import { ExternalLink, Info, Loader2 } from 'lucide-react'
import { saveProgramOffer, saveSiteOutreach } from '@/lib/actions/outreach-settings'
import type { OfferProgramRow, OutreachSettings } from '@/lib/get-involved/offer'

interface Props {
  programs: OfferProgramRow[]
  site: OutreachSettings
  /** ISO date of the next 1st of the month (UTC), when seats reset. */
  resetsOn: string
}

const inp = 'w-full h-11 rounded-lg border border-gray-400 px-3 text-[15px] text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 disabled:bg-gray-100'
const lbl = 'block text-sm font-semibold text-gray-800 mb-1'
const hint = 'text-[13px] text-gray-600'
const card = 'bg-white border border-gray-200 rounded-xl p-4 sm:p-5'
const btnPrimary = 'h-11 px-5 rounded-lg bg-primary-700 hover:bg-primary-800 text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2'
const btnSecondary = 'h-11 px-4 rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 text-sm font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2'

type Banner = { ok: boolean; text: string } | null

function BannerView({ banner }: { banner: Banner }) {
  if (!banner) return null
  return banner.ok
    ? <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{banner.text}</div>
    : <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{banner.text}</div>
}

function ProgramOfferCard({ p }: { p: OfferProgramRow }) {
  const [fullPrice, setFullPrice] = useState(p.fullPrice)
  const [sponsoredPrice, setSponsoredPrice] = useState(p.sponsoredPrice)
  const [reason, setReason] = useState(p.reason)
  const [seats, setSeats] = useState(p.seatsPerMonth === null ? '' : String(p.seatsPerMonth))
  const [saved, setSaved] = useState({ seats: p.seatsPerMonth, used: p.usedThisMonth })
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState<Banner>(null)

  const id = (k: string) => `offer-${p.id}-${k}`
  const seatsNum = seats.trim() === '' ? 0 : Number(seats)
  const showsOffer = Number.isInteger(seatsNum) && seatsNum > 0
  const previewLeft = Math.max(0, seatsNum - saved.used)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBanner(null)
    setBusy(true)
    try {
      const r = await saveProgramOffer({ programId: p.id, fullPrice, sponsoredPrice, reason, seats: seats.trim() })
      if (!r.ok) { setBanner({ ok: false, text: r.error }); return }
      setSaved({ seats: r.seatsPerMonth, used: r.usedThisMonth })
      setBanner({ ok: true, text: r.seatsPerMonth && r.seatsPerMonth > 0 ? 'Offer saved.' : 'Saved. No offer is shown for this program.' })
    } finally {
      setBusy(false)
    }
  }

  const savedLeft = saved.seats && saved.seats > 0 ? Math.max(0, saved.seats - saved.used) : null

  return (
    <section className={card} aria-labelledby={id('title')}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <div className="min-w-0">
          <h2 id={id('title')} className="text-lg font-bold text-gray-900">{p.name}</h2>
          <p className="text-sm text-gray-600">
            {p.ownerName ? <>Owner: {p.ownerName} ({p.ownerRole === 'COACH' ? 'coach' : 'ambassador'})</> : 'No owner assigned'}
            {p.organization ? <> &middot; {p.organization}</> : null}
          </p>
        </div>
        <p className="text-sm text-gray-800">
          This month: <strong>{saved.used} used</strong>
          {savedLeft !== null ? <> &middot; <strong>{savedLeft} left</strong> of {saved.seats}</> : <> &middot; no offer shown</>}
        </p>
      </div>

      <div className="flex flex-wrap gap-5 items-start">
        <form onSubmit={save} className="flex-[3_1_420px] min-w-0 space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-[1_1_160px]">
              <label className={lbl} htmlFor={id('full')}>Full price</label>
              <input id={id('full')} className={inp} value={fullPrice} maxLength={40} onChange={(e) => setFullPrice(e.target.value)} placeholder="$299" />
            </div>
            <div className="flex-[1_1_160px]">
              <label className={lbl} htmlFor={id('sponsored')}>Sponsored price</label>
              <input id={id('sponsored')} className={inp} value={sponsoredPrice} maxLength={40} onChange={(e) => setSponsoredPrice(e.target.value)} placeholder="$99" />
            </div>
          </div>
          <p className={`${hint} -mt-2`}>Keep the reduction moderate. Very deep cuts can make a program look less valuable.</p>

          <div>
            <label className={lbl} htmlFor={id('reason')}>Why it&apos;s sponsored (shown to prospects)</label>
            <textarea id={id('reason')} rows={2} className={`${inp} h-auto py-2.5 leading-normal`} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)}
              placeholder="NowTransformed, a nonprofit, pays part of the cost so more people can take part." />
            <p className={hint}>{300 - reason.length} characters left.</p>
          </div>

          <div className="max-w-[220px]">
            <label className={lbl} htmlFor={id('seats')}>Sponsored seats per month</label>
            <input id={id('seats')} className={inp} inputMode="numeric" type="number" min={0} max={1000} step={1} value={seats} onChange={(e) => setSeats(e.target.value)} placeholder="0" />
          </div>

          <BannerView banner={banner} />

          <div className="flex flex-wrap gap-2.5">
            <button type="submit" className={btnPrimary} disabled={busy}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
              Save offer
            </button>
            {p.ownerInviteSlug && (
              <a className={btnSecondary} href={`/join/${encodeURIComponent(p.ownerInviteSlug)}/${encodeURIComponent(p.slug)}`} target="_blank" rel="noopener noreferrer">
                Preview sign-up page <ExternalLink className="w-4 h-4" aria-hidden />
              </a>
            )}
          </div>
        </form>

        <div className="flex-[2_1_260px] min-w-0 space-y-2" aria-label={`How the offer for ${p.name} shows`}>
          <p className="text-sm font-bold text-gray-900">How it shows</p>
          {showsOffer ? (
            <div className="rounded-xl border-2 border-primary-700 p-4 space-y-2">
              <p className="text-xs font-bold text-sky-800 tracking-wide">SPONSORED SEAT</p>
              <p className="flex flex-wrap items-baseline gap-2">
                {fullPrice.trim() && <span className="text-gray-500 line-through">{fullPrice.trim()}</span>}
                <strong className="text-xl text-gray-900">{sponsoredPrice.trim() || '[Sponsored price]'}</strong>
              </p>
              {reason.trim() && <p className="text-[13px] text-gray-700 break-words">{reason.trim()}</p>}
              <p className="text-[13px] font-semibold text-amber-800">
                {previewLeft > 0 ? `${previewLeft} of ${seatsNum} sponsored seats left this month` : "Join the waiting list for next month's seats"}
              </p>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-600">No offer is shown for this program (seats are 0 or empty).</p>
          )}
        </div>
      </div>
    </section>
  )
}

function SiteCard({ site }: { site: OutreachSettings }) {
  const [mailingAddress, setMailingAddress] = useState(site.mailingAddress)
  const [replyWithin, setReplyWithin] = useState(site.replyWithin)
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState<Banner>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBanner(null)
    setBusy(true)
    try {
      const r = await saveSiteOutreach({ mailingAddress, replyWithin })
      setBanner(r.ok ? { ok: true, text: 'Site-wide settings saved.' } : { ok: false, text: r.error })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className={`${card} space-y-4`} aria-labelledby="site-title">
      <h2 id="site-title" className="text-lg font-bold text-gray-900">Site-wide</h2>
      <div>
        <label className={lbl} htmlFor="site-address">Mailing address</label>
        <input id="site-address" className={inp} value={mailingAddress} maxLength={300} onChange={(e) => setMailingAddress(e.target.value)} placeholder="NowTransformed, 123 Main St, Las Vegas, NV 89101" />
        <p className={hint}>Shown in every email footer and at the bottom of the sign-up page. Empty = the line is hidden.</p>
      </div>
      <div className="max-w-md">
        <label className={lbl} htmlFor="site-reply">Reply promise</label>
        <input id="site-reply" className={inp} value={replyWithin} maxLength={60} onChange={(e) => setReplyWithin(e.target.value)} placeholder="1 business day" />
        <p className={hint}>Used when someone asks to be contacted, e.g. &ldquo;We&apos;ll reply within 1 business day.&rdquo; Empty = no time is promised.</p>
      </div>
      <BannerView banner={banner} />
      <button type="submit" className={btnPrimary} disabled={busy}>
        {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
        Save site-wide settings
      </button>
    </form>
  )
}

export function OutreachSettingsClient({ programs, site, resetsOn }: Props) {
  const reset = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(resetsOn))
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Outreach settings</h1>
        <p className="text-gray-600 mt-1">One sponsored-seat offer per program. Coaches and ambassadors can&apos;t change it, so every page and message says the same true thing.</p>
      </div>

      <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900 flex gap-3">
        <Info className="w-5 h-5 flex-none mt-0.5" aria-hidden />
        <ul className="space-y-1 list-disc pl-4">
          <li>Seats reset on the 1st of each month (next reset: {reset}).</li>
          <li>A seat is used when someone who came through that program books a discovery call this month. Cancelled calls give the seat back.</li>
          <li>0 or empty seats = no offer is shown anywhere for that program.</li>
          <li>When no seats are left, pages offer the waiting list for next month. Never a fake countdown.</li>
          <li>Shown on the sign-up page, welcome and nudge emails, and the call guide.</li>
        </ul>
      </div>

      <SiteCard site={site} />

      <div className="space-y-4">
        <h2 className="text-lg font-bold text-gray-900">Live programs</h2>
        {programs.length === 0 ? (
          <p className={`${card} text-sm text-gray-600`}>No program pages are live yet. Offers can be set once a program page is approved and published.</p>
        ) : (
          programs.map((p) => <ProgramOfferCard key={p.id} p={p} />)
        )}
      </div>
    </div>
  )
}
