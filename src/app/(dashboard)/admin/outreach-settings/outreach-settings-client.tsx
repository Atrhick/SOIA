'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ExternalLink, Loader2, Pencil, X } from 'lucide-react'
import { SPONSOR_LINE } from '@/lib/get-involved/scripts'
import { saveProgramOffer, saveSiteOutreach } from '@/lib/actions/outreach-settings'
import type { OfferProgramRow, OutreachSettings } from '@/lib/get-involved/offer'

const inp = 'w-full h-10 rounded-lg border border-gray-300 px-3 text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600'
const lbl = 'block text-sm font-semibold text-gray-800 mb-1'
const hint = 'text-xs text-gray-500 mt-1'
const btnPrimary = 'h-10 px-4 rounded-lg bg-primary-700 hover:bg-primary-800 text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2'
const btnSecondary = 'h-10 px-4 rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 text-sm font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2'
const th = 'px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap'

type Banner = { ok: boolean; text: string } | null

function BannerView({ banner }: { banner: Banner }) {
  if (!banner) return null
  return banner.ok
    ? <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{banner.text}</div>
    : <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{banner.text}</div>
}

const fmtDate = (iso: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso))

function changedBy(p: OfferProgramRow) {
  if (!p.pricesUpdatedAt || !p.pricesUpdatedBy) return null
  return `${p.pricesUpdatedBy.isOwner ? 'Owner' : p.pricesUpdatedBy.name} · ${fmtDate(p.pricesUpdatedAt)}`
}

