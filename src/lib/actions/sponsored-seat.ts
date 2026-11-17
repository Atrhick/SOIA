'use server'

/**
 * Sponsorships (One-A-Day v2): the admin team qualifies the person on the free call and then OFFERS
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
import { userDisplayName } from '@/lib/get-involved/server'
import { sendEmail } from '@/lib/email'
import { codeEmail } from '@/lib/explorenation/core'
import { createCode, enConfig, enPublicUrl, revokeCode } from '@/lib/explorenation/client'

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
    if (!hosts) return { ok: false, error: 'Only the host or an admin can offer a sponsorship.' }
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
          program: { select: { id: true, name: true, sponsoredSeatsPerMonth: true, offerFullPrice: true, offerSponsoredPrice: true, partnerCodeSource: true } },
        },
      })
      if (!p) throw new SeatError('Person not found.')
      if (p.sponsoredSeatOfferedAt) throw new SeatError(`${p.firstName} already has a sponsorship offer.`)
      const prog = p.program
      const seats = prog?.sponsoredSeatsPerMonth ?? 0
      if (!prog || seats <= 0) throw new SeatError("This person's program has no sponsorships.")
      if (prog.partnerCodeSource === 'explorenation' && !enConfig()) throw new SeatError('The ExploreNation connection is not set up yet, so no founding-rate code can be sent. Ask an admin.')
      // One lock per program and month: two people offering at once can't go over the monthly seats.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${seatLockKey(prog.id, now)}))`
      const used = await tx.prospect.count({ where: { programId: prog.id, ...seatsUsedWhere(now) } })
      if (used >= seats) throw new SeatError(`All ${seats} sponsorships for ${prog.name} have been offered this month. They reset on the 1st.`)
      const claimed = await tx.prospect.updateMany({
        where: { id: p.id, sponsoredSeatOfferedAt: null },
        data: {
          sponsoredSeatOfferedAt: now,
          sponsoredSeatOfferedById: g.userId,
          sponsoredSeatFullPrice: prog.offerFullPrice,
          sponsoredSeatPrice: prog.offerSponsoredPrice,
        },
      })
      if (claimed.count !== 1) throw new SeatError(`${p.firstName} already has a sponsorship offer.`)
      await tx.auditLog.create({
        data: {
          userId: g.userId, action: 'SPONSORED_SEAT_OFFERED', entityType: 'Prospect', entityId: p.id,
          details: JSON.stringify({ programId: prog.id, fullPrice: prog.offerFullPrice, sponsoredPrice: prog.offerSponsoredPrice, seatNo: used + 1, seatsPerMonth: seats }),
        },
      })
      return { first: p.firstName, programId: prog.id, left: seats - used - 1, partner: prog.partnerCodeSource }
    })
    let codeNote = ''
    if (result.partner === 'explorenation') {
      const c = await sendExploreNationCode(g.prospectId, result.programId, g.userId, now)
      if (!c.ok) {
        // No code, no offer: give the seat back so the host can try again.
        await prisma.prospect.updateMany({
          where: { id: g.prospectId, sponsoredSeatOfferedAt: now },
          data: { sponsoredSeatOfferedAt: null, sponsoredSeatOfferedById: null, sponsoredSeatFullPrice: null, sponsoredSeatPrice: null },
        })
        await prisma.auditLog.create({
          data: { userId: g.userId, action: 'SPONSORED_SEAT_UNDONE', entityType: 'Prospect', entityId: g.prospectId, details: JSON.stringify({ programId: result.programId, reason: 'partner code failed' }) },
        }).catch(() => {})
        refresh(result.programId)
        return { ok: false, error: c.error }
      }
      codeNote = c.emailed
        ? ` Founding-rate code ${c.code} emailed to ${result.first}.`
        : ` Code ${c.code} was created, but the email didn't send. Use "Email the code again" or read it to ${result.first}.`
    }
    refresh(result.programId)
    await tellOwner(result.programId, result.first)
    return { ok: true, message: `Sponsorship offered to ${result.first}. ${result.left} left this month.${codeNote}` }
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
    // Cancel the partner code first: never free the seat while a code still works, and never once it's used.
    const latest = await prisma.partnerCode.findFirst({ where: { prospectId: p.id }, orderBy: { createdAt: 'desc' }, select: { id: true, code: true, status: true } })
    if (latest?.status === 'USED') return { ok: false, error: "The founding-rate code has already been used, so this offer can't be undone." }
    const live = latest && ['REQUESTED', 'SENT', 'HELD'].includes(latest.status) ? latest : null
    if (live?.code) {
      const r = await revokeCode(live.code, 'Offer undone on the NowTRANSFORMED call record')
      if (!r.ok && r.status === 409) return { ok: false, error: "The founding-rate code has already been used, so this offer can't be undone." }
      if (!r.ok && r.status !== 404) return { ok: false, error: "ExploreNation didn't answer, so the code still works and the offer stays. Please try again in a minute." }
    }
    if (live) await prisma.partnerCode.update({ where: { id: live.id }, data: { status: 'REVOKED', statusAt: new Date() } })
    const done = await prisma.prospect.updateMany({
      where: { id: p.id, sponsoredSeatOfferedAt: p.sponsoredSeatOfferedAt },
      data: { sponsoredSeatOfferedAt: null, sponsoredSeatOfferedById: null, sponsoredSeatFullPrice: null, sponsoredSeatPrice: null },
    })
    if (done.count !== 1) return { ok: false, error: 'This offer just changed. Reload the page.' }
    await prisma.auditLog.create({
      data: { userId: g.userId, action: 'SPONSORED_SEAT_UNDONE', entityType: 'Prospect', entityId: p.id, details: JSON.stringify({ programId: p.programId, offeredAt: p.sponsoredSeatOfferedAt.toISOString() }) },
    }).catch(() => {})
    refresh(p.programId)
    return { ok: true, message: live ? 'Offer undone and the founding-rate code cancelled. The sponsorship is free again.' : 'Offer undone. The sponsorship is free again.' }
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
      title: 'Sponsorship offered',
      body: `${firstName} was offered a sponsorship for ${prog.name}.`,
      url: `${base}/programs/${prog.id}`,
      tag: `seat-${programId}`,
    })
  } catch (e) {
    console.error('[SEAT] owner notification failed', e)
  }
}


type CodeSend = { ok: true; code: string; emailed: boolean } | { ok: false; error: string }

/**
 * Asks ExploreNation for this person's founding-rate code, stores it and emails it. The requestId is fixed
 * per offer (prospect + offer time), so a retry returns the same code instead of making a second one.
 */
