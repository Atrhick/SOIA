import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { canInvite, journeyPosition, stagePath } from '@/lib/get-involved/core'
import { CLOSED_BODY, CLOSED_TITLE } from '@/lib/get-involved/journey-page'
import { appUrl } from '@/lib/get-involved/emails'
import { journeyFactsFor, journeyLinkUsable, prospectForJourney } from '@/lib/get-involved/journey'
import { prospectRoleConfig } from '@/lib/get-involved/roles'
import { ensureInviteSlug, userDisplayName } from '@/lib/get-involved/server'
import { journeyBtn, journeyCard } from '@/components/get-involved/join-shell'
import { JourneyExpired } from '@/components/get-involved/journey-expired'
import { WelcomeClient } from './welcome-client'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Welcome | NowTransformed', robots: { index: false } }

const BUSINESS_ROLES = ['COACH', 'SERVICE_PROVIDER', 'COACH_SERVICE_PROVIDER', 'BUSINESS_AFFILIATE', 'RESOURCE_CENTER_OWNER']

export default async function WelcomePage({ params }: { params: { token: string } }) {
  const p = await prospectForJourney(params.token)
  if (!p) return <JourneyExpired />
  const cfg = await prospectRoleConfig(p)
  const pos = journeyPosition(journeyFactsFor(p, cfg))
  // Closed (not a fit, paused): same message as every other journey page, no promise of an email.
  if (pos.stage === 'CLOSED') {
    return (
      <div className={`${journeyCard} max-w-2xl mx-auto`}>
        <h1 className="text-2xl font-bold text-gray-900">{CLOSED_TITLE}</h1>
        <p className="text-gray-700">{CLOSED_BODY}</p>
      </div>
    )
  }
  if (pos.stage !== 'DONE' || !p.userId) {
    const path = stagePath(pos.stage, params.token)
    if (path && pos.stage !== 'DONE') redirect(path)
    return (
      <div className={`${journeyCard} max-w-2xl mx-auto`}>
        <h1 className="text-2xl font-bold text-gray-900">Not quite yet</h1>
        <p className="text-gray-700">This page opens once your login is ready. We&apos;ll email you when it is.</p>
      </div>
    )
  }

  const user = await prisma.user.findUnique({ where: { id: p.userId }, select: { role: true, status: true } })
  const signInPath = user?.role === 'AMBASSADOR' ? '/ambassador-login' : '/login'
  // Past the 14 days: keep it to a plain "you're all set" without names or links.
  if (!journeyLinkUsable(p) || user?.status !== 'ACTIVE') {
    return (
      <div className={`${journeyCard} max-w-2xl mx-auto`}>
        <h1 className="text-2xl font-bold text-gray-900">You&apos;re all set</h1>
        <p className="text-gray-700">Your login is ready. Sign in to get started.</p>
        <a href={signInPath} className={journeyBtn}>Sign in</a>
      </div>
    )
  }

  const inviter = p.invitedById ? (await userDisplayName(p.invitedById))?.full ?? null : null
  let inviteUrl: string | null = null
  // Only coaches and ambassadors have a One-A-Day page and leaderboard for their invites.
  if (canInvite(user?.role)) {
    try { inviteUrl = appUrl(`/join/${await ensureInviteSlug(p.userId)}`) } catch { inviteUrl = null }
  }
  const paid = p.payment?.status === 'COMPLETED'
  return (
    <WelcomeClient
      firstName={p.firstName}
      roleLabel={cfg?.label ?? 'member'}
      inviterName={inviter}
      inviteUrl={inviteUrl}
      paymentReceived={paid}
      businessRole={BUSINESS_ROLES.includes(p.journeyRole ?? '')}
      signInPath={signInPath}
      inviter={canInvite(user?.role)}
    />
  )
}
