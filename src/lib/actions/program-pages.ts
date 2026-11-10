'use server'

import crypto from 'crypto'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { isFeatureEnabled } from '@/lib/actions/feature-config'
import {
  AGE_BAND_LABELS,
  CHILD_AGE_BANDS,
  FAMILY_QUESTIONS,
  FAMILY_STAGES,
  MAX_CHILDREN,
  MAX_EXTRA_QUESTIONS,
  MAX_TEXT_LONG_LENGTH,
  PROGRAM_AUDIENCES,
  PROGRAM_QUESTION_TYPES,
  RESERVED_QUESTION_PREFIXES,
  audienceIncludesChildren,
  slugifyProgramName,
  type ProgramAnswer,
  type ProgramChild,
  type ProgramQuestion,
} from '@/lib/program-question-types'
import { toVideoEmbedUrl } from '@/lib/video-embed'
import {
  decodeOwnerChoice,
  hasProgramOwner,
  isProgramOwnedBy,
  ownerAssignment,
  ownerTerm,
  ownerWhere,
  programOwnerRole,
  programsBasePath,
  type ProgramOwnerColumns,
  type ProgramOwnerIdentity,
} from '@/lib/program-owner'
import { flattenProgramLeads } from '@/lib/program-leads'

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

// A video link must be one the public page can actually embed, so a coach
// finds out at save time rather than an applicant finding a blank player.
const videoUrlSchema = z
  .string()
  .max(500)
  .refine((v) => v === '' || toVideoEmbedUrl(v) !== null, {
    message: 'Video links must be a YouTube, Vimeo or Loom link',
  })
  .nullable()
  .optional()

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
  pageTitle: z.string().max(150).nullable().optional(),
  headline: z.string().max(200).nullable().optional(),
  coachBio: z.string().max(4000).nullable().optional(),
  programDescription: z.string().max(8000).nullable().optional(),
  eventDatesText: z.string().max(2000).nullable().optional(),
  zoomUrl: z.string().url().max(500).nullable().optional().or(z.literal('')),
  zoomLabel: z.string().max(60).nullable().optional(),
  secondMeetingUrl: z.string().url().max(500).nullable().optional().or(z.literal('')),
  secondMeetingLabel: z.string().max(60).nullable().optional(),
  zoomInstructions: z.string().max(2000).nullable().optional(),
  qualificationIntro: z.string().max(2000).nullable().optional(),
  showMeetingDetails: z.boolean().optional(),
  coachVideoUrl: videoUrlSchema,
  ntVideoUrl: videoUrlSchema,
  ntVideoIntro: z.string().max(2000).nullable().optional(),
})

const ntVideoSchema = z.object({
  ntVideoUrl: videoUrlSchema,
  ntVideoIntro: z.string().max(2000).nullable().optional(),
})

const childSchema = z.object({
  firstName: z.string().trim().min(1, "Please enter each child's first name").max(60),
  ageBand: z.enum(CHILD_AGE_BANDS, {
    message: "Please choose each child's age",
  }),
})

const registerSchema = z
  .object({
    fullName: z.string().min(1, 'Please enter your full name').max(150),
    email: z.string().email('Please enter a valid email address').max(200),
    profession: z.string().min(1, 'Please enter your profession').max(150),
    audience: z.enum(PROGRAM_AUDIENCES, {
      message: 'Please tell us who this is for',
    }),
    children: z.array(childSchema).max(MAX_CHILDREN).optional(),
    guardianConfirmed: z.boolean().optional(),
    phone: z.string().trim().max(40).optional(),
  })
  .superRefine((d, ctx) => {
    if (!audienceIncludesChildren(d.audience)) return
    if (!d.children || d.children.length === 0) {
      ctx.addIssue({ code: 'custom', message: 'Please add at least one child' })
    }
    if (!d.guardianConfirmed) {
      ctx.addIssue({
        code: 'custom',
        message: 'Please confirm you are the parent or legal guardian',
      })
    }
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
  'pageTitle',
  'headline',
  'coachBio',
  'programDescription',
  'eventDatesText',
  'zoomUrl',
  'zoomLabel',
  'secondMeetingUrl',
  'secondMeetingLabel',
  'zoomInstructions',
  'qualificationIntro',
  'extraQuestions',
  'showMeetingDetails',
  'coachVideoUrl',
  'ntVideoUrl',
  'ntVideoIntro',
] as const

type ProgramRecord = Record<string, unknown>

function buildSnapshot(program: ProgramRecord) {
  const snapshot: ProgramRecord = {}
  for (const field of SNAPSHOT_FIELDS) snapshot[field] = program[field] ?? null
  snapshot.snapshotAt = new Date().toISOString()
  return snapshot
}

// ============================================
// Owner helpers (coach or ambassador)
// ============================================

// Guards return an `ok` discriminant rather than relying on `'error' in x`
// narrowing - a union whose members differ only by an optional property does
// not narrow reliably and leaks into every caller's return type.

/**
 * An impersonating admin may look but not touch: they can read a coach's pages
 * to see exactly what the coach sees, but must not author or publish content in
 * the coach's name, because coach-side actions write no audit trail.
 *
 * Reads pass `allowImpersonation: true`; every write leaves it off.
 *
 * A program owner is a COACH (matched on their CoachProfile id) or an
 * AMBASSADOR (matched on their Ambassador id), with Program Pages enabled for
 * them by role default or a per-user grant from /admin/users.
 */
async function requireProgramUser({ allowImpersonation = false } = {}) {
  const session = await auth()
  const role = session?.user.role
  if (!session || (role !== 'COACH' && role !== 'AMBASSADOR')) {
    return { ok: false as const, error: 'Unauthorized' }
  }
  if (session.user.isImpersonating && !allowImpersonation) {
    return { ok: false as const, error: 'Not available while impersonating another user' }
  }
  const enabled = await isFeatureEnabled('PROGRAM_PAGES', role, session.user.id)
  if (!enabled) {
    return { ok: false as const, error: 'This feature is not enabled for your account' }
  }

  let owner: ProgramOwnerIdentity
  if (role === 'COACH') {
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    })
    if (!coachProfile) return { ok: false as const, error: 'Coach profile not found' }
    owner = { role: 'COACH', coachId: coachProfile.id }
  } else {
    const ambassador = await prisma.ambassador.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    })
    if (!ambassador) return { ok: false as const, error: 'Ambassador profile not found' }
    owner = { role: 'AMBASSADOR', ambassadorId: ambassador.id }
  }

  return {
    ok: true as const,
    session,
    owner,
    readOnly: Boolean(session.user.isImpersonating),
  }
}

