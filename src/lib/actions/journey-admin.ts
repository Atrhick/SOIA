'use server'

/**
 * Admin actions on a Get Involved prospect record (/admin/prospects/[id]): resend the assessment,
 * change the role, mark not a fit, add a note. ADMIN only (not SUB_ADMIN), never while
 * impersonating. Every export here is a public endpoint, so each one checks the session itself.
 */
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import type { Session } from 'next-auth'
import prisma from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { GET_INVOLVED_ROLES, canAnswerAssessment, canChooseRole, canMarkNotAFit, isGetInvolvedRole } from '@/lib/get-involved/core'
import { afterNotAFitEmails, chooseRole, markNotAFit } from '@/lib/get-involved/journey'
import { prospectRoleConfig } from '@/lib/get-involved/roles'
import { sendAssessmentInvite } from '@/lib/get-involved/journey-steps'
import { sendGiveLinkAfterCall } from '@/lib/get-involved/call-outcome'
import { completeJourney } from '@/lib/get-involved/login'

type Result = { success: true; message?: string } | { error: string }
type Guard = { error: string; session?: never } | { session: Session; error?: never }

async function requireAdmin(): Promise<Guard> {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') return { error: 'Unauthorized' }
  if (session.user.isImpersonating) return { error: 'Switch back to your admin account first.' }
  return { session }
}

const idSchema = z.string().min(1).max(64)

function refresh(id: string) {
  revalidatePath('/admin/prospects')
  revalidatePath(`/admin/prospects/${id}`)
}

async function journeyProspect(id: string) {
  return prisma.prospect.findUnique({
    where: { id },
    select: {
      id: true, firstName: true, lastName: true, email: true, ageRange: true, parentEmail: true, invitedById: true,
      status: true, journeyToken: true, journeyRole: true, roleConfigSnapshot: true, roleTermsAcceptedAt: true, assessmentSentAt: true,
    },
  })
}

/** Email the role's 3 questions again with a fresh 14-day link. Only while the answers are still due. */
export async function resendAssessmentQuestions(prospectId: string): Promise<Result> {
  const g = await requireAdmin()
  if (!g.session) return { error: g.error }
  const id = idSchema.safeParse(prospectId)
  if (!id.success) return { error: 'Prospect not found.' }
  const p = await journeyProspect(id.data)
  if (!p || !p.journeyToken) return { error: 'Prospect not found.' }
  if (!canAnswerAssessment(p.status) || !isGetInvolvedRole(p.journeyRole) || p.journeyRole === 'SPONSOR') {
    return { error: 'The questions can only be resent while the assessment is waiting for answers.' }
  }
  if (p.assessmentSentAt && Date.now() - p.assessmentSentAt.getTime() < 60_000) {
    return { error: 'The questions were sent less than a minute ago. Please wait before sending again.' }
  }
  const cfg = await prospectRoleConfig(p)
  if (!cfg) return { error: 'Choose a role first.' }

  await prisma.auditLog.create({ data: { userId: g.session.user.id, action: 'RESEND_ASSESSMENT', entityType: 'Prospect', entityId: p.id, details: JSON.stringify({ role: p.journeyRole }) } })
  // Same E8 email as after the call; it refreshes the 14-day link and sets assessmentSentAt.
  const sent = await sendAssessmentInvite(p.id)
  if (!sent.ok) return { error: `${sent.error} Please try again.` }
  refresh(p.id)
  return { success: true, message: `Questions sent to ${p.email}${p.ageRange === 'UNDER_18' && p.parentEmail ? ' and their parent' : ''}.` }
}

const changeRoleSchema = z.object({
  role: z.enum(GET_INVOLVED_ROLES as unknown as [string, ...string[]]),
  reason: z.string().trim().max(1000).optional().default(''),
})

/**
 * Change (or set) the role. Clears assessment and orientation progress (chooseRole), then emails the
 * new role's questions, or the donation link for a sponsor.
 */
export async function changeProspectRole(prospectId: string, input: z.input<typeof changeRoleSchema>): Promise<Result> {
  const g = await requireAdmin()
  if (!g.session) return { error: g.error }
  const id = idSchema.safeParse(prospectId)
  const parsed = changeRoleSchema.safeParse(input)
  if (!id.success) return { error: 'Prospect not found.' }
  if (!parsed.success || !isGetInvolvedRole(parsed.data.role)) return { error: 'Choose a role.' }
  const role = parsed.data.role
  const p = await journeyProspect(id.data)
  if (!p || !p.journeyToken) return { error: 'Prospect not found.' }
  if (p.status === 'DISCOVERY_BOOKED') return { error: 'Record the discovery call first (Discovery Calls page), then choose the role there.' }
  if (!canChooseRole(p.status, !!p.roleTermsAcceptedAt)) return { error: 'The role can no longer be changed at this step.' }
  if (p.journeyRole === role) return { error: p.status === 'ASSESSMENT_PENDING' ? 'That is already their role. Use "Resend questions" to send the email again.' : 'That is already their role.' }

  const r = await prisma.$transaction(async (tx) => {
    const res = await chooseRole(tx, p.id, role, g.session.user.id)
    if (res.ok) {
      await tx.auditLog.create({
        data: { userId: g.session.user.id, action: 'CHANGE_PROSPECT_ROLE', entityType: 'Prospect', entityId: p.id, details: JSON.stringify({ from: p.journeyRole, to: role, reason: parsed.data.reason || null }) },
      })
    }
    return res
  })
  if (!r.ok) return { error: r.error }

  let sent: boolean
  if (r.status === 'DONATION_HANDOFF') {
    await sendGiveLinkAfterCall(p.id)
    sent = true
  } else {
    sent = (await sendAssessmentInvite(p.id)).ok
  }
  refresh(p.id)
  if (!sent) return { success: true, message: `Role ${p.journeyRole ? 'changed' : 'set'} to ${r.config.label}, but the email could not be sent. Use "Resend questions" to try again.` }
  const verb = p.journeyRole ? 'Role changed to' : 'Role set to'
  return { success: true, message: `${verb} ${r.config.label}. ${r.status === 'DONATION_HANDOFF' ? 'The donation link' : 'The new questions'} went to ${p.email}.` }
}

