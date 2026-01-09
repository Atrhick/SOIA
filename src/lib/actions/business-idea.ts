'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const businessIdeaSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  targetMarket: z.string().optional(),
  resources: z.string().optional(),
})

export async function saveBusinessIdea(formData: FormData) {
  const session = await auth()
  if (!session || session.user.role !== 'AMBASSADOR') {
    return { error: 'Unauthorized' }
  }

  const ambassador = await prisma.ambassador.findUnique({
    where: { userId: session.user.id },
  })

  if (!ambassador) {
    return { error: 'Ambassador profile not found' }
  }

  const rawData = {
    title: formData.get('title') as string,
    description: formData.get('description') as string,
    targetMarket: formData.get('targetMarket') as string || undefined,
    resources: formData.get('resources') as string || undefined,
  }

  const validated = businessIdeaSchema.safeParse(rawData)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Validation failed' }
  }

  try {
    const businessIdea = await prisma.businessIdea.upsert({
      where: { ambassadorId: ambassador.id },
      update: {
        title: validated.data.title,
        description: validated.data.description,
        targetMarket: validated.data.targetMarket,
        resources: validated.data.resources,
        status: 'DRAFT',
      },
      create: {
        ambassadorId: ambassador.id,
        title: validated.data.title,
        description: validated.data.description,
        targetMarket: validated.data.targetMarket,
        resources: validated.data.resources,
        status: 'DRAFT',
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'SAVE_BUSINESS_IDEA',
        entityType: 'BusinessIdea',
        entityId: businessIdea.id,
      },
    })

    revalidatePath('/ambassador/business-idea')
    return { success: true }
  } catch (error) {
    console.error('Error saving business idea:', error)
    return { error: 'Failed to save business idea' }
  }
}

export async function submitBusinessIdea() {
  const session = await auth()
  if (!session || session.user.role !== 'AMBASSADOR') {
    return { error: 'Unauthorized' }
  }

  const ambassador = await prisma.ambassador.findUnique({
    where: { userId: session.user.id },
    include: { businessIdea: true },
  })

  if (!ambassador) {
    return { error: 'Ambassador profile not found' }
  }

  if (!ambassador.businessIdea) {
    return { error: 'No business idea to submit' }
  }

  if (ambassador.businessIdea.status !== 'DRAFT' && ambassador.businessIdea.status !== 'NEEDS_REVISION') {
    return { error: 'Business idea has already been submitted' }
  }

  try {
    await prisma.businessIdea.update({
      where: { id: ambassador.businessIdea.id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    })

    // Update onboarding progress
    const businessIdeaTask = await prisma.ambassadorOnboardingTask.findFirst({
      where: { type: 'BUSINESS_IDEA', isActive: true },
    })

    if (businessIdeaTask) {
      await prisma.ambassadorOnboardingProgress.upsert({
        where: {
          ambassadorId_taskId: { ambassadorId: ambassador.id, taskId: businessIdeaTask.id },
        },
        update: { status: 'SUBMITTED' },
        create: {
          ambassadorId: ambassador.id,
          taskId: businessIdeaTask.id,
          status: 'SUBMITTED',
        },
      })
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'SUBMIT_BUSINESS_IDEA',
        entityType: 'BusinessIdea',
        entityId: ambassador.businessIdea.id,
      },
    })

    revalidatePath('/ambassador/business-idea')
    revalidatePath('/admin/business-ideas')
    return { success: true }
  } catch (error) {
    console.error('Error submitting business idea:', error)
    return { error: 'Failed to submit business idea' }
  }
}

export async function reviewBusinessIdea(
  businessIdeaId: string,
  status: 'UNDER_REVIEW' | 'APPROVED' | 'NEEDS_REVISION' | 'REJECTED',
  feedback?: string
) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    // For UNDER_REVIEW, don't set reviewedAt yet - just mark as in progress
    const updateData = status === 'UNDER_REVIEW'
      ? {
          status,
          reviewedBy: session.user.id,
        }
      : {
          status,
          feedback,
          reviewedBy: session.user.id,
          reviewedAt: new Date(),
        }

    const businessIdea = await prisma.businessIdea.update({
      where: { id: businessIdeaId },
      data: updateData,
    })

    // Update onboarding progress if approved
    if (status === 'APPROVED') {
      const businessIdeaTask = await prisma.ambassadorOnboardingTask.findFirst({
        where: { type: 'BUSINESS_IDEA', isActive: true },
      })

      if (businessIdeaTask) {
        await prisma.ambassadorOnboardingProgress.upsert({
          where: {
            ambassadorId_taskId: { ambassadorId: businessIdea.ambassadorId, taskId: businessIdeaTask.id },
          },
          update: {
            status: 'APPROVED',
            completedAt: new Date(),
            reviewedBy: session.user.id,
            notes: feedback,
          },
          create: {
            ambassadorId: businessIdea.ambassadorId,
            taskId: businessIdeaTask.id,
            status: 'APPROVED',
            completedAt: new Date(),
            reviewedBy: session.user.id,
            notes: feedback,
          },
        })
      }
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'REVIEW_BUSINESS_IDEA',
        entityType: 'BusinessIdea',
        entityId: businessIdeaId,
        details: JSON.stringify({ status, feedback }),
      },
    })

    revalidatePath('/ambassador/business-idea')
    revalidatePath('/admin/business-ideas')
    return { success: true }
  } catch (error) {
    console.error('Error reviewing business idea:', error)
    return { error: 'Failed to review business idea' }
  }
}

export async function getBusinessIdeasForReview() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  const businessIdeas = await prisma.businessIdea.findMany({
    where: {
      status: { in: ['SUBMITTED', 'UNDER_REVIEW'] },
    },
    include: {
      ambassador: {
        include: {
          coach: {
            select: { firstName: true, lastName: true },
          },
        },
      },
    },
    orderBy: { submittedAt: 'asc' },
  })

  return { businessIdeas }
}

export async function getAllBusinessIdeas() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  const businessIdeas = await prisma.businessIdea.findMany({
    include: {
      ambassador: {
        include: {
          coach: {
            select: { firstName: true, lastName: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return { businessIdeas }
}
