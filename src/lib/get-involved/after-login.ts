/**
 * Extras after a Get Involved login is created. Server only, NOT 'use server' (moved out of
 * src/lib/actions/journey-join.ts so the Invo webhook can call it without making it an endpoint).
 */
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'

/**
 * After a login is created: ambassador onboarding tasks (as ambassador-auth.ts does), and for 17 and
 * under, a PARENT login linked to the ambassador (Ambassador.parentUserId), as the existing parental
 * consent flow does. Never throws; nothing here blocks the prospect.
 */
export async function afterLoginExtras(prospectId: string) {
  try {
    const p = await prisma.prospect.findUnique({ where: { id: prospectId }, select: { userId: true, ageRange: true, parentEmail: true } })
    if (!p?.userId) return
    const amb = await prisma.ambassador.findUnique({ where: { userId: p.userId }, select: { id: true, parentUserId: true } })
    if (!amb) return
    const tasks = await prisma.ambassadorOnboardingTask.findMany({ where: { isActive: true }, select: { id: true } })
    if (tasks.length) {
      await prisma.ambassadorOnboardingProgress.createMany({ data: tasks.map((t) => ({ ambassadorId: amb.id, taskId: t.id, status: 'NOT_STARTED' as const })), skipDuplicates: true })
    }
    const parentEmail = p.parentEmail?.trim().toLowerCase()
    if (p.ageRange !== 'UNDER_18' || !parentEmail || amb.parentUserId) return
    const existing = await prisma.user.findFirst({ where: { email: { equals: parentEmail, mode: 'insensitive' } }, select: { id: true, role: true, parentOfAmbassador: { select: { id: true } } } })
    if (existing) {
      if (existing.role === 'PARENT' && !existing.parentOfAmbassador) await prisma.ambassador.update({ where: { id: amb.id }, data: { parentUserId: existing.id } })
      return
    }
    // Random password the parent never sees (same as ambassador-auth.ts); they can use "Forgot password".
    const hash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 12)
    await prisma.$transaction(async (tx) => {
      const parent = await tx.user.create({ data: { email: parentEmail, password: hash, role: 'PARENT', status: 'ACTIVE' } })
      await tx.ambassador.update({ where: { id: amb.id }, data: { parentUserId: parent.id } })
    })
  } catch (e) {
    console.error('[JOURNEY-JOIN] after-login extras failed', e)
  }
}
