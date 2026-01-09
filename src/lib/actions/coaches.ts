'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const createCoachSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  country: z.string().optional(),
  recruiterId: z.string().optional(),
})

const updateCoachSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  bio: z.string().optional(),
  phone: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  country: z.string().optional(),
})

export async function createCoach(formData: FormData) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    firstName: formData.get('firstName') as string,
    lastName: formData.get('lastName') as string,
    phone: formData.get('phone') as string || undefined,
    city: formData.get('city') as string || undefined,
    region: formData.get('region') as string || undefined,
    country: formData.get('country') as string || undefined,
    recruiterId: formData.get('recruiterId') as string || undefined,
  }

  const validated = createCoachSchema.safeParse(data)
  if (!validated.success) {
    const issues = validated.error.issues
    return { error: issues[0]?.message || 'Validation failed' }
  }

  // Check if email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: validated.data.email },
  })

  if (existingUser) {
    return { error: 'A user with this email already exists' }
  }

  try {
    // Hash password
    const hashedPassword = await bcrypt.hash(validated.data.password, 12)

    // Create user and coach profile in transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: validated.data.email,
          password: hashedPassword,
          role: 'COACH',
          status: 'ACTIVE',
        },
      })

      const coachProfile = await tx.coachProfile.create({
        data: {
          userId: user.id,
          firstName: validated.data.firstName,
          lastName: validated.data.lastName,
          phone: validated.data.phone || null,
          city: validated.data.city || null,
          region: validated.data.region || null,
          country: validated.data.country || null,
          recruiterId: validated.data.recruiterId || null,
          coachStatus: 'ONBOARDING_INCOMPLETE',
        },
      })

      // Create initial business excellence records
      await tx.businessExcellenceCRM.create({
        data: { coachId: coachProfile.id },
      })

      await tx.websiteContentStatus.create({
        data: { coachId: coachProfile.id },
      })

      return { user, coachProfile }
    })

    // Set feature permissions if provided
    const featurePermissionsJson = formData.get('featurePermissions') as string
    if (featurePermissionsJson) {
      try {
        const permissions = JSON.parse(featurePermissionsJson) as { feature: string; granted: boolean }[]
        if (permissions.length > 0) {
          await prisma.userFeaturePermission.createMany({
            data: permissions.map(p => ({
              userId: result.user.id,
              feature: p.feature,
              granted: p.granted,
            }))
          })
        }
      } catch (e) {
        console.error('Error parsing feature permissions:', e)
      }
    }

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE_COACH',
        entityType: 'Coach',
        entityId: result.coachProfile.id,
        details: `Created coach: ${validated.data.firstName} ${validated.data.lastName} (${validated.data.email})`,
      },
    })

    revalidatePath('/admin/coaches')
    return { success: true, coachId: result.coachProfile.id, userId: result.user.id }
  } catch (error) {
    console.error('Error creating coach:', error)
    return { error: 'Failed to create coach' }
  }
}

export async function updateCoach(coachId: string, formData: FormData) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  const data = {
    firstName: formData.get('firstName') as string,
    lastName: formData.get('lastName') as string,
    bio: formData.get('bio') as string || undefined,
    phone: formData.get('phone') as string || undefined,
    city: formData.get('city') as string || undefined,
    region: formData.get('region') as string || undefined,
    country: formData.get('country') as string || undefined,
  }

  const validated = updateCoachSchema.safeParse(data)
  if (!validated.success) {
    const issues = validated.error.issues
    return { error: issues[0]?.message || 'Validation failed' }
  }

  try {
    await prisma.coachProfile.update({
      where: { id: coachId },
      data: {
        firstName: validated.data.firstName,
        lastName: validated.data.lastName,
        bio: validated.data.bio || null,
        phone: validated.data.phone || null,
        city: validated.data.city || null,
        region: validated.data.region || null,
        country: validated.data.country || null,
      },
    })

    revalidatePath('/admin/coaches')
    revalidatePath(`/admin/coaches/${coachId}`)
    return { success: true }
  } catch (error) {
    console.error('Error updating coach:', error)
    return { error: 'Failed to update coach' }
  }
}

export async function updateCoachUserStatus(
  coachId: string,
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  try {
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { id: coachId },
    })

    if (!coachProfile) {
      return { error: 'Coach not found' }
    }

    await prisma.user.update({
      where: { id: coachProfile.userId },
      data: { status },
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE_COACH_STATUS',
        entityType: 'Coach',
        entityId: coachId,
        details: `Updated user status to: ${status}`,
      },
    })

    revalidatePath('/admin/coaches')
    revalidatePath(`/admin/coaches/${coachId}`)
    return { success: true }
  } catch (error) {
    console.error('Error updating coach status:', error)
    return { error: 'Failed to update status' }
  }
}

export async function updateCoachOnboardingStatus(
  coachId: string,
  coachStatus: 'ONBOARDING_INCOMPLETE' | 'ACTIVE_COACH'
) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  try {
    await prisma.coachProfile.update({
      where: { id: coachId },
      data: { coachStatus },
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE_COACH_ONBOARDING_STATUS',
        entityType: 'Coach',
        entityId: coachId,
        details: `Updated coach status to: ${coachStatus}`,
      },
    })

    revalidatePath('/admin/coaches')
    revalidatePath(`/admin/coaches/${coachId}`)
    return { success: true }
  } catch (error) {
    console.error('Error updating coach status:', error)
    return { error: 'Failed to update status' }
  }
}

export async function updateOnboardingTaskByAdmin(
  coachId: string,
  taskId: string,
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED'
) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  try {
    await prisma.coachOnboardingProgress.upsert({
      where: {
        coachId_taskId: { coachId, taskId },
      },
      update: {
        status,
        completedAt: status === 'APPROVED' ? new Date() : null,
      },
      create: {
        coachId,
        taskId,
        status,
        completedAt: status === 'APPROVED' ? new Date() : null,
      },
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE_ONBOARDING_TASK',
        entityType: 'OnboardingProgress',
        entityId: `${coachId}-${taskId}`,
        details: `Updated task ${taskId} to: ${status}`,
      },
    })

    revalidatePath('/admin/coaches')
    revalidatePath(`/admin/coaches/${coachId}`)
    return { success: true }
  } catch (error) {
    console.error('Error updating onboarding task:', error)
    return { error: 'Failed to update task' }
  }
}

export async function resetCoachPassword(coachId: string, newPassword: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  if (newPassword.length < 6) {
    return { error: 'Password must be at least 6 characters' }
  }

  try {
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { id: coachId },
    })

    if (!coachProfile) {
      return { error: 'Coach not found' }
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12)

    await prisma.user.update({
      where: { id: coachProfile.userId },
      data: { password: hashedPassword },
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'RESET_COACH_PASSWORD',
        entityType: 'Coach',
        entityId: coachId,
        details: 'Password was reset by admin',
      },
    })

    return { success: true }
  } catch (error) {
    console.error('Error resetting password:', error)
    return { error: 'Failed to reset password' }
  }
}
