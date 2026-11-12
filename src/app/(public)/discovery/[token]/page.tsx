import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { JourneyStage, journeyOpen, journeyPosition, stagePath } from '@/lib/get-involved/core'
import { journeyUsable, prospectByJourneyToken, userDisplayName } from '@/lib/get-involved/server'
import { journeyStateFor } from '@/lib/get-involved/journey'
import { JourneyStepFrame } from '@/components/get-involved/journey-step-frame'
import { DiscoveryClient, DiscoveryView } from './discovery-client'
import { bookViewFor } from './book-view'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Discovery call | NowTransformed', robots: { index: false } }

export default async function DiscoveryPage({ params }: { params: { token: string } }) {
  const p = await prospectByJourneyToken(params.token)
  const now = new Date()
  let view: DiscoveryView
  // The booking steps show the journey rail (PBookMinor / PBookYoung / PCancel / PNoSlots), like the later steps.
  let stage: JourneyStage | null = null

  if (!p) view = { kind: 'expired' }
  else if (p.ageRange === 'UNDER_18' && !p.parentConsentAt) {
    stage = 'PARENT_CONSENT'
    view = { kind: 'message', title: 'Waiting on your parent', body: "We've emailed your parent or guardian. Once they give consent, you'll be able to book your call here." }
  }
  else if (p.status === 'PAUSED' || p.status === 'NOT_A_FIT') view = { kind: 'message', title: 'Please get in touch', body: 'To book a new call, please reach out to the person who invited you, or reply to any of our emails.' }
  else if (!journeyOpen(p.status)) {
    // After the call: once a role is chosen, send them on to their next step.
    const { facts } = await journeyStateFor(p)
    const next = p.journeyToken ? stagePath(journeyPosition(facts).stage, p.journeyToken) : null
    if (next && !next.startsWith('/discovery/')) redirect(next)
    view = { kind: 'message', title: 'Your call is done', body: "Thanks for talking with us. We'll email you about your next step." }
  }
  else if (!journeyUsable(p, now)) view = { kind: 'expired' }
  else {
    stage = p.discoveryCalls[0] ? 'DISCOVERY_CALL' : 'BOOK_CALL'
    view = await bookViewFor(p, now)
  }

  const client = <DiscoveryClient token={params.token} view={view} framed={!!stage} />
  if (!p || !stage) return client
  const inviter = p.invitedById ? await userDisplayName(p.invitedById) : null
  return (
    <JourneyStepFrame stage={stage} role={null} ageRange={p.ageRange} invitedBy={inviter?.full ?? null}>
      {client}
    </JourneyStepFrame>
  )
}
