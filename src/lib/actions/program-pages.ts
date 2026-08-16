'use server'

import crypto from 'crypto'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { isFeatureEnabled } from '@/lib/actions/feature-config'
import {
  CORE_QUESTIONS,
  MAX_EXTRA_QUESTIONS,
  MAX_TEXT_LONG_LENGTH,
  PROGRAM_QUESTION_TYPES,
  slugifyProgramName,
  type ProgramAnswer,
  type ProgramQuestion,
} from '@/lib/program-question-types'

// ============================================
// Schemas
// ============================================

const likertSchema = z.object({
  min: z.number().int(),
  max: z.number().int(),
  minLabel: z.string().min(1).max(60),
  maxLabel: z.string().min(1).max(60),
})

const questionSchema = z
  .object({
    id: z.string().min(1).max(64),
    type: z.enum(PROGRAM_QUESTION_TYPES),
    label: z.string().min(1).max(300),
    required: z.boolean(),
    options: z.array(z.string().min(1).max(200)).optional(),
    likert: likertSchema.optional(),
  })
  .superRefine((q, ctx) => {
    if (q.type === 'DROPDOWN' || q.type === 'RADIO') {
      if (!q.options || q.options.length < 2) {
        ctx.addIssue({ code: 'custom', message: `"${q.label}" needs at least 2 options` })
      }
    }
    if (q.type === 'LIKERT') {
      if (!q.likert) {
        ctx.addIssue({ code: 'custom', message: `"${q.label}" needs a rating scale` })
      } else if (q.likert.min >= q.likert.max) {
        ctx.addIssue({ code: 'custom', message: `"${q.label}" scale minimum must be below the maximum` })
      }
    }
  })

const questionsSchema = z.array(questionSchema).max(MAX_EXTRA_QUESTIONS)

const programContentSchema = z.object({
  name: z.string().min(1).max(150),
  organization: z.string().min(1).max(150),
  targetMarket: z.string().max(300),
  internshipOffering: z.string().max(300),
  servicesDescription: z.string().max(4000),
  weeklyEngagement1: z.string().max(200),
  weeklyEngagement2: z.string().max(200),
  monthlyGrowthGoal: z.string().max(200),
  monthlyImpactGoal: z.string().max(200),
  headline: z.string().max(200).nullable().optional(),
  coachBio: z.string().max(4000).nullable().optional(),
  programDescription: z.string().max(8000).nullable().optional(),
  eventDatesText: z.string().max(2000).nullable().optional(),
  zoomUrl: z.string().url().max(500).nullable().optional().or(z.literal('')),
  zoomInstructions: z.string().max(2000).nullable().optional(),
  qualificationIntro: z.string().max(2000).nullable().optional(),
})

const registerSchema = z.object({
  fullName: z.string().min(1, 'Please enter your full name').max(150),
  email: z.string().email('Please enter a valid email address').max(200),
  profession: z.string().min(1, 'Please enter your profession').max(150),
})

const createProgramSchema = z.object({
  name: z.string().min(1, 'Program name is required').max(150),
  organization: z.string().min(1, 'Organization is required').max(150),
  targetMarket: z.string().max(300).optional(),
  internshipOffering: z.string().max(300).optional(),
  servicesDescription: z.string().max(4000).optional(),
  weeklyEngagement1: z.string().max(200).optional(),
  weeklyEngagement2: z.string().max(200).optional(),
  monthlyGrowthGoal: z.string().max(200).optional(),
  monthlyImpactGoal: z.string().max(200).optional(),
})

// Fields copied into publishedSnapshot on approval. The public page reads
// only this snapshot, never the live columns.
const SNAPSHOT_FIELDS = [
  'name',
  'organization',
  'targetMarket',
  'internshipOffering',
  'servicesDescription',
  'weeklyEngagement1',
  'weeklyEngagement2',
  'monthlyGrowthGoal',
  'monthlyImpactGoal',
  'headline',
  'coachBio',
  'programDescription',
  'eventDatesText',
  'zoomUrl',
  'zoomInstructions',
  'qualificationIntro',
  'extraQuestions',
] as const

