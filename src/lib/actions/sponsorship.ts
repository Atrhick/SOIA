'use server'

import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'

// Validation schemas
const createRequestSchema = z.object({
  requestType: z.enum(['COACH_SPONSORSHIP', 'AMBASSADOR_SPONSORSHIP', 'PROJECT_FUNDING']),
  beneficiaryType: z.enum(['SELF', 'AMBASSADOR', 'PROJECT']),
  ambassadorId: z.string().optional(),
  projectName: z.string().optional(),
  amountRequested: z.number().positive('Amount must be positive'),
  amountContributing: z.number().min(0).optional(),
  reason: z.string().min(10, 'Please provide a detailed reason'),
  urgency: z.enum(['URGENT', 'NORMAL', 'FLEXIBLE']),
})

// Helper to get current coach
async function getCurrentCoach() {
  const session = await auth()
  if (!session || session.user.role !== 'COACH') {
    return null
  }

  return prisma.coachProfile.findUnique({
    where: { userId: session.user.id },
  })
}

// Helper to check admin
async function isAdmin() {
  const session = await auth()
  return session?.user.role === 'ADMIN'
}

// Coach: Create sponsorship request
export async function createSponsorshipRequest(formData: FormData) {
  const coach = await getCurrentCoach()
  if (!coach) {
    return { error: 'Unauthorized' }
  }

  const data = {
    requestType: formData.get('requestType') as string,
    beneficiaryType: formData.get('beneficiaryType') as string,
    ambassadorId: formData.get('ambassadorId') as string || undefined,
    projectName: formData.get('projectName') as string || undefined,
    amountRequested: parseFloat(formData.get('amountRequested') as string),
    amountContributing: formData.get('amountContributing')
      ? parseFloat(formData.get('amountContributing') as string)
      : undefined,
    reason: formData.get('reason') as string,
    urgency: formData.get('urgency') as string,
  }

  const validated = createRequestSchema.safeParse(data)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Invalid input' }
  }

  // Validate ambassador if beneficiary type is AMBASSADOR
  if (validated.data.beneficiaryType === 'AMBASSADOR') {
    if (!validated.data.ambassadorId) {
      return { error: 'Please select an ambassador' }
    }
    // Verify ambassador belongs to this coach
    const ambassador = await prisma.ambassador.findFirst({
      where: {
        id: validated.data.ambassadorId,
        coachId: coach.id,
      },
    })
    if (!ambassador) {
      return { error: 'Ambassador not found' }
    }
  }

  // Validate project name if beneficiary type is PROJECT
  if (validated.data.beneficiaryType === 'PROJECT' && !validated.data.projectName) {
    return { error: 'Please provide a project name' }
  }

  try {
    await prisma.sponsorshipRequest.create({
      data: {
        coachId: coach.id,
        requestType: validated.data.requestType as 'COACH_SPONSORSHIP' | 'AMBASSADOR_SPONSORSHIP' | 'PROJECT_FUNDING',
        beneficiaryType: validated.data.beneficiaryType,
        ambassadorId: validated.data.ambassadorId || null,
        projectName: validated.data.projectName || null,
        amountRequested: new Decimal(validated.data.amountRequested),
        amountContributing: validated.data.amountContributing
          ? new Decimal(validated.data.amountContributing)
          : null,
        reason: validated.data.reason,
        urgency: validated.data.urgency as 'URGENT' | 'NORMAL' | 'FLEXIBLE',
      },
    })

    revalidatePath('/coach/sponsorship')
    return { success: true }
  } catch (error) {
    console.error('Error creating sponsorship request:', error)
    return { error: 'Failed to create request' }
  }
}

// Coach: Delete own request (only if still SUBMITTED)
export async function deleteSponsorshipRequest(requestId: string) {
  const coach = await getCurrentCoach()
  if (!coach) {
    return { error: 'Unauthorized' }
  }

  const request = await prisma.sponsorshipRequest.findUnique({
    where: { id: requestId },
  })

  if (!request || request.coachId !== coach.id) {
    return { error: 'Request not found' }
  }

  if (request.status !== 'SUBMITTED') {
    return { error: 'Cannot delete a request that is already being reviewed' }
  }

  try {
    await prisma.sponsorshipRequest.delete({
      where: { id: requestId },
    })

    revalidatePath('/coach/sponsorship')
    return { success: true }
  } catch (error) {
    console.error('Error deleting sponsorship request:', error)
    return { error: 'Failed to delete request' }
  }
}

// Admin: Update request status
export async function updateSponsorshipStatus(
  requestId: string,
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED_FULL' | 'APPROVED_PARTIAL' | 'PAYMENT_PLAN' | 'NOT_APPROVED',
  adminNotes?: string
) {
  if (!(await isAdmin())) {
    return { error: 'Unauthorized' }
  }

  try {
    const updateData: {
      status: typeof status
      adminNotes?: string
      decidedAt?: Date
    } = { status }

    if (adminNotes !== undefined) {
      updateData.adminNotes = adminNotes
    }

    // Set decidedAt for terminal statuses
    if (['APPROVED_FULL', 'APPROVED_PARTIAL', 'PAYMENT_PLAN', 'NOT_APPROVED'].includes(status)) {
      updateData.decidedAt = new Date()
    }

    await prisma.sponsorshipRequest.update({
      where: { id: requestId },
      data: updateData,
    })

    revalidatePath('/admin/sponsorship')
    return { success: true }
  } catch (error) {
    console.error('Error updating sponsorship status:', error)
    return { error: 'Failed to update status' }
  }
}

// Admin: Add notes to request
export async function addAdminNotes(requestId: string, notes: string) {
  if (!(await isAdmin())) {
    return { error: 'Unauthorized' }
  }

  try {
    await prisma.sponsorshipRequest.update({
      where: { id: requestId },
      data: { adminNotes: notes },
    })

    revalidatePath('/admin/sponsorship')
    return { success: true }
  } catch (error) {
    console.error('Error adding admin notes:', error)
    return { error: 'Failed to add notes' }
  }
}
