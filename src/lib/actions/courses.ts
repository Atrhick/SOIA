'use server'

import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// Validation schemas
const courseSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  videoUrl: z.string().optional(),
  embedCode: z.string().optional(),
  isRequired: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
})

const questionSchema = z.object({
  questionText: z.string().min(1, 'Question text is required'),
  sortOrder: z.number().int().default(0),
  options: z.array(z.object({
    optionText: z.string().min(1, 'Option text is required'),
    isCorrect: z.boolean().default(false),
  })).min(2, 'At least 2 options required'),
})

// Helper to check admin
async function isAdmin() {
  const session = await auth()
  return session?.user.role === 'ADMIN'
}

// Get all courses with questions
export async function getAllCourses() {
  if (!(await isAdmin())) {
    return { error: 'Unauthorized' }
  }

  const courses = await prisma.course.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      questions: {
        orderBy: { sortOrder: 'asc' },
        include: {
          options: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
      results: {
        select: {
          id: true,
          passed: true,
        },
      },
    },
  })

  return { courses }
}

// Create a new course
export async function createCourse(formData: FormData) {
  if (!(await isAdmin())) {
    return { error: 'Unauthorized' }
  }

  const data = {
    name: formData.get('name') as string,
    description: formData.get('description') as string || undefined,
    videoUrl: formData.get('videoUrl') as string || undefined,
    embedCode: formData.get('embedCode') as string || undefined,
    isRequired: formData.get('isRequired') === 'true',
    sortOrder: parseInt(formData.get('sortOrder') as string || '0'),
    isActive: formData.get('isActive') !== 'false',
  }

  const validated = courseSchema.safeParse(data)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Invalid input' }
  }

  try {
    await prisma.course.create({
      data: validated.data,
    })

    revalidatePath('/admin/courses')
    return { success: true }
  } catch (error) {
    console.error('Error creating course:', error)
    return { error: 'Failed to create course' }
  }
}

// Update a course
export async function updateCourse(courseId: string, formData: FormData) {
  if (!(await isAdmin())) {
    return { error: 'Unauthorized' }
  }

  const data = {
    name: formData.get('name') as string,
    description: formData.get('description') as string || undefined,
    videoUrl: formData.get('videoUrl') as string || undefined,
    embedCode: formData.get('embedCode') as string || undefined,
    isRequired: formData.get('isRequired') === 'true',
    sortOrder: parseInt(formData.get('sortOrder') as string || '0'),
    isActive: formData.get('isActive') !== 'false',
  }

  const validated = courseSchema.safeParse(data)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Invalid input' }
  }

  try {
    await prisma.course.update({
      where: { id: courseId },
      data: validated.data,
    })

    revalidatePath('/admin/courses')
    return { success: true }
  } catch (error) {
    console.error('Error updating course:', error)
    return { error: 'Failed to update course' }
  }
}

// Delete a course
export async function deleteCourse(courseId: string) {
  if (!(await isAdmin())) {
    return { error: 'Unauthorized' }
  }

  try {
    await prisma.course.delete({
      where: { id: courseId },
    })

    revalidatePath('/admin/courses')
    return { success: true }
  } catch (error) {
    console.error('Error deleting course:', error)
    return { error: 'Failed to delete course' }
  }
}

// Toggle course active status
export async function toggleCourseActive(courseId: string) {
  if (!(await isAdmin())) {
    return { error: 'Unauthorized' }
  }

  try {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    })

    if (!course) {
      return { error: 'Course not found' }
    }

    await prisma.course.update({
      where: { id: courseId },
      data: { isActive: !course.isActive },
    })

    revalidatePath('/admin/courses')
    return { success: true }
  } catch (error) {
    console.error('Error toggling course:', error)
    return { error: 'Failed to toggle course status' }
  }
}

// Add a question to a course
export async function addQuestion(courseId: string, data: {
  questionText: string
  sortOrder?: number
  options: { optionText: string; isCorrect: boolean }[]
}) {
  if (!(await isAdmin())) {
    return { error: 'Unauthorized' }
  }

  const validated = questionSchema.safeParse(data)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Invalid input' }
  }

  // Ensure at least one correct answer
  const hasCorrectAnswer = validated.data.options.some(o => o.isCorrect)
  if (!hasCorrectAnswer) {
    return { error: 'At least one option must be marked as correct' }
  }

  try {
    await prisma.quizQuestion.create({
      data: {
        courseId,
        questionText: validated.data.questionText,
        sortOrder: validated.data.sortOrder || 0,
        options: {
          create: validated.data.options.map((opt, index) => ({
            optionText: opt.optionText,
            isCorrect: opt.isCorrect,
            sortOrder: index,
          })),
        },
      },
    })

    revalidatePath('/admin/courses')
    return { success: true }
  } catch (error) {
    console.error('Error adding question:', error)
    return { error: 'Failed to add question' }
  }
}

// Update a question
export async function updateQuestion(questionId: string, data: {
  questionText: string
  sortOrder?: number
  options: { optionText: string; isCorrect: boolean }[]
}) {
  if (!(await isAdmin())) {
    return { error: 'Unauthorized' }
  }

  const validated = questionSchema.safeParse(data)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Invalid input' }
  }

  const hasCorrectAnswer = validated.data.options.some(o => o.isCorrect)
  if (!hasCorrectAnswer) {
    return { error: 'At least one option must be marked as correct' }
  }

  try {
    // Delete existing options and recreate
    await prisma.quizOption.deleteMany({
      where: { questionId },
    })

    await prisma.quizQuestion.update({
      where: { id: questionId },
      data: {
        questionText: validated.data.questionText,
        sortOrder: validated.data.sortOrder || 0,
        options: {
          create: validated.data.options.map((opt, index) => ({
            optionText: opt.optionText,
            isCorrect: opt.isCorrect,
            sortOrder: index,
          })),
        },
      },
    })

    revalidatePath('/admin/courses')
    return { success: true }
  } catch (error) {
    console.error('Error updating question:', error)
    return { error: 'Failed to update question' }
  }
}

// Delete a question
export async function deleteQuestion(questionId: string) {
  if (!(await isAdmin())) {
    return { error: 'Unauthorized' }
  }

  try {
    await prisma.quizQuestion.delete({
      where: { id: questionId },
    })

    revalidatePath('/admin/courses')
    return { success: true }
  } catch (error) {
    console.error('Error deleting question:', error)
    return { error: 'Failed to delete question' }
  }
}

// Get course statistics
export async function getCourseStats() {
  if (!(await isAdmin())) {
    return { error: 'Unauthorized' }
  }

  const [courses, totalResults, passedResults] = await Promise.all([
    prisma.course.count(),
    prisma.quizResult.count(),
    prisma.quizResult.count({ where: { passed: true } }),
  ])

  return {
    totalCourses: courses,
    totalAttempts: totalResults,
    passedAttempts: passedResults,
    passRate: totalResults > 0 ? Math.round((passedResults / totalResults) * 100) : 0,
  }
}
