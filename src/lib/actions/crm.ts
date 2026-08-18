'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { isFeatureEnabled } from '@/lib/actions/feature-config'
import type { ProgramAnswer } from '@/lib/program-question-types'

// Note: the Prisma client exposes these as cRMContact / cRMActivity - it only
// lowercases the first character of CRMContact.

const CONTACT_STATUSES = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'CONVERTED',
  'DORMANT',
  'LOST',
] as const

const ACTIVITY_TYPES = ['CALL', 'EMAIL', 'MEETING', 'NOTE', 'TASK'] as const

// ============================================
// Guards
// ============================================

// Same `ok` discriminant used in program-pages.ts: a union whose members
// differ only by an optional property does not narrow reliably.

async function requireCoach() {
  const session = await auth()
  if (!session || session.user.role !== 'COACH') {
    return { ok: false as const, error: 'Unauthorized' }
  }
  if (session.user.isImpersonating) {
    return { ok: false as const, error: 'Not available while impersonating another user' }
  }
  const enabled = await isFeatureEnabled('CRM', 'COACH', session.user.id)
  if (!enabled) {
    return { ok: false as const, error: 'This feature is not enabled for your account' }
  }
  const coachProfile = await prisma.coachProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!coachProfile) {
    return { ok: false as const, error: 'Coach profile not found' }
  }
  return { ok: true as const, session, coachProfile }
}

async function requireContactOwner(contactId: string) {
  const ctx = await requireCoach()
  if (!ctx.ok) return { ok: false as const, error: ctx.error }

  const contact = await prisma.cRMContact.findUnique({ where: { id: contactId } })
  // Same message whether it does not exist or belongs to another coach, so
  // the id cannot be used as an existence oracle.
  if (!contact || contact.ownerId !== ctx.coachProfile.id) {
    return { ok: false as const, error: 'Contact not found' }
  }
  return { ok: true as const, session: ctx.session, coachProfile: ctx.coachProfile, contact }
}

// ============================================
// Reads
// ============================================

export async function getMyContacts(filter?: 'ALL' | 'NEEDS_ATTENTION' | (typeof CONTACT_STATUSES)[number]) {
  const ctx = await requireCoach()
  if (!ctx.ok) return { error: ctx.error }

  const now = new Date()
  const where =
    filter === 'NEEDS_ATTENTION'
      ? {
          ownerId: ctx.coachProfile.id,
          OR: [{ status: 'NEW' as const }, { nextFollowUpAt: { lte: now } }],
        }
      : filter && filter !== 'ALL'
        ? { ownerId: ctx.coachProfile.id, status: filter }
        : { ownerId: ctx.coachProfile.id }

  const [contacts, counts] = await Promise.all([
    prisma.cRMContact.findMany({
      where,
      orderBy: [{ nextFollowUpAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
      include: {
        programLead: {
          select: { qualifiedAt: true, association: true, program: { select: { name: true } } },
        },
        _count: { select: { activities: true } },
      },
    }),
    prisma.cRMContact.groupBy({
      by: ['status'],
      where: { ownerId: ctx.coachProfile.id },
      _count: true,
    }),
  ])

  const needsAttention = await prisma.cRMContact.count({
    where: {
      ownerId: ctx.coachProfile.id,
      OR: [{ status: 'NEW' }, { nextFollowUpAt: { lte: now } }],
    },
  })

  return {
    contacts: contacts.map((c) => ({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      phone: c.phone,
      jobTitle: c.jobTitle,
      source: c.source,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
      lastContactedAt: c.lastContactedAt?.toISOString() ?? null,
      nextFollowUpAt: c.nextFollowUpAt?.toISOString() ?? null,
      programName: c.programLead?.program.name ?? null,
      association: c.programLead?.association ?? null,
      completedForm: c.programLead ? c.programLead.qualifiedAt !== null : null,
      activityCount: c._count.activities,
    })),
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count])) as Record<string, number>,
    needsAttention,
  }
}

