import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { billingLabel, formatDollars, isPaidRole, journeyPosition, priceLabel, stagePath } from '@/lib/get-involved/core'
import { journeyFactsFor, journeyLinkUsable, prospectForJourney } from '@/lib/get-involved/journey'
import { getLiveTerms, prospectRoleConfig } from '@/lib/get-involved/roles'
import { userDisplayName } from '@/lib/get-involved/server'
import { needsCoachMatch } from '@/lib/get-involved/login'
import { onlinePaymentAvailableFor } from '@/lib/payments'
import { JoinShell, journeyBtn, journeyCard } from '@/components/get-involved/join-shell'
import { JourneyExpired } from '@/components/get-involved/journey-expired'
import { JoinClient, JoinView } from './join-client'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Join | NowTransformed', robots: { index: false } }

const JOIN_STAGES = ['TERMS', 'PAYMENT', 'LOGIN']

export default async function JoinPage({ params, searchParams }: { params: { token: string }; searchParams?: { paid?: string; cancelled?: string } }) {
  const returnedPaid = searchParams?.paid === '1'
  const returnedCancelled = searchParams?.cancelled === '1'
  const p = await prospectForJourney(params.token)
  if (!p) return <JourneyExpired />
  const cfg = await prospectRoleConfig(p)
  const pos = journeyPosition(journeyFactsFor(p, cfg))

  if (pos.stage === 'CLOSED') {
    return <Message title="Please get in touch" body="This step is closed. If you think that's a mistake, reply to any of our emails or contact the person who invited you." />
  }
  // Back from Invo and the webhook has already created the login: say so instead of jumping away.
  if (returnedPaid && pos.stage === 'DONE') {
    return (
      <div className={`${journeyCard} max-w-2xl mx-auto`}>
        <h1 className="text-2xl font-bold text-gray-900">Payment received</h1>
        <p className="text-gray-700">Thank you, {p.firstName}. Your login is ready.</p>
        <a href={`/journey/${params.token}/welcome`} className={`${journeyBtn} w-full`}>Continue to your welcome page</a>
      </div>
    )
  }
  if (!JOIN_STAGES.includes(pos.stage)) {
    const path = stagePath(pos.stage, params.token)
    if (path) redirect(path)
    return <Message title="Not quite yet" body="There's an earlier step to finish first. We'll email you when it's time to join." />
  }
  if (!cfg) return <Message title="Not quite yet" body="We'll email you when it's time to join." />
  if (!journeyLinkUsable(p)) return <JourneyExpired />

  const inviter = p.invitedById ? (await userDisplayName(p.invitedById))?.full ?? null : null
  const paid = isPaidRole(cfg)
  const base = { firstName: p.firstName, inviterName: inviter, roleLabel: cfg.label, email: p.email }
  const online = paid && onlinePaymentAvailableFor(cfg.billing)
  let view: JoinView
  if (pos.stage === 'TERMS') {
    const terms = await getLiveTerms(cfg.role)
    view = {
      kind: 'terms', ...base, paid,
      minor: p.ageRange === 'UNDER_18', parentConsent: !!p.parentConsentAt,
      terms: { version: terms.version, body: terms.body, title: paid ? `${cfg.label} agreement` : `${cfg.label} terms` },
      price: paid ? { amount: formatDollars(cfg.priceCents), billing: billingLabel(cfg.billing), label: priceLabel(cfg), online } : null,
    }
  } else if (pos.stage === 'PAYMENT') {
    view = {
      kind: 'payment', ...base,
      amount: formatDollars(cfg.priceCents), billing: billingLabel(cfg.billing),
      termsVersion: p.acceptedTerms?.version ?? null,
      acceptedAt: p.roleTermsAcceptedAt?.toISOString() ?? null,
      // Pay online only while the payment is still open; a fresh checkout is made on each click.
      online: online && p.payment?.status === 'PENDING',
      failed: p.payment?.status === 'FAILED',
      notice: returnedPaid ? 'paid' : returnedCancelled ? 'cancelled' : null,
    }
  } else if (await needsCoachMatch(p.id)) {
    // An ambassador whose inviter has no coach: the login waits until an admin places them.
    view = { kind: 'coach', ...base, passwordSaved: !!p.pendingPasswordHash, paymentReceived: p.payment?.status === 'COMPLETED' }
  } else {
    view = { kind: 'login', ...base, paymentReceived: p.payment?.status === 'COMPLETED' }
  }
  return (
    <JoinShell rail={{ stage: pos.stage, role: p.journeyRole, ageRange: p.ageRange, roleLabel: cfg.label }}>
      <JoinClient token={params.token} view={view} />
    </JoinShell>
  )
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className={`${journeyCard} max-w-2xl mx-auto`}>
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      <p className="text-gray-700">{body}</p>
    </div>
  )
}
