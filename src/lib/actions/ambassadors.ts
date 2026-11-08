'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

const ambassadorSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  region: z.string().optional(),
  notes: z.string().optional(),
})

export async function createAmbassador(formData: FormData) {
  const session = await auth()
  if (!session || session.user.role !== 'COACH') {
    return { error: 'Unauthorized' }
  }

  const coachProfile = await prisma.coachProfile.findUnique({
    where: { userId: session.user.id },
  })

  if (!coachProfile) {
    return { error: 'Coach profile not found' }
  }

  const data = {
    firstName: formData.get('firstName') as string,
    lastName: formData.get('lastName') as string,
    email: formData.get('email') as string || undefined,
    phone: formData.get('phone') as string || undefined,
    region: formData.get('region') as string || undefined,
    notes: formData.get('notes') as string || undefined,
  }

  const validated = ambassadorSchema.safeParse(data)
  if (!validated.success) {
    const issues = validated.error.issues
    return { error: issues[0]?.message || 'Validation failed' }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const ambassador = await tx.ambassador.create({
        data: {
          coachId: coachProfile.id,
          firstName: validated.data.firstName,
          lastName: validated.data.lastName,
          email: validated.data.email || null,
          phone: validated.data.phone || null,
          region: validated.data.region || null,
          notes: validated.data.notes || null,
          status: 'PENDING',
          assessmentStatus: 'NOT_SUBMITTED',
        },
      })

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'CREATE_AMBASSADOR',
          entityType: 'Ambassador',
          entityId: ambassador.id,
          details: `Created ambassador: ${validated.data.firstName} ${validated.data.lastName}`,
        },
      })

      return ambassador
    })

    revalidatePath('/coach/ambassadors')
    return { success: true, ambassadorId: result.id }
  } catch (error) {
    console.error('Error creating ambassador:', error)
    return { error: 'Failed to create ambassador' }
  }
}

export async function updateAmbassador(ambassadorId: string, formData: FormData) {
  const session = await auth()
  if (!session || session.user.role !== 'COACH') {
    return { error: 'Unauthorized' }
  }

  const coachProfile = await prisma.coachProfile.findUnique({
    where: { userId: session.user.id },
  })

  if (!coachProfile) {
    return { error: 'Coach profile not found' }
  }

  // Verify ambassador belongs to this coach
  const ambassador = await prisma.ambassador.findFirst({
    where: { id: ambassadorId, coachId: coachProfile.id },
  })

  if (!ambassador) {
    return { error: 'Ambassador not found' }
  }

  const data = {
    firstName: formData.get('firstName') as string,
    lastName: formData.get('lastName') as string,
    email: formData.get('email') as string || undefined,
    phone: formData.get('phone') as string || undefined,
    region: formData.get('region') as string || undefined,
    notes: formData.get('notes') as string || undefined,
  }

  const validated = ambassadorSchema.safeParse(data)
  if (!validated.success) {
    const issues = validated.error.issues
    return { error: issues[0]?.message || 'Validation failed' }
  }

  try {
    await prisma.ambassador.update({
      where: { id: ambassadorId },
      data: {
        firstName: validated.data.firstName,
        lastName: validated.data.lastName,
        email: validated.data.email || null,
        phone: validated.data.phone || null,
        region: validated.data.region || null,
        notes: validated.data.notes || null,
      },
    })

    revalidatePath('/coach/ambassadors')
    revalidatePath(`/coach/ambassadors/${ambassadorId}`)
    return { success: true }
  } catch (error) {
    console.error('Error updating ambassador:', error)
    return { error: 'Failed to update ambassador' }
  }
}

export async function deleteAmbassador(ambassadorId: string) {
  const session = await auth()
  if (!session || session.user.role !== 'COACH') {
    return { error: 'Unauthorized' }
  }

  const coachProfile = await prisma.coachProfile.findUnique({
    where: { userId: session.user.id },
  })

  if (!coachProfile) {
    return { error: 'Coach profile not found' }
  }

  // Verify ambassador belongs to this coach
  const ambassador = await prisma.ambassador.findFirst({
    where: { id: ambassadorId, coachId: coachProfile.id },
  })

  if (!ambassador) {
    return { error: 'Ambassador not found' }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'DELETE_AMBASSADOR',
          entityType: 'Ambassador',
          entityId: ambassadorId,
          details: `Deleted ambassador: ${ambassador.firstName} ${ambassador.lastName}`,
        },
      })

      await tx.ambassador.delete({
        where: { id: ambassadorId },
      })
    })

    revalidatePath('/coach/ambassadors')
    return { success: true }
  } catch (error) {
    console.error('Error deleting ambassador:', error)
    return { error: 'Failed to delete ambassador' }
  }
}

// Admin actions for status management
export async function updateAmbassadorStatus(
  ambassadorId: string,
  status: 'PENDING' | 'APPROVED' | 'INACTIVE' | 'COMPLETED' | 'ON_HOLD'
) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.ambassador.update({
        where: { id: ambassadorId },
        data: { status },
      })

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'UPDATE_AMBASSADOR_STATUS',
          entityType: 'Ambassador',
          entityId: ambassadorId,
          details: `Updated status to: ${status}`,
        },
      })
    })

    revalidatePath('/admin/ambassadors')
    revalidatePath('/coach/ambassadors')
    return { success: true }
  } catch (error) {
    console.error('Error updating ambassador status:', error)
    return { error: 'Failed to update status' }
  }
}

