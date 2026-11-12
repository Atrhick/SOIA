'use server'

/**
 * Outreach settings (/admin/outreach-settings): the sponsored-seat offer per live program and the
 * site-wide mailing address / reply promise. ADMIN only (not SUB_ADMIN), blocked while impersonating.
 * Program owners can also set their own program's two prices (saveMyProgramPrices).
 */
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { saveOutreachSettings, seatsUsedThisMonth } from '@/lib/get-involved/offer'

function revalidateOwnerProgramPages(programId: string) {
  for (const base of ['/coach/programs', '/ambassador/programs']) revalidatePath(`${base}/${programId}`)
}

async function requireAdmin(): Promise<string | null> {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') return 'Unauthorized'
  if (session.user.isImpersonating) return 'Switch back to your admin account first.'
  return null
}

const text = (max: number, label: string) =>
  z.string().max(max * 4).transform((s) => s.replace(/\s+/g, ' ').trim()).refine((s) => s.length <= max, `${label}: at most ${max} characters`)

const offerSchema = z.object({
  programId: z.string().min(1).max(100),
  fullPrice: text(40, 'Full price'),
  sponsoredPrice: text(40, 'Sponsored price'),
  reason: text(300, 'Reason'),
  seats: z.union([z.literal(''), z.coerce.number()])
    .transform((v) => (v === '' ? null : v))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 0 && v <= 1000), 'Seats per month: a whole number from 0 to 1000'),
})

export type SaveOfferResult =
  | { ok: true; usedThisMonth: number; seatsPerMonth: number | null }
  | { ok: false; error: string }

export async function saveProgramOffer(input: unknown): Promise<SaveOfferResult> {
  const denied = await requireAdmin()
  if (denied) return { ok: false, error: denied }
  const parsed = offerSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the form' }
  const { programId, fullPrice, sponsoredPrice, reason, seats } = parsed.data
  if (seats && seats > 0 && !sponsoredPrice) return { ok: false, error: 'Enter the sponsored price, or set seats to 0 to show no offer.' }

  try {
    const exists = await prisma.coachProgram.findUnique({ where: { id: programId }, select: { id: true, offerFullPrice: true, offerSponsoredPrice: true } })
    if (!exists) return { ok: false, error: 'Program not found' }
    const session = await auth()
    const pricesChanged = (exists.offerFullPrice ?? '') !== fullPrice || (exists.offerSponsoredPrice ?? '') !== sponsoredPrice
    await prisma.coachProgram.update({
      where: { id: programId },
      data: {
        offerFullPrice: fullPrice || null,
        offerSponsoredPrice: sponsoredPrice || null,
        offerReason: reason || null,
        sponsoredSeatsPerMonth: seats,
        ...(pricesChanged ? { offerPricesUpdatedAt: new Date(), offerPricesUpdatedById: session?.user.id ?? null } : {}),
      },
    })
    revalidatePath('/admin/outreach-settings')
    revalidateOwnerProgramPages(programId)
    return { ok: true, usedThisMonth: await seatsUsedThisMonth(programId), seatsPerMonth: seats }
  } catch (e) {
    console.error('saveProgramOffer failed', e)
    return { ok: false, error: 'Could not save the offer. Please try again.' }
  }
}

const siteSchema = z.object({
  mailingAddress: text(300, 'Mailing address'),
  replyWithin: text(60, 'Reply promise'),
})

export async function saveSiteOutreach(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const denied = await requireAdmin()
  if (denied) return { ok: false, error: denied }
  const parsed = siteSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the form' }
  try {
    await saveOutreachSettings(parsed.data)
    revalidatePath('/admin/outreach-settings')
    return { ok: true }
  } catch (e) {
    console.error('saveSiteOutreach failed', e)
    return { ok: false, error: 'Could not save. Please try again.' }
  }
}

// ---------- program owner: prices ----------

const priceSchema = z.object({
  programId: z.string().min(1).max(100),
  fullPrice: text(40, 'Full price'),
  sponsoredPrice: text(40, 'Sponsored price'),
})

/** What the owner sees: their prices (editable) and the admin-set seats (read-only). */
export type MyProgramOffer = {
  fullPrice: string
  sponsoredPrice: string
  reason: string
  seatsPerMonth: number | null
  usedThisMonth: number
  canEdit: boolean
}

async function ownedProgram(programId: string) {
  const session = await auth()
  if (!session || (session.user.role !== 'COACH' && session.user.role !== 'AMBASSADOR')) return null
  const p = await prisma.coachProgram.findUnique({
    where: { id: programId },
    select: {
      id: true, offerFullPrice: true, offerSponsoredPrice: true, offerReason: true, sponsoredSeatsPerMonth: true,
      coach: { select: { userId: true } }, ambassador: { select: { userId: true } },
    },
  })
  const ownerUserId = p?.coach?.userId ?? p?.ambassador?.userId
  if (!p || !ownerUserId || ownerUserId !== session.user.id) return null
  return { session, program: p }
}

export async function getMyProgramOffer(programId: string): Promise<MyProgramOffer | null> {
  const ctx = await ownedProgram(programId)
  if (!ctx) return null
  const p = ctx.program
  return {
    fullPrice: p.offerFullPrice ?? '',
    sponsoredPrice: p.offerSponsoredPrice ?? '',
    reason: p.offerReason ?? '',
    seatsPerMonth: p.sponsoredSeatsPerMonth,
    usedThisMonth: await seatsUsedThisMonth(p.id),
    canEdit: !ctx.session.user.isImpersonating,
  }
}

/** The program owner sets the full and sponsored price. Seats and the "why sponsored" line stay with admins. */
export async function saveMyProgramPrices(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = priceSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the form' }
  const ctx = await ownedProgram(parsed.data.programId)
  if (!ctx) return { ok: false, error: 'Program not found' }
  if (ctx.session.user.isImpersonating) return { ok: false, error: 'Not available while viewing as someone else.' }
  const { fullPrice, sponsoredPrice } = parsed.data
  const p = ctx.program
  if ((p.sponsoredSeatsPerMonth ?? 0) > 0 && !sponsoredPrice) {
    return { ok: false, error: 'Sponsored seats are on for this program, so it needs a sponsored price.' }
  }
  if ((p.offerFullPrice ?? '') === fullPrice && (p.offerSponsoredPrice ?? '') === sponsoredPrice) return { ok: true }
  try {
    await prisma.coachProgram.update({
      where: { id: p.id },
      data: { offerFullPrice: fullPrice || null, offerSponsoredPrice: sponsoredPrice || null, offerPricesUpdatedAt: new Date(), offerPricesUpdatedById: ctx.session.user.id },
    })
    await prisma.auditLog.create({
      data: { userId: ctx.session.user.id, action: 'PROGRAM_PRICES_UPDATED', entityType: 'CoachProgram', entityId: p.id, details: JSON.stringify({ fullPrice, sponsoredPrice }) },
    }).catch(() => {})
    revalidatePath('/admin/outreach-settings')
    revalidateOwnerProgramPages(p.id)
    return { ok: true }
  } catch (e) {
    console.error('saveMyProgramPrices failed', e)
    return { ok: false, error: 'Could not save the prices. Please try again.' }
  }
}
