'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function getAmbassadorOnboardingTasks() {
  const tasks = await prisma.ambassadorOnboardingTask.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  })
  return tasks
}

export async function getAmbassadorOnboardingProgress(ambassadorId: string) {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  // Verify access - either the ambassador themselves, their coach, or admin
  if (session.user.role === 'AMBASSADOR') {
    const ambassador = await prisma.ambassador.findUnique({
      where: { userId: session.user.id },
    })
    if (!ambassador || ambassador.id !== ambassadorId) {
      return { error: 'Unauthorized' }
    }
  } else if (session.user.role === 'COACH') {
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: session.user.id },
    })
    const ambassador = await prisma.ambassador.findUnique({
      where: { id: ambassadorId },
    })
    if (!coachProfile || !ambassador || ambassador.coachId !== coachProfile.id) {
      return { error: 'Unauthorized' }
    }
  } else if (session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  const progress = await prisma.ambassadorOnboardingProgress.findMany({
    where: { ambassadorId },
    include: { task: true },
    orderBy: { task: { sortOrder: 'asc' } },
  })

  return { progress }
}

export async function updateAmbassadorOnboardingProgress(
  ambassadorId: string,
  taskId: string,
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'REJECTED',
  notes?: string
) {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  // Only admin can approve/reject
  if ((status === 'APPROVED' || status === 'REJECTED') && session.user.role !== 'ADMIN') {
    return { error: 'Only administrators can approve or reject tasks' }
  }

  try {
    const progress = await prisma.ambassadorOnboardingProgress.upsert({
      where: {
        ambassadorId_taskId: { ambassadorId, taskId },
      },
      update: {
        status,
        notes,
        completedAt: status === 'APPROVED' ? new Date() : null,
        reviewedBy: (status === 'APPROVED' || status === 'REJECTED') ? session.user.id : undefined,
      },
      create: {
        ambassadorId,
        taskId,
        status,
        notes,
        completedAt: status === 'APPROVED' ? new Date() : null,
        reviewedBy: (status === 'APPROVED' || status === 'REJECTED') ? session.user.id : undefined,
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE_AMBASSADOR_ONBOARDING',
        entityType: 'AmbassadorOnboardingProgress',
        entityId: progress.id,
        details: JSON.stringify({ ambassadorId, taskId, status }),
      },
    })

    revalidatePath('/ambassador/onboarding')
    revalidatePath(`/coach/ambassadors/${ambassadorId}`)
    revalidatePath('/admin/ambassador-onboarding')

    return { success: true }
  } catch (error) {
    console.error('Error updating onboarding progress:', error)
    return { error: 'Failed to update onboarding progress' }
  }
}

export async function approveInterview(ambassadorId: string, notes?: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Only administrators can approve interviews' }
  }

  try {
    // Find the interview task
    const interviewTask = await prisma.ambassadorOnboardingTask.findFirst({
      where: { type: 'INTERVIEW', isActive: true },
    })

    if (!interviewTask) {
      return { error: 'Interview task not found' }
    }

    await prisma.ambassadorOnboardingProgress.upsert({
      where: {
        ambassadorId_taskId: { ambassadorId, taskId: interviewTask.id },
      },
      update: {
        status: 'APPROVED',
        completedAt: new Date(),
        reviewedBy: session.user.id,
        notes,
      },
      create: {
        ambassadorId,
        taskId: interviewTask.id,
        status: 'APPROVED',
        completedAt: new Date(),
        reviewedBy: session.user.id,
        notes,
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'APPROVE_INTERVIEW',
        entityType: 'Ambassador',
        entityId: ambassadorId,
        details: notes,
      },
    })

    revalidatePath('/ambassador/onboarding')
    revalidatePath(`/admin/ambassador-onboarding`)

    return { success: true }
  } catch (error) {
    console.error('Error approving interview:', error)
    return { error: 'Failed to approve interview' }
  }
}

export async function markWhatsAppTeamCreated(ambassadorId: string, groupLink?: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Only administrators can mark WhatsApp team as created' }
  }

  try {
    // Update ambassador record
    await prisma.ambassador.update({
      where: { id: ambassadorId },
      data: {
        whatsappGroupCreated: true,
        whatsappGroupLink: groupLink,
      },
    })

    // Find and update the WhatsApp task
    const whatsappTask = await prisma.ambassadorOnboardingTask.findFirst({
      where: { type: 'WHATSAPP_TEAM', isActive: true },
    })

    if (whatsappTask) {
      await prisma.ambassadorOnboardingProgress.upsert({
        where: {
          ambassadorId_taskId: { ambassadorId, taskId: whatsappTask.id },
        },
        update: {
          status: 'APPROVED',
          completedAt: new Date(),
          reviewedBy: session.user.id,
          notes: groupLink ? `Group link: ${groupLink}` : undefined,
        },
        create: {
          ambassadorId,
          taskId: whatsappTask.id,
          status: 'APPROVED',
          completedAt: new Date(),
          reviewedBy: session.user.id,
          notes: groupLink ? `Group link: ${groupLink}` : undefined,
        },
      })
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE_WHATSAPP_TEAM',
        entityType: 'Ambassador',
        entityId: ambassadorId,
        details: groupLink,
      },
    })

    revalidatePath('/ambassador/onboarding')
    revalidatePath(`/admin/ambassador-onboarding`)

    return { success: true }
  } catch (error) {
    console.error('Error marking WhatsApp team created:', error)
    return { error: 'Failed to update WhatsApp team status' }
  }
}

export async function inviteToPowerTeam(ambassadorId: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Only administrators can invite to Power Team' }
  }

  try {
    // Update ambassador record
    await prisma.ambassador.update({
      where: { id: ambassadorId },
      data: {
        powerTeamInvited: true,
        powerTeamJoinedAt: new Date(),
      },
    })

    // Find and update the Power Team task
    const powerTeamTask = await prisma.ambassadorOnboardingTask.findFirst({
      where: { type: 'POWER_TEAM', isActive: true },
    })

    if (powerTeamTask) {
      await prisma.ambassadorOnboardingProgress.upsert({
        where: {
          ambassadorId_taskId: { ambassadorId, taskId: powerTeamTask.id },
        },
        update: {
          status: 'APPROVED',
          completedAt: new Date(),
          reviewedBy: session.user.id,
        },
        create: {
          ambassadorId,
          taskId: powerTeamTask.id,
          status: 'APPROVED',
          completedAt: new Date(),
          reviewedBy: session.user.id,
        },
      })
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'INVITE_TO_POWER_TEAM',
        entityType: 'Ambassador',
        entityId: ambassadorId,
      },
    })

    revalidatePath('/ambassador/onboarding')
    revalidatePath(`/admin/ambassador-onboarding`)

    return { success: true }
  } catch (error) {
    console.error('Error inviting to Power Team:', error)
    return { error: 'Failed to invite to Power Team' }
  }
}

export async function getAmbassadorsForOnboardingReview() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  const ambassadors = await prisma.ambassador.findMany({
    where: {
      userId: { not: null }, // Only ambassadors with accounts
    },
    include: {
      user: {
        select: { email: true, status: true },
      },
      coach: {
        select: { firstName: true, lastName: true },
      },
      onboardingProgress: {
        include: { task: true },
        orderBy: { task: { sortOrder: 'asc' } },
      },
      businessIdea: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return { ambassadors }
}
