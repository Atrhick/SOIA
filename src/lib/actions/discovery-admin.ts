'use server'

/** Admin side of discovery calls: hosts, availability, outcomes, staff cancels. */
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { auth } from '@/lib/auth'
import type { Session } from 'next-auth'
import { sendEmail } from '@/lib/email'
import { AgeRangeValue, CALL_MINUTES, GetInvolvedRoleValue, MAX_NO_SHOWS, dayKeyIn, generateSlots, isDayKey, isGetInvolvedRole, pickHost, rolesForAge } from '@/lib/get-involved/core'
import { validateCallRecord } from '@/lib/get-involved/call-record'
import { sendAssessmentInviteAfterCall, sendGiveLinkAfterCall, tellInviterRoleChosen } from '@/lib/get-involved/call-outcome'
import * as mail from '@/lib/get-involved/emails'
import { afterNotAFitEmails, chooseRole, markNotAFit } from '@/lib/get-involved/journey'
import { listRoleConfigs } from '@/lib/get-involved/roles'
import { afterCancelEmails, busyBlocks, eligibleHosts, emailInviter, isStatusConflict, journeyUrl, mustTransition, upcomingCounts } from '@/lib/get-involved/server'
import { afterStaffMoveEmails, blockedDaysByUser, bookedCallsOnDays, hostsForSlots, lockBookings, notifyWaitingProspects, openSlotsWithBlocks } from '@/lib/get-involved/discovery-slots'

type Result = { success: true } | { error: string }

type Guard = { error: string; session?: never } | { session: Session; error?: never }

async function requireAdmin(): Promise<Guard> {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') return { error: 'Unauthorized' }
  if (session.user.isImpersonating) return { error: 'Switch back to your admin account first.' }
  return { session }
}

function refresh() {
  revalidatePath('/admin/discovery-calls')
  revalidatePath('/admin/discovery-calls/hosts')
  revalidatePath('/admin/discovery-calls/availability')
}

const AGE = z.enum(['UNDER_18', 'AGE_18_24', 'AGE_25_55', 'AGE_56_PLUS'])
const tz = z.string().max(64).refine((t) => { try { new Intl.DateTimeFormat('en-US', { timeZone: t }); return true } catch { return false } }, 'Unknown time zone')

const hostSchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().trim().min(1, 'Enter the name prospects will see').max(80),
  ageRanges: z.array(AGE).min(1, 'Pick at least one age range'),
  meetingUrl: z.string().trim().max(500).refine((v) => v === '' || /^https:\/\//i.test(v), 'The meeting link must start with https://'),
  timezone: tz,
  active: z.boolean(),
})

export async function saveDiscoveryHost(input: z.input<typeof hostSchema>): Promise<Result> {
  const g = await requireAdmin()
  if (!g.session) return { error: g.error }
  const parsed = hostSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form' }
  const user = await prisma.user.findUnique({ where: { id: parsed.data.userId }, select: { role: true, status: true } })
  // ADMIN only: the calls page and outcomes are ADMIN-only, so a sub-admin host couldn't run their calls.
  if (!user || user.role !== 'ADMIN') return { error: 'Only admin accounts can host discovery calls.' }

  const { userId, ...rest } = parsed.data
  const data = { ...rest, meetingUrl: rest.meetingUrl || null }
  await prisma.$transaction(async (tx) => {
    await tx.discoveryHost.upsert({ where: { userId }, create: { userId, ...data }, update: data })
    await tx.auditLog.create({ data: { userId: g.session.user.id, action: 'SAVE_DISCOVERY_HOST', entityType: 'DiscoveryHost', entityId: userId, details: JSON.stringify({ ageRanges: data.ageRanges, active: data.active }) } })
  })
  await notifyWaitingProspects()
  refresh()
  return { success: true }
}

export async function removeDiscoveryHost(userId: string): Promise<Result> {
  const g = await requireAdmin()
  if (!g.session) return { error: g.error }
  const upcoming = await prisma.discoveryCall.count({ where: { hostId: userId, status: 'BOOKED', startsAt: { gt: new Date() } } })
  if (upcoming > 0) return { error: `This host has ${upcoming} upcoming call${upcoming === 1 ? '' : 's'}. Turn them off instead (no new bookings), or cancel those calls first.` }
  await prisma.discoveryHost.deleteMany({ where: { userId } })
  await prisma.auditLog.create({ data: { userId: g.session.user.id, action: 'REMOVE_DISCOVERY_HOST', entityType: 'DiscoveryHost', entityId: userId } })
  refresh()
  return { success: true }
}

const windowSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startMinute: z.number().int().min(0).max(24 * 60),
  endMinute: z.number().int().min(0).max(24 * 60),
}).refine((w) => w.endMinute - w.startMinute >= 30, 'Each time block must be at least 30 minutes')

/** Replace a host's weekly availability. Admins can edit their own or anyone's. */
export async function saveAvailability(hostUserId: string, windows: z.input<typeof windowSchema>[]): Promise<Result> {
  const g = await requireAdmin()
  if (!g.session) return { error: g.error }
  const parsed = z.array(windowSchema).max(50).safeParse(windows)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the times' }
  const sorted = [...parsed.data].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinute - b.startMinute)
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].dayOfWeek === sorted[i - 1].dayOfWeek && sorted[i].startMinute < sorted[i - 1].endMinute) return { error: 'Two time blocks on the same day overlap.' }
  }
  const host = await prisma.discoveryHost.findUnique({ where: { userId: hostUserId }, select: { id: true } })
  if (!host) return { error: 'That person is not set up as a host yet.' }
  await prisma.$transaction([
    prisma.discoveryAvailability.deleteMany({ where: { hostId: host.id } }),
    prisma.discoveryAvailability.createMany({ data: sorted.map((w) => ({ ...w, hostId: host.id })) }),
  ])
  await notifyWaitingProspects()
  refresh()
  return { success: true }
}

// ---------- call record: outcome, topics, parent, role ----------

const recordSchema = z.object({
  outcome: z.enum(['KEPT', 'NO_SHOW', 'NOT_A_FIT', 'RESCHEDULE']),
  role: z.string().max(40).nullable().optional().default(null),
  topics: z.array(z.string().max(80)).max(10).optional().default([]),
  notes: z.string().trim().max(4000).optional().default(''),
  parentAttended: z.boolean().nullable().optional().default(null),
  parentName: z.string().trim().max(200).optional().default(''),
  parentRelationship: z.string().trim().max(40).optional().default(''),
})
export type CallRecordPayload = z.input<typeof recordSchema>
type RecordResult = { success: true; message: string } | { error: string; fieldErrors?: Record<string, string> }

function refreshCall(callId: string, prospectId: string) {
  refresh()
  revalidatePath(`/admin/discovery-calls/${callId}`)
  revalidatePath(`/admin/prospects/${prospectId}`)
  revalidatePath('/admin/prospects')
}

async function allowedRolesFor(ageRange: string | null) {
  return rolesForAge(await listRoleConfigs(), ageRange)
}

/** After the transaction: email the next step for the role and tell the inviter. */
async function afterRoleChosen(p: { id: string; firstName: string; lastName: string; invitedById: string | null }, chosen: { status: string; config: { label: string } }, hostId: string) {
  const sponsor = chosen.status === 'DONATION_HANDOFF'
  if (sponsor) await sendGiveLinkAfterCall(p.id)
  else await sendAssessmentInviteAfterCall(p.id, hostId)
  await tellInviterRoleChosen(p, chosen.config.label, sponsor)
}

/**
 * Record a discovery call from the call record page: Kept (with topics, notes, the parent for 17 and
 * under, and the role, which sends the assessment), No-show, Not a fit, or Reschedule.
 */
