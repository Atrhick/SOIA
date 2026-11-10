/**
 * Server-only helpers for the Get Involved journey (database + email).
 * Not a 'use server' module: nothing here is callable from the browser.
 * Public entry points live in src/lib/actions/get-involved.ts.
 */
import crypto from 'crypto'
import { headers } from 'next/headers'
import { Prisma, ProspectStatus } from '@prisma/client'
import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import {
  AgeRangeValue, BusyBlock, HostForSlots, Slot, ageRangeLabel, canInvite, canMoveStatus, computeStreak, generateSlots,
  linkStillValid, slugifyName,
} from './core'
import * as mail from './emails'

export const newToken = () => crypto.randomBytes(24).toString('base64url')

// ---------- people ----------

/** Display name for any user: coach, ambassador or associate profile, else the email's local part. */
/** Where a host manages their calls: coaches have their own page, admins use the admin one. */
export const callsPathFor = (role?: string | null) => (role === 'COACH' ? '/coach/discovery-calls' : '/admin/discovery-calls')

export async function userDisplayName(userId: string): Promise<{ first: string; full: string; email: string; role: string; tz: string | null } | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      role: true,
      coachProfile: { select: { firstName: true, lastName: true } },
      ambassadorProfile: { select: { firstName: true, lastName: true } },
      associateProfile: { select: { firstName: true, lastName: true } },
      discoveryHost: { select: { displayName: true, timezone: true } },
    },
  })
  if (!u) return null
  const tz = u.discoveryHost?.timezone ?? null
  const p = u.coachProfile ?? u.ambassadorProfile ?? u.associateProfile
  if (p) return { first: p.firstName, full: `${p.firstName} ${p.lastName}`.trim(), email: u.email, role: u.role, tz }
  if (u.discoveryHost) return { first: u.discoveryHost.displayName.split(' ')[0], full: u.discoveryHost.displayName, email: u.email, role: u.role, tz }
  const local = u.email.split('@')[0]
  return { first: local, full: local, email: u.email, role: u.role, tz }
}

/** The user's invite slug, created on first use. */
export async function ensureInviteSlug(userId: string): Promise<string> {
  const existing = await prisma.user.findUnique({ where: { id: userId }, select: { inviteSlug: true } })
  if (existing?.inviteSlug) return existing.inviteSlug
  const name = await userDisplayName(userId)
  const base = slugifyName(name?.full ?? 'member')
  for (let i = 0; i < 20; i++) {
    const slug = i === 0 ? base : `${base}-${crypto.randomInt(10, 99)}${i}`
    try {
      await prisma.user.update({ where: { id: userId }, data: { inviteSlug: slug } })
      return slug
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue
      throw e
    }
  }
  throw new Error('Could not create an invite link')
}

export async function inviterBySlug(slug: string) {
  if (!slug) return null
  const u = await prisma.user.findUnique({ where: { inviteSlug: slug }, select: { id: true, status: true, role: true } })
  // Only coaches and ambassadors have a One-A-Day page, leaderboard place and My Team to receive invites.
  if (!u || u.status !== 'ACTIVE' || !canInvite(u.role)) return null
  return u
}

// ---------- rate limiting (in-memory, per instance, same approach as login) ----------

const hits = new Map<string, number[]>()
export function rateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  list.push(now)
  hits.set(key, list)
  if (hits.size > 5000) hits.clear()
  return list.length > max
}

