/**
 * Builds the booking view for a prospect whose journey is open. Shared by /discovery/[token] and the
 * sign-up page's "pick a time" step (signupBookingView). Server only, not 'use server'.
 */
import prisma from '@/lib/prisma'
import { AgeRangeValue, canProspectChange } from '@/lib/get-involved/core'
import { prospectByJourneyToken } from '@/lib/get-involved/server'
import { alertNoSlotsOncePerDay, openSlotsWithBlocks } from '@/lib/get-involved/discovery-slots'
import { getOutreachSettings, getSignupOffer, smsEnabled } from '@/lib/get-involved/offer'
import { programDisplay } from '@/lib/get-involved/program-welcome-server'
import type { BookView } from '@/components/get-involved/signup/booking'

type P = NonNullable<Awaited<ReturnType<typeof prospectByJourneyToken>>>

export async function bookViewFor(p: P, now = new Date()): Promise<BookView> {
  const call = p.discoveryCalls[0] ?? null
  const { slots, hosts } = await openSlotsWithBlocks(p.ageRange as AgeRangeValue | null, now, call?.id)
  const oneHost = hosts.length === 1 ? hosts[0].displayName : null
  const open = await prisma.discoverySlotRequest.findMany({ where: { prospectId: p.id, handledAt: null }, select: { kind: true } })
  if (slots.length === 0 && !call) await alertNoSlotsOncePerDay(p, now)
  const [settings, offer, program] = await Promise.all([
    getOutreachSettings(),
    getSignupOffer(p.programId).catch(() => null),
    p.programId ? programDisplay(p.programId).catch(() => null) : Promise.resolve(null),
  ])
  const waitlisted = open.some((r) => r.kind === 'SEAT_WAITLIST')
  return {
    kind: 'book',
    firstName: p.firstName,
    minor: p.ageRange === 'UNDER_18',
    parentName: p.parentName,
    hostLabel: oneHost,
    slots: slots.map((s) => s.startsAt.toISOString()),
    requested: { notify: open.some((r) => r.kind === 'NOTIFY'), reachOut: open.some((r) => r.kind === 'REACH_OUT') },
    call: call
      ? {
          startsAt: call.startsAt.toISOString(),
          endsAt: call.endsAt.toISOString(),
          timezone: call.timezone,
          hostName: call.host?.discoveryHost?.displayName ?? 'our team',
          meetingUrl: call.meetingUrl ?? call.host?.discoveryHost?.meetingUrl ?? null,
          canChange: canProspectChange(call.startsAt, now),
        }
      : null,
    replyWithin: settings.replyWithin.trim(),
    textReminders: smsEnabled() && !!p.smsConsentAt,
    programName: program?.label ?? null,
    // "your sponsored seat" on the booked screen: only with an offer, and not for someone on the waiting list.
    sponsored: !!offer && !waitlisted,
    helpWith: p.helpWith ?? '',
  }
}