export async function getContact(contactId: string) {
  const ctx = await requireContactOwner(contactId)
  if (!ctx.ok) return { error: ctx.error }

  const [full, activities] = await Promise.all([
    prisma.cRMContact.findUnique({
      where: { id: contactId },
      include: {
        programLead: {
          include: { program: { select: { name: true, slug: true } } },
        },
      },
    }),
    prisma.cRMActivity.findMany({
      where: { contactId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ])
  if (!full) return { error: 'Contact not found' }

  return {
    contact: {
      id: full.id,
      firstName: full.firstName,
      lastName: full.lastName,
      email: full.email,
      phone: full.phone,
      company: full.company,
      jobTitle: full.jobTitle,
      notes: full.notes,
      source: full.source,
      status: full.status,
      createdAt: full.createdAt.toISOString(),
      lastContactedAt: full.lastContactedAt?.toISOString() ?? null,
      nextFollowUpAt: full.nextFollowUpAt?.toISOString() ?? null,
      lead: full.programLead
        ? {
            programName: full.programLead.program.name,
            programSlug: full.programLead.program.slug,
            registeredAt: full.programLead.registeredAt.toISOString(),
            qualifiedAt: full.programLead.qualifiedAt?.toISOString() ?? null,
            association: full.programLead.association,
            coachNotes: full.programLead.coachNotes,
            // The answers are the whole point of the qualification form and
            // were previously not visible anywhere.
            answers: (full.programLead.answers as unknown as ProgramAnswer[]) ?? [],
          }
        : null,
    },
    activities: activities.map((a) => ({
      id: a.id,
      type: a.type,
      title: a.title,
      description: a.description,
      dueDate: a.dueDate?.toISOString() ?? null,
      completedAt: a.completedAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
    })),
  }
}

// ============================================
// Writes
// ============================================

export async function updateContactStatus(contactId: string, status: string) {
  const ctx = await requireContactOwner(contactId)
  if (!ctx.ok) return { error: ctx.error }

  const parsed = z.enum(CONTACT_STATUSES).safeParse(status)
  if (!parsed.success) return { error: 'Invalid status' }

  await prisma.cRMContact.update({
    where: { id: contactId },
    data: { status: parsed.data },
  })

  revalidatePath('/coach/crm')
  revalidatePath(`/coach/crm/${contactId}`)
  return { success: true }
}

export async function setNextFollowUp(contactId: string, isoDate: string | null) {
  const ctx = await requireContactOwner(contactId)
  if (!ctx.ok) return { error: ctx.error }

  let when: Date | null = null
  if (isoDate) {
    const parsed = new Date(isoDate)
    if (Number.isNaN(parsed.getTime())) return { error: 'Invalid date' }
    when = parsed
  }

  await prisma.cRMContact.update({
    where: { id: contactId },
    data: { nextFollowUpAt: when },
  })

  revalidatePath('/coach/crm')
  revalidatePath(`/coach/crm/${contactId}`)
  return { success: true }
}

const activitySchema = z.object({
  type: z.enum(ACTIVITY_TYPES),
  title: z.string().min(1, 'Give this a short title').max(200),
  description: z.string().max(4000).optional(),
})

export async function logActivity(contactId: string, data: unknown) {
  const ctx = await requireContactOwner(contactId)
  if (!ctx.ok) return { error: ctx.error }

  const parsed = activitySchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid activity' }

  const isContact = parsed.data.type !== 'NOTE' && parsed.data.type !== 'TASK'

  await prisma.$transaction([
    prisma.cRMActivity.create({
      data: {
        userId: ctx.session.user.id,
        contactId,
        type: parsed.data.type,
        title: parsed.data.title,
        description: parsed.data.description || null,
        completedAt: new Date(),
      },
    }),
    prisma.cRMContact.update({
      where: { id: contactId },
      data: {
        // Logging a call/email/meeting is evidence of contact; a private note
        // is not, so it must not silently clear the follow-up prompt.
        ...(isContact ? { lastContactedAt: new Date() } : {}),
        ...(isContact && ctx.contact.status === 'NEW' ? { status: 'CONTACTED' as const } : {}),
      },
    }),
  ])

  revalidatePath('/coach/crm')
  revalidatePath(`/coach/crm/${contactId}`)
  return { success: true }
}

export async function updateContactNotes(contactId: string, notes: string) {
  const ctx = await requireContactOwner(contactId)
  if (!ctx.ok) return { error: ctx.error }

  await prisma.cRMContact.update({
    where: { id: contactId },
    data: { notes: notes.slice(0, 8000) || null },
  })

  revalidatePath(`/coach/crm/${contactId}`)
  return { success: true }
}

/**
 * Records how the coach has classified this person. Mirrors the association
 * onto the originating ProgramLead so Business Excellence and the CRM agree.
 */
export async function setContactAssociation(contactId: string, association: string) {
  const ctx = await requireContactOwner(contactId)
  if (!ctx.ok) return { error: ctx.error }

  const parsed = z
    .enum(['UNCLASSIFIED', 'AMBASSADOR', 'COACH', 'SERVICE_PROVIDER', 'BUSINESS_AFFILIATE', 'VOLUNTEER'])
    .safeParse(association)
  if (!parsed.success) return { error: 'Invalid association type' }

  if (!ctx.contact.programLeadId) {
    return { error: 'This contact did not come from a program page' }
  }

  await prisma.programLead.update({
    where: { id: ctx.contact.programLeadId },
    data: { association: parsed.data, classifiedAt: new Date() },
  })

  revalidatePath('/coach/crm')
  revalidatePath(`/coach/crm/${contactId}`)
  revalidatePath('/coach/business-excellence')
  return { success: true }
}
