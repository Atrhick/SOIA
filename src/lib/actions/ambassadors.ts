'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'

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
    const ambassador = await prisma.ambassador.create({
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

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE_AMBASSADOR',
        entityType: 'Ambassador',
        entityId: ambassador.id,
        details: `Created ambassador: ${validated.data.firstName} ${validated.data.lastName}`,
      },
    })

    revalidatePath('/coach/ambassadors')
    return { success: true, ambassadorId: ambassador.id }
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
    await prisma.ambassador.delete({
      where: { id: ambassadorId },
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE_AMBASSADOR',
        entityType: 'Ambassador',
        entityId: ambassadorId,
        details: `Deleted ambassador: ${ambassador.firstName} ${ambassador.lastName}`,
      },
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
    const ambassador = await prisma.ambassador.update({
      where: { id: ambassadorId },
      data: { status },
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE_AMBASSADOR_STATUS',
        entityType: 'Ambassador',
        entityId: ambassadorId,
        details: `Updated status to: ${status}`,
      },
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