export async function saveCallRecord(callId: string, input: CallRecordPayload): Promise<RecordResult> {
  const g = await requireAdmin()
  if (!g.session) return { error: g.error }
  const parsed = recordSchema.safeParse(input)
  if (!parsed.success) return { error: 'Please check the form.' }
  const call = await prisma.discoveryCall.findUnique({ where: { id: String(callId ?? '') }, include: { prospect: true } })
  if (!call || call.status !== 'BOOKED') return { error: 'This call is not waiting for an outcome.' }
  const p = call.prospect
  const minor = p.ageRange === 'UNDER_18'
  const now = new Date()
  const d = parsed.data
  const allowed = await allowedRolesFor(p.ageRange)
  const fieldErrors = validateCallRecord(
    { outcome: d.outcome, role: (d.role || null) as GetInvolvedRoleValue | null, topics: d.topics, notes: d.notes, parentAttended: d.parentAttended, parentName: d.parentName, parentRelationship: d.parentRelationship },
    { minor, started: call.startsAt <= now, allowedRoles: allowed.map((c) => c.role) },
  )
  if (Object.keys(fieldErrors).length) return { error: Object.values(fieldErrors)[0], fieldErrors }
  const by = g.session.user.id
  const name = `${p.firstName} ${p.lastName}`
  const role = d.outcome === 'KEPT' && d.role && isGetInvolvedRole(d.role) ? d.role : null
  const kept = {
    status: 'KEPT' as const, outcomeAt: now, outcomeById: by, notes: d.notes || null, topicsCovered: d.topics,
    parentAttended: minor ? d.parentAttended : null,
    parentAttendeeName: minor && d.parentName ? d.parentName : null,
    parentAttendeeRelationship: minor && d.parentRelationship ? d.parentRelationship : null,
  }

  if (d.outcome === 'RESCHEDULE') {
    const r = await staffCancelCall(call.id, { reason: d.notes.slice(0, 300), noParent: minor && d.parentAttended === false })
    if ('error' in r) return { error: r.error }
    refreshCall(call.id, p.id)
    return { success: true, message: `Call cancelled. We emailed ${p.firstName} a link to pick a new time.` }
  }

  if (d.outcome === 'NO_SHOW') {
    let res: { paused: boolean } | null
    try {
    res = await prisma.$transaction(async (tx) => {
      const r = await tx.discoveryCall.updateMany({ where: { id: call.id, status: 'BOOKED' }, data: { status: 'NO_SHOW', outcomeAt: now, outcomeById: by, notes: d.notes || null } })
      if (r.count === 0) return null
      const up = await tx.prospect.update({ where: { id: p.id }, data: { noShowCount: { increment: 1 }, journeyTokenIssuedAt: now }, select: { noShowCount: true, status: true } })
      const paused = up.noShowCount >= MAX_NO_SHOWS
      await mustTransition(tx, p.id, up.status, paused ? 'PAUSED' : 'FORM_SUBMITTED', by, `Missed call (${up.noShowCount})`)
      return { paused }
    })
    } catch (e) {
      if (isStatusConflict(e)) return { error: 'This prospect was just changed by someone else. Reload and try again.' }
      throw e
    }
    if (!res) return { error: 'Someone already recorded this call.' }
    if (!res.paused && p.journeyToken) {
      const m = mail.noShowEmail({ firstName: p.firstName, bookUrl: journeyUrl(p.journeyToken) })
      await sendEmail({ to: p.email, ...m })
      if (minor && p.parentEmail) await sendEmail({ to: p.parentEmail, ...m })
    }
    await emailInviter(p.invitedById, name, res.paused ? 'missed two calls and is paused. A personal call from you could help' : 'missed their discovery call. We sent them a link to rebook')
    refreshCall(call.id, p.id)
    return { success: true, message: res.paused ? `Saved. ${p.firstName} has missed two calls and is now paused.` : `Saved. We emailed ${p.firstName} a link to rebook.` }
  }

  if (d.outcome === 'NOT_A_FIT') {
    try {
      await prisma.$transaction(async (tx) => {
        // A call that already happened is recorded as kept; one that hasn't started is cancelled by markNotAFit.
        if (call.startsAt <= now) {
          const r = await tx.discoveryCall.updateMany({ where: { id: call.id, status: 'BOOKED' }, data: kept })
          if (r.count === 0) throw new Error('STALE')
        }
        if (!(await markNotAFit(tx, p.id, by, d.notes))) throw new Error('CLOSED')
      })
    } catch (e) {
      if (e instanceof Error && e.message === 'STALE') return { error: 'Someone already recorded this call.' }
      if (e instanceof Error && e.message === 'CLOSED') return { error: 'This prospect can no longer be closed from here. Open their record.' }
      throw e
    }
    await afterNotAFitEmails(p)
    refreshCall(call.id, p.id)
    return { success: true, message: `Closed as not a fit. We sent ${p.firstName} a kind email.` }
  }

  // KEPT
  let chosen: Awaited<ReturnType<typeof chooseRole>> | null = null
  try {
    chosen = await prisma.$transaction(async (tx) => {
      const r = await tx.discoveryCall.updateMany({ where: { id: call.id, status: 'BOOKED' }, data: kept })
      if (r.count === 0) throw new Error('STALE')
      if (role) {
        const c = await chooseRole(tx, p.id, role, by)
        if (!c.ok) throw new Error(`ROLE:${c.error}`)
        return c
      }
      await mustTransition(tx, p.id, p.status, 'DISCOVERY_COMPLETED', by, 'Discovery call kept')
      return null
    })
  } catch (e) {
    if (e instanceof Error && e.message === 'STALE') return { error: 'Someone already recorded this call.' }
    if (isStatusConflict(e)) return { error: 'This prospect was just changed by someone else. Reload and try again.' }
    if (e instanceof Error && e.message.startsWith('ROLE:')) return { error: e.message.slice(5), fieldErrors: { role: e.message.slice(5) } }
    throw e
  }
  if (chosen?.ok) {
    await afterRoleChosen(p, chosen, by)
    refreshCall(call.id, p.id)
    return { success: true, message: chosen.status === 'DONATION_HANDOFF' ? `Saved. We sent ${p.firstName} the giving page.` : `Saved. We emailed ${p.firstName} the ${chosen.config.label} questions${minor ? ' and copied their parent' : ''}.` }
  }
  await emailInviter(p.invitedById, name, 'had their discovery call')
  refreshCall(call.id, p.id)
  return { success: true, message: 'Saved as kept. Choose the role below when you are ready.' }
}