type ProgramRecord = Record<string, unknown>

function buildSnapshot(program: ProgramRecord) {
  const snapshot: ProgramRecord = {}
  for (const field of SNAPSHOT_FIELDS) snapshot[field] = program[field] ?? null
  snapshot.snapshotAt = new Date().toISOString()
  return snapshot
}

// ============================================
// Coach helpers
// ============================================

// Guards return an `ok` discriminant rather than relying on `'error' in x`
// narrowing - a union whose members differ only by an optional property does
// not narrow reliably and leaks into every caller's return type.

async function requireCoach() {
  const session = await auth()
  if (!session || session.user.role !== 'COACH') {
    return { ok: false as const, error: 'Unauthorized' }
  }
  // An impersonating admin may look, but must not author or publish content
  // in a coach's name - coach-side actions write no audit trail.
  if (session.user.isImpersonating) {
    return { ok: false as const, error: 'Not available while impersonating another user' }
  }
  const enabled = await isFeatureEnabled('PROGRAM_PAGES', 'COACH', session.user.id)
  if (!enabled) {
    return { ok: false as const, error: 'This feature is not enabled for your account' }
  }
  const coachProfile = await prisma.coachProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, firstName: true, lastName: true },
  })
  if (!coachProfile) {
    return { ok: false as const, error: 'Coach profile not found' }
  }
  return { ok: true as const, session, coachProfile }
}

async function requireProgramOwner(programId: string) {
  const ctx = await requireCoach()
  if (!ctx.ok) return { ok: false as const, error: ctx.error }

  const program = await prisma.coachProgram.findUnique({ where: { id: programId } })
  if (!program || program.coachId !== ctx.coachProfile.id) {
    // Same message whether it does not exist or belongs to someone else.
    return { ok: false as const, error: 'Program not found' }
  }
  return { ok: true as const, session: ctx.session, coachProfile: ctx.coachProfile, program }
}

async function requireAdmin() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { ok: false as const, error: 'Unauthorized' }
  }
  if (session.user.isImpersonating) {
    return { ok: false as const, error: 'Not available while impersonating another user' }
  }
  return { ok: true as const, session }
}

async function audit(userId: string, action: string, entityId: string, details: unknown) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType: 'CoachProgram',
        entityId,
        details: JSON.stringify(details),
      },
    })
  } catch (error) {
    console.error('Audit log failed:', error)
  }
}

// ============================================
// Coach actions
// ============================================

export async function getMyPrograms() {
  const ctx = await requireCoach()
  if (!ctx.ok) return { error: ctx.error }

  const programs = await prisma.coachProgram.findMany({
    where: { coachId: ctx.coachProfile.id },
    orderBy: { name: 'asc' },
    include: { _count: { select: { leads: true } } },
  })

  return {
    programs: programs.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      organization: p.organization,
      status: p.status,
      reviewNotes: p.reviewNotes,
      isLive: p.status === 'PUBLISHED' && p.publishedSnapshot !== null,
      leadCount: p._count.leads,
      updatedAt: p.updatedAt.toISOString(),
    })),
  }
}

export async function getMyProgram(programId: string) {
  const ctx = await requireProgramOwner(programId)
  if (!ctx.ok) return { error: ctx.error }

  const p = ctx.program
  return {
    program: {
      id: p.id,
      slug: p.slug,
      name: p.name,
      organization: p.organization,
      targetMarket: p.targetMarket,
      internshipOffering: p.internshipOffering,
      servicesDescription: p.servicesDescription,
      weeklyEngagement1: p.weeklyEngagement1,
      weeklyEngagement2: p.weeklyEngagement2,
      monthlyGrowthGoal: p.monthlyGrowthGoal,
      monthlyImpactGoal: p.monthlyImpactGoal,
      headline: p.headline,
      coachBio: p.coachBio,
      programDescription: p.programDescription,
      eventDatesText: p.eventDatesText,
      zoomUrl: p.zoomUrl,
      zoomInstructions: p.zoomInstructions,
      qualificationIntro: p.qualificationIntro,
      extraQuestions: (p.extraQuestions as unknown as ProgramQuestion[]) ?? [],
      status: p.status,
      reviewNotes: p.reviewNotes,
      hasLiveVersion: p.publishedSnapshot !== null,
      submittedAt: p.submittedAt?.toISOString() ?? null,
      reviewedAt: p.reviewedAt?.toISOString() ?? null,
    },
  }
}