export async function updateAssessmentStatus(
  ambassadorId: string,
  assessmentStatus: 'NOT_SUBMITTED' | 'SUBMITTED' | 'REVIEWED'
) {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  // Coaches can submit, admins can review
  if (session.user.role === 'COACH') {
    if (assessmentStatus === 'REVIEWED') {
      return { error: 'Only admins can mark as reviewed' }
    }
  }

  try {
    await prisma.ambassador.update({
      where: { id: ambassadorId },
      data: { assessmentStatus },
    })

    revalidatePath('/admin/ambassadors')
    revalidatePath('/coach/ambassadors')
    return { success: true }
  } catch (error) {
    console.error('Error updating assessment status:', error)
    return { error: 'Failed to update assessment status' }
  }
}

// Admin edit of an ambassador's details. Unlike the coach-side
// `updateAmbassador`, this can reach any ambassador, reassign the coach, and
// keeps the login email (User.email) in step with the profile email.
const adminAmbassadorSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  email: z.string().trim().email('Enter a valid email').optional().or(z.literal('')),
  phone: z.string().trim().optional(),
  phoneCountryCode: z.string().trim().optional(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date of birth')
    .optional()
    .or(z.literal('')),
  region: z.string().trim().optional(),
  address1: z.string().trim().optional(),
  address2: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
  country: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  coachId: z.string().min(1, 'Coach is required'),
})

export async function adminUpdateAmbassador(ambassadorId: string, formData: FormData) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }
  if (session.user.isImpersonating) {
    return { error: 'Stop impersonating before editing ambassadors' }
  }

  const field = (name: string) => (formData.get(name) as string | null) ?? undefined
  const validated = adminAmbassadorSchema.safeParse({
    firstName: field('firstName'),
    lastName: field('lastName'),
    email: field('email'),
    phone: field('phone'),
    phoneCountryCode: field('phoneCountryCode'),
    dateOfBirth: field('dateOfBirth'),
    region: field('region'),
    address1: field('address1'),
    address2: field('address2'),
    city: field('city'),
    state: field('state'),
    postalCode: field('postalCode'),
    country: field('country'),
    notes: field('notes'),
    coachId: field('coachId'),
  })
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Validation failed' }
  }
  const data = validated.data

  const ambassador = await prisma.ambassador.findUnique({
    where: { id: ambassadorId },
    include: { user: { select: { id: true, email: true } } },
  })
  if (!ambassador) {
    return { error: 'Ambassador not found' }
  }

  const email = data.email || null
  // An ambassador with a login must keep an email, or they can't sign in.
  if (ambassador.user && !email) {
    return { error: 'This ambassador signs in with their email, so it cannot be blank' }
  }

  let dateOfBirth: Date | null = null
  if (data.dateOfBirth) {
    dateOfBirth = new Date(`${data.dateOfBirth}T00:00:00.000Z`)
    if (isNaN(dateOfBirth.getTime()) || dateOfBirth > new Date()) {
      return { error: 'Enter a valid date of birth' }
    }
  }

  if (data.coachId !== ambassador.coachId) {
    const coach = await prisma.coachProfile.findUnique({ where: { id: data.coachId } })
    if (!coach) {
      return { error: 'Selected coach not found' }
    }
  }

  const loginEmailChanges = !!ambassador.user && email !== ambassador.user.email
  if (loginEmailChanges && email) {
    const taken = await prisma.user.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        id: { not: ambassador.user!.id },
      },
      select: { id: true },
    })
    if (taken) {
      return { error: 'Another account already uses that email' }
    }
  }

  const updates = {
    firstName: data.firstName,
    lastName: data.lastName,
    email,
    phone: data.phone || null,
    phoneCountryCode: data.phoneCountryCode || null,
    dateOfBirth,
    region: data.region || null,
    address1: data.address1 || null,
    address2: data.address2 || null,
    city: data.city || null,
    state: data.state || null,
    postalCode: data.postalCode || null,
    country: data.country || null,
    notes: data.notes || null,
    coachId: data.coachId,
  }

  // Record which fields changed (names only, so the audit log holds no PII).
  const changed = (Object.keys(updates) as (keyof typeof updates)[]).filter((key) => {
    const before = ambassador[key]
    const after = updates[key]
    if (before instanceof Date || after instanceof Date) {
      return (before as Date | null)?.getTime() !== (after as Date | null)?.getTime()
    }
    return (before ?? null) !== (after ?? null)
  })
  if (changed.length === 0) {
    return { success: true }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.ambassador.update({ where: { id: ambassadorId }, data: updates })

      if (loginEmailChanges && email) {
        await tx.user.update({ where: { id: ambassador.user!.id }, data: { email } })
      }

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'ADMIN_UPDATE_AMBASSADOR',
          entityType: 'Ambassador',
          entityId: ambassadorId,
          details: `Updated: ${changed.join(', ')}${loginEmailChanges ? ' (login email changed)' : ''}`,
        },
      })
    })

    revalidatePath('/admin/ambassadors')
    revalidatePath('/coach/ambassadors')
    revalidatePath(`/coach/ambassadors/${ambassadorId}`)
    return { success: true }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { error: 'Another account already uses that email' }
    }
    console.error('Error updating ambassador (admin):', error)
    return { error: 'Failed to update ambassador' }
  }
}
