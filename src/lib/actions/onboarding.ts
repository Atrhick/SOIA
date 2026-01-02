'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'

// Schema for profile update
const profileSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  bio: z.string().optional(),
  phone: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  country: z.string().optional(),
})

export async function updateCoachProfile(formData: FormData) {
  const session = await auth()
  if (!session || session.user.role !== 'COACH') {
    return { error: 'Unauthorized' }
  }

  const data = {
    firstName: formData.get('firstName') as string,
    lastName: formData.get('lastName') as string,
    bio: formData.get('bio') as string,
    phone: formData.get('phone') as string,
    city: formData.get('city') as string,
    region: formData.get('region') as string,
    country: formData.get('country') as string,
  }

  const validated = profileSchema.safeParse(data)
  if (!validated.success) {
    const issues = validated.error.issues
    return { error: issues[0]?.message || 'Validation failed' }
  }

  try {
    await prisma.coachProfile.update({
      where: { userId: session.user.id },
      data: validated.data,
    })

    // Mark profile task as completed
    await markTaskProgress(session.user.id, 'complete-coach-profile', 'SUBMITTED')

    revalidatePath('/coach/onboarding')
    return { success: true }
  } catch (error) {
    console.error('Error updating profile:', error)
    return { error: 'Failed to update profile' }
  }
}

export async function uploadProfilePhoto(formData: FormData) {
  const session = await auth()
  if (!session || session.user.role !== 'COACH') {
    return { error: 'Unauthorized' }
  }

  const file = formData.get('photo') as File
  if (!file || file.size === 0) {
    return { error: 'No file provided' }
  }

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return { error: 'Invalid file type. Please upload a JPEG, PNG, or WebP image.' }
  }

  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    return { error: 'File too large. Maximum size is 5MB.' }
  }

  try {
    // In production, you'd upload to S3/Cloudinary. For now, store as base64
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = `data:${file.type};base64,${buffer.toString('base64')}`

    await prisma.coachProfile.update({
      where: { userId: session.user.id },
      data: { photoUrl: base64 },
    })

    // Mark photo task as completed
    await markTaskProgress(session.user.id, 'upload-profile-photo', 'APPROVED')

    revalidatePath('/coach/onboarding')
    return { success: true }
  } catch (error) {
    console.error('Error uploading photo:', error)
    return { error: 'Failed to upload photo' }
  }
}

export async function markCourseAsWatched(courseId: string) {
  const session = await auth()
  if (!session || session.user.role !== 'COACH') {
    return { error: 'Unauthorized' }
  }

  try {
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: session.user.id },
    })

    if (!coachProfile) {
      return { error: 'Coach profile not found' }
    }

    // Map course to onboarding task
    const taskMapping: Record<string, string> = {
      'anti-human-trafficking': 'watch-anti–human-trafficking-course',
      'ambassador-workbook': 'complete-ambassador-workbook',
    }

    const taskId = taskMapping[courseId]
    if (taskId) {
      await markTaskProgress(session.user.id, taskId, 'SUBMITTED')
    }

    revalidatePath('/coach/onboarding')
    return { success: true }
  } catch (error) {
    console.error('Error marking course:', error)
    return { error: 'Failed to mark course as watched' }
  }
}

export async function submitQuizAnswers(
  courseId: string,
  answers: Record<string, string>
) {
  const session = await auth()
  if (!session || session.user.role !== 'COACH') {
    return { error: 'Unauthorized' }
  }

  try {
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: session.user.id },
    })

    if (!coachProfile) {
      return { error: 'Coach profile not found' }
    }

    // Get quiz questions with correct answers
    const questions = await prisma.quizQuestion.findMany({
      where: { courseId },
      include: { options: true },
    })

    // Calculate score
    let correctCount = 0
    for (const question of questions) {
      const selectedOptionId = answers[question.id]
      const correctOption = question.options.find((o) => o.isCorrect)
      if (selectedOptionId === correctOption?.id) {
        correctCount++
      }
    }

    const score = (correctCount / questions.length) * 100
    const passed = score >= 80

    // Save quiz result
    await prisma.quizResult.create({
      data: {
        coachId: coachProfile.id,
        courseId,
        score,
        passed,
      },
    })

    // If passed, mark the assessment task as approved
    if (passed && courseId === 'anti-human-trafficking') {
      await markTaskProgress(
        session.user.id,
        'pass-anti–human-trafficking-assessment',
        'APPROVED'
      )
    }

    revalidatePath('/coach/onboarding')
    return { success: true, score, passed }
  } catch (error) {
    console.error('Error submitting quiz:', error)
    return { error: 'Failed to submit quiz' }
  }
}

export async function updateOnboardingTask(
  taskId: string,
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED'
) {
  const session = await auth()
  if (!session || session.user.role !== 'COACH') {
    return { error: 'Unauthorized' }
  }

  try {
    await markTaskProgress(session.user.id, taskId, status)
    await checkAndUpdateCoachStatus(session.user.id)
    revalidatePath('/coach/onboarding')
    return { success: true }
  } catch (error) {
    console.error('Error updating task:', error)
    return { error: 'Failed to update task' }
  }
}

export async function confirmWorkbookReceived() {
  const session = await auth()
  if (!session || session.user.role !== 'COACH') {
    return { error: 'Unauthorized' }
  }

  try {
    await markTaskProgress(
      session.user.id,
      'confirm-receipt-of-coach-workbook',
      'APPROVED'
    )
    await checkAndUpdateCoachStatus(session.user.id)
    revalidatePath('/coach/onboarding')
    return { success: true }
  } catch (error) {
    console.error('Error confirming workbook:', error)
    return { error: 'Failed to confirm workbook receipt' }
  }
}

// Helper function to mark task progress
async function markTaskProgress(
  userId: string,
  taskId: string,
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED'
) {
  const coachProfile = await prisma.coachProfile.findUnique({
    where: { userId },
  })

  if (!coachProfile) return

  const task = await prisma.onboardingTask.findFirst({
    where: { id: taskId },
  })

  if (!task) return

  await prisma.coachOnboardingProgress.upsert({
    where: {
      coachId_taskId: {
        coachId: coachProfile.id,
        taskId: task.id,
      },
    },
    update: {
      status,
      completedAt: status === 'APPROVED' ? new Date() : null,
    },
    create: {
      coachId: coachProfile.id,
      taskId: task.id,
      status,
      completedAt: status === 'APPROVED' ? new Date() : null,
    },
  })
}

// Check if all required tasks are complete and update coach status
async function checkAndUpdateCoachStatus(userId: string) {
  const coachProfile = await prisma.coachProfile.findUnique({
    where: { userId },
    include: {
      onboardingProgress: true,
      ambassadors: { where: { status: 'APPROVED' } },
    },
  })

  if (!coachProfile) return

  const requiredTasks = await prisma.onboardingTask.findMany({
    where: { isRequired: true, isActive: true },
  })

  const completedTasks = coachProfile.onboardingProgress.filter(
    (p) => p.status === 'APPROVED'
  )

  const allTasksComplete = requiredTasks.every((task) =>
    completedTasks.some((p) => p.taskId === task.id)
  )

  const hasEnoughAmbassadors = coachProfile.ambassadors.length >= 2

  if (allTasksComplete && hasEnoughAmbassadors) {
    await prisma.coachProfile.update({
      where: { id: coachProfile.id },
      data: { coachStatus: 'ACTIVE_COACH' },
    })
  }
}
