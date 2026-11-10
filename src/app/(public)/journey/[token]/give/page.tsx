import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ExternalLink, Heart } from 'lucide-react'
import { journeyPosition, stagePath } from '@/lib/get-involved/core'
import { journeyFactsFor, prospectForJourney } from '@/lib/get-involved/journey'
import { prospectRoleConfig } from '@/lib/get-involved/roles'
import { JoinShell, journeyBtn, journeyCard } from '@/components/get-involved/join-shell'
import { JourneyExpired } from '@/components/get-involved/journey-expired'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Give | NowTransformed', robots: { index: false } }

/**
 * Sponsor / donor hand-off. Sponsors get no login: this page thanks them and sends them to the
 * donation page set in Role Settings (handoffUrl). Read-only and shows only the first name, so it
 * stays open after the 14-day link window (there is no "new link" for DONATION_HANDOFF).
 */
export default async function GivePage({ params }: { params: { token: string } }) {
  const p = await prospectForJourney(params.token)
  if (!p) return <JourneyExpired />
  const cfg = await prospectRoleConfig(p)
  const pos = journeyPosition(journeyFactsFor(p, cfg))
  if (pos.stage !== 'DONATION' || p.status !== 'DONATION_HANDOFF') {
    const path = pos.stage === 'DONATION' ? null : stagePath(pos.stage, params.token)
    if (path) redirect(path)
    return (
      <div className={`${journeyCard} max-w-2xl mx-auto`}>
        <h1 className="text-2xl font-bold text-gray-900">Please get in touch</h1>
        <p className="text-gray-700">This page isn&apos;t open for you. Reply to any of our emails or contact the person who invited you.</p>
      </div>
    )
  }
  const url = cfg?.handoffUrl && /^https:\/\//i.test(cfg.handoffUrl) ? cfg.handoffUrl : null
  return (
    <JoinShell rail={{ stage: 'DONATION', role: p.journeyRole, ageRange: p.ageRange, roleLabel: cfg?.label ?? null }}>
      <div className={journeyCard}>
        <Heart className="h-10 w-10 text-primary-700" aria-hidden />
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Thank you, {p.firstName}</h1>
        <p className="text-gray-700">Sponsors and donors give through our donation page. There&apos;s no login to set up: your gift goes straight to the young people and families in the program.</p>
        {url ? (
          <>
            <a href={url} target="_blank" rel="noopener noreferrer" className={journeyBtn}>
              Go to the donation page<ExternalLink className="h-4 w-4" aria-hidden /><span className="sr-only"> (opens in a new tab)</span>
            </a>
            <p className="text-sm text-gray-500">Questions about giving? Just reply to any of our emails.</p>
          </>
        ) : (
          <p className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sky-900">Our team will email you the donation details shortly. Questions? Just reply to any of our emails.</p>
        )}
      </div>
    </JoinShell>
  )
}
