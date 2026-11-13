/**
 * Outreach round 1: shared, server-only reads used by the sign-up page, the emails and the settings pages.
 * - Sponsored-seat offer per program (admin-set on CoachProgram).
 * - Invite profile per inviter (photo, "why I do this", which program the main link shares).
 * - Site-wide outreach settings (mailing address, reply promise) stored in FeatureConfig 'GET_INVOLVED'.
 */
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { BUSINESS_TZ } from './core'

// ---------- sponsored-seat offer ----------

export interface SignupOffer {
  programId: string
  fullPrice: string | null
  sponsoredPrice: string | null
  reason: string | null
  seatsPerMonth: number
  seatsLeft: number
}

/** Milliseconds the zone is ahead of UTC at instant t (negative for the Americas). */
function zoneOffsetMs(t: number, tz: string): number {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(t)).map((p) => [p.type, p.value]))
  return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second) - Math.floor(t / 1000) * 1000
}

/** Midnight on the 1st of (year, month0) in the zone, as a UTC instant (handles DST). */
function zoneMonthStart(year: number, month0: number, tz: string): Date {
  const guess = Date.UTC(year, month0, 1)
  let t = guess - zoneOffsetMs(guess, tz)
  t = guess - zoneOffsetMs(t, tz)
  return new Date(t)
}

function zoneYearMonth(now: Date, tz: string): [number, number] {
  const [y, m] = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit' }).format(now).split('-').map(Number)
  return [y, m - 1]
}

/** First instant of the current calendar month in US Central time. Seat counts reset on the 1st. */
export function monthStart(now = new Date(), tz = BUSINESS_TZ): Date {
  const [y, m] = zoneYearMonth(now, tz)
  return zoneMonthStart(y, m, tz)
}

/** First instant of next month in US Central time: when the seats reopen. */
export function nextMonthStart(now = new Date(), tz = BUSINESS_TZ): Date {
  const [y, m] = zoneYearMonth(now, tz)
  return zoneMonthStart(m === 11 ? y + 1 : y, (m + 1) % 12, tz)
}

/**
 * A sponsored seat is "used" when the admin team OFFERS it on the free call (Prospect.sponsoredSeatOfferedAt
 * in this calendar month, for a prospect who came through this program). Booking a call uses nothing;
 * "Undo offer" gives the seat back. One definition, kept here so it is easy to change.
 */
export function seatsUsedWhere(now = new Date()) {
  return { sponsoredSeatOfferedAt: { gte: monthStart(now), lt: nextMonthStart(now) } }
}

export async function seatsUsedThisMonth(programId: string, now = new Date()): Promise<number> {
  return prisma.prospect.count({ where: { programId, ...seatsUsedWhere(now) } })
}

/** Seats left this month (never below 0). Pure. */
export function seatsLeftOf(seatsPerMonth: number | null | undefined, used: number): number {
  return Math.max(0, (seatsPerMonth ?? 0) - used)
}

/** Advisory-lock key for offering seats in one program in one month (two admins can't overbook). Pure. */
export function seatLockKey(programId: string, now = new Date()): string {
  const m = monthStart(now)
  return `sponsored-seat:${programId}:${m.getUTCFullYear()}-${String(m.getUTCMonth() + 1).padStart(2, '0')}`
}

/** An offer can be undone only in the month it was made (seat counts reset on the 1st). Pure. */
export function canUndoSeatOffer(offeredAt: Date | null | undefined, now = new Date()): boolean {
  return !!offeredAt && offeredAt >= monthStart(now) && offeredAt < nextMonthStart(now)
}

/** Each program's regular price as its owner set it (programs with no price are left out). */
export async function getRegularPrices(programIds: string[]): Promise<Map<string, string>> {
  if (!programIds.length) return new Map()
  const rows = await prisma.coachProgram.findMany({ where: { id: { in: programIds } }, select: { id: true, offerFullPrice: true } })
  return new Map(rows.filter((r) => r.offerFullPrice?.trim()).map((r) => [r.id, r.offerFullPrice!.trim()]))
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
    seatsLeft: seatsLeftOf(p.sponsoredSeatsPerMonth, used),
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
  /** Who last changed the prices and when (null before anyone has). */
  pricesUpdatedAt: string | null
  pricesUpdatedBy: { name: string; isOwner: boolean } | null
}

export type OfferFilter = 'all' | 'offer' | 'none'

