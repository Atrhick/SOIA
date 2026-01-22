'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'

// ============================================
// VALIDATION SCHEMAS
// ============================================

const createLessonSchema = z.object({
  moduleId: z.string().min(1, 'Module ID is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  estimatedDuration: z.number().int().positive().optional(),
})

const updateLessonSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().nullable(),
  estimatedDuration: z.number().int().positive().optional().nullable(),
})

// ============================================
// LESSON CRUD OPERATIONS
// ============================================

export async function createLesson(formData: FormData) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  const data = {
    moduleId: formData.get('moduleId') as string,
    title: formData.get('title') as string,
    description: (formData.get('description') as string) || undefined,
    estimatedDuration: formData.get('estimatedDuration')
      ? parseInt(formData.get('estimatedDuration') as string)
      : undefined,
  }

  const validated = createLessonSchema.safeParse(data)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Validation failed' }
  }

  try {
    // Verify module exists and get course ID
    const module = await prisma.lMSModule.findUnique({
      where: { id: validated.data.moduleId },
      select: { id: true, courseId: true },
    })

    if (!module) {
      return { error: 'Module not found' }
    }

    // Get the max sort order for this module
    const maxSortOrder = await prisma.lMSLesson.aggregate({
      where: { moduleId: validated.data.moduleId },
      _max: { sortOrder: true },
    })

    const lesson = await prisma.lMSLesson.create({
      data: {
        moduleId: validated.data.moduleId,
        title: validated.data.title,
        description: validated.data.description,
        estimatedDuration: validated.data.estimatedDuration,
        sortOrder: (maxSortOrder._max.sortOrder || 0) + 1,
      },
    })

    revalidatePath(`/admin/lms/${module.courseId}`)
    return { success: true, lessonId: lesson.id }
  } catch (error) {
    console.error('Error creating lesson:', error)
    return { error: 'Failed to create lesson' }
  }
}

export async function updateLesson(lessonId: string, formData: FormData) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  const data = {
    title: formData.get('title') as string,
    description: (formData.get('description') as string) || null,
    estimatedDuration: formData.get('estimatedDuration')
      ? parseInt(formData.get('estimatedDuration') as string)
      : null,
  }

  const validated = updateLessonSchema.safeParse(data)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Validation failed' }
  }

  try {
    const lesson = await prisma.lMSLesson.findUnique({
      where: { id: lessonId },
      select: { module: { select: { courseId: true } } },
    })

    if (!lesson) {
      return { error: 'Lesson not found' }
    }

    await prisma.lMSLesson.update({
      where: { id: lessonId },
      data: {
        title: validated.data.title,
        description: validated.data.description,
        estimatedDuration: validated.data.estimatedDuration,
      },
    })

    revalidatePath(`/admin/lms/${lesson.module.courseId}`)
    return { success: true }
  } catch (error) {
    console.error('Error updating lesson:', error)
    return { error: 'Failed to update lesson' }
  }
}

export async function deleteLesson(lessonId: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  try {
    const lesson = await prisma.lMSLesson.findUnique({
      where: { id: lessonId },
      select: { title: true, module: { select: { courseId: true } } },
    })

    if (!lesson) {
      return { error: 'Lesson not found' }
    }

    await prisma.lMSLesson.delete({
      where: { id: lessonId },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE_LMS_LESSON',
        entityType: 'LMSLesson',
        entityId: lessonId,
        details: `Deleted lesson: ${lesson.title}`,
      },
    })

    revalidatePath(`/admin/lms/${lesson.module.courseId}`)
    return { success: true }
  } catch (error) {
    console.error('Error deleting lesson:', error)
    return { error: 'Failed to delete lesson' }
  }
}

export async function reorderLessons(moduleId: string, lessonIds: string[]) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  try {
    // Get the course ID for revalidation
    const module = await prisma.lMSModule.findUnique({
      where: { id: moduleId },
      select: { courseId: true },
    })

    if (!module) {
      return { error: 'Module not found' }
    }

    // Update sort order for each lesson
    await Promise.all(
      lessonIds.map((id, index) =>
        prisma.lMSLesson.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    )

    revalidatePath(`/admin/lms/${module.courseId}`)
    return { success: true }
  } catch (error) {
    console.error('Error reordering lessons:', error)
    return { error: 'Failed to reorder lessons' }
  }
}

export async function moveLesson(lessonId: string, targetModuleId: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  try {
    const lesson = await prisma.lMSLesson.findUnique({
      where: { id: lessonId },
      select: { module: { select: { courseId: true } } },
    })

    if (!lesson) {
      return { error: 'Lesson not found' }
    }

    // Get max sort order in target module
    const maxSortOrder = await prisma.lMSLesson.aggregate({
      where: { moduleId: targetModuleId },
      _max: { sortOrder: true },
    })

    await prisma.lMSLesson.update({
      where: { id: lessonId },
      data: {
        moduleId: targetModuleId,
        sortOrder: (maxSortOrder._max.sortOrder || 0) + 1,
      },
    })

    revalidatePath(`/admin/lms/${lesson.module.courseId}`)
    return { success: true }
  } catch (error) {
    console.error('Error moving lesson:', error)
    return { error: 'Failed to move lesson' }
  }
}