export async function clientIp(): Promise<string> {
  const h = await headers()
  // The left entries of X-Forwarded-For come from the client and can be faked.
  // The right-most one is added by Google's front end in production.
  const parts = (h.get('x-forwarded-for') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  return parts[parts.length - 1] || h.get('x-real-ip') || 'unknown'
}

// ---------- status ----------

/**
 * Unconditional status write + history. Kept for older callers; Get Involved journey moves use
 * transitionStatus() so two actions at once can't overwrite each other.
 */
export async function setStatus(tx: Prisma.TransactionClient, prospectId: string, from: ProspectStatus | null, to: ProspectStatus, changedBy: string | null, notes?: string) {
  await tx.prospect.update({ where: { id: prospectId }, data: { status: to } })
  if (from !== to) await tx.prospectStatusHistory.create({ data: { prospectId, fromStatus: from, toStatus: to, changedBy, notes } })
}

/** Thrown (to roll the transaction back) when a guarded status move finds the status already changed. */
export class StatusConflictError extends Error {
  constructor(public from: string, public to: string) {
    super('STATUS_CONFLICT')
    this.name = 'StatusConflictError'
  }
}
export const isStatusConflict = (e: unknown): e is StatusConflictError => e instanceof StatusConflictError

/**
 * Guarded status move: one conditional UPDATE ... WHERE id AND status = from (plus `where`), with
 * `data` written in the same statement. Postgres locks the row and re-checks the WHERE, so of two
 * concurrent moves from the same status only one succeeds. Returns false (nothing written) when the
 * status (or `where`) no longer matches or canMoveStatus() refuses the move; writes history otherwise.
 * Callers that already wrote something in the transaction should throw StatusConflictError on false.
 */
export async function transitionStatus(
  tx: Prisma.TransactionClient,
  prospectId: string,
  from: ProspectStatus,
  to: ProspectStatus,
  changedBy: string | null,
  notes?: string,
  opts: { data?: Prisma.ProspectUpdateManyMutationInput; where?: Prisma.ProspectWhereInput } = {},
): Promise<boolean> {
  if (!canMoveStatus(from, to)) return false
  const r = await tx.prospect.updateMany({ where: { ...opts.where, id: prospectId, status: from }, data: { ...opts.data, status: to } })
  if (r.count === 0) return false
  if (from !== to) await tx.prospectStatusHistory.create({ data: { prospectId, fromStatus: from, toStatus: to, changedBy, notes } })
  return true
}

/** transitionStatus that throws StatusConflictError instead of returning false. */
export async function mustTransition(...args: Parameters<typeof transitionStatus>): Promise<void> {
  if (!(await transitionStatus(...args))) throw new StatusConflictError(args[2], args[3])
}

/** Case-insensitive email match (older paths stored emails as typed). */
export const emailEquals = (email: string) => ({ equals: email.trim(), mode: 'insensitive' as const })

// ---------- slots ----------

const DEFAULT_RANGE: AgeRangeValue = 'AGE_25_55'

export async function eligibleHosts(ageRange: AgeRangeValue | null) {
  const range = ageRange ?? DEFAULT_RANGE
  return prisma.discoveryHost.findMany({
    where: { active: true, ageRanges: { has: range }, user: { status: 'ACTIVE' } },
    include: { availability: true },
  })
}

export async function openSlotsFor(ageRange: AgeRangeValue | null, now = new Date(), excludeCallId?: string): Promise<{ slots: Slot[]; hosts: Awaited<ReturnType<typeof eligibleHosts>> }> {
  const hosts = await eligibleHosts(ageRange)
  if (hosts.length === 0) return { slots: [], hosts }
  const busy = await busyBlocks(hosts.map((h) => h.userId), now, excludeCallId)
  const forSlots: HostForSlots[] = hosts.map((h) => ({ id: h.userId, timezone: h.timezone, availability: h.availability }))
  return { slots: generateSlots(forSlots, busy, now), hosts }
}

export async function busyBlocks(hostUserIds: string[], now: Date, excludeCallId?: string, db: Prisma.TransactionClient | typeof prisma = prisma): Promise<BusyBlock[]> {
  const calls = await db.discoveryCall.findMany({
    where: { hostId: { in: hostUserIds }, status: 'BOOKED', endsAt: { gt: now }, ...(excludeCallId ? { id: { not: excludeCallId } } : {}) },
    select: { hostId: true, startsAt: true, endsAt: true },
  })
  return calls.map((c) => ({ hostId: c.hostId!, startsAt: c.startsAt, endsAt: c.endsAt }))
}

export async function upcomingCounts(hostUserIds: string[], now = new Date()): Promise<Record<string, number>> {
  const rows = await prisma.discoveryCall.groupBy({ by: ['hostId'], where: { hostId: { in: hostUserIds }, status: 'BOOKED', startsAt: { gt: now } }, _count: true })
  return Object.fromEntries(rows.map((r) => [r.hostId!, r._count]))
}

// ---------- journey lookups ----------

export async function prospectByJourneyToken(token: string) {
  if (!token || token.length < 16) return null
  return prisma.prospect.findUnique({
    where: { journeyToken: token },
    include: {
      discoveryCalls: { where: { status: 'BOOKED' }, orderBy: { startsAt: 'asc' }, take: 1, include: { host: { select: { id: true, discoveryHost: { select: { displayName: true, meetingUrl: true } } } } } },
    },
  })
}

export function journeyUsable(p: { journeyTokenIssuedAt: Date | null; discoveryCalls: { startsAt: Date }[] }, now = new Date()): boolean {
  // A booked upcoming call keeps its manage link working until the call.
  if (p.discoveryCalls.some((c) => c.startsAt > now)) return true
  return linkStillValid(p.journeyTokenIssuedAt, now)
}

// ---------- notifications ----------

export async function notifyAdmins(title: string, message: string, prospectId: string) {
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true } })
  if (admins.length === 0) return
  await prisma.adminNotification.createMany({
    data: admins.map((a) => ({ userId: a.id, type: 'PROSPECT_STATUS_CHANGED' as const, title, message, entityType: 'Prospect', entityId: prospectId, actionUrl: `/admin/prospects/${prospectId}` })),
  })
}