export async function updateProgram(programId: string, data: unknown) {
  const ctx = await requireProgramOwner(programId)
  if (!ctx.ok) return { error: ctx.error }

  const parsed = programContentSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { zoomUrl, ...rest } = parsed.data
  await prisma.coachProgram.update({
    where: { id: programId },
    data: { ...rest, zoomUrl: zoomUrl === '' ? null : zoomUrl },
  })

  revalidatePath(`/coach/programs/${programId}`)
  revalidatePath('/coach/programs')
  return { success: true }
}

export async function saveExtraQuestions(programId: string, questions: unknown) {
  const ctx = await requireProgramOwner(programId)
  if (!ctx.ok) return { error: ctx.error }

  const parsed = questionsSchema.safeParse(questions)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid questions' }
  }

  const ids = new Set<string>()
  for (const q of parsed.data) {
    if (q.id.startsWith('core_')) {
      return { error: 'Question ids beginning with "core_" are reserved' }
    }
    if (ids.has(q.id)) return { error: 'Duplicate question id' }
    ids.add(q.id)
  }

  await prisma.coachProgram.update({
    where: { id: programId },
    data: { extraQuestions: parsed.data as unknown as object },
  })

  revalidatePath(`/coach/programs/${programId}`)
  return { success: true }
}

export async function submitProgramForReview(programId: string) {
  const ctx = await requireProgramOwner(programId)
  if (!ctx.ok) return { error: ctx.error }
  const p = ctx.program

  if (p.status === 'PENDING_REVIEW') {
    return { error: 'This program is already awaiting review' }
  }

  const missing: string[] = []
  if (!p.programDescription?.trim()) missing.push('program description')
  if (!p.coachBio?.trim()) missing.push('about the coach')
  if (!p.zoomUrl?.trim()) missing.push('Zoom link')
  if (!p.eventDatesText?.trim()) missing.push('at least one event date')
  if (missing.length > 0) {
    return { error: `Please fill in ${missing.join(', ')} before submitting` }
  }

  await prisma.coachProgram.update({
    where: { id: programId },
    data: { status: 'PENDING_REVIEW', submittedAt: new Date(), reviewNotes: null },
  })

  revalidatePath(`/coach/programs/${programId}`)
  revalidatePath('/coach/programs')
  revalidatePath('/admin/programs')
  return { success: true }
}

export async function unpublishProgram(programId: string) {
  const ctx = await requireProgramOwner(programId)
  if (!ctx.ok) return { error: ctx.error }

  // Prisma.DbNull writes a real SQL NULL (a bare `null` would store the JSON
  // value `null`). One statement, so status and snapshot cannot diverge.
  await prisma.coachProgram.update({
    where: { id: programId },
    data: { status: 'DRAFT', publishedSnapshot: Prisma.DbNull },
  })

  revalidatePath(`/coach/programs/${programId}`)
  revalidatePath(`/p/${ctx.program.slug}`)
  revalidatePath('/coach/programs')
  return { success: true }
}


const ASSOCIATION_VALUES = [
  'UNCLASSIFIED',
  'AMBASSADOR',
  'COACH',
  'SERVICE_PROVIDER',
  'BUSINESS_AFFILIATE',
  'VOLUNTEER',
] as const

export async function setLeadAssociation(leadId: string, association: string) {
  const ctx = await requireCoach()
  if (!ctx.ok) return { error: ctx.error }

  const parsed = z.enum(ASSOCIATION_VALUES).safeParse(association)
  if (!parsed.success) return { error: 'Invalid association type' }

  const lead = await prisma.programLead.findUnique({
    where: { id: leadId },
    select: { id: true, program: { select: { coachId: true } } },
  })
  if (!lead || lead.program.coachId !== ctx.coachProfile.id) {
    return { error: 'Lead not found' }
  }

  await prisma.programLead.update({
    where: { id: leadId },
    data: { association: parsed.data, classifiedAt: new Date() },
  })

  revalidatePath('/coach/business-excellence')
  return { success: true }
}


