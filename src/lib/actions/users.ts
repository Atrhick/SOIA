'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['ADMIN', 'COACH', 'AMBASSADOR']),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
})

export async function getAllUsers() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    const users = await prisma.user.findMany({
      include: {
        coachProfile: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            coachStatus: true,
          }
        },
        ambassadorProfile: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            status: true,
          }
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return {
      users: users.map(u => ({
        id: u.id,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt.toISOString(),
        firstName: u.coachProfile?.firstName || u.ambassadorProfile?.firstName || null,
        lastName: u.coachProfile?.lastName || u.ambassadorProfile?.lastName || null,
        status: u.coachProfile?.coachStatus || u.ambassadorProfile?.status || null,
        coachId: u.coachProfile?.id || null,
        ambassadorId: u.ambassadorProfile?.id || null,
      }))
    }
  } catch (error) {
    console.error('Error fetching users:', error)
    return { error: 'Failed to fetch users' }
  }
}

export async function createUser(formData: FormData) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    role: formData.get('role') as string,
    firstName: formData.get('firstName') as string || undefined,
    lastName: formData.get('lastName') as string || undefined,
  }

  const validated = createUserSchema.safeParse(data)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Invalid data' }
  }

  try {
    // Check if email already exists
    const existing = await prisma.user.findUnique({
      where: { email: validated.data.email },
    })

    if (existing) {
      return { error: 'A user with this email already exists' }
    }

    const hashedPassword = await bcrypt.hash(validated.data.password, 10)

    // Create user with appropriate profile
    // Note: Ambassador profiles require a coach connection, so they are created
    // separately through the ambassador management flow, not here
    const user = await prisma.user.create({
      data: {
        email: validated.data.email,
        password: hashedPassword,
        role: validated.data.role,
        ...(validated.data.role === 'COACH' && {
          coachProfile: {
            create: {
              firstName: validated.data.firstName || '',
              lastName: validated.data.lastName || '',
              coachStatus: 'ONBOARDING_INCOMPLETE',
            }
          }
        }),
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE_USER',
        entityType: 'User',
        entityId: user.id,
        details: JSON.stringify({ email: validated.data.email, role: validated.data.role }),
      },
    })

    revalidatePath('/admin/users')
    return { success: true, user: { id: user.id, email: user.email, role: user.role } }
  } catch (error) {
    console.error('Error creating user:', error)
    return { error: 'Failed to create user' }
  }
}

export async function updateUserRole(userId: string, newRole: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  const validRoles = ['ADMIN', 'COACH', 'AMBASSADOR', 'PARENT'] as const
  if (!validRoles.includes(newRole as typeof validRoles[number])) {
    return { error: 'Invalid role' }
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { role: newRole as typeof validRoles[number] },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE_USER_ROLE',
        entityType: 'User',
        entityId: userId,
        details: JSON.stringify({ newRole }),
      },
    })

    revalidatePath('/admin/users')
    return { success: true, user }
  } catch (error) {
    console.error('Error updating user role:', error)
    return { error: 'Failed to update user role' }
  }
}

export async function deleteUser(userId: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  // Prevent self-deletion
  if (userId === session.user.id) {
    return { error: 'Cannot delete your own account' }
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return { error: 'User not found' }
    }

    // Delete user (cascading deletes should handle related records)
    await prisma.user.delete({
      where: { id: userId },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE_USER',
        entityType: 'User',
        entityId: userId,
        details: JSON.stringify({ email: user.email, role: user.role }),
      },
    })

    revalidatePath('/admin/users')
    return { success: true }
  } catch (error) {
    console.error('Error deleting user:', error)
    return { error: 'Failed to delete user. User may have related data.' }
  }
}

export async function resetUserPassword(userId: string, newPassword: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  if (newPassword.length < 6) {
    return { error: 'Password must be at least 6 characters' }
  }

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'RESET_USER_PASSWORD',
        entityType: 'User',
        entityId: userId,
        details: JSON.stringify({ action: 'password_reset' }),
      },
    })

    revalidatePath('/admin/users')
    return { success: true }
  } catch (error) {
    console.error('Error resetting password:', error)
    return { error: 'Failed to reset password' }
  }
}

// ============ USER FEATURE PERMISSIONS ============

export async function getUserFeaturePermissions(userId: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    const permissions = await prisma.userFeaturePermission.findMany({
      where: { userId },
    })

    return {
      permissions: permissions.map(p => ({
        id: p.id,
        feature: p.feature,
        granted: p.granted,
      }))
    }
  } catch (error) {
    console.error('Error fetching user permissions:', error)
    return { error: 'Failed to fetch permissions' }
  }
}

export async function setUserFeaturePermission(
  userId: string,
  feature: string,
  granted: boolean
) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    const permission = await prisma.userFeaturePermission.upsert({
      where: {
        userId_feature: { userId, feature }
      },
      update: { granted },
      create: { userId, feature, granted },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: granted ? 'GRANT_FEATURE' : 'DENY_FEATURE',
        entityType: 'UserFeaturePermission',
        entityId: permission.id,
        details: JSON.stringify({ targetUserId: userId, feature, granted }),
      },
    })

    revalidatePath('/admin/users')
    return { success: true, permission }
  } catch (error) {
    console.error('Error setting user permission:', error)
    return { error: 'Failed to set permission' }
  }
}

export async function removeUserFeaturePermission(userId: string, feature: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    await prisma.userFeaturePermission.delete({
      where: {
        userId_feature: { userId, feature }
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'REMOVE_FEATURE_OVERRIDE',
        entityType: 'UserFeaturePermission',
        entityId: `${userId}-${feature}`,
        details: JSON.stringify({ targetUserId: userId, feature }),
      },
    })

    revalidatePath('/admin/users')
    return { success: true }
  } catch (error) {
    console.error('Error removing user permission:', error)
    return { error: 'Failed to remove permission' }
  }
}

export async function setUserFeaturePermissions(
  userId: string,
  permissions: { feature: string; granted: boolean }[]
) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    // Delete all existing permissions for this user
    await prisma.userFeaturePermission.deleteMany({
      where: { userId }
    })

    // Create new permissions
    if (permissions.length > 0) {
      await prisma.userFeaturePermission.createMany({
        data: permissions.map(p => ({
          userId,
          feature: p.feature,
          granted: p.granted,
        }))
      })
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE_USER_PERMISSIONS',
        entityType: 'User',
        entityId: userId,
        details: JSON.stringify({ permissions }),
      },
    })

    revalidatePath('/admin/users')
    return { success: true }
  } catch (error) {
    console.error('Error setting user permissions:', error)
    return { error: 'Failed to set permissions' }
  }
}