const afterCallSchema = z.object({
  decision: z.string().min(1).max(40),
  notes: z.string().trim().max(4000).optional().default(''),
})

/**
 * For a call already recorded Kept with no role yet (for example from phase 1): choose the role
 * (sends the assessment) or close as Not a fit. Changing an existing role is done on the prospect record.
 */
export async function decideAfterCall(callId: string, input: z.input<typeof afterCallSchema>): Promise<RecordResult> {
  const g = await requireAdmin()
  if (!g.session) return { error: g.error }
  const parsed = afterCallSchema.safeParse(input)
  if (!parsed.success) return { error: 'Please choose a role or Not a fit.' }
  const call = await prisma.discoveryCall.findUnique({ where: { id: String(callId ?? '') }, include: { prospect: true } })
  if (!call || call.status !== 'KEPT') return { error: 'This call has not been recorded as kept.' }
  const p = call.prospect
  if (p.journeyRole) return { error: 'A role is already chosen. Change it on the prospect record.' }
  const by = g.session.user.id
  const { decision, notes } = parsed.data

  if (decision === 'NOT_A_FIT') {
    const ok = await prisma.$transaction((tx) => markNotAFit(tx, p.id, by, notes))
    if (!ok) return { error: 'This prospect can no longer be closed from here.' }
    await afterNotAFitEmails(p)
    refreshCall(call.id, p.id)
    return { success: true, message: `Closed as not a fit. We sent ${p.firstName} a kind email.` }
  }

  const allowed = (await allowedRolesFor(p.ageRange)).map((c) => c.role as string)
  if (!isGetInvolvedRole(decision) || !allowed.includes(decision)) return { error: 'That role is not open to this age range.', fieldErrors: { role: 'That role is not open to this age range.' } }
  const chosen = await prisma.$transaction(async (tx) => {
    const c = await chooseRole(tx, p.id, decision, by)
    if (c.ok && notes) await tx.prospectNote.create({ data: { prospectId: p.id, authorId: by, body: notes } })
    return c
  })
  if (!chosen.ok) return { error: chosen.error }
  await afterRoleChosen(p, chosen, by)
  refreshCall(call.id, p.id)
  return { success: true, message: chosen.status === 'DONATION_HANDOFF' ? `Saved. We sent ${p.firstName} the giving page.` : `Saved. We emailed ${p.firstName} the ${chosen.config.label} questions.` }
}

const staffCancelSchema = z.object({ reason: z.string().trim().max(300).optional().default(''), noParent: z.boolean().optional().default(false) })