async function sendExploreNationCode(prospectId: string, programId: string, userId: string, offeredAt: Date): Promise<CodeSend> {
  const p = await prisma.prospect.findUnique({ where: { id: prospectId }, select: { firstName: true, lastName: true, email: true, companyName: true } })
  const host = await userDisplayName(userId)
  if (!p || !host) return { ok: false, error: 'Person not found.' }
  const contactName = `${p.firstName} ${p.lastName}`.trim()
  // EN_REQUEST_ID_PREFIX=test- on test runs against ExploreNation staging, so they can clear test codes.
  const requestId = `${(process.env.EN_REQUEST_ID_PREFIX ?? '').trim().slice(0, 10)}nt_${prospectId}_${offeredAt.getTime()}`
  const row = await prisma.partnerCode.upsert({
    where: { requestId },
    create: { partner: 'explorenation', requestId, prospectId, programId, createdById: userId },
    update: {},
    select: { id: true },
  })
  const r = await createCode({
    requestId,
    business: { name: (p.companyName ?? '').trim() || contactName, contactName, email: p.email },
    requestedBy: { name: host.full, email: host.email },
  })
  if (!r.ok) {
    await prisma.partnerCode.delete({ where: { id: row.id } }).catch(() => {})
    console.error('[EN] code request failed', r.status, r.error)
    const why = r.status === 429
      ? 'ExploreNation is limiting code requests right now, so nothing was offered. Please try again in a few minutes.'
      : r.status === 0
        ? "ExploreNation didn't answer, so nothing was offered and no sponsorship was used. Please try again in a minute."
        : "ExploreNation couldn't create a code, so nothing was offered. Please try again, or tell an admin if it keeps happening."
    return { ok: false, error: why }
  }
  await prisma.partnerCode.update({
    where: { id: row.id },
    data: { code: r.data.code, status: r.data.status === 'REQUESTED' ? 'SENT' : r.data.status, expiresAt: r.data.expiresAt, statusAt: new Date() },
  })
  const mail = codeEmail({ firstName: p.firstName, code: r.data.code, expiresAt: r.data.expiresAt, hostName: host.full, siteUrl: enPublicUrl() })
  const sent = await sendEmail({ to: p.email, subject: mail.subject, html: mail.html, fromName: `${host.full} via NowTRANSFORMED`, replyTo: host.email })
  if (sent.sent) await prisma.partnerCode.update({ where: { id: row.id }, data: { emailedAt: new Date() } })
  await prisma.auditLog.create({
    data: { userId, action: 'PARTNER_CODE_SENT', entityType: 'Prospect', entityId: prospectId, details: JSON.stringify({ partner: 'explorenation', partnerCodeId: row.id, programId, emailed: sent.sent }) },
  }).catch(() => {})
  return { ok: true, code: r.data.code, emailed: sent.sent }
}

/** "Email the code again" on the call record. Same people as offering. */
export async function resendPartnerCode(prospectId: unknown): Promise<SeatResult> {
  const g = await guard(prospectId)
  if (!g.ok) return g
  try {
    const row = await prisma.partnerCode.findFirst({
      where: { prospectId: g.prospectId, status: { in: ['SENT', 'HELD'] }, code: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, code: true, expiresAt: true, emailedAt: true },
    })
    if (!row?.code) return { ok: false, error: 'There is no active code to send.' }
    if (row.emailedAt && Date.now() - row.emailedAt.getTime() < 2 * 60_000) return { ok: false, error: 'The code was just emailed. Please wait a couple of minutes.' }
    const p = await prisma.prospect.findUnique({ where: { id: g.prospectId }, select: { firstName: true, email: true } })
    const host = await userDisplayName(g.userId)
    if (!p || !host) return { ok: false, error: 'Person not found.' }
    const mail = codeEmail({ firstName: p.firstName, code: row.code, expiresAt: row.expiresAt, hostName: host.full, siteUrl: enPublicUrl() })
    const sent = await sendEmail({ to: p.email, subject: mail.subject, html: mail.html, fromName: `${host.full} via NowTRANSFORMED`, replyTo: host.email })
    if (!sent.sent) return { ok: false, error: "The email didn't send. Please try again." }
    await prisma.partnerCode.update({ where: { id: row.id }, data: { emailedAt: new Date() } })
    await prisma.auditLog.create({
      data: { userId: g.userId, action: 'PARTNER_CODE_RESENT', entityType: 'Prospect', entityId: g.prospectId, details: JSON.stringify({ partnerCodeId: row.id }) },
    }).catch(() => {})
    revalidatePath('/admin/discovery-calls/[id]', 'page')
    revalidatePath('/coach/discovery-calls/[id]', 'page')
    return { ok: true, message: `Code emailed to ${p.firstName} again.` }
  } catch (e) {
    console.error('resendPartnerCode failed', e)
    return { ok: false, error: 'Could not send the code. Please try again.' }
  }
}
