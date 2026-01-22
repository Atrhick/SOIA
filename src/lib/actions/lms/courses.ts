'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'

// ============================================
// VALIDATION SCHEMAS
// ============================================

const createCourseSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  thumbnail: z.string().url().optional().or(z.literal('')),
  allowedRoles: z.array(z.string()).min(1, 'At least one role must be selected'),
  prerequisiteIds: z.array(z.string()).optional(),
  estimatedDuration: z.number().int().positive().optional(),
})

const updateCourseSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  thumbnail: z.string().url().optional().or(z.literal('')).nullable(),
  allowedRoles: z.array(z.string()).min(1, 'At least one role must be selected'),
  prerequisiteIds: z.array(z.string()).optional(),
  estimatedDuration: z.number().int().positive().optional().nullable(),
  sortOrder: z.number().int().optional(),
})

// ============================================
// COURSE CRUD OPERATIONS
// ============================================

export async function getCourses(options?: {
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  includeEnrollmentCounts?: boolean
}) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  try {
    const courses = await prisma.lMSCourse.findMany({
      where: options?.status ? { status: options.status } : undefined,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: {
        modules: {
          select: { id: true },
        },
        _count: options?.includeEnrollmentCounts
          ? {
              select: {
                enrollments: true,
              },
            }
          : undefined,
      },
    })

    // Serialize dates
    const serializedCourses = courses.map((course) => ({
      ...course,
      createdAt: course.createdAt.toISOString(),
      updatedAt: course.updatedAt.toISOString(),
      publishedAt: course.publishedAt?.toISOString() || null,
      moduleCount: course.modules.length,
      enrollmentCount: (course._count as { enrollments?: number })?.enrollments || 0,
    }))

    return { courses: serializedCourses }
  } catch (error) {
    console.error('Error fetching courses:', error)
    return { error: 'Failed to fetch courses' }
  }
}

export async function getCourse(courseId: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  try {
    const course = await prisma.lMSCourse.findUnique({
      where: { id: courseId },
      include: {
        modules: {
          orderBy: { sortOrder: 'asc' },
          include: {
            lessons: {
              orderBy: { sortOrder: 'asc' },
              include: {
                contentBlocks: {
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
          },
        },
        _count: {
          select: {
            enrollments: true,
          },
        },
      },
    })

    if (!course) {
      return { error: 'Course not found' }
    }

    // Serialize dates recursively
    const serializedCourse = {
      ...course,
      createdAt: course.createdAt.toISOString(),
      updatedAt: course.updatedAt.toISOString(),
      publishedAt: course.publishedAt?.toISOString() || null,
      enrollmentCount: course._count.enrollments,
      modules: course.modules.map((module) => ({
        ...module,
        createdAt: module.createdAt.toISOString(),
        updatedAt: module.updatedAt.toISOString(),
        lessons: module.lessons.map((lesson) => ({
          ...lesson,
          createdAt: lesson.createdAt.toISOString(),
          updatedAt: lesson.updatedAt.toISOString(),
          contentBlocks: lesson.contentBlocks.map((block) => ({
            ...block,
            content: (block.content as Record<string, unknown>) || {},
            createdAt: block.createdAt.toISOString(),
            updatedAt: block.updatedAt.toISOString(),
          })),
        })),
      })),
    }

    return { course: serializedCourse }
  } catch (error) {
    console.error('Error fetching course:', error)
    return { error: 'Failed to fetch course' }
  }
}

export async function createCourse(formData: FormData) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  const data = {
    title: formData.get('title') as string,
    description: (formData.get('description') as string) || undefined,
    thumbnail: (formData.get('thumbnail') as string) || undefined,
    allowedRoles: JSON.parse((formData.get('allowedRoles') as string) || '[]'),
    prerequisiteIds: JSON.parse((formData.get('prerequisiteIds') as string) || '[]'),
    estimatedDuration: formData.get('estimatedDuration')
      ? parseInt(formData.get('estimatedDuration') as string)
      : undefined,
  }

  const validated = createCourseSchema.safeParse(data)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Validation failed' }
  }

  try {
    // Get the max sort order
    const maxSortOrder = await prisma.lMSCourse.aggregate({
      _max: { sortOrder: true },
    })

    const course = await prisma.lMSCourse.create({
      data: {
        title: validated.data.title,
        description: validated.data.description,
        thumbnail: validated.data.thumbnail || null,
        allowedRoles: validated.data.allowedRoles,
        prerequisiteIds: validated.data.prerequisiteIds || [],
        estimatedDuration: validated.data.estimatedDuration,
        sortOrder: (maxSortOrder._max.sortOrder || 0) + 1,
        createdBy: session.user.id,
        status: 'DRAFT',
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE_LMS_COURSE',
        entityType: 'LMSCourse',
        entityId: course.id,
        details: `Created LMS course: ${validated.data.title}`,
      },
    })

    revalidatePath('/admin/lms')
    return { success: true, courseId: course.id }
  } catch (error) {
    console.error('Error creating course:', error)
    return { error: 'Failed to create course' }
  }
}

export async function updateCourse(courseId: string, formData: FormData) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  const data = {
    title: formData.get('title') as string,
    description: (formData.get('description') as string) || undefined,
    thumbnail: (formData.get('thumbnail') as string) || null,
    allowedRoles: JSON.parse((formData.get('allowedRoles') as string) || '[]'),
    prerequisiteIds: JSON.parse((formData.get('prerequisiteIds') as string) || '[]'),
    estimatedDuration: formData.get('estimatedDuration')
      ? parseInt(formData.get('estimatedDuration') as string)
      : null,
    sortOrder: formData.get('sortOrder')
      ? parseInt(formData.get('sortOrder') as string)
      : undefined,
  }

  const validated = updateCourseSchema.safeParse(data)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Validation failed' }
  }

  try {
    await prisma.lMSCourse.update({
      where: { id: courseId },
      data: {
        title: validated.data.title,
        description: validated.data.description,
        thumbnail: validated.data.thumbnail,
        allowedRoles: validated.data.allowedRoles,
        prerequisiteIds: validated.data.prerequisiteIds || [],
        estimatedDuration: validated.data.estimatedDuration,
        sortOrder: validated.data.sortOrder,
      },
    })

    revalidatePath('/admin/lms')
    revalidatePath(`/admin/lms/${courseId}`)
    return { success: true }
  } catch (error) {
    console.error('Error updating course:', error)
    return { error: 'Failed to update course' }
  }
}

