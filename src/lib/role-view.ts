import type { UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { isSwitchableRole, rolesOf } from '@/lib/roles'

export interface RoleView {
  id: string
  role: UserRole
  coachId?: string
  ambassadorId?: string
}

/**
 * What the session should hold for `userId` seen as `role`, read from the database, or null when this
 * login doesn't hold that role (or has no profile for it). The session never trusts role data sent
 * from the browser: switching views and "Login as User" both go through here.
 */
export async function loadRoleView(userId: string, role: string): Promise<RoleView | null> {
  if (!isSwitchableRole(role)) return null
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, extraRoles: true, status: true, coachProfile: { select: { id: true } }, ambassadorProfile: { select: { id: true } } },
  })
  if (!user || user.status !== 'ACTIVE' || !rolesOf(user).includes(role)) return null
  if (role === 'COACH' && !user.coachProfile) return null
  if (role === 'AMBASSADOR' && !user.ambassadorProfile) return null
  return {
    id: user.id,
    role,
    coachId: role === 'COACH' ? user.coachProfile?.id : undefined,
    ambassadorId: role === 'AMBASSADOR' ? user.ambassadorProfile?.id : undefined,
  }
}
