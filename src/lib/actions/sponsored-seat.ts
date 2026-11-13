'use server'

/**
 * Sponsored seats (One-A-Day v2): the admin team qualifies the person on the free call and then OFFERS
 * the seat. Offering uses one of the program's monthly seats (offer.ts `seatsUsedThisMonth`); "Undo
 * offer" gives it back, but only in the same month. Who: ADMIN, or the coach who hosts a call with this
 * person (same rule as canActOnCall). Never while impersonating.
 *
 * Payment is NOT tied to the sponsored price: program fees are collected by the program owner outside
 * this app. This only records the offer (with a snapshot of the prices as offered).
 */
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { sendPushToUser } from '@/lib/push'
import { canUndoSeatOffer, seatLockKey, seatsUsedWhere } from '@/lib/get-involved/offer'

export type SeatResult = { ok: true; message: string } | { ok: false; error: string }

const idSchema = z.string().trim().min(1).max(100)

async function guard(prospectId: unknown): Promise<{ ok: false; error: string } | { ok: true; userId: string; prospectId: string }> {
  const session = await auth()
  if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'COACH')) return { ok: false, error: 'Unauthorized' }
  if (session.user.isImpersonating) return { ok: false, error: 'Switch back to your admin account first.' }
  const parsed = idSchema.safeParse(prospectId)
  if (!parsed.success) return { ok: false, error: 'Unknown person' }
  if (session.user.role === 'COACH') {
    // A coach host may act only for someone whose call they host (canActOnCall).
    const hosts = await prisma.discoveryCall.count({ where: { prospectId: parsed.data, hostId: session.user.id } })
    if (!hosts) return { ok: false, error: 'Only the host or an admin can offer a sponsored seat.' }
  }
  return { ok: true, userId: session.user.id, prospectId: parsed.data }
}

function refresh(programId: string | null) {
  revalidatePath('/admin/discovery-calls/[id]', 'page')
  revalidatePath('/coach/discovery-calls/[id]', 'page')
  revalidatePath('/admin/outreach-settings')
  if (programId) for (const base of ['/coach/programs', '/ambassador/programs']) revalidatePath(`${base}/${programId}`)
}

class SeatError extends Error {}

export async function offerSponsoredSeat(prospectId: unknown): Promise<SeatResult> {
  const g = await guard(prospectId)
  if (!g.ok) return g
  try {
    const now = new Date()
    const result = await prisma.$transaction(async (tx) => {
      const p = await tx.prospect.findUnique({
        where: { id: g.prospectId },
        select: {
          id: true, firstName: true, programId: true, sponsoredSeatOfferedAt: true,
          program: { select: { id: true, name: true, sponsoredSeatsPerMonth: true, offerFullPrice: true, offerSponsoredPrice: true } },
        },
      })
      if (!p) throw new SeatError('Person not found.')
      if (p.sponsoredSeatOfferedAt) throw new SeatError(`${p.firstName} already has a sponsored seat offer.`)
      const prog = p.program
      const seats = prog?.sponsoredSeatsPerMonth ?? 0
      if (!prog || seats <= 0) throw new SeatError("This person's program has no sponsored seats.")
      // One lock per program and month: two people offering at once can't go over the monthly seats.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${seatLockKey(prog.id, now)}))`
      const used = await tx.prospect.count({ where: { programId: prog.id, ...seatsUsedWhere(now) } })
      if (used >= seats) throw new SeatError(`All ${seats} sponsored seats for ${prog.name} have been offered this month. They reset on the 1st.`)
      const claimed = await tx.prospect.updateMany({
        where: { id: p.id, sponsoredSeatOfferedAt: null },
        data: {
          sponsoredSeatOfferedAt: now,
          sponsoredSeatOfferedById: g.userId,
          sponsoredSeatFullPrice: prog.offerFullPrice,
          sponsoredSeatPrice: prog.offerSponsoredPrice,
        },
      })
      if (claimed.count !== 1) throw new SeatError(`${p.firstName} already has a sponsored seat offer.`)
      await tx.auditLog.create({
        data: {
          userId: g.userId, action: 'SPONSORED_SEAT_OFFERED', entityType: 'Prospect', entityId: p.id,
          details: JSON.stringify({ programId: prog.id, fullPrice: prog.offerFullPrice, sponsoredPrice: prog.offerSponsoredPrice, seatNo: used + 1, seatsPerMonth: seats }),
        },
      })
      return { first: p.firstName, programId: prog.id, left: seats - used - 1 }
    })
    refresh(result.programId)
    await tellOwner(result.programId, result.first)
    return { ok: true, message: `Sponsored seat offered to ${result.first}. ${result.left} left this month.` }
  } catch (e) {
    if (e instanceof SeatError) return { ok: false, error: e.message }
    console.error('offerSponsoredSeat failed', e)
    return { ok: false, error: 'Could not record the offer. Please try again.' }
  }
}

export async function undoSponsoredSeatOffer(prospectId: unknown): Promise<SeatResult> {
  const g = await guard(prospectId)
  if (!g.ok) return g
  try {
    const now = new Date()
    const p = await prisma.prospect.findUnique({ where: { id: g.prospectId }, select: { id: true, firstName: true, programId: true, sponsoredSeatOfferedAt: true } })
    if (!p) return { ok: false, error: 'Person not found.' }
    if (!p.sponsoredSeatOfferedAt) return { ok: false, error: 'There is no offer to undo.' }
    if (!canUndoSeatOffer(p.sponsoredSeatOfferedAt, now)) return { ok: false, error: 'Offers can only be undone in the month they were made.' }
    const done = await prisma.prospect.updateMany({
      where: { id: p.id, sponsoredSeatOfferedAt: p.sponsoredSeatOfferedAt },
      data: { sponsoredSeatOfferedAt: null, sponsoredSeatOfferedById: null, sponsoredSeatFullPrice: null, sponsoredSeatPrice: null },
    })
    if (done.count !== 1) return { ok: false, error: 'This offer just changed. Reload the page.' }
    await prisma.auditLog.create({
      data: { userId: g.userId, action: 'SPONSORED_SEAT_UNDONE', entityType: 'Prospect', entityId: p.id, details: JSON.stringify({ programId: p.programId, offeredAt: p.sponsoredSeatOfferedAt.toISOString() }) },
    }).catch(() => {})
    refresh(p.programId)
    return { ok: true, message: `Offer undone. The seat is free again.` }
  } catch (e) {
    console.error('undoSponsoredSeatOffer failed', e)
    return { ok: false, error: 'Could not undo the offer. Please try again.' }
  }
}

/** Lets the program's owner know on their phone (if they turned notifications on). Never throws. */
async function tellOwner(programId: string, firstName: string): Promise<void> {
  try {
    const prog = await prisma.coachProgram.findUnique({
      where: { id: programId },
      select: { id: true, name: true, coach: { select: { userId: true } }, ambassador: { select: { userId: true } } },
    })
    const ownerUserId = prog?.coach?.userId ?? prog?.ambassador?.userId
    if (!prog || !ownerUserId) return
    const base = prog.coach ? '/coach' : '/ambassador'
    await sendPushToUser(ownerUserId, {
      title: 'Sponsored seat offered',
      body: `${firstName} was offered a sponsored seat for ${prog.name}.`,
      url: `${base}/programs/${prog.id}`,
      tag: `seat-${programId}`,
    })
  } catch (e) {
    console.error('[SEAT] owner notification failed', e)
  }
}

