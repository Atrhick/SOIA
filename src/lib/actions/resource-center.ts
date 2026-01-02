'use server'

import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// Validation schemas
const applicationSchema = z.object({
  proposedLocation: z.string().min(1, 'Location is required'),
  communityDescription: z.string().optional(),
  visionAndGoals: z.string().optional(),
  capacityInfo: z.string().optional(),
})

const classSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  date: z.string().min(1, 'Date is required'),
  audienceType: z.enum(['AMBASSADORS', 'ADULTS', 'MIXED']),
  attendanceCount: z.number().int().min(0).default(0),
  notes: z.string().optional(),
})

// Helper to get current coach
async function getCurrentCoach() {
  const session = await auth()
  if (!session || session.user.role !== 'COACH') {
    return null
  }

  return prisma.coachProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      recruitedCoaches: true,
      resourceCenterApp: true,
      resourceCenter: {
        include: {
          classes: {
            orderBy: { date: 'desc' },
          },
        },
      },
    },
  })
}

// Helper to check admin
async function isAdmin() {
  const session = await auth()
  return session?.user.role === 'ADMIN'
}

// Check eligibility (need 5+ recruited coaches)
export async function checkEligibility() {
  const coach = await getCurrentCoach()
  if (!coach) {
    return { error: 'Unauthorized' }
  }

  const recruitedCount = coach.recruitedCoaches.length
  const isEligible = recruitedCount >= 5

  return {
    isEligible,
    recruitedCount,
    requiredCount: 5,
  }
}

// Coach: Submit application
export async function submitApplication(formData: FormData) {
  const coach = await getCurrentCoach()
  if (!coach) {
    return { error: 'Unauthorized' }
  }

  // Check eligibility
  if (coach.recruitedCoaches.length < 5) {
    return { error: 'You need to recruit at least 5 coaches to apply' }
  }

  // Check if already has application
  if (coach.resourceCenterApp) {
    return { error: 'You already have an application' }
  }

  const data = {
    proposedLocation: formData.get('proposedLocation') as string,
    communityDescription: formData.get('communityDescription') as string || undefined,
    visionAndGoals: formData.get('visionAndGoals') as string || undefined,
    capacityInfo: formData.get('capacityInfo') as string || undefined,
  }

  const validated = applicationSchema.safeParse(data)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Invalid input' }
  }

  try {
    await prisma.resourceCenterApplication.create({
      data: {
        coachId: coach.id,
        proposedLocation: validated.data.proposedLocation,
        communityDescription: validated.data.communityDescription,
        visionAndGoals: validated.data.visionAndGoals,
        capacityInfo: validated.data.capacityInfo,
        status: 'UNDER_REVIEW',
      },
    })

    revalidatePath('/coach/resource-center')
    return { success: true }
  } catch (error) {
    console.error('Error submitting application:', error)
    return { error: 'Failed to submit application' }
  }
}

// Admin: Review application
export async function reviewApplication(
  applicationId: string,
  decision: 'APPROVED' | 'DECLINED',
  declineReason?: string
) {
  if (!(await isAdmin())) {
    return { error: 'Unauthorized' }
  }

  const application = await prisma.resourceCenterApplication.findUnique({
    where: { id: applicationId },
    include: { coach: true },
  })

  if (!application) {
    return { error: 'Application not found' }
  }

  try {
    // Update application
    await prisma.resourceCenterApplication.update({
      where: { id: applicationId },
      data: {
        status: decision,
        declineReason: decision === 'DECLINED' ? declineReason : null,
        reviewedAt: new Date(),
      },
    })

    // If approved, create the Resource Center
    if (decision === 'APPROVED') {
      await prisma.resourceCenter.create({
        data: {
          ownerId: application.coachId,
          name: `${application.coach.firstName}'s Resource Center`,
          location: application.proposedLocation,
          description: application.visionAndGoals,
        },
      })
    }

    revalidatePath('/admin/resource-centers')
    revalidatePath('/coach/resource-center')
    return { success: true }
  } catch (error) {
    console.error('Error reviewing application:', error)
    return { error: 'Failed to review application' }
  }
}

// Coach: Add class to resource center
export async function addClass(formData: FormData) {
  const coach = await getCurrentCoach()
  if (!coach) {
    return { error: 'Unauthorized' }
  }

  if (!coach.resourceCenter) {
    return { error: 'You do not have an approved Resource Center' }
  }

  const data = {
    title: formData.get('title') as string,
    date: formData.get('date') as string,
    audienceType: formData.get('audienceType') as string,
    attendanceCount: parseInt(formData.get('attendanceCount') as string || '0'),
    notes: formData.get('notes') as string || undefined,
  }

  const validated = classSchema.safeParse(data)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Invalid input' }
  }

  try {
    await prisma.resourceCenterClass.create({
      data: {
        resourceCenterId: coach.resourceCenter.id,
        title: validated.data.title,
        date: new Date(validated.data.date),
        audienceType: validated.data.audienceType as 'AMBASSADORS' | 'ADULTS' | 'MIXED',
        attendanceCount: validated.data.attendanceCount,
        notes: validated.data.notes,
      },
    })

    revalidatePath('/coach/resource-center')
    return { success: true }
  } catch (error) {
    console.error('Error adding class:', error)
    return { error: 'Failed to add class' }
  }
}

// Coach: Update class attendance
export async function updateClassAttendance(classId: string, attendanceCount: number) {
  const coach = await getCurrentCoach()
  if (!coach || !coach.resourceCenter) {
    return { error: 'Unauthorized' }
  }

  const classRecord = await prisma.resourceCenterClass.findFirst({
    where: {
      id: classId,
      resourceCenterId: coach.resourceCenter.id,
    },
  })

  if (!classRecord) {
    return { error: 'Class not found' }
  }

  try {
    await prisma.resourceCenterClass.update({
      where: { id: classId },
      data: { attendanceCount },
    })

    revalidatePath('/coach/resource-center')
    return { success: true }
  } catch (error) {
    console.error('Error updating attendance:', error)
    return { error: 'Failed to update attendance' }
  }
}

// Coach: Delete class
export async function deleteClass(classId: string) {
  const coach = await getCurrentCoach()
  if (!coach || !coach.resourceCenter) {
    return { error: 'Unauthorized' }
  }

  const classRecord = await prisma.resourceCenterClass.findFirst({
    where: {
      id: classId,
      resourceCenterId: coach.resourceCenter.id,
    },
  })

  if (!classRecord) {
    return { error: 'Class not found' }
  }

  try {
    await prisma.resourceCenterClass.delete({
      where: { id: classId },
    })

    revalidatePath('/coach/resource-center')
    return { success: true }
  } catch (error) {
    console.error('Error deleting class:', error)
    return { error: 'Failed to delete class' }
  }
}