/** Seats offered this month for many programs in one query. */
export async function seatsUsedByProgram(programIds: string[], now = new Date()): Promise<Map<string, number>> {
  if (programIds.length === 0) return new Map()
  const rows = await prisma.prospect.groupBy({
    by: ['programId'],
    where: { programId: { in: programIds }, ...seatsUsedWhere(now) },
    _count: { _all: true },
  })
  return new Map(rows.filter((r) => r.programId).map((r) => [r.programId as string, r._count._all]))
}

/** One page of live programs (published, with a snapshot) with their offer settings and this month's seat use. */
export async function listOfferPrograms(opts: { q?: string; filter?: OfferFilter; page?: number; pageSize?: number } = {}, now = new Date()) {
  const { q = '', filter = 'all', page = 1, pageSize = 25 } = opts
  const live: Prisma.CoachProgramWhereInput = { status: 'PUBLISHED', NOT: { publishedSnapshot: { equals: Prisma.DbNull } } }
  const search: Prisma.CoachProgramWhereInput[] = q.split(/\s+/).filter(Boolean).slice(0, 4).map((w) => ({ OR: [
    { name: { contains: w, mode: 'insensitive' } },
    { organization: { contains: w, mode: 'insensitive' } },
    { coach: { OR: [{ firstName: { contains: w, mode: 'insensitive' } }, { lastName: { contains: w, mode: 'insensitive' } }] } },
    { ambassador: { OR: [{ firstName: { contains: w, mode: 'insensitive' } }, { lastName: { contains: w, mode: 'insensitive' } }] } },
  ] }))
  const hasOffer: Prisma.CoachProgramWhereInput = { sponsoredSeatsPerMonth: { gt: 0 } }
  const noOffer: Prisma.CoachProgramWhereInput = { OR: [{ sponsoredSeatsPerMonth: null }, { sponsoredSeatsPerMonth: { lte: 0 } }] }
  const where = (f: OfferFilter): Prisma.CoachProgramWhereInput => ({ AND: [live, ...search, ...(f === 'offer' ? [hasOffer] : f === 'none' ? [noOffer] : [])] })

  const [rows, total, all, offer, none] = await Promise.all([
    prisma.coachProgram.findMany({
      where: where(filter),
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, name: true, slug: true, organization: true, coachId: true, ambassadorId: true,
        offerFullPrice: true, offerSponsoredPrice: true, offerReason: true, sponsoredSeatsPerMonth: true,
        offerPricesUpdatedAt: true, offerPricesUpdatedById: true,
        coach: { select: { firstName: true, lastName: true, userId: true, user: { select: { inviteSlug: true } } } },
        ambassador: { select: { firstName: true, lastName: true, userId: true, user: { select: { inviteSlug: true } } } },
      },
    }),
    prisma.coachProgram.count({ where: where(filter) }),
    prisma.coachProgram.count({ where: where('all') }),
    prisma.coachProgram.count({ where: where('offer') }),
    prisma.coachProgram.count({ where: where('none') }),
  ])
  const editorIds = Array.from(new Set(rows.map((r) => r.offerPricesUpdatedById).filter((x): x is string => !!x)))
  const [used, editors] = await Promise.all([
    seatsUsedByProgram(rows.map((r) => r.id), now),
    editorIds.length ? prisma.user.findMany({ where: { id: { in: editorIds } }, select: { id: true, email: true, coachProfile: { select: { firstName: true, lastName: true } }, ambassadorProfile: { select: { firstName: true, lastName: true } } } }) : Promise.resolve([]),
  ])
  const editorName = new Map(editors.map((u) => {
    const n = u.coachProfile ?? u.ambassadorProfile
    return [u.id, n ? `${n.firstName} ${n.lastName}`.trim() : u.email.split('@')[0]]
  }))
  const programs: OfferProgramRow[] = rows.map((p) => {
    const owner = p.coach ?? p.ambassador
    const by = p.offerPricesUpdatedById
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
      usedThisMonth: used.get(p.id) ?? 0,
      pricesUpdatedAt: p.offerPricesUpdatedAt?.toISOString() ?? null,
      pricesUpdatedBy: by ? { name: editorName.get(by) ?? 'Someone', isOwner: by === owner?.userId } : null,
    }
  })
  return { programs, total, counts: { all, offer, none } as Record<OfferFilter, number> }
}