async function requireProgramOwner(programId: string, opts?: { allowImpersonation?: boolean }) {
  const ctx = await requireProgramUser(opts)
  if (!ctx.ok) return { ok: false as const, error: ctx.error }

  const program = await prisma.coachProgram.findUnique({ where: { id: programId } })
  if (!program || !isProgramOwnedBy(program, ctx.owner)) {
    // Same message whether it does not exist or belongs to someone else.
    return { ok: false as const, error: 'Program not found' }
  }
  return {
    ok: true as const,
    session: ctx.session,
    owner: ctx.owner,
    readOnly: ctx.readOnly,
    program,
  }
}

/** Refresh the owner's list and editor after a change to one program. */
function revalidateOwnerPages(programId: string) {
  for (const base of [programsBasePath('COACH'), programsBasePath('AMBASSADOR')]) {
    revalidatePath(base)
    revalidatePath(`${base}/${programId}`)
  }
}

/** Every page that shows program leads to their owner. */
function revalidateLeadPages() {
  revalidatePath('/coach/business-excellence')
  revalidatePath('/coach/crm')
  revalidatePath(programsBasePath('AMBASSADOR'), 'layout')
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
// Owner actions (coach or ambassador)
// ============================================

export async function getMyPrograms() {
  const ctx = await requireProgramUser({ allowImpersonation: true })
  if (!ctx.ok) return { error: ctx.error }

  const programs = await prisma.coachProgram.findMany({
    where: ownerWhere(ctx.owner),
    orderBy: { name: 'asc' },
    include: { _count: { select: { leads: true } } },
  })

  return {
    readOnly: ctx.readOnly,
    ownerRole: ctx.owner.role,
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
  const ctx = await requireProgramOwner(programId, { allowImpersonation: true })
  if (!ctx.ok) return { error: ctx.error }

  const p = ctx.program
  return {
    readOnly: ctx.readOnly,
    ownerRole: ctx.owner.role,
    // What the lead will actually be asked ahead of the coach's own questions.
    // Empty while an admin has the standard questions switched off, so the
    // editor never promises questions no form will ask.
    standardQuestions: await loadCoreQuestions(),
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
      pageTitle: p.pageTitle,
      headline: p.headline,
      coachBio: p.coachBio,
      programDescription: p.programDescription,
      eventDatesText: p.eventDatesText,
      zoomUrl: p.zoomUrl,
      zoomLabel: p.zoomLabel,
      secondMeetingUrl: p.secondMeetingUrl,
      secondMeetingLabel: p.secondMeetingLabel,
      zoomInstructions: p.zoomInstructions,
      qualificationIntro: p.qualificationIntro,
      showMeetingDetails: p.showMeetingDetails,
      coachVideoUrl: p.coachVideoUrl,
      ntVideoUrl: p.ntVideoUrl,
      ntVideoIntro: p.ntVideoIntro,
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

  // The URL fields accept '' so a coach can clear them in the form; store
  // that as NULL rather than an empty string the public page would render.
  const { zoomUrl, secondMeetingUrl, coachVideoUrl, ntVideoUrl, ...rest } = parsed.data
  await prisma.coachProgram.update({
    where: { id: programId },
    data: {
      ...rest,
      zoomUrl: zoomUrl === '' ? null : zoomUrl,
      secondMeetingUrl: secondMeetingUrl === '' ? null : secondMeetingUrl,
      coachVideoUrl: coachVideoUrl === '' ? null : coachVideoUrl,
      ntVideoUrl: ntVideoUrl === '' ? null : ntVideoUrl,
    },
  })

  revalidateOwnerPages(programId)
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
    if (RESERVED_QUESTION_PREFIXES.some((prefix) => q.id.startsWith(prefix))) {
      return { error: 'That question id is reserved' }
    }
    if (ids.has(q.id)) return { error: 'Duplicate question id' }
    ids.add(q.id)
  }

  await prisma.coachProgram.update({
    where: { id: programId },
    data: { extraQuestions: parsed.data as unknown as object },
  })

  revalidateOwnerPages(programId)
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
  if (!p.coachBio?.trim()) missing.push('about you')
  if (p.showMeetingDetails) {
    if (!p.zoomUrl?.trim()) missing.push('Zoom link')
    if (!p.eventDatesText?.trim()) missing.push('at least one event date')
  } else if (!p.coachVideoUrl?.trim()) {
    // With the meeting switched off, the video is the whole presentation.
    missing.push('your program video (or switch the meeting details back on)')
  }
  if (missing.length > 0) {
    return { error: `Please fill in ${missing.join(', ')} before submitting` }
  }

  await prisma.coachProgram.update({
    where: { id: programId },
    data: { status: 'PENDING_REVIEW', submittedAt: new Date(), reviewNotes: null },
  })

  revalidateOwnerPages(programId)
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

  revalidateOwnerPages(programId)
  revalidatePath(`/p/${ctx.program.slug}`)
  return { success: true }
}

/**
 * The signups for one program, for its owner. Ambassadors have no CRM, so this
 * is where they see their leads; coaches also get them in Business Excellence.
 */
export async function getMyProgramLeads(programId: string) {
  const ctx = await requireProgramOwner(programId, { allowImpersonation: true })
  if (!ctx.ok) return { error: ctx.error }

  const leads = await prisma.programLead.findMany({
    where: { programId },
    orderBy: { registeredAt: 'desc' },
  })
  return {
    leads: flattenProgramLeads([
      { name: ctx.program.name, slug: ctx.program.slug, leads },
    ]),
  }
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
  const ctx = await requireProgramUser()
  if (!ctx.ok) return { error: ctx.error }

  const parsed = z.enum(ASSOCIATION_VALUES).safeParse(association)
  if (!parsed.success) return { error: 'Invalid association type' }

  const lead = await prisma.programLead.findUnique({
    where: { id: leadId },
    select: { id: true, program: { select: { coachId: true, ambassadorId: true } } },
  })
  if (!lead || !isProgramOwnedBy(lead.program, ctx.owner)) {
    return { error: 'Lead not found' }
  }

  await prisma.programLead.update({
    where: { id: leadId },
    data: { association: parsed.data, classifiedAt: new Date() },
  })

  revalidateLeadPages()
  return { success: true }
}

export async function setLeadFamilyStage(leadId: string, stage: string) {
  const ctx = await requireProgramUser()
  if (!ctx.ok) return { error: ctx.error }

  const parsed = z.enum(FAMILY_STAGES).safeParse(stage)
  if (!parsed.success) return { error: 'Invalid follow-up stage' }

  const lead = await prisma.programLead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      audience: true,
      program: { select: { coachId: true, ambassadorId: true } },
    },
  })
  if (!lead || !isProgramOwnedBy(lead.program, ctx.owner)) {
    return { error: 'Lead not found' }
  }
  if (!audienceIncludesChildren(lead.audience)) {
    return { error: 'This lead did not sign up for a child' }
  }

  await prisma.programLead.update({
    where: { id: leadId },
    data: { familyStage: parsed.data },
  })

  revalidateLeadPages()
  return { success: true }
}


