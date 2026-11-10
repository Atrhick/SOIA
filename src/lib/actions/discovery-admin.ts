'use server'

/** Admin side of discovery calls: hosts, availability, outcomes, staff cancels. */
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { auth } from '@/lib/auth'
import type { Session } from 'next-auth'
import { sendEmail } from '@/lib/email'
import { MAX_NO_SHOWS } from '@/lib/get-involved/core'
import * as mail from '@/lib/get-involved/emails'
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

const outcomeSchema = z.object({
  outcome: z.enum(['KEPT', 'NO_SHOW']),
  parentAttended: z.boolean().optional(),
  notes: z.string().trim().max(4000).optional().default(''),
})

export async function recordCallOutcome(callId: string, input: z.input<typeof outcomeSchema>): Promise<Result> {
  const g = await requireAdmin()
  if (!g.session) return { error: g.error }
  const parsed = outcomeSchema.safeParse(input)
  if (!parsed.success) return { error: 'Please check the form' }
  const call = await prisma.discoveryCall.findUnique({ where: { id: callId }, include: { prospect: true } })
  if (!call || call.status !== 'BOOKED') return { error: 'This call is not waiting for an outcome.' }
  if (call.startsAt > new Date()) return { error: "This call hasn't started yet." }
  const p = call.prospect
  const minor = p.ageRange === 'UNDER_18'
  const { outcome, parentAttended, notes } = parsed.data

  if (outcome === 'KEPT') {
    if (minor && parentAttended !== true) return { error: 'A parent or guardian must be on the call for someone 17 or under. If they were not, choose "No parent: reschedule" instead.' }
    const ok = await prisma.$transaction(async (tx) => {
      const r = await tx.discoveryCall.updateMany({ where: { id: call.id, status: 'BOOKED' }, data: { status: 'KEPT', parentAttended: minor ? true : null, outcomeAt: new Date(), outcomeById: g.session.user.id, notes: notes || null } })
      if (r.count === 0) return false
      await setStatus(tx, p.id, p.status, 'DISCOVERY_COMPLETED', g.session.user.id, 'Discovery call kept')
      return true
    })
    if (!ok) return { error: 'Someone already recorded this call.' }
    await emailInviter(p.invitedById, `${p.firstName} ${p.lastName}`, 'had their discovery call')
  } else {
    const res = await prisma.$transaction(async (tx) => {
      const r = await tx.discoveryCall.updateMany({ where: { id: call.id, status: 'BOOKED' }, data: { status: 'NO_SHOW', outcomeAt: new Date(), outcomeById: g.session.user.id, notes: notes || null } })
      if (r.count === 0) return null
      const up = await tx.prospect.update({ where: { id: p.id }, data: { noShowCount: { increment: 1 }, journeyTokenIssuedAt: new Date() }, select: { noShowCount: true, status: true } })
      const paused = up.noShowCount >= MAX_NO_SHOWS
      await setStatus(tx, p.id, up.status, paused ? 'PAUSED' : 'FORM_SUBMITTED', g.session.user.id, `Missed call (${up.noShowCount})`)
      return { paused }
    })
    if (!res) return { error: 'Someone already recorded this call.' }
    const { paused } = res
    if (!paused && p.journeyToken) {
      const m = mail.noShowEmail({ firstName: p.firstName, bookUrl: journeyUrl(p.journeyToken) })
      await sendEmail({ to: p.email, ...m })
      if (minor && p.parentEmail) await sendEmail({ to: p.parentEmail, ...m })
    }
    await emailInviter(p.invitedById, `${p.firstName} ${p.lastName}`, paused ? 'missed two calls and is paused. A personal call from you could help' : 'missed their discovery call. We sent them a link to rebook')
  }
  refresh()
  revalidatePath(`/admin/prospects/${p.id}`)
  return { success: true }
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
