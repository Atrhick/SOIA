'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'

// ============================================
// VALIDATION SCHEMAS
// ============================================

const createModuleSchema = z.object({
  courseId: z.string().min(1, 'Course ID is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
})

const updateModuleSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().nullable(),
  unlockAfterModuleId: z.string().optional().nullable(),
})

// ============================================
// MODULE CRUD OPERATIONS
// ============================================

export async function createModule(formData: FormData) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  const data = {
    courseId: formData.get('courseId') as string,
    title: formData.get('title') as string,
    description: (formData.get('description') as string) || undefined,
  }

  const validated = createModuleSchema.safeParse(data)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Validation failed' }
  }

  try {
    // Verify course exists
    const course = await prisma.lMSCourse.findUnique({
      where: { id: validated.data.courseId },
      select: { id: true },
    })

    if (!course) {
      return { error: 'Course not found' }
    }

    // Get the max sort order for this course
    const maxSortOrder = await prisma.lMSModule.aggregate({
      where: { courseId: validated.data.courseId },
      _max: { sortOrder: true },
    })

    const module = await prisma.lMSModule.create({
      data: {
        courseId: validated.data.courseId,
        title: validated.data.title,
        description: validated.data.description,
        sortOrder: (maxSortOrder._max.sortOrder || 0) + 1,
      },
    })

    revalidatePath(`/admin/lms/${validated.data.courseId}`)
    return { success: true, moduleId: module.id }
  } catch (error) {
    console.error('Error creating module:', error)
    return { error: 'Failed to create module' }
  }
}

export async function updateModule(moduleId: string, formData: FormData) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  const data = {
    title: formData.get('title') as string,
    description: (formData.get('description') as string) || null,
    unlockAfterModuleId: (formData.get('unlockAfterModuleId') as string) || null,
  }

  const validated = updateModuleSchema.safeParse(data)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Validation failed' }
  }

  try {
    const module = await prisma.lMSModule.findUnique({
      where: { id: moduleId },
      select: { courseId: true },
    })

    if (!module) {
      return { error: 'Module not found' }
    }

    await prisma.lMSModule.update({
      where: { id: moduleId },
      data: {
        title: validated.data.title,
        description: validated.data.description,
        unlockAfterModuleId: validated.data.unlockAfterModuleId,
      },
    })

    revalidatePath(`/admin/lms/${module.courseId}`)
    return { success: true }
  } catch (error) {
    console.error('Error updating module:', error)
    return { error: 'Failed to update module' }
  }
}

export async function deleteModule(moduleId: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  try {
    const module = await prisma.lMSModule.findUnique({
      where: { id: moduleId },
      select: { courseId: true, title: true },
    })

    if (!module) {
      return { error: 'Module not found' }
    }

    await prisma.lMSModule.delete({
      where: { id: moduleId },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE_LMS_MODULE',
        entityType: 'LMSModule',
        entityId: moduleId,
        details: `Deleted module: ${module.title}`,
      },
    })

    revalidatePath(`/admin/lms/${module.courseId}`)
    return { success: true }
  } catch (error) {
    console.error('Error deleting module:', error)
    return { error: 'Failed to delete module' }
  }
}

export async function reorderModules(courseId: string, moduleIds: string[]) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  try {
    // Update sort order for each module
    await Promise.all(
      moduleIds.map((id, index) =>
        prisma.lMSModule.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    )

    revalidatePath(`/admin/lms/${courseId}`)
    return { success: true }
  } catch (error) {
    console.error('Error reordering modules:', error)
    return { error: 'Failed to reorder modules' }
  }
}