export async function deleteCourse(courseId: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  try {
    const course = await prisma.lMSCourse.findUnique({
      where: { id: courseId },
      select: {
        title: true,
        _count: { select: { enrollments: true } },
      },
    })

    if (!course) {
      return { error: 'Course not found' }
    }

    // Prevent deletion if there are enrollments
    if (course._count.enrollments > 0) {
      return { error: 'Cannot delete course with existing enrollments. Archive it instead.' }
    }

    await prisma.lMSCourse.delete({
      where: { id: courseId },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE_LMS_COURSE',
        entityType: 'LMSCourse',
        entityId: courseId,
        details: `Deleted LMS course: ${course.title}`,
      },
    })

    revalidatePath('/admin/lms')
    return { success: true }
  } catch (error) {
    console.error('Error deleting course:', error)
    return { error: 'Failed to delete course' }
  }
}

export async function publishCourse(courseId: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  try {
    const course = await prisma.lMSCourse.findUnique({
      where: { id: courseId },
      include: {
        modules: {
          include: {
            lessons: {
              include: {
                contentBlocks: true,
              },
            },
          },
        },
      },
    })

    if (!course) {
      return { error: 'Course not found' }
    }

    // Validate course has content
    if (course.modules.length === 0) {
      return { error: 'Course must have at least one module before publishing' }
    }

    const hasLessons = course.modules.some((m) => m.lessons.length > 0)
    if (!hasLessons) {
      return { error: 'Course must have at least one lesson before publishing' }
    }

    const hasContent = course.modules.some((m) =>
      m.lessons.some((l) => l.contentBlocks.length > 0)
    )
    if (!hasContent) {
      return { error: 'Course must have at least one content block before publishing' }
    }

    await prisma.lMSCourse.update({
      where: { id: courseId },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'PUBLISH_LMS_COURSE',
        entityType: 'LMSCourse',
        entityId: courseId,
        details: `Published LMS course: ${course.title}`,
      },
    })

    revalidatePath('/admin/lms')
    revalidatePath(`/admin/lms/${courseId}`)
    return { success: true }
  } catch (error) {
    console.error('Error publishing course:', error)
    return { error: 'Failed to publish course' }
  }
}

export async function unpublishCourse(courseId: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  try {
    const course = await prisma.lMSCourse.findUnique({
      where: { id: courseId },
      select: { title: true },
    })

    if (!course) {
      return { error: 'Course not found' }
    }

    await prisma.lMSCourse.update({
      where: { id: courseId },
      data: {
        status: 'DRAFT',
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UNPUBLISH_LMS_COURSE',
        entityType: 'LMSCourse',
        entityId: courseId,
        details: `Unpublished LMS course: ${course.title}`,
      },
    })

    revalidatePath('/admin/lms')
    revalidatePath(`/admin/lms/${courseId}`)
    return { success: true }
  } catch (error) {
    console.error('Error unpublishing course:', error)
    return { error: 'Failed to unpublish course' }
  }
}

export async function archiveCourse(courseId: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  try {
    const course = await prisma.lMSCourse.findUnique({
      where: { id: courseId },
      select: { title: true },
    })

    if (!course) {
      return { error: 'Course not found' }
    }

    await prisma.lMSCourse.update({
      where: { id: courseId },
      data: {
        status: 'ARCHIVED',
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'ARCHIVE_LMS_COURSE',
        entityType: 'LMSCourse',
        entityId: courseId,
        details: `Archived LMS course: ${course.title}`,
      },
    })

    revalidatePath('/admin/lms')
    revalidatePath(`/admin/lms/${courseId}`)
    return { success: true }
  } catch (error) {
    console.error('Error archiving course:', error)
    return { error: 'Failed to archive course' }
  }
}

export async function reorderCourses(courseIds: string[]) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  try {
    // Update sort order for each course
    await Promise.all(
      courseIds.map((id, index) =>
        prisma.lMSCourse.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    )

    revalidatePath('/admin/lms')
    return { success: true }
  } catch (error) {
    console.error('Error reordering courses:', error)
    return { error: 'Failed to reorder courses' }
  }
}
