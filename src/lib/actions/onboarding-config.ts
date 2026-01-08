'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// ============================================
// COACH ONBOARDING TASKS
// ============================================

const coachTaskSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  description: z.string().optional(),
  type: z.enum(['MANUAL_STATUS', 'VIDEO', 'QUIZ', 'UPLOAD', 'BOOLEAN']),
  isRequired: z.boolean().default(true),
  sortOrder: z.number().default(0),
  isActive: z.boolean().default(true),
})

export async function getCoachOnboardingTasks() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  const tasks = await prisma.onboardingTask.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      _count: {
        select: { progress: true },
      },
    },
  })

  return { tasks }
}

export async function createCoachOnboardingTask(formData: FormData) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  const rawData = {
    label: formData.get('label') as string,
    description: formData.get('description') as string || undefined,
    type: formData.get('type') as string,
    isRequired: formData.get('isRequired') === 'true',
    sortOrder: parseInt(formData.get('sortOrder') as string) || 0,
    isActive: formData.get('isActive') !== 'false',
  }

  const validated = coachTaskSchema.safeParse(rawData)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Validation failed' }
  }

  try {
    // Get the highest sort order if not provided
    if (!rawData.sortOrder) {
      const maxOrder = await prisma.onboardingTask.aggregate({
        _max: { sortOrder: true },
      })
      validated.data.sortOrder = (maxOrder._max.sortOrder || 0) + 1
    }

    const task = await prisma.onboardingTask.create({
      data: validated.data,
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE_COACH_ONBOARDING_TASK',
        entityType: 'OnboardingTask',
        entityId: task.id,
        details: JSON.stringify({ label: task.label }),
      },
    })

    revalidatePath('/admin/onboarding')
    return { success: true, taskId: task.id }
  } catch (error) {
    console.error('Error creating coach onboarding task:', error)
    return { error: 'Failed to create task' }
  }
}

export async function updateCoachOnboardingTask(taskId: string, formData: FormData) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  const rawData = {
    label: formData.get('label') as string,
    description: formData.get('description') as string || undefined,
    type: formData.get('type') as string,
    isRequired: formData.get('isRequired') === 'true',
    sortOrder: parseInt(formData.get('sortOrder') as string) || 0,
    isActive: formData.get('isActive') === 'true',
  }

  const validated = coachTaskSchema.safeParse(rawData)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Validation failed' }
  }

  try {
    await prisma.onboardingTask.update({
      where: { id: taskId },
      data: validated.data,
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE_COACH_ONBOARDING_TASK',
        entityType: 'OnboardingTask',
        entityId: taskId,
        details: JSON.stringify({ label: validated.data.label }),
      },
    })

    revalidatePath('/admin/onboarding')
    return { success: true }
  } catch (error) {
    console.error('Error updating coach onboarding task:', error)
    return { error: 'Failed to update task' }
  }
}

export async function deleteCoachOnboardingTask(taskId: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    // Check if task has any progress records
    const progressCount = await prisma.coachOnboardingProgress.count({
      where: { taskId },
    })

    if (progressCount > 0) {
      // Soft delete - just mark as inactive
      await prisma.onboardingTask.update({
        where: { id: taskId },
        data: { isActive: false },
      })
    } else {
      // Hard delete if no progress
      await prisma.onboardingTask.delete({
        where: { id: taskId },
      })
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE_COACH_ONBOARDING_TASK',
        entityType: 'OnboardingTask',
        entityId: taskId,
      },
    })

    revalidatePath('/admin/onboarding')
    return { success: true }
  } catch (error) {
    console.error('Error deleting coach onboarding task:', error)
    return { error: 'Failed to delete task' }
  }
}

export async function reorderCoachOnboardingTasks(taskIds: string[]) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    await prisma.$transaction(
      taskIds.map((id, index) =>
        prisma.onboardingTask.update({
          where: { id },
          data: { sortOrder: index + 1 },
        })
      )
    )

    revalidatePath('/admin/onboarding')
    return { success: true }
  } catch (error) {
    console.error('Error reordering coach onboarding tasks:', error)
    return { error: 'Failed to reorder tasks' }
  }
}

// ============================================
// AMBASSADOR ONBOARDING TASKS
// ============================================

const ambassadorTaskSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  description: z.string().optional(),
  type: z.enum(['INTERVIEW', 'WHATSAPP_TEAM', 'BUSINESS_IDEA', 'POWER_TEAM', 'CLASS_SELECTION', 'MANUAL_STATUS']),
  isRequired: z.boolean().default(true),
  sortOrder: z.number().default(0),
  isActive: z.boolean().default(true),
})