/** Staff cancel (including "no parent joined, reschedule"). The prospect gets a link to pick a new time. */
export async function staffCancelCall(callId: string, input: z.input<typeof staffCancelSchema>): Promise<Result> {
  const g = await requireAdmin()
  if (!g.session) return { error: g.error }
  const parsed = staffCancelSchema.safeParse(input)
  if (!parsed.success) return { error: 'Please check the form' }
  const call = await prisma.discoveryCall.findUnique({ where: { id: callId }, include: { prospect: true } })
  if (!call || call.status !== 'BOOKED') return { error: 'This call is not booked.' }
  const now = new Date()
  let ok: boolean
  try {
  ok = await prisma.$transaction(async (tx) => {
    const r = await tx.discoveryCall.updateMany({ where: { id: call.id, status: 'BOOKED' }, data: { status: 'CANCELLED', cancelledAt: now, cancelledBy: 'HOST', cancelReason: parsed.data.noParent ? 'No parent or guardian on the call' : parsed.data.reason || null } })
    if (r.count === 0) return false
    await tx.prospect.update({ where: { id: call.prospectId }, data: { journeyTokenIssuedAt: now } })
    await mustTransition(tx, call.prospectId, call.prospect.status, 'FORM_SUBMITTED', g.session.user.id, parsed.data.noParent ? 'Rescheduling: no parent on the call' : 'Call cancelled by staff')
    return true
  })
  } catch (e) {
    if (isStatusConflict(e)) return { error: 'This prospect was just changed by someone else. Reload and try again.' }
    throw e
  }
  if (!ok) return { error: 'This call was already changed.' }
  await afterCancelEmails(call.prospect, call, { byHost: true, noParent: parsed.data.noParent })
  refresh()
  return { success: true }
}

// ---------- blocked dates (a host's day off) ----------

const blockSchema = z.object({
  day: z.string().refine(isDayKey, 'Pick a date'),
  note: z.string().trim().max(120).optional().default(''),
})

type MessageResult = { success: true; message: string } | { error: string }

/** Block off one whole day for a host. No new slots that day; calls already booked stay and are listed. */
export async function blockDiscoveryDate(hostUserId: string, input: z.input<typeof blockSchema>): Promise<MessageResult> {
  const g = await requireAdmin()
  if (!g.session) return { error: g.error }
  const parsed = blockSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Pick a date' }
  const host = await prisma.discoveryHost.findUnique({ where: { userId: String(hostUserId ?? '') }, select: { id: true, userId: true, timezone: true } })
  if (!host) return { error: 'That person is not set up as a host yet.' }
  const { day, note } = parsed.data
  const now = new Date()
  if (day < dayKeyIn(now, host.timezone)) return { error: 'That date has already passed.' }
  if (day > dayKeyIn(new Date(now.getTime() + 366 * 86400_000), host.timezone)) return { error: 'Pick a date within the next year.' }
  await prisma.$transaction(async (tx) => {
    await tx.discoveryBlockedDate.upsert({
      where: { hostId_day: { hostId: host.id, day } },
      create: { hostId: host.id, day, note: note || null, createdById: g.session.user.id },
      update: { note: note || null },
    })
    await tx.auditLog.create({ data: { userId: g.session.user.id, action: 'BLOCK_DISCOVERY_DATE', entityType: 'DiscoveryHost', entityId: host.userId, details: JSON.stringify({ day }) } })
  })
  const booked = await bookedCallsOnDays(host, [day])
  refresh()
  const n = booked.length
  return { success: true, message: n ? `Blocked. ${n} call${n === 1 ? ' is' : 's are'} still booked that day: move ${n === 1 ? 'it' : 'them'} below.` : 'Blocked. No one can book that day.' }
}

export async function unblockDiscoveryDate(hostUserId: string, day: string): Promise<Result> {
  const g = await requireAdmin()
  if (!g.session) return { error: g.error }
  if (typeof day !== 'string' || !isDayKey(day)) return { error: 'Pick a date' }
  const host = await prisma.discoveryHost.findUnique({ where: { userId: String(hostUserId ?? '') }, select: { id: true, userId: true } })
  if (!host) return { error: 'That person is not set up as a host yet.' }
  await prisma.$transaction([
    prisma.discoveryBlockedDate.deleteMany({ where: { hostId: host.id, day } }),
    prisma.auditLog.create({ data: { userId: g.session.user.id, action: 'UNBLOCK_DISCOVERY_DATE', entityType: 'DiscoveryHost', entityId: host.userId, details: JSON.stringify({ day }) } }),
  ])
  await notifyWaitingProspects()
  refresh()
  return { success: true }
}

// ---------- move an upcoming call (staff) ----------

export type MoveSlot = { startsAt: string; hosts: string[] }

