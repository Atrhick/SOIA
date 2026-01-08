'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const classSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  date: z.string().optional(),
  duration: z.coerce.number().optional(),
  location: z.string().optional(),
  isOnline: z.boolean().default(false),
  meetingLink: z.string().optional(),
  isFree: z.boolean().default(true),
  price: z.coerce.number().optional(),
  maxCapacity: z.coerce.number().optional(),
})

// Coach actions

export async function createClass(formData: FormData) {
  const session = await auth()
  if (!session || session.user.role !== 'COACH') {
    return { error: 'Unauthorized' }
  }

  const coachProfile = await prisma.coachProfile.findUnique({
    where: { userId: session.user.id },
  })

  if (!coachProfile) {
    return { error: 'Coach profile not found' }
  }

  const rawData = {
    title: formData.get('title') as string,
    description: formData.get('description') as string || undefined,
    date: formData.get('date') as string || undefined,
    duration: formData.get('duration') ? parseInt(formData.get('duration') as string) : undefined,
    location: formData.get('location') as string || undefined,
    isOnline: formData.get('isOnline') === 'true',
    meetingLink: formData.get('meetingLink') as string || undefined,
    isFree: formData.get('isFree') !== 'false',
    price: formData.get('price') ? parseFloat(formData.get('price') as string) : undefined,
    maxCapacity: formData.get('maxCapacity') ? parseInt(formData.get('maxCapacity') as string) : undefined,
  }

  const validated = classSchema.safeParse(rawData)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Validation failed' }
  }

  try {
    const newClass = await prisma.coachClass.create({
      data: {
        coachId: coachProfile.id,
        title: validated.data.title,
        description: validated.data.description,
        date: validated.data.date ? new Date(validated.data.date) : null,
        duration: validated.data.duration,
        location: validated.data.location,
        isOnline: validated.data.isOnline,
        meetingLink: validated.data.meetingLink,
        isFree: validated.data.isFree,
        price: validated.data.isFree ? null : validated.data.price,
        maxCapacity: validated.data.maxCapacity,
        isActive: true,
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE_CLASS',
        entityType: 'CoachClass',
        entityId: newClass.id,
      },
    })

    revalidatePath('/coach/classes')
    return { success: true, classId: newClass.id }
  } catch (error) {
    console.error('Error creating class:', error)
    return { error: 'Failed to create class' }
  }
}

export async function updateClass(classId: string, formData: FormData) {
  const session = await auth()
  if (!session || session.user.role !== 'COACH') {
    return { error: 'Unauthorized' }
  }

  const coachProfile = await prisma.coachProfile.findUnique({
    where: { userId: session.user.id },
  })

  if (!coachProfile) {
    return { error: 'Coach profile not found' }
  }

  const existingClass = await prisma.coachClass.findFirst({
    where: { id: classId, coachId: coachProfile.id },
  })

  if (!existingClass) {
    return { error: 'Class not found' }
  }

  const rawData = {
    title: formData.get('title') as string,
    description: formData.get('description') as string || undefined,
    date: formData.get('date') as string || undefined,
    duration: formData.get('duration') ? parseInt(formData.get('duration') as string) : undefined,
    location: formData.get('location') as string || undefined,
    isOnline: formData.get('isOnline') === 'true',
    meetingLink: formData.get('meetingLink') as string || undefined,
    isFree: formData.get('isFree') !== 'false',
    price: formData.get('price') ? parseFloat(formData.get('price') as string) : undefined,
    maxCapacity: formData.get('maxCapacity') ? parseInt(formData.get('maxCapacity') as string) : undefined,
  }

  const validated = classSchema.safeParse(rawData)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Validation failed' }
  }

  try {
    await prisma.coachClass.update({
      where: { id: classId },
      data: {
        title: validated.data.title,
        description: validated.data.description,
        date: validated.data.date ? new Date(validated.data.date) : null,
        duration: validated.data.duration,
        location: validated.data.location,
        isOnline: validated.data.isOnline,
        meetingLink: validated.data.meetingLink,
        isFree: validated.data.isFree,
        price: validated.data.isFree ? null : validated.data.price,
        maxCapacity: validated.data.maxCapacity,
      },
    })

    revalidatePath('/coach/classes')
    return { success: true }
  } catch (error) {
    console.error('Error updating class:', error)
    return { error: 'Failed to update class' }
  }
}

export async function deleteClass(classId: string) {
  const session = await auth()
  if (!session || session.user.role !== 'COACH') {
    return { error: 'Unauthorized' }
  }

  const coachProfile = await prisma.coachProfile.findUnique({
    where: { userId: session.user.id },
  })

  if (!coachProfile) {
    return { error: 'Coach profile not found' }
  }

  const existingClass = await prisma.coachClass.findFirst({
    where: { id: classId, coachId: coachProfile.id },
  })

  if (!existingClass) {
    return { error: 'Class not found' }
  }

  try {
    await prisma.coachClass.delete({
      where: { id: classId },
    })

    revalidatePath('/coach/classes')
    return { success: true }
  } catch (error) {
    console.error('Error deleting class:', error)
    return { error: 'Failed to delete class' }
  }
}

export async function toggleClassActive(classId: string) {
  const session = await auth()
  if (!session || session.user.role !== 'COACH') {
    return { error: 'Unauthorized' }
  }

  const coachProfile = await prisma.coachProfile.findUnique({
    where: { userId: session.user.id },
  })

  if (!coachProfile) {
    return { error: 'Coach profile not found' }
  }

  const existingClass = await prisma.coachClass.findFirst({
    where: { id: classId, coachId: coachProfile.id },
  })

  if (!existingClass) {
    return { error: 'Class not found' }
  }

  try {
    await prisma.coachClass.update({
      where: { id: classId },
      data: { isActive: !existingClass.isActive },
    })

    revalidatePath('/coach/classes')
    return { success: true }
  } catch (error) {
    console.error('Error toggling class status:', error)
    return { error: 'Failed to update class status' }
  }
}

