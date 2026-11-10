import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { AgeRangeValue, JourneyStage, canProspectChange, journeyOpen, journeyPosition, stagePath } from '@/lib/get-involved/core'
import { journeyUsable, prospectByJourneyToken, userDisplayName } from '@/lib/get-involved/server'
import { alertNoSlotsOncePerDay, openSlotsWithBlocks } from '@/lib/get-involved/discovery-slots'
import { journeyStateFor } from '@/lib/get-involved/journey'
import { JourneyStepFrame } from '@/components/get-involved/journey-step-frame'
import { DiscoveryClient, DiscoveryView } from './discovery-client'

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
    const call = p.discoveryCalls[0] ?? null
    stage = call ? 'DISCOVERY_CALL' : 'BOOK_CALL'
    const { slots, hosts } = await openSlotsWithBlocks(p.ageRange as AgeRangeValue | null, now, call?.id)
    const oneHost = hosts.length === 1 ? hosts[0].displayName : null
    let requested = { notify: false, reachOut: false }
    if (slots.length === 0 && !call) {
      await alertNoSlotsOncePerDay(p, now)
      const open = await prisma.discoverySlotRequest.findMany({ where: { prospectId: p.id, handledAt: null }, select: { kind: true } })
      requested = { notify: open.some((r) => r.kind === 'NOTIFY'), reachOut: open.some((r) => r.kind === 'REACH_OUT') }
    }
    view = {
      kind: 'book',
      firstName: p.firstName,
      minor: p.ageRange === 'UNDER_18',
      parentName: p.parentName,
      hostLabel: oneHost,
      slots: slots.map((s) => s.startsAt.toISOString()),
      requested,
      call: call
        ? {
            startsAt: call.startsAt.toISOString(),
            timezone: call.timezone,
            hostName: call.host?.discoveryHost?.displayName ?? 'our team',
            meetingUrl: call.meetingUrl ?? call.host?.discoveryHost?.meetingUrl ?? null,
            canChange: canProspectChange(call.startsAt, now),
          }
        : null,
    }
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