/** Times this call can move to: the prospect's own booking rules (age range, hours, blocked days, 12 h notice). */
export async function slotsForMove(callId: string): Promise<{ slots: MoveSlot[] } | { error: string }> {
  const g = await requireAdmin()
  if (!g.session) return { error: g.error }
  const call = await prisma.discoveryCall.findUnique({ where: { id: String(callId ?? '') }, select: { id: true, status: true, startsAt: true, prospect: { select: { ageRange: true } } } })
  const now = new Date()
  if (!call || call.status !== 'BOOKED' || call.startsAt <= now) return { error: 'Only upcoming booked calls can be moved.' }
  const { slots, hosts } = await openSlotsWithBlocks(call.prospect.ageRange as AgeRangeValue | null, now, call.id)
  const names = new Map(hosts.map((h) => [h.userId, h.displayName]))
  return {
    slots: slots
      .filter((s) => s.startsAt.getTime() !== call.startsAt.getTime())
      .slice(0, 400)
      .map((s) => ({ startsAt: s.startsAt.toISOString(), hosts: s.hostIds.map((id) => names.get(id) ?? 'Host') })),
  }
}

const moveSchema = z.object({ startsAt: z.string().datetime() })

/**
 * Move an upcoming call to another open slot. Same checks as the prospect's own move in
 * bookDiscoveryCall (advisory lock, slot still open, keep the host when free) and the same emails.
 */
export async function moveDiscoveryCall(callId: string, input: z.input<typeof moveSchema>): Promise<Result> {
  const g = await requireAdmin()
  if (!g.session) return { error: g.error }
  const parsed = moveSchema.safeParse(input)
  if (!parsed.success) return { error: 'Pick a new time.' }
  const call = await prisma.discoveryCall.findUnique({ where: { id: String(callId ?? '') }, include: { prospect: true } })
  const now = new Date()
  if (!call || call.status !== 'BOOKED' || call.startsAt <= now) return { error: 'Only upcoming booked calls can be moved.' }
  const startsAt = new Date(parsed.data.startsAt)
  if (startsAt.getTime() === call.startsAt.getTime()) return { error: 'That is the current time. Pick a different one.' }
  const hosts = await eligibleHosts(call.prospect.ageRange as AgeRangeValue | null)
  if (hosts.length === 0) return { error: 'No active host covers this age range.' }
  const old = { startsAt: call.startsAt, hostId: call.hostId }
  let moved: { startsAt: Date; hostId: string | null; meetingUrl: string | null; timezone: string }
  try {
    moved = await prisma.$transaction(async (tx) => {
      await lockBookings(tx)
      const cur = await tx.discoveryCall.findUnique({ where: { id: call.id }, select: { status: true, startsAt: true } })
      if (!cur || cur.status !== 'BOOKED' || cur.startsAt.getTime() !== call.startsAt.getTime()) throw new Error('CHANGED')
      const [busy, blocked] = await Promise.all([busyBlocks(hosts.map((h) => h.userId), now, call.id, tx), blockedDaysByUser(hosts, now, tx)])
      const slot = generateSlots(hostsForSlots(hosts, blocked), busy, now).find((s) => s.startsAt.getTime() === startsAt.getTime())
      if (!slot) throw new Error('SLOT_TAKEN')
      const hostId = call.hostId && slot.hostIds.includes(call.hostId) ? call.hostId : pickHost(slot.hostIds, await upcomingCounts(slot.hostIds, now))
      const host = hosts.find((h) => h.userId === hostId)!
      const c = await tx.discoveryCall.update({
        where: { id: call.id },
        data: { hostId, startsAt, endsAt: new Date(startsAt.getTime() + CALL_MINUTES * 60_000), meetingUrl: host.meetingUrl, reminder24hSentAt: null, reminder1hSentAt: null, rescheduleCount: { increment: 1 } },
      })
      await tx.auditLog.create({ data: { userId: g.session.user.id, action: 'MOVE_DISCOVERY_CALL', entityType: 'DiscoveryCall', entityId: call.id, details: JSON.stringify({ from: old.startsAt.toISOString(), to: startsAt.toISOString(), hostId }) } })
      return c
    })
  } catch (e) {
    if (e instanceof Error && e.message === 'SLOT_TAKEN') return { error: 'That time is no longer open. Pick another.' }
    if (e instanceof Error && e.message === 'CHANGED') return { error: 'This call just changed. Reload the page.' }
    console.error('[GET-INVOLVED] staff move failed', e)
    return { error: 'Something went wrong. Please try again.' }
  }
  await afterStaffMoveEmails(call.prospect, moved, old)
  refresh()
  revalidatePath(`/admin/discovery-calls/${call.id}`)
  return { success: true }
}