export async function getCoachClasses() {
  const session = await auth()
  if (!session || session.user.role !== 'COACH') {
    return { error: 'Unauthorized' }
  }

  const coachProfile = await prisma.coachProfile.findUnique({
    where: { userId: session.user.id },
  })

  if (!coachProfile) {
    return { error: 'Coach profile not found' }
  }

  const classes = await prisma.coachClass.findMany({
    where: { coachId: coachProfile.id },
    include: {
      enrollments: {
        include: {
          ambassador: {
            select: { firstName: true, lastName: true },
          },
        },
      },
      _count: {
        select: { enrollments: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return { classes }
}

// Ambassador actions

export async function getAvailableClasses() {
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

  const classes = await prisma.coachClass.findMany({
    where: { isActive: true },
    include: {
      coach: {
        select: { firstName: true, lastName: true },
      },
      _count: {
        select: { enrollments: true },
      },
      enrollments: {
        where: { ambassadorId: ambassador.id },
        select: { id: true, status: true, paymentStatus: true },
      },
    },
    orderBy: [{ date: 'asc' }, { createdAt: 'desc' }],
  })

  return { classes }
}

export async function enrollInClass(classId: string) {
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

  const targetClass = await prisma.coachClass.findUnique({
    where: { id: classId },
    include: {
      _count: { select: { enrollments: true } },
    },
  })

  if (!targetClass || !targetClass.isActive) {
    return { error: 'Class not found or not available' }
  }

  // Check capacity
  if (targetClass.maxCapacity && targetClass._count.enrollments >= targetClass.maxCapacity) {
    return { error: 'Class is full' }
  }

  // Check if already enrolled
  const existingEnrollment = await prisma.classEnrollment.findUnique({
    where: {
      ambassadorId_classId: { ambassadorId: ambassador.id, classId },
    },
  })

  if (existingEnrollment) {
    return { error: 'Already enrolled in this class' }
  }

  try {
    await prisma.classEnrollment.create({
      data: {
        ambassadorId: ambassador.id,
        classId,
        status: 'ENROLLED',
        paymentStatus: targetClass.isFree ? 'NOT_REQUIRED' : 'PENDING',
      },
    })

    // Check if this completes the class selection task
    const classSelectionTask = await prisma.ambassadorOnboardingTask.findFirst({
      where: { type: 'CLASS_SELECTION', isActive: true },
    })

    if (classSelectionTask) {
      await prisma.ambassadorOnboardingProgress.upsert({
        where: {
          ambassadorId_taskId: { ambassadorId: ambassador.id, taskId: classSelectionTask.id },
        },
        update: {
          status: 'APPROVED',
          completedAt: new Date(),
        },
        create: {
          ambassadorId: ambassador.id,
          taskId: classSelectionTask.id,
          status: 'APPROVED',
          completedAt: new Date(),
        },
      })
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'ENROLL_IN_CLASS',
        entityType: 'ClassEnrollment',
        entityId: classId,
        details: JSON.stringify({ ambassadorId: ambassador.id }),
      },
    })

    revalidatePath('/ambassador/classes')
    revalidatePath('/ambassador/onboarding')
    return { success: true }
  } catch (error) {
    console.error('Error enrolling in class:', error)
    return { error: 'Failed to enroll in class' }
  }
}

export async function withdrawFromClass(classId: string) {
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

  const enrollment = await prisma.classEnrollment.findUnique({
    where: {
      ambassadorId_classId: { ambassadorId: ambassador.id, classId },
    },
  })

  if (!enrollment) {
    return { error: 'Not enrolled in this class' }
  }

  try {
    await prisma.classEnrollment.delete({
      where: { id: enrollment.id },
    })

    revalidatePath('/ambassador/classes')
    return { success: true }
  } catch (error) {
    console.error('Error withdrawing from class:', error)
    return { error: 'Failed to withdraw from class' }
  }
}

export async function getMyEnrollments() {
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

  const enrollments = await prisma.classEnrollment.findMany({
    where: { ambassadorId: ambassador.id },
    include: {
      class: {
        include: {
          coach: {
            select: { firstName: true, lastName: true },
          },
        },
      },
    },
    orderBy: { enrolledAt: 'desc' },
  })

  return { enrollments }
}

// Admin actions

export async function getAllClasses() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  const classes = await prisma.coachClass.findMany({
    include: {
      coach: {
        select: { firstName: true, lastName: true },
      },
      _count: {
        select: { enrollments: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return { classes }
}

export async function markAttendance(classId: string, ambassadorIds: string[], attended: boolean) {
  const session = await auth()
  if (!session || (session.user.role !== 'COACH' && session.user.role !== 'ADMIN')) {
    return { error: 'Unauthorized' }
  }

  try {
    await prisma.classEnrollment.updateMany({
      where: {
        classId,
        ambassadorId: { in: ambassadorIds },
      },
      data: {
        status: attended ? 'ATTENDED' : 'ENROLLED',
        attendedAt: attended ? new Date() : null,
      },
    })

    revalidatePath('/coach/classes')
    return { success: true }
  } catch (error) {
    console.error('Error marking attendance:', error)
    return { error: 'Failed to mark attendance' }
  }
}