// ============================================
// Admin actions
// ============================================

export async function getAllPrograms() {
  const ctx = await requireAdmin()
  if (!ctx.ok) return { error: ctx.error }

  const [programs, coaches] = await Promise.all([
    prisma.coachProgram.findMany({
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      include: {
        coach: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { leads: true } },
      },
    }),
    prisma.coachProfile.findMany({
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: { id: true, firstName: true, lastName: true },
    }),
  ])

  return {
    programs: programs.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      organization: p.organization,
      status: p.status,
      coachId: p.coachId,
      coachName: p.coach ? `${p.coach.firstName} ${p.coach.lastName}` : null,
      isLive: p.status === 'PUBLISHED' && p.publishedSnapshot !== null,
      leadCount: p._count.leads,
      submittedAt: p.submittedAt?.toISOString() ?? null,
      reviewNotes: p.reviewNotes,
      programDescription: p.programDescription,
      coachBio: p.coachBio,
      eventDatesText: p.eventDatesText,
      zoomUrl: p.zoomUrl,
      extraQuestionCount: ((p.extraQuestions as unknown as ProgramQuestion[]) ?? []).length,
    })),
    coaches: coaches.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` })),
  }
}

export async function createProgram(data: unknown) {
  const ctx = await requireAdmin()
  if (!ctx.ok) return { error: ctx.error }

  const parsed = createProgramSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const base = slugifyProgramName(parsed.data.name)
  if (!base) return { error: 'Program name must contain letters or numbers' }

  // Find a free slug: base, base-2, base-3 ...
  let slug = base
  for (let n = 2; n < 100; n++) {
    const taken = await prisma.coachProgram.findUnique({ where: { slug }, select: { id: true } })
    if (!taken) break
    slug = `${base}-${n}`
  }

  const program = await prisma.coachProgram.create({
    data: {
      slug,
      name: parsed.data.name,
      organization: parsed.data.organization,
      targetMarket: parsed.data.targetMarket ?? '',
      internshipOffering: parsed.data.internshipOffering ?? '',
      servicesDescription: parsed.data.servicesDescription ?? '',
      weeklyEngagement1: parsed.data.weeklyEngagement1 ?? '',
      weeklyEngagement2: parsed.data.weeklyEngagement2 ?? '',
      monthlyGrowthGoal: parsed.data.monthlyGrowthGoal ?? '',
      monthlyImpactGoal: parsed.data.monthlyImpactGoal ?? '',
    },
  })

  await audit(ctx.session.user.id, 'CREATE_PROGRAM', program.id, { slug, name: parsed.data.name })
  revalidatePath('/admin/programs')
  return { success: true, programId: program.id, slug }
}

export async function assignProgramToCoach(programId: string, coachId: string | null) {
  const ctx = await requireAdmin()
  if (!ctx.ok) return { error: ctx.error }

  const program = await prisma.coachProgram.findUnique({
    where: { id: programId },
    select: { id: true },
  })
  if (!program) return { error: 'Program not found' }

  if (coachId) {
    const coach = await prisma.coachProfile.findUnique({ where: { id: coachId }, select: { id: true } })
    if (!coach) return { error: 'Coach not found' }
  }

  await prisma.coachProgram.update({
    where: { id: programId },
    data: {
      coachId,
      assignedAt: coachId ? new Date() : null,
      assignedBy: coachId ? ctx.session.user.id : null,
    },
  })

  await audit(ctx.session.user.id, coachId ? 'ASSIGN_PROGRAM' : 'UNASSIGN_PROGRAM', programId, { coachId })
  revalidatePath('/admin/programs')
  revalidatePath('/coach/programs')
  return { success: true }
}

export async function approveProgram(programId: string) {
  const ctx = await requireAdmin()
  if (!ctx.ok) return { error: ctx.error }

  const program = await prisma.coachProgram.findUnique({ where: { id: programId } })
  if (!program) return { error: 'Program not found' }
  if (!program.coachId) return { error: 'Assign a coach before publishing' }

  await prisma.coachProgram.update({
    where: { id: programId },
    data: {
      status: 'PUBLISHED',
      publishedSnapshot: buildSnapshot(program as unknown as ProgramRecord) as object,
      reviewedAt: new Date(),
      reviewedBy: ctx.session.user.id,
      reviewNotes: null,
    },
  })

  await audit(ctx.session.user.id, 'APPROVE_PROGRAM', programId, { slug: program.slug })
  revalidatePath('/admin/programs')
  revalidatePath('/coach/programs')
  revalidatePath(`/p/${program.slug}`)
  return { success: true }
}

export async function rejectProgram(programId: string, reason: string) {
  const ctx = await requireAdmin()
  if (!ctx.ok) return { error: ctx.error }

  const trimmed = (reason ?? '').trim()
  if (!trimmed) return { error: 'Please give the coach a reason' }

  const program = await prisma.coachProgram.findUnique({
    where: { id: programId },
    select: { id: true, slug: true },
  })
  if (!program) return { error: 'Program not found' }

  await prisma.coachProgram.update({
    where: { id: programId },
    data: {
      status: 'REJECTED',
      reviewedAt: new Date(),
      reviewedBy: ctx.session.user.id,
      reviewNotes: trimmed.slice(0, 4000),
    },
  })

  await audit(ctx.session.user.id, 'REJECT_PROGRAM', programId, { reason: trimmed })
  revalidatePath('/admin/programs')
  revalidatePath('/coach/programs')
  return { success: true }
}

export async function adminUnpublishProgram(programId: string, reason: string) {
  const ctx = await requireAdmin()
  if (!ctx.ok) return { error: ctx.error }

  const trimmed = (reason ?? '').trim()
  if (!trimmed) return { error: 'Please give a reason for taking this page down' }

  const program = await prisma.coachProgram.findUnique({
    where: { id: programId },
    select: { id: true, slug: true },
  })
  if (!program) return { error: 'Program not found' }

  await prisma.coachProgram.update({
    where: { id: programId },
    data: {
      status: 'REJECTED',
      publishedSnapshot: Prisma.DbNull,
      reviewedAt: new Date(),
      reviewedBy: ctx.session.user.id,
      reviewNotes: trimmed.slice(0, 4000),
    },
  })

  await audit(ctx.session.user.id, 'UNPUBLISH_PROGRAM', programId, { reason: trimmed })
  revalidatePath('/admin/programs')
  revalidatePath(`/p/${program.slug}`)
  return { success: true }
}

export async function deleteProgram(programId: string) {
  const ctx = await requireAdmin()
  if (!ctx.ok) return { error: ctx.error }

  const program = await prisma.coachProgram.findUnique({
    where: { id: programId },
    select: { id: true, slug: true, name: true, _count: { select: { leads: true } } },
  })
  if (!program) return { error: 'Program not found' }

  await prisma.coachProgram.delete({ where: { id: programId } })

  await audit(ctx.session.user.id, 'DELETE_PROGRAM', programId, {
    slug: program.slug,
    name: program.name,
    deletedLeads: program._count.leads,
  })
  revalidatePath('/admin/programs')
  return { success: true }
}

// ============================================
// Public actions - NO auth() by design.
// Authorization is possession of a published slug or an unguessable token,
// matching getProspectByToken / submitBusinessForm / createPublicBooking.
// ============================================

type PublicSnapshot = Record<string, unknown>

async function loadPublishedProgram(slug: string) {
  if (!slug || slug.length > 80) return null
  const program = await prisma.coachProgram.findUnique({ where: { slug } })
  if (!program) return null
  if (program.status !== 'PUBLISHED' || !program.coachId || !program.publishedSnapshot) return null
  return program
}

export async function getPublicProgram(slug: string) {
  const program = await loadPublishedProgram(slug)
  if (!program) return { error: 'Program not found' }

  const snap = program.publishedSnapshot as PublicSnapshot
  return {
    program: {
      slug: program.slug,
      name: (snap.name as string) ?? '',
      organization: (snap.organization as string) ?? '',
      headline: (snap.headline as string) ?? null,
      coachBio: (snap.coachBio as string) ?? null,
      programDescription: (snap.programDescription as string) ?? null,
      targetMarket: (snap.targetMarket as string) ?? '',
      servicesDescription: (snap.servicesDescription as string) ?? '',
      eventDatesText: (snap.eventDatesText as string) ?? null,
    },
  }
}

/**
 * Renders the landing page from the LIVE columns instead of the approved
 * snapshot, so the owning coach can see their unpublished changes and an
 * admin can look at a submission before approving it.
 *
 * This is the one place that exposes live content, so it is fully
 * authenticated: only the owning coach or an admin, never the public.
 */
export async function getProgramPreview(slug: string) {
  const session = await auth()
  if (!session) return { error: 'Unauthorized' }

  const program = await prisma.coachProgram.findUnique({
    where: { slug },
    include: { coach: { select: { userId: true } } },
  })
  if (!program) return { error: 'Program not found' }

  const isAdmin = session.user.role === 'ADMIN'
  const isOwner =
    session.user.role === 'COACH' && program.coach?.userId === session.user.id
  if (!isAdmin && !isOwner) {
    return { error: 'Program not found' }
  }

  return {
    preview: true as const,
    status: program.status,
    program: {
      slug: program.slug,
      name: program.name,
      organization: program.organization,
      headline: program.headline,
      coachBio: program.coachBio,
      programDescription: program.programDescription,
      targetMarket: program.targetMarket,
      servicesDescription: program.servicesDescription,
      eventDatesText: program.eventDatesText,
    },
  }
}

export async function registerInterest(slug: string, data: unknown, honeypot?: string) {
  const program = await loadPublishedProgram(slug)
  if (!program) return { error: 'Program not found' }

  // Honeypot first, before validation: a bot that fills this field AND sends a
  // malformed email must not be able to tell the two rejections apart.
  // A real browser leaves this hidden field empty.
  if (honeypot && honeypot.trim() !== '') {
    return { success: true, alreadyRegistered: true as const }
  }

  const parsed = registerSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const email = parsed.data.email.trim().toLowerCase()

  const existing = await prisma.programLead.findUnique({
    where: { programId_email: { programId: program.id, email } },
    select: { id: true },
  })
  if (existing) {
    // Deliberately does NOT return the existing token. Doing so would mean
    // anyone who knows a registrant's email address could retrieve their
    // private link, read the Zoom details, and submit forged qualification
    // answers in their name.
    return { success: true, alreadyRegistered: true as const }
  }

  const token = `pl_${crypto.randomBytes(24).toString('hex')}`
  try {
    await prisma.programLead.create({
      data: {
        programId: program.id,
        fullName: parsed.data.fullName.trim(),
        email,
        profession: parsed.data.profession.trim(),
        token,
      },
    })
  } catch (error) {
    // Two submissions racing (double-click, two tabs) both pass the check
    // above; the loser hits the @@unique([programId, email]) constraint.
    // Treat it as the already-registered case rather than a 500 on the one
    // conversion step in the funnel.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return { success: true, alreadyRegistered: true as const }
    }
    throw error
  }

  // Feed Business Excellence. Never let a logging failure fail the signup.
  if (program.coachId) {
    try {
      await prisma.outreachActivityLog.create({
        data: {
          coachId: program.coachId,
          date: new Date(),
          category: 'NEW_CONTACTS',
          quantity: 1,
          notes: `Program page signup: ${parsed.data.fullName.trim()} (${program.name})`,
        },
      })
    } catch (error) {
      console.error('Outreach log failed for program signup:', error)
    }
  }

  revalidatePath('/coach/business-excellence')
  return { success: true, token }
}

export async function getLeadQualificationData(slug: string, token: string) {
  if (!token || token.length < 10 || token.length > 120) return { error: 'Invalid link' }

  const lead = await prisma.programLead.findUnique({
    where: { token },
    include: { program: true },
  })
  if (!lead) return { error: 'Invalid link' }
  if (lead.program.slug !== slug) return { error: 'Invalid link' }
  // Same gate as loadPublishedProgram, including coachId: an unassigned
  // program must not keep serving its Zoom link here after /p/[slug] 404s.
  if (
    lead.program.status !== 'PUBLISHED' ||
    !lead.program.publishedSnapshot ||
    !lead.program.coachId
  ) {
    return { error: 'Invalid link' }
  }

  const snap = lead.program.publishedSnapshot as PublicSnapshot
  const extras = (snap.extraQuestions as unknown as ProgramQuestion[]) ?? []

  return {
    data: {
      programName: (snap.name as string) ?? '',
      zoomUrl: (snap.zoomUrl as string) ?? null,
      zoomInstructions: (snap.zoomInstructions as string) ?? null,
      eventDatesText: (snap.eventDatesText as string) ?? null,
      qualificationIntro: (snap.qualificationIntro as string) ?? null,
      questions: [...CORE_QUESTIONS, ...extras],
      leadName: lead.fullName,
      alreadySubmitted: lead.qualifiedAt !== null,
    },
  }
}

export async function submitQualification(token: string, answers: unknown) {
  if (!token || token.length < 10 || token.length > 120) return { error: 'Invalid link' }

  const lead = await prisma.programLead.findUnique({
    where: { token },
    include: { program: true },
  })
  if (!lead) return { error: 'Invalid link' }
  if (lead.program.status !== 'PUBLISHED' || !lead.program.publishedSnapshot) {
    return { error: 'Invalid link' }
  }
  if (lead.qualifiedAt) return { error: 'You have already completed this form' }

  const snap = lead.program.publishedSnapshot as PublicSnapshot
  const extras = (snap.extraQuestions as unknown as ProgramQuestion[]) ?? []
  const questions = [...CORE_QUESTIONS, ...extras]

  const rawAnswers = z
    .array(z.object({ questionId: z.string(), value: z.union([z.string(), z.number()]) }))
    .safeParse(answers)
  if (!rawAnswers.success) return { error: 'Invalid answers' }

  const byId = new Map(rawAnswers.data.map((a) => [a.questionId, a.value]))
  const stored: ProgramAnswer[] = []

  for (const q of questions) {
    const raw = byId.get(q.id)
    const isBlank = raw === undefined || (typeof raw === 'string' && raw.trim() === '')

    if (isBlank) {
      if (q.required) return { error: `Please answer: ${q.label}` }
      continue
    }

    if (q.type === 'LIKERT') {
      const num = typeof raw === 'number' ? raw : Number(raw)
      const cfg = q.likert
      if (!cfg || !Number.isInteger(num) || num < cfg.min || num > cfg.max) {
        return { error: `Invalid rating for: ${q.label}` }
      }
      stored.push({ questionId: q.id, label: q.label, type: q.type, value: num })
      continue
    }

    const text = String(raw)

    if (q.type === 'DROPDOWN' || q.type === 'RADIO') {
      if (!q.options?.includes(text)) {
        return { error: `Invalid selection for: ${q.label}` }
      }
      stored.push({ questionId: q.id, label: q.label, type: q.type, value: text })
      continue
    }

    // TEXT_LONG
    if (text.length > MAX_TEXT_LONG_LENGTH) {
      return { error: `Answer too long for: ${q.label}` }
    }
    stored.push({ questionId: q.id, label: q.label, type: q.type, value: text })
  }

  // Any answer whose questionId is not in the current question set is dropped
  // rather than stored, so a crafted payload cannot inject arbitrary content.
  await prisma.programLead.update({
    where: { id: lead.id },
    data: { answers: stored as unknown as object, qualifiedAt: new Date() },
  })

  revalidatePath('/coach/business-excellence')
  return { success: true }
}
