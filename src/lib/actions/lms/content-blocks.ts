'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { z } from 'zod'

// ============================================
// VALIDATION SCHEMAS
// ============================================

const videoContentSchema = z.object({
  url: z.string().url('Invalid video URL'),
  provider: z.enum(['youtube', 'vimeo', 'custom']),
  duration: z.number().int().positive().optional(),
})

const textContentSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  format: z.enum(['markdown', 'html']).default('markdown'),
})

const quizContentSchema = z.object({
  surveyId: z.string().min(1, 'Quiz/Survey ID is required'),
})

const documentContentSchema = z.object({
  url: z.string().url('Invalid document URL'),
  fileName: z.string().min(1, 'File name is required'),
  fileSize: z.number().int().positive().optional(),
  mimeType: z.string().optional(),
})

const createContentBlockSchema = z.object({
  lessonId: z.string().min(1, 'Lesson ID is required'),
  title: z.string().optional(),
  type: z.enum(['VIDEO', 'TEXT', 'QUIZ', 'DOCUMENT']),
  content: z.any(), // Validated based on type
  completionThreshold: z.number().int().min(0).max(100).optional(),
})

const updateContentBlockSchema = z.object({
  title: z.string().optional().nullable(),
  content: z.any(),
  completionThreshold: z.number().int().min(0).max(100).optional().nullable(),
})

// ============================================
// HELPER FUNCTIONS
// ============================================

function validateContent(type: string, content: unknown) {
  switch (type) {
    case 'VIDEO':
      return videoContentSchema.safeParse(content)
    case 'TEXT':
      return textContentSchema.safeParse(content)
    case 'QUIZ':
      return quizContentSchema.safeParse(content)
    case 'DOCUMENT':
      return documentContentSchema.safeParse(content)
    default:
      return { success: false, error: { issues: [{ message: 'Invalid content type' }] } }
  }
}

async function getCourseIdFromLesson(lessonId: string) {
  const lesson = await prisma.lMSLesson.findUnique({
    where: { id: lessonId },
    select: { module: { select: { courseId: true } } },
  })
  return lesson?.module.courseId
}

async function getCourseIdFromContentBlock(contentBlockId: string) {
  const block = await prisma.lMSContentBlock.findUnique({
    where: { id: contentBlockId },
    select: { lesson: { select: { module: { select: { courseId: true } } } } },
  })
  return block?.lesson.module.courseId
}

// ============================================
// CONTENT BLOCK CRUD OPERATIONS
// ============================================

export async function createContentBlock(formData: FormData) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  const contentStr = formData.get('content') as string
  let content: unknown
  try {
    content = JSON.parse(contentStr)
  } catch {
    return { error: 'Invalid content format' }
  }

  const data = {
    lessonId: formData.get('lessonId') as string,
    title: (formData.get('title') as string) || undefined,
    type: formData.get('type') as 'VIDEO' | 'TEXT' | 'QUIZ' | 'DOCUMENT',
    content,
    completionThreshold: formData.get('completionThreshold')
      ? parseInt(formData.get('completionThreshold') as string)
      : undefined,
  }

  const validated = createContentBlockSchema.safeParse(data)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Validation failed' }
  }

  // Validate content based on type
  const contentValidation = validateContent(validated.data.type, validated.data.content)
  if (!contentValidation.success) {
    const errorMessage = 'issues' in contentValidation.error
      ? contentValidation.error.issues[0]?.message
      : 'Invalid content'
    return { error: errorMessage || 'Invalid content' }
  }

  try {
    // Verify lesson exists
    const lesson = await prisma.lMSLesson.findUnique({
      where: { id: validated.data.lessonId },
      select: { id: true, module: { select: { courseId: true } } },
    })

    if (!lesson) {
      return { error: 'Lesson not found' }
    }

    // Get the max sort order for this lesson
    const maxSortOrder = await prisma.lMSContentBlock.aggregate({
      where: { lessonId: validated.data.lessonId },
      _max: { sortOrder: true },
    })

    // Set default completion threshold based on type
    let completionThreshold = validated.data.completionThreshold
    if (completionThreshold === undefined) {
      switch (validated.data.type) {
        case 'VIDEO':
          completionThreshold = 80 // 80% watched
          break
        case 'QUIZ':
          completionThreshold = 70 // 70% passing score
          break
        default:
          completionThreshold = null as unknown as undefined // TEXT and DOCUMENT don't need threshold
      }
    }

    const block = await prisma.lMSContentBlock.create({
      data: {
        lessonId: validated.data.lessonId,
        title: validated.data.title,
        type: validated.data.type,
        content: validated.data.content,
        completionThreshold,
        sortOrder: (maxSortOrder._max.sortOrder || 0) + 1,
      },
    })

    revalidatePath(`/admin/lms/${lesson.module.courseId}`)
    return { success: true, contentBlockId: block.id }
  } catch (error) {
    console.error('Error creating content block:', error)
    return { error: 'Failed to create content block' }
  }
}