const notAFitSchema = z.object({ note: z.string().trim().max(1000).optional().default('') })

/** Close the prospect as Not a fit (cancels a booked call, fails a pending payment) and send the kind email. */
export async function markProspectNotAFit(prospectId: string, input: z.input<typeof notAFitSchema>): Promise<Result> {
  const g = await requireAdmin()
  if (!g.session) return { error: g.error }
  const id = idSchema.safeParse(prospectId)
  const parsed = notAFitSchema.safeParse(input)
  if (!id.success) return { error: 'Prospect not found.' }
  if (!parsed.success) return { error: 'The note is too long (1,000 characters at most).' }
  const p = await journeyProspect(id.data)
  if (!p || !p.journeyToken) return { error: 'Prospect not found.' }
  if (!canMarkNotAFit(p.status)) return { error: 'This person can no longer be marked not a fit.' }

  const ok = await prisma.$transaction(async (tx) => {
    const done = await markNotAFit(tx, p.id, g.session.user.id, parsed.data.note || null)
    if (done) {
      await tx.auditLog.create({ data: { userId: g.session.user.id, action: 'MARK_NOT_A_FIT', entityType: 'Prospect', entityId: p.id, details: JSON.stringify({ from: p.status, note: parsed.data.note || null }) } })
    }
    return done
  })
  if (!ok) return { error: 'This person can no longer be marked not a fit.' }
  await afterNotAFitEmails(p)
  refresh(p.id)
  return { success: true, message: 'Marked not a fit. The kind email has been sent.' }
}

const noteSchema = z.object({ body: z.string().trim().min(1, 'Write a note first.').max(4000, 'Notes can be 4,000 characters at most.') })

/** An admins-only note on the record. */
export async function addProspectNote(prospectId: string, input: z.input<typeof noteSchema>): Promise<Result> {
  const g = await requireAdmin()
  if (!g.session) return { error: g.error }
  const id = idSchema.safeParse(prospectId)
  const parsed = noteSchema.safeParse(input)
  if (!id.success) return { error: 'Prospect not found.' }
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the note.' }
  const exists = await prisma.prospect.findUnique({ where: { id: id.data }, select: { id: true } })
  if (!exists) return { error: 'Prospect not found.' }
  await prisma.prospectNote.create({ data: { prospectId: id.data, authorId: g.session.user.id, body: parsed.data.body } })
  refresh(id.data)
  return { success: true, message: 'Note saved.' }
}

const assignCoachSchema = z.object({ coachProfileId: z.string().min(1).max(64) })

/**
 * An ambassador's login needs a coach. When the inviter has none, the journey stops after the terms
 * and admins are notified; this picks the coach and creates the login (same emails as the Join page).
 */
export async function assignCoachAndCreateLogin(prospectId: string, input: z.input<typeof assignCoachSchema>): Promise<Result> {
  const g = await requireAdmin()
  if (!g.session) return { error: g.error }
  const id = idSchema.safeParse(prospectId)
  const parsed = assignCoachSchema.safeParse(input)
  if (!id.success || !parsed.success) return { error: 'Choose a coach.' }
  const coach = await prisma.coachProfile.findUnique({ where: { id: parsed.data.coachProfileId }, select: { id: true, firstName: true, lastName: true, user: { select: { status: true } } } })
  if (!coach || coach.user.status !== 'ACTIVE') return { error: 'That coach was not found or is not active.' }
  const p = await prisma.prospect.findUnique({ where: { id: id.data }, select: { id: true, journeyRole: true, userId: true, roleTermsAcceptedAt: true } })
  if (!p || (p.journeyRole !== 'AMBASSADOR' && p.journeyRole !== 'YOUTH_AMBASSADOR')) return { error: 'Only ambassadors need a coach to finish.' }
  if (p.userId) return { error: 'Their login already exists.' }
  if (!p.roleTermsAcceptedAt) return { error: 'They have not accepted the terms yet.' }
  const r = await completeJourney(p.id, { byUserId: g.session.user.id, coachProfileId: coach.id })
  if (!r.ok) return { error: r.error }
  await prisma.auditLog.create({ data: { userId: g.session.user.id, action: 'ASSIGN_COACH_CREATE_LOGIN', entityType: 'Prospect', entityId: p.id, details: JSON.stringify({ coachProfileId: coach.id }) } })
  refresh(p.id)
  return { success: true, message: `Login created and placed with ${coach.firstName} ${coach.lastName}. We emailed them a link to set their password.` }
}
