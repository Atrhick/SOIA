'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { sendWelcomeInvite } from '@/lib/welcome-invite'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { upcomingHostCallsError, upcomingHostedCallsWhere } from '@/lib/prospect-pipeline'
import { ROLE_VIEW_NAMES, SWITCHABLE_ROLES, rolesOf, splitRoles } from '@/lib/roles'

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
        associateProfile: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return {
      users: users.map(u => ({
        id: u.id,
        email: u.email,
        role: u.role,
        extraRoles: u.extraRoles as string[],
        createdAt: u.createdAt.toISOString(),
        firstName: u.coachProfile?.firstName || u.ambassadorProfile?.firstName || u.associateProfile?.firstName || null,
        lastName: u.coachProfile?.lastName || u.ambassadorProfile?.lastName || u.associateProfile?.lastName || null,
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

    const hashedPassword = await bcrypt.hash(validated.data.password, 12)

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

    // Email them a one-time link to set their own password. After the user is
    // created, so a mail failure can never roll back the account - the admin
    // still has the password they typed as a fallback.
    const invite = await sendWelcomeInvite(
      user.id,
      validated.data.firstName || '',
      validated.data.role.toLowerCase()
    )

    revalidatePath('/admin/users')
    return {
      success: true,
      user: { id: user.id, email: user.email, role: user.role },
      inviteSent: invite.sent,
      inviteError: invite.error,
    }
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

  // Associates are managed at /admin/associates, where User.role and
  // AssociateProfile.type are written together. Changing the role here would
  // leave the two out of step: the account would route to a dashboard it has
  // no profile for, and no screen could set it back.
  const associateProfile = await prisma.associateProfile.findUnique({
    where: { userId },
    select: { id: true },
  })
  if (associateProfile) {
    return { error: 'Change this person’s association from the Associates page instead' }
  }

  try {
    // Only ADMIN users host discovery calls. Moving a host to another role would let the
    // coach/ambassador delete screens remove them with calls still booked.
    if (newRole !== 'ADMIN') {
      const upcoming = await prisma.discoveryCall.count({ where: upcomingHostedCallsWhere(userId, new Date()) })
      const blocked = upcomingHostCallsError(upcoming)
      if (blocked) return { error: blocked }
    }

    // A main role can't also be an extra one.
    const current = await prisma.user.findUnique({ where: { id: userId }, select: { extraRoles: true } })
    const user = await prisma.user.update({
      where: { id: userId },
      data: { role: newRole as typeof validRoles[number], extraRoles: (current?.extraRoles ?? []).filter((r) => r !== newRole) },
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

    // A discovery-call host's delete would cascade their DiscoveryHost row and set hostId to
    // null on their booked calls, leaving prospects booked with nobody to attend. Refuse, as
    // removeHost does. Counted inside the transaction so the check and the delete go together.
    const refused = await prisma.$transaction(async (tx) => {
      const upcoming = await tx.discoveryCall.count({ where: upcomingHostedCallsWhere(userId, new Date()) })
      const blocked = upcomingHostCallsError(upcoming)
      if (blocked) return blocked
      // Delete user (cascading deletes should handle related records)
      await tx.user.delete({ where: { id: userId } })
      return null
    })
    if (refused) return { error: refused }

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

  if (newPassword.length < 8) {
    return { error: 'Password must be at least 8 characters' }
  }

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 12)

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

const setRolesSchema = z.object({
  userId: z.string().min(1),
  roles: z.array(z.enum(SWITCHABLE_ROLES)).min(1, 'Pick at least one role'),
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  /** The coach who leads them, needed the first time someone is made an ambassador. */
  ambassadorCoachId: z.string().optional(),
})

/**
 * Gives one login any mix of the admin, coach and ambassador roles, so the person can switch views
 * instead of keeping a separate login per role. Adding coach or ambassador creates that profile the
 * first time; taking a role away keeps the profile and its history (adding it back reuses it).
 */
export async function setUserRoles(input: z.infer<typeof setRolesSchema>) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN' || session.user.isImpersonating) {
    return { error: 'Unauthorized' }
  }
  const parsed = setRolesSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Invalid data' }
  const { userId, roles, ambassadorCoachId } = parsed.data
  const split = splitRoles(roles)
  if (!split) return { error: 'Pick at least one role' }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, role: true, extraRoles: true,
      coachProfile: { select: { id: true, firstName: true, lastName: true } },
      ambassadorProfile: { select: { id: true, firstName: true, lastName: true } },
      associateProfile: { select: { id: true } },
    },
  })
  if (!user) return { error: 'User not found' }
  if (user.associateProfile) return { error: 'Change this person’s association from the Associates page instead' }
  if (rolesOf(user).some((r) => !(SWITCHABLE_ROLES as readonly string[]).includes(r))) {
    return { error: `Only ${SWITCHABLE_ROLES.map((r) => ROLE_VIEW_NAMES[r]).join(', ')} can be combined. Change this person’s main role first.` }
  }
  if (userId === session.user.id && !roles.includes('ADMIN')) return { error: 'You can’t take away your own admin role' }

  const had = rolesOf(user)
  // Only admins host discovery calls (same rule as changing the main role).
  if (had.includes('ADMIN') && !roles.includes('ADMIN')) {
    const upcoming = await prisma.discoveryCall.count({ where: upcomingHostedCallsWhere(userId, new Date()) })
    const blocked = upcomingHostCallsError(upcoming)
    if (blocked) return { error: blocked }
  }

  const known = user.coachProfile ?? user.ambassadorProfile
  const firstName = parsed.data.firstName || known?.firstName || ''
  const lastName = parsed.data.lastName || known?.lastName || ''
  const needsCoach = roles.includes('COACH') && !user.coachProfile
  const needsAmbassador = roles.includes('AMBASSADOR') && !user.ambassadorProfile
  if ((needsCoach || needsAmbassador) && !firstName) return { error: 'Add their first and last name first' }
  if (needsAmbassador) {
    if (!ambassadorCoachId) return { error: 'Choose the coach who leads them as an ambassador' }
    const coach = await prisma.coachProfile.findUnique({ where: { id: ambassadorCoachId }, select: { id: true } })
    if (!coach && ambassadorCoachId !== 'SELF') return { error: 'That coach was not found' }
    if (ambassadorCoachId === 'SELF' && !roles.includes('COACH')) return { error: 'Choose the coach who leads them as an ambassador' }
  }

  try {
    await prisma.$transaction(async (tx) => {
      let coachId = user.coachProfile?.id
      if (needsCoach) {
        const coach = await tx.coachProfile.create({ data: { userId, firstName, lastName, coachStatus: 'ONBOARDING_INCOMPLETE' } })
        await tx.businessExcellenceCRM.create({ data: { coachId: coach.id } })
        await tx.websiteContentStatus.create({ data: { coachId: coach.id } })
        coachId = coach.id
      }
      if (needsAmbassador) {
        await tx.ambassador.create({
          data: {
            userId,
            coachId: ambassadorCoachId === 'SELF' ? coachId! : ambassadorCoachId!,
            firstName,
            lastName,
            email: user.email,
            status: 'APPROVED',
          },
        })
      }
      await tx.user.update({ where: { id: userId }, data: { role: split.role, extraRoles: split.extraRoles } })
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'UPDATE_USER_ROLES',
          entityType: 'User',
          entityId: userId,
          details: JSON.stringify({ from: had, to: roles }),
        },
      })
    })
  } catch (error) {
    console.error('Error setting user roles:', error)
    return { error: 'Failed to save roles' }
  }

  revalidatePath('/admin/users')
  return { success: true, role: split.role, extraRoles: split.extraRoles as string[] }
}
