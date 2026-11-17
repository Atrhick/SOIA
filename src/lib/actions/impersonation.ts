'use server'

import type { UserRole } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { rolesOf } from '@/lib/roles'

/** The views "Login as User" can open. Never the admin view: one admin can't act as another inside admin pages. */
const VIEWABLE_ROLES = ['COACH', 'AMBASSADOR'] as const
type ViewableRole = (typeof VIEWABLE_ROLES)[number]
const isViewable = (r: unknown): r is ViewableRole => typeof r === 'string' && (VIEWABLE_ROLES as readonly string[]).includes(r)

export async function getUsersForImpersonation() {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  // Don't show impersonation options if already impersonating
  if (session.user.isImpersonating) {
    return { error: 'Already impersonating' }
  }

  // A login can hold several roles (role = highest, extraRoles = the rest), so an admin who is also a
  // coach is found through extraRoles. Each person is listed once per coach/ambassador view they have.
  const users = await prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      id: { not: session.user.id }, // your own other views are under "Switch view"
      OR: [{ role: { in: [...VIEWABLE_ROLES] } }, { extraRoles: { hasSome: [...VIEWABLE_ROLES] as UserRole[] } }],
    },
    include: {
      coachProfile: {
        select: { id: true, firstName: true, lastName: true }
      },
      ambassadorProfile: {
        select: { id: true, firstName: true, lastName: true }
      }
    },
    orderBy: { email: 'asc' },
    take: 1000
  })

  const formattedUsers = users.flatMap((user) => {
    const held = rolesOf(user)
    return VIEWABLE_ROLES.filter((r) => held.includes(r)).flatMap((role) => {
      const profile = role === 'COACH' ? user.coachProfile : user.ambassadorProfile
      if (!profile) return []
      return [{
        id: user.id,
        email: user.email,
        role,
        alsoAdmin: held.includes('ADMIN'),
        name: `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || user.email,
        coachId: user.coachProfile?.id,
        ambassadorId: user.ambassadorProfile?.id
      }]
    })
  })

  return { users: formattedUsers }
}

export async function getImpersonationData(userId: string, viewRole?: string) {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  if (session.user.isImpersonating) {
    return { error: 'Cannot impersonate while already impersonating. Switch back first.' }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      coachProfile: { select: { id: true } },
      ambassadorProfile: { select: { id: true } }
    }
  })

  if (!user) {
    return { error: 'User not found' }
  }

  // The caller being an admin is not sufficient - the TARGET must hold the coach or ambassador role
  // being opened (as its main role or an extra one). The admin view of another admin is never
  // opened. The session re-checks all of this against the database (auth.ts, loadRoleView).
  const role = viewRole ?? user.role
  if (!isViewable(role) || !rolesOf(user).includes(role) || user.id === session.user.id) {
    return { error: 'This user cannot be impersonated' }
  }

  // Log the impersonation
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'IMPERSONATE_USER',
      entityType: 'User',
      entityId: userId,
      details: JSON.stringify({ targetEmail: user.email, targetRole: role, targetMainRole: user.role })
    }
  })

  return {
    impersonateData: {
      id: user.id,
      role,
      ambassadorId: role === 'AMBASSADOR' ? user.ambassadorProfile?.id : undefined,
      coachId: role === 'COACH' ? user.coachProfile?.id : undefined
    }
  }
}
