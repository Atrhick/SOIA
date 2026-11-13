/**
 * Data for the "Sponsored seat" card on the call record (admin and coach hosts). Server only.
 * Shown when the person came through a program with sponsored seats, or already has an offer.
 */
import prisma from '@/lib/prisma'
import { canUndoSeatOffer, seatsLeftOf, seatsUsedThisMonth } from '@/lib/get-involved/offer'

export interface SeatCardData {
  prospectId: string
  firstName: string
  programName: string
  fullPrice: string | null
  sponsoredPrice: string | null
  seatsPerMonth: number
  seatsLeft: number
  /** Set once offered: when, by whom, and the prices as offered. */
  offered: { at: string; by: string | null; fullPrice: string | null; sponsoredPrice: string | null; canUndo: boolean } | null
}

export async function loadSeatCard(callId: string, now = new Date()): Promise<SeatCardData | null> {
  const call = await prisma.discoveryCall.findUnique({
    where: { id: callId },
    select: {
      prospect: {
        select: {
          id: true, firstName: true, sponsoredSeatOfferedAt: true, sponsoredSeatOfferedById: true, sponsoredSeatFullPrice: true, sponsoredSeatPrice: true,
          program: { select: { id: true, name: true, sponsoredSeatsPerMonth: true, offerFullPrice: true, offerSponsoredPrice: true } },
        },
      },
    },
  })
  const p = call?.prospect
  const prog = p?.program
  if (!p || !prog) return null
  const seats = prog.sponsoredSeatsPerMonth ?? 0
  if (seats <= 0 && !p.sponsoredSeatOfferedAt) return null
  const used = await seatsUsedThisMonth(prog.id, now)
  let by: string | null = null
  if (p.sponsoredSeatOfferedById) {
    const u = await prisma.user.findUnique({
      where: { id: p.sponsoredSeatOfferedById },
      select: { email: true, coachProfile: { select: { firstName: true, lastName: true } } },
    })
    by = u ? (u.coachProfile ? `${u.coachProfile.firstName} ${u.coachProfile.lastName}`.trim() : u.email.split('@')[0]) : null
  }
  return {
    prospectId: p.id,
    firstName: p.firstName,
    programName: prog.name,
    fullPrice: prog.offerFullPrice,
    sponsoredPrice: prog.offerSponsoredPrice,
    seatsPerMonth: seats,
    seatsLeft: seatsLeftOf(seats, used),
    offered: p.sponsoredSeatOfferedAt
      ? { at: p.sponsoredSeatOfferedAt.toISOString(), by, fullPrice: p.sponsoredSeatFullPrice, sponsoredPrice: p.sponsoredSeatPrice, canUndo: canUndoSeatOffer(p.sponsoredSeatOfferedAt, now) }
      : null,
  }
}
