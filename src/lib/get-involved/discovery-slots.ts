/**
 * Server-only slot helpers that know about blocked dates (DiscoveryBlockedDate), plus the
 * "no open times" follow-ups. Not 'use server': nothing here is a public endpoint.
 *
 * openSlotsWithBlocks() is openSlotsFor() (server.ts) plus each host's blocked days. Every place that
 * offers or validates a slot should use it so a blocked day is never bookable.
 */
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { AgeRangeValue, HostForSlots, Slot, ageRangeLabel, dayKeyIn, generateSlots, journeyOpen } from './core'
import { startOfBusinessDay } from './call-tools'
import { busyBlocks, eligibleHosts, emailInviter, journeyUrl, notifyAdmins, userDisplayName } from './server'
import * as mail from './emails'
import { timesOpenEmail } from './emails/slots-open'

type Db = Prisma.TransactionClient | typeof prisma
type Hosts = Awaited<ReturnType<typeof eligibleHosts>>

/** Same advisory lock key as bookDiscoveryCall (get-involved.ts), so staff moves and prospect bookings never race. */
export async function lockBookings(tx: Prisma.TransactionClient) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(4210911)`
}

/** Blocked days (yyyy-mm-dd, host timezone) for each host, keyed by the host's user id. Only today and later. */
export async function blockedDaysByUser(hosts: { id: string; userId: string; timezone: string }[], now: Date, db: Db = prisma): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>()
  if (hosts.length === 0) return out
  // The earliest "today" across host timezones is never before yesterday in UTC.
  const floor = dayKeyIn(new Date(now.getTime() - 86400_000), 'UTC')
  const rows = await db.discoveryBlockedDate.findMany({ where: { hostId: { in: hosts.map((h) => h.id) }, day: { gte: floor } }, select: { hostId: true, day: true } })
  for (const h of hosts) out.set(h.userId, rows.filter((r) => r.hostId === h.id).map((r) => r.day))
  return out
}

export function hostsForSlots(hosts: Hosts, blocked: Map<string, string[]>): HostForSlots[] {
  return hosts.map((h) => ({ id: h.userId, timezone: h.timezone, availability: h.availability, blockedDays: blocked.get(h.userId) ?? [] }))
}

/** Open slots for an age range, skipping booked calls (except `excludeCallId`) and blocked days. */
export async function openSlotsWithBlocks(ageRange: AgeRangeValue | null, now = new Date(), excludeCallId?: string, db: Db = prisma): Promise<{ slots: Slot[]; hosts: Hosts }> {
  const hosts = await eligibleHosts(ageRange)
  if (hosts.length === 0) return { slots: [], hosts }
  const [busy, blocked] = await Promise.all([
    busyBlocks(hosts.map((h) => h.userId), now, excludeCallId, db),
    blockedDaysByUser(hosts, now, db),
  ])
  return { slots: generateSlots(hostsForSlots(hosts, blocked), busy, now), hosts }
}

/** Booked calls for one host on the given days (yyyy-mm-dd in the host's timezone), so staff can move them. */
export async function bookedCallsOnDays(host: { userId: string; timezone: string }, days: string[], db: Db = prisma) {
  if (days.length === 0) return []
  const sorted = [...days].sort()
  const edge = (d: string, shift: number) => { const [y, m, dd] = d.split('-').map(Number); return new Date(Date.UTC(y, m - 1, dd) + shift * 86400_000) }
  const calls = await db.discoveryCall.findMany({
    where: { hostId: host.userId, status: 'BOOKED', startsAt: { gte: edge(sorted[0], -1), lt: edge(sorted[sorted.length - 1], 2) } },
    select: { id: true, startsAt: true, prospect: { select: { firstName: true, lastName: true } } },
    orderBy: { startsAt: 'asc' },
  })
  const want = new Set(days)
  return calls.map((c) => ({ ...c, day: dayKeyIn(c.startsAt, host.timezone) })).filter((c) => want.has(c.day))
}

// ---------- no open times ----------

export const NO_SLOTS_ALERT_TITLE = 'No open call times'

/**
 * The prospect opened the booking page and saw no times. Tell the admins, at most once per prospect
 * per Central-time day. Never throws (it runs while rendering the public page).
 */
export async function alertNoSlotsOncePerDay(p: { id: string; firstName: string; lastName: string; ageRange: string | null }, now = new Date()) {
  try {
    const since = startOfBusinessDay(now)
    const already = await prisma.adminNotification.findFirst({ where: { entityType: 'Prospect', entityId: p.id, title: NO_SLOTS_ALERT_TITLE, createdAt: { gte: since } }, select: { id: true } })
    if (already) return
    await notifyAdmins(NO_SLOTS_ALERT_TITLE, `${p.firstName} ${p.lastName} (${ageRangeLabel(p.ageRange)}) opened the booking page and found no open times. Add hours or a host for this age range.`, p.id)
  } catch (e) {
    console.error('[GET-INVOLVED] no-slots alert failed', e)
  }
}

/**
 * After hours, hosts or blocked dates change: email every prospect who asked "Email me when times
 * open up" and now has times. Marks each request handled and refreshes the link's 14 days. Never throws.
 */
export async function notifyWaitingProspects(now = new Date()): Promise<number> {
  try {
    const reqs = await prisma.discoverySlotRequest.findMany({
      where: { kind: 'NOTIFY', handledAt: null },
      orderBy: { createdAt: 'asc' },
      take: 200,
      include: { prospect: { select: { id: true, firstName: true, email: true, ageRange: true, parentName: true, parentEmail: true, parentConsentAt: true, status: true, journeyToken: true } } },
    })
    const cache = new Map<string, number>()
    let sent = 0
    for (const r of reqs) {
      const p = r.prospect
      if (!p.journeyToken || !journeyOpen(p.status) || p.status !== 'FORM_SUBMITTED' || (p.ageRange === 'UNDER_18' && !p.parentConsentAt)) {
        await prisma.discoverySlotRequest.update({ where: { id: r.id }, data: { handledAt: now } })
        continue
      }
      const key = p.ageRange ?? ''
      if (!cache.has(key)) cache.set(key, (await openSlotsWithBlocks((p.ageRange as AgeRangeValue | null) ?? null, now)).slots.length)
      if (!cache.get(key)) continue
      const claimed = await prisma.discoverySlotRequest.updateMany({ where: { id: r.id, handledAt: null }, data: { handledAt: now } })
      if (claimed.count === 0) continue
      await prisma.prospect.update({ where: { id: p.id }, data: { journeyTokenIssuedAt: now } })
      const url = journeyUrl(p.journeyToken)
      await sendEmail({ to: p.email, ...timesOpenEmail({ firstName: p.firstName, bookUrl: url }) })
      if (p.ageRange === 'UNDER_18' && p.parentEmail) {
        await sendEmail({ to: p.parentEmail, ...timesOpenEmail({ firstName: p.firstName, bookUrl: url, parent: { first: (p.parentName ?? '').split(' ')[0] || 'Hi' } }) })
      }
      sent++
    }
    return sent
  } catch (e) {
    console.error('[GET-INVOLVED] times-open emails failed', e)
    return 0
  }
}

// ---------- staff move: emails ----------

/**
 * Emails after staff move a call: the same templates as a prospect's own move (rescheduledEmail to the
 * prospect and parent, hostCallEmail to the host(s)) plus the inviter update.
 */
export async function afterStaffMoveEmails(
  p: { firstName: string; lastName: string; email: string; phone: string | null; ageRange: string | null; parentName: string | null; parentEmail: string | null; parentPhone: string | null; journeyToken: string | null; invitedById: string | null },
  call: { startsAt: Date; hostId: string | null; meetingUrl: string | null; timezone: string },
  old: { startsAt: Date; hostId: string | null },
) {
  try {
    const host = call.hostId ? await userDisplayName(call.hostId) : null
    const minor = p.ageRange === 'UNDER_18'
    const base = { firstName: p.firstName, startsAt: call.startsAt, tz: call.timezone, hostName: host?.full ?? 'our team', meetingUrl: call.meetingUrl, manageUrl: journeyUrl(p.journeyToken ?? ''), oldStartsAt: old.startsAt }
    await sendEmail({ to: p.email, ...mail.rescheduledEmail(base) })
    if (minor && p.parentEmail) await sendEmail({ to: p.parentEmail, ...mail.rescheduledEmail({ ...base, parent: { first: (p.parentName ?? '').split(' ')[0] || 'Hi' } }) })
    const inviter = p.invitedById ? await userDisplayName(p.invitedById) : null
    const hostMail = (kind: 'new' | 'moved' | 'cancelled', to: { first: string; email: string }, startsAt: Date, oldStartsAt?: Date) =>
      sendEmail({ to: to.email, ...mail.hostCallEmail({ kind, hostName: to.first, prospectName: `${p.firstName} ${p.lastName}`, startsAt, oldStartsAt, ageLabel: ageRangeLabel(p.ageRange), inviterName: inviter?.full ?? null, phone: p.phone, parent: minor && p.parentName && p.parentEmail ? { name: p.parentName, email: p.parentEmail, phone: p.parentPhone } : null, callsUrl: mail.appUrl('/admin/discovery-calls') }) })
    if (host) {
      if (old.hostId === call.hostId) await hostMail('moved', host, call.startsAt, old.startsAt)
      else {
        await hostMail('new', host, call.startsAt)
        const oldHost = old.hostId ? await userDisplayName(old.hostId) : null
        if (oldHost) await hostMail('cancelled', oldHost, old.startsAt)
      }
    }
    if (p.invitedById) {
      const when = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago', timeZoneName: 'short' }).format(call.startsAt)
      await emailInviter(p.invitedById, `${p.firstName} ${p.lastName}`, `had their discovery call moved to ${when}`)
    }
  } catch (e) {
    console.error('[GET-INVOLVED] move emails failed', e)
  }
}
