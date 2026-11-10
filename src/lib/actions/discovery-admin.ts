'use server'

/** Admin side of discovery calls: hosts, availability, outcomes, staff cancels. */
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { auth } from '@/lib/auth'
import type { Session } from 'next-auth'
import { sendEmail } from '@/lib/email'
import { GetInvolvedRoleValue, MAX_NO_SHOWS, isGetInvolvedRole, rolesForAge } from '@/lib/get-involved/core'
import { validateCallRecord } from '@/lib/get-involved/call-record'
import { sendAssessmentInviteAfterCall, sendGiveLinkAfterCall, tellInviterRoleChosen } from '@/lib/get-involved/call-outcome'
import * as mail from '@/lib/get-involved/emails'
import { afterNotAFitEmails, chooseRole, markNotAFit } from '@/lib/get-involved/journey'
import { listRoleConfigs } from '@/lib/get-involved/roles'
import { afterCancelEmails, emailInviter, journeyUrl, setStatus } from '@/lib/get-involved/server'

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
    const res = await prisma.$transaction(async (tx) => {
      const r = await tx.discoveryCall.updateMany({ where: { id: call.id, status: 'BOOKED' }, data: { status: 'NO_SHOW', outcomeAt: now, outcomeById: by, notes: d.notes || null } })
      if (r.count === 0) return null
      const up = await tx.prospect.update({ where: { id: p.id }, data: { noShowCount: { increment: 1 }, journeyTokenIssuedAt: now }, select: { noShowCount: true, status: true } })
      const paused = up.noShowCount >= MAX_NO_SHOWS
      await setStatus(tx, p.id, up.status, paused ? 'PAUSED' : 'FORM_SUBMITTED', by, `Missed call (${up.noShowCount})`)
      return { paused }
    })
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
      await setStatus(tx, p.id, p.status, 'DISCOVERY_COMPLETED', by, 'Discovery call kept')
      return null
    })
  } catch (e) {
    if (e instanceof Error && e.message === 'STALE') return { error: 'Someone already recorded this call.' }
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
  const ok = await prisma.$transaction(async (tx) => {
    const r = await tx.discoveryCall.updateMany({ where: { id: call.id, status: 'BOOKED' }, data: { status: 'CANCELLED', cancelledAt: now, cancelledBy: 'HOST', cancelReason: parsed.data.noParent ? 'No parent or guardian on the call' : parsed.data.reason || null } })
    if (r.count === 0) return false
    await tx.prospect.update({ where: { id: call.prospectId }, data: { journeyTokenIssuedAt: now } })
    await setStatus(tx, call.prospectId, call.prospect.status, 'FORM_SUBMITTED', g.session.user.id, parsed.data.noParent ? 'Rescheduling: no parent on the call' : 'Call cancelled by staff')
    return true
  })
  if (!ok) return { error: 'This call was already changed.' }
  await afterCancelEmails(call.prospect, call, { byHost: true, noParent: parsed.data.noParent })
  refresh()
  return { success: true }
}