// ============================================
// Admin actions
// ============================================

export async function getAllPrograms() {
  const ctx = await requireAdmin()
  if (!ctx.ok) return { error: ctx.error }

  const [programs, coaches, ambassadors] = await Promise.all([
    prisma.coachProgram.findMany({
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      include: {
        coach: { select: { id: true, firstName: true, lastName: true } },
        ambassador: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { leads: true } },
      },
    }),
    prisma.coachProfile.findMany({
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: { id: true, firstName: true, lastName: true },
    }),
    // Only ambassadors with a login can edit a page.
    prisma.ambassador.findMany({
      where: { userId: { not: null } },
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
      ambassadorId: p.ambassadorId,
      ownerRole: programOwnerRole(p),
      ownerName: ownerDisplayName(p),
      isLive: p.status === 'PUBLISHED' && p.publishedSnapshot !== null,
      leadCount: p._count.leads,
      submittedAt: p.submittedAt?.toISOString() ?? null,
      reviewNotes: p.reviewNotes,
      programDescription: p.programDescription,
      coachBio: p.coachBio,
      eventDatesText: p.eventDatesText,
      zoomUrl: p.zoomUrl,
      showMeetingDetails: p.showMeetingDetails,
      coachVideoUrl: p.coachVideoUrl,
      ntVideoUrl: p.ntVideoUrl,
      ntVideoIntro: p.ntVideoIntro,
      extraQuestionCount: ((p.extraQuestions as unknown as ProgramQuestion[]) ?? []).length,
    })),
    coaches: coaches.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` })),
    ambassadors: ambassadors.map((a) => ({ id: a.id, name: `${a.firstName} ${a.lastName}` })),
  }
}

function ownerDisplayName(p: {
  coachId: string | null
  ambassadorId: string | null
  coach: { firstName: string; lastName: string } | null
  ambassador: { firstName: string; lastName: string } | null
}): string | null {
  const role = programOwnerRole(p)
  if (role === 'COACH' && p.coach) return `${p.coach.firstName} ${p.coach.lastName}`
  if (role === 'AMBASSADOR' && p.ambassador) {
    return `${p.ambassador.firstName} ${p.ambassador.lastName}`
  }
  return null
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

/**
 * Assigns a program to a coach or an ambassador, or unassigns it. `owner` is
 * the admin picker's value: `COACH:<coachProfileId>`, `AMBASSADOR:<ambassadorId>`
 * or the unassigned marker. Setting one owner always clears the other.
 */
export async function assignProgramOwner(programId: string, owner: string) {
  const ctx = await requireAdmin()
  if (!ctx.ok) return { error: ctx.error }

  const choice = decodeOwnerChoice(String(owner ?? ''))
  if (choice === undefined) return { error: 'Invalid owner' }

  const program = await prisma.coachProgram.findUnique({
    where: { id: programId },
    select: { id: true, coachId: true, ambassadorId: true },
  })
  if (!program) return { error: 'Program not found' }

  if (choice?.role === 'COACH') {
    const coach = await prisma.coachProfile.findUnique({
      where: { id: choice.id },
      select: { id: true },
    })
    if (!coach) return { error: 'Coach not found' }
  }
  if (choice?.role === 'AMBASSADOR') {
    const ambassador = await prisma.ambassador.findUnique({
      where: { id: choice.id },
      select: { id: true, userId: true },
    })
    if (!ambassador) return { error: 'Ambassador not found' }
    if (!ambassador.userId) return { error: 'This ambassador has no login yet' }
  }

  const columns = ownerAssignment(choice)
  await prisma.coachProgram.update({
    where: { id: programId },
    data: {
      ...columns,
      assignedAt: choice ? new Date() : null,
      assignedBy: choice ? ctx.session.user.id : null,
    },
  })

  await audit(ctx.session.user.id, choice ? 'ASSIGN_PROGRAM' : 'UNASSIGN_PROGRAM', programId, {
    ...columns,
    ownerRole: choice?.role ?? null,
    previous: { coachId: program.coachId, ambassadorId: program.ambassadorId },
  })
  revalidatePath('/admin/programs')
  revalidateOwnerPages(programId)
  return { success: true }
}

export async function approveProgram(programId: string) {
  const ctx = await requireAdmin()
  if (!ctx.ok) return { error: ctx.error }

  const program = await prisma.coachProgram.findUnique({ where: { id: programId } })
  if (!program) return { error: 'Program not found' }
  if (!hasProgramOwner(program)) return { error: 'Assign a coach or ambassador before publishing' }

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
  revalidateOwnerPages(programId)
  revalidatePath(`/p/${program.slug}`)
  return { success: true }
}

/**
 * The NowTransformed / sponsorship video is NT's message, so an admin can set
 * it directly without waiting for the coach to resubmit. An admin edit is
 * already authorized, so on a live page it goes straight into the published
 * snapshot as well as the draft - the coach's own draft edits stay unpublished.
 */
export async function setProgramNtVideo(programId: string, data: unknown) {
  const ctx = await requireAdmin()
  if (!ctx.ok) return { error: ctx.error }

  const parsed = ntVideoSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const program = await prisma.coachProgram.findUnique({
    where: { id: programId },
    select: { id: true, slug: true, publishedSnapshot: true },
  })
  if (!program) return { error: 'Program not found' }

  const ntVideoUrl = parsed.data.ntVideoUrl?.trim() || null
  const ntVideoIntro = parsed.data.ntVideoIntro?.trim() || null
  const snapshot = program.publishedSnapshot as PublicSnapshot | null

  await prisma.coachProgram.update({
    where: { id: programId },
    data: {
      ntVideoUrl,
      ntVideoIntro,
      ...(snapshot
        ? { publishedSnapshot: { ...snapshot, ntVideoUrl, ntVideoIntro } as object }
        : {}),
    },
  })

  await audit(ctx.session.user.id, 'SET_PROGRAM_NT_VIDEO', programId, {
    ntVideoUrl,
    appliedToLivePage: Boolean(snapshot),
  })
  revalidatePath('/admin/programs')
  revalidateOwnerPages(programId)
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
  revalidateOwnerPages(programId)
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
  revalidateOwnerPages(programId)
  revalidatePath(`/p/${program.slug}`)
  return { success: true }
}

// ── Standard questions master switch ────────────────────────────────────────

// One row, one flag. `id` is fixed so concurrent upserts converge on the same
// record instead of racing to create two.
const PROGRAM_SETTINGS_ID = 'global'

/**
 * Whether the shared standard questions are asked at all.
 *
 * Off by default, and a missing settings row reads as off, so a fresh database
 * (or one that has never been touched by an admin) collects only the coach's
 * own questions.
 */
async function standardQuestionsEnabled(): Promise<boolean> {
  const row = await prisma.programQuestionSettings.findUnique({
    where: { id: PROGRAM_SETTINGS_ID },
    select: { standardQuestionsEnabled: true },
  })
  return row?.standardQuestionsEnabled ?? false
}

export async function getProgramQuestionSettings() {
  const ctx = await requireAdmin()
  if (!ctx.ok) return { error: ctx.error }

  return { settings: { standardQuestionsEnabled: await standardQuestionsEnabled() } }
}

export async function setStandardQuestionsEnabled(enabled: unknown) {
  const ctx = await requireAdmin()
  if (!ctx.ok) return { error: ctx.error }

  const parsed = z.boolean().safeParse(enabled)
  if (!parsed.success) return { error: 'Invalid value' }

  await prisma.programQuestionSettings.upsert({
    where: { id: PROGRAM_SETTINGS_ID },
    update: { standardQuestionsEnabled: parsed.data, updatedBy: ctx.session.user.id },
    create: {
      id: PROGRAM_SETTINGS_ID,
      standardQuestionsEnabled: parsed.data,
      updatedBy: ctx.session.user.id,
    },
  })

  await audit(
    ctx.session.user.id,
    parsed.data ? 'ENABLE_STANDARD_QUESTIONS' : 'DISABLE_STANDARD_QUESTIONS',
    PROGRAM_SETTINGS_ID,
    {}
  )
  revalidatePath('/admin/programs')
  revalidatePath(programsBasePath('COACH'), 'layout')
  revalidatePath(programsBasePath('AMBASSADOR'), 'layout')
  return { success: true }
}

// ── Core questions (admin-managed, shared by every program) ──────────────────

const coreQuestionSchema = z
  .object({
    type: z.enum(PROGRAM_QUESTION_TYPES),
    label: z.string().min(1, 'Question text is required').max(300),
    required: z.boolean(),
    options: z.array(z.string().min(1).max(200)).optional(),
    likert: likertSchema.optional(),
    sortOrder: z.number().int().min(0).max(10000).optional(),
  })
  .superRefine((q, ctx) => {
    if ((q.type === 'DROPDOWN' || q.type === 'RADIO') && (!q.options || q.options.length < 2)) {
      ctx.addIssue({ code: 'custom', message: 'This question needs at least 2 options' })
    }
    if (q.type === 'LIKERT') {
      if (!q.likert) ctx.addIssue({ code: 'custom', message: 'This question needs a rating scale' })
      else if (q.likert.min >= q.likert.max) {
        ctx.addIssue({ code: 'custom', message: 'Scale minimum must be below the maximum' })
      }
    }
  })

export async function getCoreQuestions() {
  const ctx = await requireAdmin()
  if (!ctx.ok) return { error: ctx.error }

  const rows = await prisma.programCoreQuestion.findMany({ orderBy: { sortOrder: 'asc' } })
  return {
    questions: rows.map((r) => ({
      id: r.id,
      key: r.key,
      type: r.type,
      label: r.label,
      required: r.required,
      options: (r.options as unknown as string[]) ?? undefined,
      likert: (r.likert as unknown as ProgramQuestion['likert']) ?? undefined,
      sortOrder: r.sortOrder,
      isActive: r.isActive,
    })),
  }
}

export async function createCoreQuestion(data: unknown) {
  const ctx = await requireAdmin()
  if (!ctx.ok) return { error: ctx.error }

  const parsed = coreQuestionSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid question' }

  const count = await prisma.programCoreQuestion.count()
  // Keys are generated, never user-supplied, so they can never collide with an
  // existing question's stored answers.
  const key = `core_${crypto.randomBytes(6).toString('hex')}`

  const created = await prisma.programCoreQuestion.create({
    data: {
      key,
      type: parsed.data.type,
      label: parsed.data.label,
      required: parsed.data.required,
      options: (parsed.data.options as unknown as object) ?? undefined,
      likert: (parsed.data.likert as unknown as object) ?? undefined,
      sortOrder: parsed.data.sortOrder ?? (count + 1) * 10,
    },
  })

  await audit(ctx.session.user.id, 'CREATE_CORE_QUESTION', created.id, { key, label: parsed.data.label })
  revalidatePath('/admin/programs')
  return { success: true }
}

export async function updateCoreQuestion(id: string, data: unknown) {
  const ctx = await requireAdmin()
  if (!ctx.ok) return { error: ctx.error }

  const parsed = coreQuestionSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid question' }

  const existing = await prisma.programCoreQuestion.findUnique({ where: { id }, select: { id: true } })
  if (!existing) return { error: 'Question not found' }

  // `key` is deliberately never updated. Answers are stored against it, and
  // reusing a key for a different question would merge two distinct things in
  // reporting. Rewording the label is safe - answers snapshot their own label.
  await prisma.programCoreQuestion.update({
    where: { id },
    data: {
      type: parsed.data.type,
      label: parsed.data.label,
      required: parsed.data.required,
      options: (parsed.data.options as unknown as object) ?? Prisma.DbNull,
      likert: (parsed.data.likert as unknown as object) ?? Prisma.DbNull,
      ...(parsed.data.sortOrder !== undefined ? { sortOrder: parsed.data.sortOrder } : {}),
    },
  })

  await audit(ctx.session.user.id, 'UPDATE_CORE_QUESTION', id, { label: parsed.data.label })
  revalidatePath('/admin/programs')
  return { success: true }
}

export async function setCoreQuestionActive(id: string, isActive: boolean) {
  const ctx = await requireAdmin()
  if (!ctx.ok) return { error: ctx.error }

  const existing = await prisma.programCoreQuestion.findUnique({ where: { id }, select: { id: true } })
  if (!existing) return { error: 'Question not found' }

  // Retiring rather than deleting keeps answers already stored resolvable.
  await prisma.programCoreQuestion.update({ where: { id }, data: { isActive } })

  await audit(ctx.session.user.id, isActive ? 'ENABLE_CORE_QUESTION' : 'RETIRE_CORE_QUESTION', id, {})
  revalidatePath('/admin/programs')
  return { success: true }
}

export async function reorderCoreQuestions(orderedIds: string[]) {
  const ctx = await requireAdmin()
  if (!ctx.ok) return { error: ctx.error }

  const ids = z.array(z.string().min(1)).max(50).safeParse(orderedIds)
  if (!ids.success) return { error: 'Invalid order' }

  await prisma.$transaction(
    ids.data.map((id, index) =>
      prisma.programCoreQuestion.update({ where: { id }, data: { sortOrder: (index + 1) * 10 } })
    )
  )

  revalidatePath('/admin/programs')
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

/**
 * The standard questions every program asks, ahead of the coach's own.
 *
 * Read from the database rather than the CORE_QUESTIONS constant so admins can
 * edit them without a deploy. CORE_QUESTIONS remains the seed source only.
 * Retired questions (isActive false) are excluded, which stops collection
 * without orphaning answers already stored against their key.
 *
 * Returns nothing at all while the master switch is off (its default), leaving
 * each form with only the coach's own questions.
 */
async function loadCoreQuestions(): Promise<ProgramQuestion[]> {
  if (!(await standardQuestionsEnabled())) return []

  const rows = await prisma.programCoreQuestion.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  })

  return rows.map((r) => ({
    id: r.key,
    type: r.type as ProgramQuestion['type'],
    label: r.label,
    required: r.required,
    ...(r.options ? { options: r.options as unknown as string[] } : {}),
    ...(r.likert ? { likert: r.likert as unknown as ProgramQuestion['likert'] } : {}),
  }))
}

type PublicSnapshot = Record<string, unknown>

// First names only: the owner may be a youth ambassador, so the public page
// never shows a surname.
const OWNER_NAME_SELECT = {
  coach: { select: { firstName: true } },
  ambassador: { select: { firstName: true } },
} as const

/**
 * Who the public sees as the page's owner. Ownership is admin-controlled, so it
 * is read live rather than from the snapshot.
 */
function publicOwner(p: {
  coachId: string | null
  ambassadorId: string | null
  coach: { firstName: string } | null
  ambassador: { firstName: string } | null
}) {
  const role = programOwnerRole(p)
  const firstName =
    role === 'COACH' ? p.coach?.firstName : role === 'AMBASSADOR' ? p.ambassador?.firstName : null
  return { role, term: ownerTerm(role), firstName: firstName ?? null }
}

async function loadPublishedProgram(slug: string) {
  if (!slug || slug.length > 80) return null
  const program = await prisma.coachProgram.findUnique({
    where: { slug },
    include: OWNER_NAME_SELECT,
  })
  if (!program) return null
  // An unassigned program (owner removed or deleted) must stop serving.
  if (program.status !== 'PUBLISHED' || !hasProgramOwner(program) || !program.publishedSnapshot) {
    return null
  }
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
      // The public heading, falling back to the grant programme name.
      pageTitle: ((snap.pageTitle as string) || (snap.name as string)) ?? '',
      organization: (snap.organization as string) ?? '',
      headline: (snap.headline as string) ?? null,
      coachBio: (snap.coachBio as string) ?? null,
      programDescription: (snap.programDescription as string) ?? null,
      targetMarket: (snap.targetMarket as string) ?? '',
      servicesDescription: (snap.servicesDescription as string) ?? '',
      eventDatesText: (snap.eventDatesText as string) ?? null,
      showMeetingDetails: snapshotShowsMeeting(snap),
      owner: publicOwner(program),
    },
  }
}

// Snapshots taken before the switch existed have no key, and those pages were
// published with their meeting showing - so absent reads as on.
function snapshotShowsMeeting(snap: PublicSnapshot): boolean {
  return snap.showMeetingDetails !== false
}

type JourneySource = {
  ownerTerm: 'coach' | 'ambassador'
  pageTitle: string
  organization: string
  showMeetingDetails: boolean
  coachVideoUrl: string | null
  ntVideoUrl: string | null
  ntVideoIntro: string | null
  zoomUrl: string | null
  zoomLabel: string | null
  secondMeetingUrl: string | null
  secondMeetingLabel: string | null
  zoomInstructions: string | null
  eventDatesText: string | null
  qualificationIntro: string | null
  extraQuestions: ProgramQuestion[]
}

/**
 * Everything the post-signup journey renders, from either the published
 * snapshot or (for a preview) the live draft. Meeting details are withheld
 * entirely when the coach has switched them off, not merely hidden in the UI.
 */
async function buildJourney(src: JourneySource) {
  const meeting = src.showMeetingDetails
    ? {
        zoomUrl: src.zoomUrl,
        zoomLabel: src.zoomLabel,
        secondMeetingUrl: src.secondMeetingUrl,
        secondMeetingLabel: src.secondMeetingLabel,
        zoomInstructions: src.zoomInstructions,
        eventDatesText: src.eventDatesText,
      }
    : null
  return {
    ownerTerm: src.ownerTerm,
    programName: src.pageTitle,
    organization: src.organization,
    coachVideoEmbedUrl: toVideoEmbedUrl(src.coachVideoUrl),
    ntVideoEmbedUrl: toVideoEmbedUrl(src.ntVideoUrl),
    ntVideoIntro: src.ntVideoIntro,
    meeting,
    qualificationIntro: src.qualificationIntro,
    baseQuestions: [...(await loadCoreQuestions()), ...src.extraQuestions],
    familyQuestions: FAMILY_QUESTIONS,
  }
}

function journeyFromSnapshot(
  snap: PublicSnapshot,
  owner: ProgramOwnerColumns
): JourneySource {
  const str = (k: string) => (snap[k] as string | null | undefined) ?? null
  return {
    ownerTerm: ownerTerm(programOwnerRole(owner)),
    pageTitle: (str('pageTitle') || str('name')) ?? '',
    organization: str('organization') ?? '',
    showMeetingDetails: snapshotShowsMeeting(snap),
    coachVideoUrl: str('coachVideoUrl'),
    ntVideoUrl: str('ntVideoUrl'),
    ntVideoIntro: str('ntVideoIntro'),
    zoomUrl: str('zoomUrl'),
    zoomLabel: str('zoomLabel'),
    secondMeetingUrl: str('secondMeetingUrl'),
    secondMeetingLabel: str('secondMeetingLabel'),
    zoomInstructions: str('zoomInstructions'),
    eventDatesText: str('eventDatesText'),
    qualificationIntro: str('qualificationIntro'),
    extraQuestions: (snap.extraQuestions as unknown as ProgramQuestion[]) ?? [],
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
    include: {
      coach: { select: { userId: true, firstName: true } },
      ambassador: { select: { userId: true, firstName: true } },
    },
  })
  if (!program) return { error: 'Program not found' }

  const isAdmin = session.user.role === 'ADMIN'
  const ownerRole = programOwnerRole(program)
  const isOwner =
    (ownerRole === 'COACH' &&
      session.user.role === 'COACH' &&
      program.coach?.userId === session.user.id) ||
    (ownerRole === 'AMBASSADOR' &&
      session.user.role === 'AMBASSADOR' &&
      program.ambassador?.userId === session.user.id)
  if (!isAdmin && !isOwner) {
    return { error: 'Program not found' }
  }

  return {
    preview: true as const,
    status: program.status,
    program: {
      slug: program.slug,
      name: program.name,
      pageTitle: program.pageTitle || program.name,
      organization: program.organization,
      headline: program.headline,
      coachBio: program.coachBio,
      programDescription: program.programDescription,
      targetMarket: program.targetMarket,
      servicesDescription: program.servicesDescription,
      eventDatesText: program.eventDatesText,
      showMeetingDetails: program.showMeetingDetails,
      owner: publicOwner(program),
    },
    // The draft journey, so the coach can click through the videos and form
    // exactly as an applicant would before submitting for review.
    journey: await buildJourney({
      ownerTerm: ownerTerm(ownerRole),
      pageTitle: program.pageTitle || program.name,
      organization: program.organization,
      showMeetingDetails: program.showMeetingDetails,
      coachVideoUrl: program.coachVideoUrl,
      ntVideoUrl: program.ntVideoUrl,
      ntVideoIntro: program.ntVideoIntro,
      zoomUrl: program.zoomUrl,
      zoomLabel: program.zoomLabel,
      secondMeetingUrl: program.secondMeetingUrl,
      secondMeetingLabel: program.secondMeetingLabel,
      zoomInstructions: program.zoomInstructions,
      eventDatesText: program.eventDatesText,
      qualificationIntro: program.qualificationIntro,
      extraQuestions: (program.extraQuestions as unknown as ProgramQuestion[]) ?? [],
    }),
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
  const forChildren = audienceIncludesChildren(parsed.data.audience)
  // Children are dropped entirely for a SELF signup, so a form that was
  // switched back to "Myself" cannot leave child data behind.
  const children: ProgramChild[] = forChildren
    ? (parsed.data.children ?? []).map((c) => ({ firstName: c.firstName.trim(), ageBand: c.ageBand }))
    : []
  const phone = parsed.data.phone?.trim() || null

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
  let leadId: string
  try {
    const lead = await prisma.programLead.create({
      data: {
        programId: program.id,
        fullName: parsed.data.fullName.trim(),
        email,
        profession: parsed.data.profession.trim(),
        token,
        audience: parsed.data.audience,
        phone,
        ...(forChildren
          ? {
              children: children as unknown as object,
              guardianConfirmedAt: new Date(),
              familyStage: 'NEW' as const,
            }
          : {}),
      },
    })
    leadId = lead.id
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

  // Everything below is bookkeeping for the coach. None of it may fail the
  // signup - the visitor has already given us their details and is expecting
  // their joining link. An ambassador-owned program has no outreach log or CRM
  // (both are keyed to a CoachProfile); the ambassador sees the ProgramLead on
  // their program page instead.
  if (programOwnerRole(program) === 'COACH' && program.coachId) {
    const fullName = parsed.data.fullName.trim()

    // Feed Business Excellence.
    try {
      await prisma.outreachActivityLog.create({
        data: {
          coachId: program.coachId,
          date: new Date(),
          category: 'NEW_CONTACTS',
          quantity: 1,
          notes: `Program page signup: ${fullName} (${program.name})`,
        },
      })
    } catch (error) {
      console.error('Outreach log failed for program signup:', error)
    }

    // Create the working record the coach actually manages the person from.
    // The ProgramLead row stays as the immutable record of what was submitted.
    try {
      const [firstName, ...rest] = fullName.split(/\s+/)
      await prisma.cRMContact.create({
        data: {
          ownerId: program.coachId,
          firstName: firstName || fullName,
          lastName: rest.join(' '),
          email,
          phone,
          jobTitle: parsed.data.profession.trim(),
          source: 'PROGRAM_PAGE',
          status: 'NEW',
          programLeadId: leadId,
          tags: forChildren ? [program.name, 'Parent'] : [program.name],
          ...(forChildren
            ? {
                // A parent enquiring for a child should hear back quickly;
                // this puts them straight onto the coach's follow-up list.
                nextFollowUpAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
                notes: `Parent/guardian enquiring for: ${children
                  .map((c) => `${c.firstName} (${AGE_BAND_LABELS[c.ageBand]})`)
                  .join(', ')}. Contact the parent only - never the child directly.`,
              }
            : {}),
        },
      })
    } catch (error) {
      console.error('CRM contact creation failed for program signup:', error)
    }
  }

  revalidateLeadPages()
  return { success: true, token }
}

/**
 * A lead by its private token, only while its program is live. Same gate as
 * loadPublishedProgram, including the owner: an unassigned program must not
 * keep serving its joining details here after /p/[slug] 404s.
 */
async function loadLeadForToken(token: string) {
  if (!token || token.length < 10 || token.length > 120) return null
  const lead = await prisma.programLead.findUnique({
    where: { token },
    include: { program: true },
  })
  if (
    !lead ||
    lead.program.status !== 'PUBLISHED' ||
    !lead.program.publishedSnapshot ||
    !hasProgramOwner(lead.program)
  ) {
    return null
  }
  return lead
}

export async function getLeadQualificationData(slug: string, token: string) {
  const lead = await loadLeadForToken(token)
  if (!lead || lead.program.slug !== slug) return { error: 'Invalid link' }

  const snap = lead.program.publishedSnapshot as PublicSnapshot

  return {
    journey: await buildJourney(journeyFromSnapshot(snap, lead.program)),
    lead: {
      firstName: lead.fullName.split(/\s+/)[0] || lead.fullName,
      audience: lead.audience,
      children: (lead.children as unknown as ProgramChild[] | null) ?? [],
      interested: lead.interestedAt !== null,
      submitted: lead.qualifiedAt !== null,
    },
  }
}

/** Records the "I'm interested" click. Idempotent: the first click stands. */
export async function markLeadInterested(token: string) {
  const lead = await loadLeadForToken(token)
  if (!lead) return { error: 'Invalid link' }

  if (!lead.interestedAt) {
    await prisma.programLead.update({
      where: { id: lead.id },
      data: { interestedAt: new Date() },
    })
    revalidateLeadPages()
  }
  return { success: true }
}

export async function submitQualification(token: string, answers: unknown) {
  const lead = await loadLeadForToken(token)
  if (!lead) return { error: 'Invalid link' }
  if (lead.qualifiedAt) return { error: 'You have already completed this form' }

  const snap = lead.program.publishedSnapshot as PublicSnapshot
  const extras = (snap.extraQuestions as unknown as ProgramQuestion[]) ?? []
  // Family questions are asked, and therefore validated, only for a signup
  // that included children. The lead's stored audience decides, not the client.
  const questions = [
    ...(await loadCoreQuestions()),
    ...extras,
    ...(audienceIncludesChildren(lead.audience) ? FAMILY_QUESTIONS : []),
  ]

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
    data: {
      answers: stored as unknown as object,
      qualifiedAt: new Date(),
      // Reaching the form is itself the interested click; this covers a
      // visitor whose click was lost (closed tab, offline) before the submit.
      interestedAt: lead.interestedAt ?? new Date(),
    },
  })

  revalidateLeadPages()
  return { success: true }
}