export async function getAmbassadorOnboardingTasks() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  const tasks = await prisma.ambassadorOnboardingTask.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      _count: {
        select: { progress: true },
      },
    },
  })

  return { tasks }
}

export async function createAmbassadorOnboardingTask(formData: FormData) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  const rawData = {
    label: formData.get('label') as string,
    description: formData.get('description') as string || undefined,
    type: formData.get('type') as string,
    isRequired: formData.get('isRequired') === 'true',
    sortOrder: parseInt(formData.get('sortOrder') as string) || 0,
    isActive: formData.get('isActive') !== 'false',
  }

  const validated = ambassadorTaskSchema.safeParse(rawData)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Validation failed' }
  }

  try {
    // Get the highest sort order if not provided
    if (!rawData.sortOrder) {
      const maxOrder = await prisma.ambassadorOnboardingTask.aggregate({
        _max: { sortOrder: true },
      })
      validated.data.sortOrder = (maxOrder._max.sortOrder || 0) + 1
    }

    const task = await prisma.ambassadorOnboardingTask.create({
      data: validated.data,
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE_AMBASSADOR_ONBOARDING_TASK',
        entityType: 'AmbassadorOnboardingTask',
        entityId: task.id,
        details: JSON.stringify({ label: task.label }),
      },
    })

    revalidatePath('/admin/onboarding')
    return { success: true, taskId: task.id }
  } catch (error) {
    console.error('Error creating ambassador onboarding task:', error)
    return { error: 'Failed to create task' }
  }
}

export async function updateAmbassadorOnboardingTask(taskId: string, formData: FormData) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  const rawData = {
    label: formData.get('label') as string,
    description: formData.get('description') as string || undefined,
    type: formData.get('type') as string,
    isRequired: formData.get('isRequired') === 'true',
    sortOrder: parseInt(formData.get('sortOrder') as string) || 0,
    isActive: formData.get('isActive') === 'true',
  }

  const validated = ambassadorTaskSchema.safeParse(rawData)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Validation failed' }
  }

  try {
    await prisma.ambassadorOnboardingTask.update({
      where: { id: taskId },
      data: validated.data,
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE_AMBASSADOR_ONBOARDING_TASK',
        entityType: 'AmbassadorOnboardingTask',
        entityId: taskId,
        details: JSON.stringify({ label: validated.data.label }),
      },
    })

    revalidatePath('/admin/onboarding')
    return { success: true }
  } catch (error) {
    console.error('Error updating ambassador onboarding task:', error)
    return { error: 'Failed to update task' }
  }
}

export async function deleteAmbassadorOnboardingTask(taskId: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    // Check if task has any progress records
    const progressCount = await prisma.ambassadorOnboardingProgress.count({
      where: { taskId },
    })

    if (progressCount > 0) {
      // Soft delete - just mark as inactive
      await prisma.ambassadorOnboardingTask.update({
        where: { id: taskId },
        data: { isActive: false },
      })
    } else {
      // Hard delete if no progress
      await prisma.ambassadorOnboardingTask.delete({
        where: { id: taskId },
      })
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE_AMBASSADOR_ONBOARDING_TASK',
        entityType: 'AmbassadorOnboardingTask',
        entityId: taskId,
      },
    })

    revalidatePath('/admin/onboarding')
    return { success: true }
  } catch (error) {
    console.error('Error deleting ambassador onboarding task:', error)
    return { error: 'Failed to delete task' }
  }
}

export async function reorderAmbassadorOnboardingTasks(taskIds: string[]) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    await prisma.$transaction(
      taskIds.map((id, index) =>
        prisma.ambassadorOnboardingTask.update({
          where: { id },
          data: { sortOrder: index + 1 },
        })
      )
    )

    revalidatePath('/admin/onboarding')
    return { success: true }
  } catch (error) {
    console.error('Error reordering ambassador onboarding tasks:', error)
    return { error: 'Failed to reorder tasks' }
  }
}

export async function toggleTaskActive(taskId: string, taskType: 'coach' | 'ambassador') {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    if (taskType === 'coach') {
      const task = await prisma.onboardingTask.findUnique({ where: { id: taskId } })
      if (!task) return { error: 'Task not found' }

      await prisma.onboardingTask.update({
        where: { id: taskId },
        data: { isActive: !task.isActive },
      })
    } else {
      const task = await prisma.ambassadorOnboardingTask.findUnique({ where: { id: taskId } })
      if (!task) return { error: 'Task not found' }

      await prisma.ambassadorOnboardingTask.update({
        where: { id: taskId },
        data: { isActive: !task.isActive },
      })
    }

    revalidatePath('/admin/onboarding')
    return { success: true }
  } catch (error) {
    console.error('Error toggling task active status:', error)
    return { error: 'Failed to toggle task status' }
  }
}
