'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function getUsersForImpersonation() {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  // Don't show impersonation options if already impersonating
  if (session.user.isImpersonating) {
    return { error: 'Already impersonating' }
  }

  const users = await prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      role: { in: ['COACH', 'AMBASSADOR'] }
    },
    include: {
      coachProfile: {
        select: { id: true, firstName: true, lastName: true }
      },
      ambassadorProfile: {
        select: { id: true, firstName: true, lastName: true }
      }
    },
    orderBy: [
      { role: 'asc' },
      { email: 'asc' }
    ],
    take: 50 // Limit for performance
  })

  const formattedUsers = users.map(user => ({
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.role === 'COACH'
      ? `${user.coachProfile?.firstName || ''} ${user.coachProfile?.lastName || ''}`.trim() || user.email
      : `${user.ambassadorProfile?.firstName || ''} ${user.ambassadorProfile?.lastName || ''}`.trim() || user.email,
    coachId: user.coachProfile?.id,
    ambassadorId: user.ambassadorProfile?.id
  }))

  return { users: formattedUsers }
}

export async function getImpersonationData(userId: string) {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
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

  // Log the impersonation
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'IMPERSONATE_USER',
      entityType: 'User',
      entityId: userId,
      details: JSON.stringify({ targetEmail: user.email, targetRole: user.role })
    }
  })

  return {
    impersonateData: {
      id: user.id,
      role: user.role,
      ambassadorId: user.ambassadorProfile?.id,
      coachId: user.coachProfile?.id
    }
  }
}
