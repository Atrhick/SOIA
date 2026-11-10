/**
 * Data for the discovery-call pages, shared by the admin pages (/admin/discovery-calls) and the
 * coach host pages (/coach/discovery-calls). Callers do the access checks.
 */
import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import {
  GetInvolvedRoleValue, STAGE_LABELS, ageRangeLabel, canChooseRole, dayKeyIn, isGetInvolvedRole, journeyPosition, journeyStages, priceLabel, rolesForAge,
} from '@/lib/get-involved/core'
import { journeyStateFor } from '@/lib/get-involved/journey'
import { listRoleConfigs } from '@/lib/get-involved/roles'
import { userDisplayName } from '@/lib/get-involved/server'
import { bookedCallsOnDays } from '@/lib/get-involved/discovery-slots'
import { STAFF_DEFAULT_TZ, zoneLabel, zoneOffset } from '@/lib/get-involved/time-zones'
import type { CallRow } from './calls-client'
import type { CallRecordData } from './[id]/call-record-client'
import type { BlockedDay } from './availability/blocked-dates-client'

/** Staff see times in their own host time zone, or Central Time if they are not a host. */
export async function staffTimeZone(userId: string): Promise<string> {
  const h = await prisma.discoveryHost.findUnique({ where: { userId }, select: { timezone: true } })
  return h?.timezone ?? STAFF_DEFAULT_TZ
}

export const tzNote = (tz: string) => `${zoneLabel(tz)} (${zoneOffset(tz)})`

export async function loadCallRows(where: Prisma.DiscoveryCallWhereInput): Promise<CallRow[]> {
  const now = new Date()
  const calls = await prisma.discoveryCall.findMany({
    where: { AND: [where, { OR: [{ status: 'BOOKED' }, { updatedAt: { gte: new Date(now.getTime() - 30 * 86400_000) } }] }] },
    orderBy: { startsAt: 'asc' },
    take: 300,
    include: { prospect: { select: { id: true, firstName: true, lastName: true, ageRange: true, phone: true, email: true, parentName: true, parentEmail: true, invitedById: true } } },
  })
  const names = new Map<string, string>()
  for (const id of Array.from(new Set(calls.flatMap((c) => [c.hostId, c.prospect.invitedById]).filter(Boolean) as string[]))) {
    names.set(id, (await userDisplayName(id))?.full ?? 'Unknown')
  }
  return calls.map((c) => ({
    id: c.id,
    prospectId: c.prospect.id,
    name: `${c.prospect.firstName} ${c.prospect.lastName}`,
    email: c.prospect.email,
    phone: c.prospect.phone,
    age: ageRangeLabel(c.prospect.ageRange),
    ageRange: c.prospect.ageRange,
    minor: c.prospect.ageRange === 'UNDER_18',
    parent: c.prospect.parentName ? `${c.prospect.parentName} · ${c.prospect.parentEmail ?? ''}` : null,
    inviter: c.prospect.invitedById ? names.get(c.prospect.invitedById) ?? null : null,
    host: c.hostId ? names.get(c.hostId) ?? null : null,
    startsAt: c.startsAt.toISOString(),
    status: c.status,
    meetingUrl: c.meetingUrl,
    notes: c.notes,
  }))
}

/** Everything the call record page shows. Null when the call doesn't exist. */
export async function loadCallRecord(callId: string, opts: { tz: string; admin: boolean }): Promise<(CallRecordData & { hostId: string | null }) | null> {
  const call = await prisma.discoveryCall.findUnique({ where: { id: callId }, include: { prospect: { include: { payment: { select: { status: true } } } } } })
  if (!call) return null
  const p = call.prospect
  const minor = p.ageRange === 'UNDER_18'
  const dateOnly = (d: Date) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: opts.tz }).format(d)

  const [configs, state, host, inviter] = await Promise.all([
    listRoleConfigs(),
    journeyStateFor(p),
    call.hostId ? userDisplayName(call.hostId) : null,
    p.invitedById ? userDisplayName(p.invitedById) : null,
  ])
  const pos = journeyPosition(state.facts)
  const role = isGetInvolvedRole(p.journeyRole) ? (p.journeyRole as GetInvolvedRoleValue) : null
  const stages = journeyStages(role, { minor, paid: state.facts.paid })
  const at = stages.indexOf(pos.stage)
  const steps = stages.map((s, i) => ({
    label: STAGE_LABELS[s],
    state: pos.stage === 'DONE' || (at >= 0 && i < at) ? 'done' as const : i === at ? 'current' as const : 'todo' as const,
  }))

  return {
    hostId: call.hostId,
    call: {
      id: call.id,
      startsAt: call.startsAt.toISOString(),
      status: call.status,
      meetingUrl: call.meetingUrl,
      notes: call.notes,
      topicsCovered: call.topicsCovered,
      parentAttended: call.parentAttended,
      parentAttendeeName: call.parentAttendeeName,
      parentAttendeeRelationship: call.parentAttendeeRelationship,
      outcomeAt: call.outcomeAt?.toISOString() ?? null,
      cancelReason: call.cancelReason,
    },
    prospect: {
      id: p.id,
      firstName: p.firstName,
      name: `${p.firstName} ${p.lastName}`,
      age: ageRangeLabel(p.ageRange),
      minor,
      city: p.city,
      parentName: p.parentName,
      parentFirst: (p.parentName ?? '').trim().split(/\s+/)[0] || null,
      parentRelationship: p.parentRelationship,
      parentConsent: p.parentConsentAt ? dateOnly(p.parentConsentAt) : null,
      status: p.status,
      roleLabel: state.config?.label ?? null,
      canChooseRole: !p.journeyRole && p.status === 'DISCOVERY_COMPLETED' && canChooseRole(p.status, !!p.roleTermsAcceptedAt),
    },
    host: host?.full ?? null,
    inviter: inviter?.full ?? null,
    inviterFirst: inviter?.first ?? null,
    roles: rolesForAge(configs, p.ageRange).map((c) => ({ role: c.role, label: c.label, price: priceLabel(c) })),
    steps,
    nextStep: pos.nextStep,
    closed: pos.stage === 'CLOSED',
    tz: opts.tz,
    prospectHref: opts.admin ? `/admin/prospects/${p.id}` : null,
  }
}

/** A host's upcoming days off, each with the calls still booked that day. */
export async function loadBlockedDays(host: { id: string; userId: string; timezone: string }): Promise<{ today: string; blocked: BlockedDay[] }> {
  const today = dayKeyIn(new Date(), host.timezone)
  const rows = await prisma.discoveryBlockedDate.findMany({ where: { hostId: host.id, day: { gte: today } }, orderBy: { day: 'asc' }, take: 100 })
  const calls = await bookedCallsOnDays(host, rows.map((r) => r.day))
  return {
    today,
    blocked: rows.map((r) => ({
      day: r.day,
      note: r.note,
      calls: calls.filter((c) => c.day === r.day).map((c) => ({ id: c.id, name: `${c.prospect.firstName} ${c.prospect.lastName}`, startsAt: c.startsAt.toISOString() })),
    })),
  }
}