export async function updateContentBlock(contentBlockId: string, formData: FormData) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  const contentStr = formData.get('content') as string
  let content: unknown
  try {
    content = JSON.parse(contentStr)
  } catch {
    return { error: 'Invalid content format' }
  }

  const data = {
    title: (formData.get('title') as string) || null,
    content,
    completionThreshold: formData.get('completionThreshold')
      ? parseInt(formData.get('completionThreshold') as string)
      : null,
  }

  const validated = updateContentBlockSchema.safeParse(data)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Validation failed' }
  }

  try {
    const block = await prisma.lMSContentBlock.findUnique({
      where: { id: contentBlockId },
      select: { type: true, lesson: { select: { module: { select: { courseId: true } } } } },
    })

    if (!block) {
      return { error: 'Content block not found' }
    }

    // Validate content based on existing type
    const contentValidation = validateContent(block.type, validated.data.content)
    if (!contentValidation.success) {
      const errorMessage = 'issues' in contentValidation.error
        ? contentValidation.error.issues[0]?.message
        : 'Invalid content'
      return { error: errorMessage || 'Invalid content' }
    }

    await prisma.lMSContentBlock.update({
      where: { id: contentBlockId },
      data: {
        title: validated.data.title,
        content: validated.data.content,
        completionThreshold: validated.data.completionThreshold,
      },
    })

    revalidatePath(`/admin/lms/${block.lesson.module.courseId}`)
    return { success: true }
  } catch (error) {
    console.error('Error updating content block:', error)
    return { error: 'Failed to update content block' }
  }
}

export async function deleteContentBlock(contentBlockId: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  try {
    const block = await prisma.lMSContentBlock.findUnique({
      where: { id: contentBlockId },
      select: {
        title: true,
        type: true,
        lesson: { select: { module: { select: { courseId: true } } } }
      },
    })

    if (!block) {
      return { error: 'Content block not found' }
    }

    await prisma.lMSContentBlock.delete({
      where: { id: contentBlockId },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE_LMS_CONTENT_BLOCK',
        entityType: 'LMSContentBlock',
        entityId: contentBlockId,
        details: `Deleted ${block.type} content block: ${block.title || '(untitled)'}`,
      },
    })

    revalidatePath(`/admin/lms/${block.lesson.module.courseId}`)
    return { success: true }
  } catch (error) {
    console.error('Error deleting content block:', error)
    return { error: 'Failed to delete content block' }
  }
}

export async function reorderContentBlocks(lessonId: string, contentBlockIds: string[]) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  try {
    const courseId = await getCourseIdFromLesson(lessonId)
    if (!courseId) {
      return { error: 'Lesson not found' }
    }

    // Update sort order for each content block
    await Promise.all(
      contentBlockIds.map((id, index) =>
        prisma.lMSContentBlock.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    )

    revalidatePath(`/admin/lms/${courseId}`)
    return { success: true }
  } catch (error) {
    console.error('Error reordering content blocks:', error)
    return { error: 'Failed to reorder content blocks' }
  }
}

export async function duplicateContentBlock(contentBlockId: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  try {
    const block = await prisma.lMSContentBlock.findUnique({
      where: { id: contentBlockId },
      select: {
        lessonId: true,
        title: true,
        type: true,
        content: true,
        completionThreshold: true,
        lesson: { select: { module: { select: { courseId: true } } } },
      },
    })

    if (!block) {
      return { error: 'Content block not found' }
    }

    // Get the max sort order for this lesson
    const maxSortOrder = await prisma.lMSContentBlock.aggregate({
      where: { lessonId: block.lessonId },
      _max: { sortOrder: true },
    })

    const newBlock = await prisma.lMSContentBlock.create({
      data: {
        lessonId: block.lessonId,
        title: block.title ? `${block.title} (Copy)` : null,
        type: block.type,
        content: block.content === null ? Prisma.JsonNull : (block.content as Prisma.InputJsonValue),
        completionThreshold: block.completionThreshold,
        sortOrder: (maxSortOrder._max.sortOrder || 0) + 1,
      },
    })

    revalidatePath(`/admin/lms/${block.lesson.module.courseId}`)
    return { success: true, contentBlockId: newBlock.id }
  } catch (error) {
    console.error('Error duplicating content block:', error)
    return { error: 'Failed to duplicate content block' }
  }
}

// Get available surveys/quizzes for linking
export async function getAvailableSurveys() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  try {
    const surveys = await prisma.survey.findMany({
      where: {
        status: 'PUBLISHED',
        type: 'QUIZ',
      },
      select: {
        id: true,
        title: true,
        passingScore: true,
        _count: {
          select: { questions: true },
        },
      },
      orderBy: { title: 'asc' },
    })

    return {
      surveys: surveys.map((s) => ({
        id: s.id,
        title: s.title,
        passingScore: s.passingScore,
        questionCount: s._count.questions,
      })),
    }
  } catch (error) {
    console.error('Error fetching surveys:', error)
    return { error: 'Failed to fetch surveys' }
  }
}