/** One row per live program; "Edit" opens the full offer form in a side panel. */
export function ProgramOfferTable({ programs, emptyText }: { programs: OfferProgramRow[]; emptyText: string }) {
  const [editing, setEditing] = useState<OfferProgramRow | null>(null)

  if (programs.length === 0) {
    return <p className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-600">{emptyText}</p>
  }
  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="relative overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Live programs and their sponsored-seat offers</caption>
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th scope="col" className={th}>Program</th>
              <th scope="col" className={th}>Prices</th>
              <th scope="col" className={th}>Sponsored seats offered this month</th>
              <th scope="col" className={th}><span className="sr-only">Edit</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {programs.map((p) => {
              const on = (p.seatsPerMonth ?? 0) > 0
              const left = on ? Math.max(0, (p.seatsPerMonth ?? 0) - p.usedThisMonth) : 0
              const who = changedBy(p)
              return (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 min-w-[14rem]">
                    <p className="font-semibold text-gray-900">{p.name}</p>
                    <p className="text-gray-500">{p.ownerName ? `${p.ownerName} (${p.ownerRole === 'COACH' ? 'coach' : 'ambassador'})` : 'No owner'}{p.organization ? ` · ${p.organization}` : ''}</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {p.sponsoredPrice || p.fullPrice ? (
                      <>
                        <p className="text-gray-900">
                          {p.sponsoredPrice && <strong>{p.sponsoredPrice}</strong>}
                          {p.fullPrice && <span className={p.sponsoredPrice ? 'ml-1.5 text-gray-500 line-through' : ''}>{p.fullPrice}</span>}
                        </p>
                        {who && <p className="text-xs text-gray-500">Changed by {who}</p>}
                      </>
                    ) : <span className="text-gray-400">Not set</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {on ? (
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200" aria-hidden="true">
                          <span className={`block h-full rounded-full ${left === 0 ? 'bg-amber-500' : 'bg-primary-600'}`} style={{ width: `${Math.min(100, (p.usedThisMonth / (p.seatsPerMonth || 1)) * 100)}%` }} />
                        </span>
                        <span className={left === 0 ? 'font-semibold text-amber-800' : 'text-gray-900'}>{p.usedThisMonth} offered · {left} of {p.seatsPerMonth} left</span>
                      </span>
                    ) : <span className="text-gray-500">Off (no sponsorship line shown)</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => setEditing(p)} className={`${btnSecondary} h-9`}>
                      <Pencil className="h-3.5 w-3.5" aria-hidden />Edit<span className="sr-only"> offer for {p.name}</span>
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <OfferSheet program={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function OfferSheet({ program, onClose }: { program: OfferProgramRow | null; onClose: () => void }) {
  return (
    <DialogPrimitive.Root open={!!program} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <DialogPrimitive.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-white shadow-2xl focus:outline-none">
          {program && <OfferForm key={program.id} p={program} onDone={onClose} />}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function OfferForm({ p, onDone }: { p: OfferProgramRow; onDone: () => void }) {
  const router = useRouter()
  const [fullPrice, setFullPrice] = useState(p.fullPrice)
  const [sponsoredPrice, setSponsoredPrice] = useState(p.sponsoredPrice)
  const [reason, setReason] = useState(p.reason)
  const [seats, setSeats] = useState(p.seatsPerMonth === null ? '' : String(p.seatsPerMonth))
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState<Banner>(null)
  const id = (k: string) => `offer-${p.id}-${k}`
  const seatsNum = seats.trim() === '' ? 0 : Number(seats)
  const showsOffer = Number.isInteger(seatsNum) && seatsNum > 0
  const previewLeft = Math.max(0, seatsNum - p.usedThisMonth)
  const who = changedBy(p)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBanner(null); setBusy(true)
    try {
      const r = await saveProgramOffer({ programId: p.id, fullPrice, sponsoredPrice, reason, seats: seats.trim() })
      if (!r.ok) { setBanner({ ok: false, text: r.error }); return }
      router.refresh()
      onDone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
        <div className="min-w-0">
          <DialogPrimitive.Title className="text-lg font-bold text-gray-900">{p.name}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="text-sm text-gray-600">
            {p.ownerName ? `Owner: ${p.ownerName}` : 'No owner'} · {p.usedThisMonth} seat{p.usedThisMonth === 1 ? '' : 's'} offered on calls this month
          </DialogPrimitive.Description>
        </div>
        <DialogPrimitive.Close className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Close"><X className="h-5 w-5" /></DialogPrimitive.Close>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
        <fieldset className="space-y-3">
          <legend className="text-sm font-bold text-gray-900">Prices <span className="font-normal text-gray-500">(for the team on the call only; the owner can change these too)</span></legend>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl} htmlFor={id('full')}>Full price</label>
              <input id={id('full')} className={inp} value={fullPrice} maxLength={40} onChange={(e) => setFullPrice(e.target.value)} placeholder="$299" />
            </div>
            <div>
              <label className={lbl} htmlFor={id('sponsored')}>Sponsored price</label>
              <input id={id('sponsored')} className={inp} value={sponsoredPrice} maxLength={40} onChange={(e) => setSponsoredPrice(e.target.value)} placeholder="$99" />
            </div>
          </div>
          {who && <p className={hint}>Last changed by {who}.</p>}
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-sm font-bold text-gray-900">Sponsorship <span className="font-normal text-gray-500">(admins only)</span></legend>
          <div className="max-w-[12rem]">
            <label className={lbl} htmlFor={id('seats')}>Seats per month</label>
            <input id={id('seats')} className={inp} inputMode="numeric" type="number" min={0} max={1000} step={1} value={seats} onChange={(e) => setSeats(e.target.value)} placeholder="0" />
            <p className={hint}>0 or empty = no sponsorship line shown. A seat is used when the team offers it on the call.</p>
          </div>
          <div>
            <label className={lbl} htmlFor={id('reason')}>Why it&apos;s sponsored (one line shown to people signing up)</label>
            <textarea id={id('reason')} rows={2} className={`${inp} h-auto py-2 leading-normal`} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)}
              placeholder="NowTransformed pays part of the cost so more people can take part." />
            <p className={hint}>{300 - reason.length} characters left.</p>
          </div>
        </fieldset>

        <div className="space-y-2">
          <p className="text-sm font-bold text-gray-900">How it shows on the sign-up page</p>
          {showsOffer ? (
            <div className="rounded-xl border-2 border-primary-700 p-4 space-y-1.5">
              <p className="text-xs font-bold text-sky-800 tracking-wide">SPONSORED SEATS</p>
              {previewLeft > 0 ? (
                <>
                  <p className="text-sm text-gray-900">{SPONSOR_LINE} We&apos;ll talk about it on your free call.</p>
                  {reason.trim() && <p className="text-sm text-gray-700 break-words">{reason.trim()}</p>}
                </>
              ) : (
                <p className="text-sm text-gray-900">Sponsored seats for this month have all been offered. Join the waiting list for next month.</p>
              )}
              <p className="text-sm text-gray-600">No prices or seat counts are shown before the call. The host sees the prices on the call record.</p>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-600">No sponsorship line is shown (seats are 0 or empty).</p>
          )}
        </div>
        <BannerView banner={banner} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 px-5 py-3">
        {p.ownerInviteSlug ? (
          <a className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:underline" href={`/join/${encodeURIComponent(p.ownerInviteSlug)}/${encodeURIComponent(p.slug)}`} target="_blank" rel="noopener noreferrer">
            Open sign-up page <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        ) : <span />}
        <div className="flex gap-2">
          <DialogPrimitive.Close type="button" className={btnSecondary}>Cancel</DialogPrimitive.Close>
          <button type="submit" className={btnPrimary} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Save
          </button>
        </div>
      </div>
    </form>
  )
}

/** Mailing address and reply promise used by every outreach email. */
export function SiteCard({ site }: { site: OutreachSettings }) {
  const [mailingAddress, setMailingAddress] = useState(site.mailingAddress)
  const [replyWithin, setReplyWithin] = useState(site.replyWithin)
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState<Banner>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBanner(null); setBusy(true)
    try {
      const r = await saveSiteOutreach({ mailingAddress, replyWithin })
      setBanner(r.ok ? { ok: true, text: 'Saved.' } : { ok: false, text: r.error })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="rounded-xl border border-gray-200 bg-white p-5 space-y-4" aria-labelledby="site-title">
      <div>
        <h2 id="site-title" className="text-lg font-bold text-gray-900">Email details</h2>
        <p className="text-sm text-gray-600">Used in every outreach email, for all programs.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] [&>*]:min-w-0">
        <div>
          <label className={lbl} htmlFor="site-address">Mailing address</label>
          <input id="site-address" className={inp} value={mailingAddress} maxLength={300} onChange={(e) => setMailingAddress(e.target.value)} placeholder="NowTransformed, 123 Main St, Las Vegas, NV 89101" />
          <p className={hint}>Shown in the email footer and at the bottom of sign-up pages. Leave empty to hide it.</p>
        </div>
        <div>
          <label className={lbl} htmlFor="site-reply">We reply within</label>
          <input id="site-reply" className={inp} value={replyWithin} maxLength={60} onChange={(e) => setReplyWithin(e.target.value)} placeholder="1 business day" />
          <p className={hint}>When someone asks to be contacted. Leave empty to promise no time.</p>
        </div>
      </div>
      <BannerView banner={banner} />
      <button type="submit" className={btnPrimary} disabled={busy}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Save email details
      </button>
    </form>
  )
}
