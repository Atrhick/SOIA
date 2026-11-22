// Server-side only (not 'use server', so nothing here is a public endpoint).
import { prisma } from '@/lib/prisma'
import { requiredParents, type GuardianCheck } from './guardians'

/** Loads the ambassadors among these logins and works out which parents must join a private conversation. */
export async function checkGuardians(participantIds: string[]): Promise<GuardianCheck> {
  const ids = Array.from(new Set(participantIds))
  const ambassadors = await prisma.ambassador.findMany({
    where: { userId: { in: ids } },
    select: {
      userId: true,
      dateOfBirth: true,
      parentUserId: true,
      parentFirstName: true,
      parentLastName: true,
      parentEmail: true,
      parentPhone: true,
    },
  })
  return requiredParents(
    ids,
    ambassadors.filter((a): a is typeof a & { userId: string } => !!a.userId),
  )
}