export function dashboardPathFor(role: string): string {
  return role === 'AMBASSADOR' ? '/ambassador/one-a-day' : '/coach/one-a-day'
}

/** Tell the inviter something happened. Never throws. */
export async function emailInviter(inviterId: string | null, prospectName: string, what: string) {
  if (!inviterId) return
  try {
    const u = await prisma.user.findUnique({ where: { id: inviterId }, select: { role: true, status: true } })
    const name = await userDisplayName(inviterId)
    if (!u || u.status !== 'ACTIVE' || !name) return
    const m = mail.inviterCallUpdateEmail({ inviterFirst: name.first, prospectName, what, dashUrl: mail.appUrl(dashboardPathFor(u.role)) })
    await sendEmail({ to: name.email, ...m })
  } catch (e) {
    console.error('[GET-INVOLVED] inviter email failed', e)
  }
}

/** Send the "new form" email to the inviter, with their current streak. */
export async function emailInviterNewLead(inviterId: string, p: { name: string; ageRange: AgeRangeValue | null; city: string | null }) {
  try {
    const u = await prisma.user.findUnique({ where: { id: inviterId }, select: { role: true, status: true } })
    const name = await userDisplayName(inviterId)
    if (!u || u.status !== 'ACTIVE' || !name) return
    const recent = await prisma.prospect.findMany({ where: { invitedById: inviterId, createdAt: { gte: new Date(Date.now() - 400 * 86400_000) } }, select: { createdAt: true } })
    const { streak } = computeStreak(recent.map((r) => r.createdAt), new Date())
    const m = mail.inviterNewLeadEmail({ inviterFirst: name.first, prospectName: p.name, ageLabel: ageRangeLabel(p.ageRange), city: p.city, minor: p.ageRange === 'UNDER_18', streak, dashUrl: mail.appUrl(dashboardPathFor(u.role)) })
    await sendEmail({ to: name.email, ...m })
  } catch (e) {
    console.error('[GET-INVOLVED] inviter email failed', e)
  }
}

/** Emails after a cancel, by the prospect or by staff. Used by the public and admin actions. */
export async function afterCancelEmails(
  p: { firstName: string; lastName: string; email: string; ageRange: string | null; parentEmail: string | null; journeyToken: string | null; invitedById: string | null },
  call: { startsAt: Date; hostId: string | null; timezone?: string },
  opts: { byHost: boolean; noParent?: boolean },
) {
  const tz = call.timezone ?? 'America/Chicago'
  const m = mail.cancelledEmail({ firstName: p.firstName, startsAt: call.startsAt, tz, bookUrl: journeyUrl(p.journeyToken!), byHost: opts.byHost, noParent: opts.noParent })
  await sendEmail({ to: p.email, ...m })
  if (p.ageRange === 'UNDER_18' && p.parentEmail) await sendEmail({ to: p.parentEmail, ...m })
  if (!opts.byHost && call.hostId) {
    const host = await userDisplayName(call.hostId)
    if (host) await sendEmail({ to: host.email, ...mail.hostCallEmail({ kind: 'cancelled', hostName: host.first, prospectName: `${p.firstName} ${p.lastName}`, startsAt: call.startsAt, ageLabel: ageRangeLabel(p.ageRange), inviterName: null, phone: null, parent: null, callsUrl: mail.appUrl(callsPathFor(host.role)), tz: host.tz }) })
  }
  await emailInviter(p.invitedById, `${p.firstName} ${p.lastName}`, opts.noParent ? 'needs to rebook so a parent can join the call' : 'cancelled their discovery call. A friendly check-in from you could help')
}

export const journeyUrl = (token: string) => mail.appUrl(`/discovery/${token}`)
export const consentUrl = (token: string) => mail.appUrl(`/consent/${token}`)
