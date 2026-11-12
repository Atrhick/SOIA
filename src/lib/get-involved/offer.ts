/**
 * Outreach round 1: shared, server-only reads used by the sign-up page, the emails and the settings pages.
 * - Sponsored-seat offer per program (admin-set on CoachProgram).
 * - Invite profile per inviter (photo, "why I do this", which program the main link shares).
 * - Site-wide outreach settings (mailing address, reply promise) stored in FeatureConfig 'GET_INVOLVED'.
 */
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'

// ---------- sponsored-seat offer ----------

export interface SignupOffer {
  programId: string
  fullPrice: string | null
  sponsoredPrice: string | null
  reason: string | null
  seatsPerMonth: number
  seatsLeft: number
}

/** First instant of the current calendar month (UTC). Seat counts reset on the 1st. */
export function monthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

/** First instant of next month (UTC): when the seats reopen. */
export function nextMonthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
}

/**
 * A sponsored seat is "used" when someone who came through this program books a discovery call this
 * month (cancelled calls give the seat back). One definition, kept here so it is easy to change.
 */
export async function seatsUsedThisMonth(programId: string, now = new Date()): Promise<number> {
  return prisma.prospect.count({
    where: {
      programId,
      discoveryCalls: { some: { createdAt: { gte: monthStart(now) }, status: { not: 'CANCELLED' } } },
    },
  })
}

/** The offer for a program, or null when the admin hasn't set one (seats 0 / unset): then no offer is shown anywhere. */
export async function getSignupOffer(programId: string | null | undefined, now = new Date()): Promise<SignupOffer | null> {
  if (!programId) return null
  const p = await prisma.coachProgram.findUnique({
    where: { id: programId },
    select: { id: true, offerFullPrice: true, offerSponsoredPrice: true, offerReason: true, sponsoredSeatsPerMonth: true },
  })
  if (!p || !p.sponsoredSeatsPerMonth || p.sponsoredSeatsPerMonth <= 0) return null
  const used = await seatsUsedThisMonth(p.id, now)
  return {
    programId: p.id,
    fullPrice: p.offerFullPrice,
    sponsoredPrice: p.offerSponsoredPrice,
    reason: p.offerReason,
    seatsPerMonth: p.sponsoredSeatsPerMonth,
    seatsLeft: Math.max(0, p.sponsoredSeatsPerMonth - used),
  }
}

// ---------- invite profile ----------

export interface InviteProfile {
  userId: string
  hasPhoto: boolean
  /** Public URL of the photo (served by /api/invite-photo/[slug]) or null. */
  photoUrl: string | null
  why: string | null
  programId: string | null
}

export const invitePhotoPath = (slug: string) => `/api/invite-photo/${encodeURIComponent(slug)}`

export async function getInviteProfile(userId: string): Promise<InviteProfile | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, inviteSlug: true, inviteWhy: true, inviteProgramId: true, invitePhoto: true },
  })
  if (!u) return null
  const hasPhoto = !!u.invitePhoto
  return {
    userId: u.id,
    hasPhoto,
    photoUrl: hasPhoto && u.inviteSlug ? invitePhotoPath(u.inviteSlug) : null,
    why: u.inviteWhy,
    programId: u.inviteProgramId,
  }
}

// ---------- site-wide outreach settings ----------

export interface OutreachSettings {
  /** Postal address shown in every email footer and on the sign-up page. Empty = line hidden. */
  mailingAddress: string
  /** Reply promise, e.g. "1 business day". Empty = no time is promised. */
  replyWithin: string
}

const FEATURE = 'GET_INVOLVED'
const DEFAULTS: OutreachSettings = { mailingAddress: '', replyWithin: '' }

export async function getOutreachSettings(): Promise<OutreachSettings> {
  const row = await prisma.featureConfig.findUnique({ where: { feature: FEATURE }, select: { settings: true } }).catch(() => null)
  const s = (row?.settings ?? {}) as Partial<Record<keyof OutreachSettings, unknown>>
  return {
    mailingAddress: typeof s.mailingAddress === 'string' ? s.mailingAddress : DEFAULTS.mailingAddress,
    replyWithin: typeof s.replyWithin === 'string' ? s.replyWithin : DEFAULTS.replyWithin,
  }
}

export async function saveOutreachSettings(next: OutreachSettings): Promise<void> {
  const row = await prisma.featureConfig.findUnique({ where: { feature: FEATURE }, select: { settings: true } })
  const merged = { ...((row?.settings ?? {}) as object), ...next }
  await prisma.featureConfig.upsert({
    where: { feature: FEATURE },
    create: { feature: FEATURE, isEnabled: true, settings: merged, enabledForCoaches: true, enabledForAmbassadors: true },
    update: { settings: merged },
  })
}

/** Text reminders are designed but off until an SMS provider is connected. */
export const smsEnabled = () => process.env.SMS_ENABLED === 'true'

// ---------- admin: offer settings list ----------

export interface OfferProgramRow {
  id: string
  name: string
  slug: string
  organization: string
  ownerName: string | null
  ownerRole: 'COACH' | 'AMBASSADOR' | null
  /** The owner's main invite slug, for a "Preview sign-up page" link (/join/[ownerSlug]/[programSlug]). */
  ownerInviteSlug: string | null
  fullPrice: string
  sponsoredPrice: string
  reason: string
  seatsPerMonth: number | null
  usedThisMonth: number
}

/** Live programs (published, with a snapshot) with their offer settings and this month's seat use. */
export async function listOfferPrograms(now = new Date()): Promise<OfferProgramRow[]> {
  const rows = await prisma.coachProgram.findMany({
    where: { status: 'PUBLISHED', NOT: { publishedSnapshot: { equals: Prisma.DbNull } } },
    orderBy: { name: 'asc' },
    select: {
      id: true, name: true, slug: true, organization: true,
      offerFullPrice: true, offerSponsoredPrice: true, offerReason: true, sponsoredSeatsPerMonth: true,
      coach: { select: { firstName: true, lastName: true, user: { select: { inviteSlug: true } } } },
      ambassador: { select: { firstName: true, lastName: true, user: { select: { inviteSlug: true } } } },
    },
  })
  return Promise.all(rows.map(async (p) => {
    const owner = p.coach ?? p.ambassador
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      organization: p.organization,
      ownerName: owner ? `${owner.firstName} ${owner.lastName}`.trim() : null,
      ownerRole: p.coach ? 'COACH' as const : p.ambassador ? 'AMBASSADOR' as const : null,
      ownerInviteSlug: owner?.user?.inviteSlug ?? null,
      fullPrice: p.offerFullPrice ?? '',
      sponsoredPrice: p.offerSponsoredPrice ?? '',
      reason: p.offerReason ?? '',
      seatsPerMonth: p.sponsoredSeatsPerMonth,
      usedThisMonth: await seatsUsedThisMonth(p.id, now),
    }
  }))
}
