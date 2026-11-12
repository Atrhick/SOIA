'use server'

/**
 * Outreach settings (/admin/outreach-settings): the sponsored-seat offer per live program and the
 * site-wide mailing address / reply promise. ADMIN only (not SUB_ADMIN), blocked while impersonating.
 */
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { saveOutreachSettings, seatsUsedThisMonth } from '@/lib/get-involved/offer'

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
    const exists = await prisma.coachProgram.findUnique({ where: { id: programId }, select: { id: true } })
    if (!exists) return { ok: false, error: 'Program not found' }
    await prisma.coachProgram.update({
      where: { id: programId },
      data: {
        offerFullPrice: fullPrice || null,
        offerSponsoredPrice: sponsoredPrice || null,
        offerReason: reason || null,
        sponsoredSeatsPerMonth: seats,
      },
    })
    revalidatePath('/admin/outreach-settings')
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
