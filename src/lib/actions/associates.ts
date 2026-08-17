'use server'

import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { ASSOCIATE_ROLES, isAssociateRole } from '@/lib/roles'

const associateTypeSchema = z.enum(ASSOCIATE_ROLES)

const createSchema = z.object({
  email: z.string().email('Please enter a valid email address').max(200),
  type: associateTypeSchema,
  firstName: z.string().min(1, 'First name is required').max(80),
  lastName: z.string().min(1, 'Last name is required').max(80),
  phone: z.string().max(40).optional(),
  organization: z.string().max(150).optional(),
  serviceOffered: z.string().max(2000).optional(),
  notes: z.string().max(2000).optional(),
  coachId: z.string().optional(),
})

const updateSchema = createSchema.omit({ email: true }).partial().extend({
  type: associateTypeSchema.optional(),
})

// Strong enough to satisfy the strictest password rule in the app, so it
// survives any future tightening.
function generateTempPassword() {
  return `Assoc${crypto.randomBytes(6).toString('hex').toUpperCase()}!${crypto.randomInt(1000, 9999)}`
}

const strongPassword = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[0-9]/, 'Password must contain a number')

async function requireAdmin() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { ok: false as const, error: 'Unauthorized' }
  }
  // Impersonating admins must not create or alter accounts.
  if (session.user.isImpersonating) {
    return { ok: false as const, error: 'Not available while impersonating another user' }
  }
  return { ok: true as const, session }
}

async function audit(userId: string, action: string, entityId: string, details: unknown) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType: 'AssociateProfile',
        entityId,
        details: JSON.stringify(details),
      },
    })
  } catch (error) {
    console.error('Audit log failed:', error)
  }
}

// ============================================
// Admin
// ============================================

export async function getAssociates() {
  const ctx = await requireAdmin()
  if (!ctx.ok) return { error: ctx.error }

  const [associates, coaches] = await Promise.all([
    prisma.associateProfile.findMany({
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      include: {
        user: { select: { email: true, status: true } },
        coach: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.coachProfile.findMany({
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: { id: true, firstName: true, lastName: true },
    }),
  ])

  return {
    associates: associates.map((a) => ({
      id: a.id,
      type: a.type,
      status: a.status,
      firstName: a.firstName,
      lastName: a.lastName,
      email: a.user.email,
      userStatus: a.user.status,
      phone: a.phone,
      organization: a.organization,
      serviceOffered: a.serviceOffered,
      notes: a.notes,
      coachId: a.coachId,
      coachName: a.coach ? `${a.coach.firstName} ${a.coach.lastName}` : null,
      createdAt: a.createdAt.toISOString(),
    })),
    coaches: coaches.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` })),
  }
}

export async function createAssociate(data: unknown) {
  const ctx = await requireAdmin()
  if (!ctx.ok) return { error: ctx.error }

  const parsed = createSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const email = parsed.data.email.trim().toLowerCase()
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (existing) {
    return { error: 'A user with this email already exists' }
  }

  if (parsed.data.coachId) {
    const coach = await prisma.coachProfile.findUnique({
      where: { id: parsed.data.coachId },
      select: { id: true },
    })
    if (!coach) return { error: 'Coach not found' }
  }

  const tempPassword = generateTempPassword()
  const hashedPassword = await bcrypt.hash(tempPassword, 12)

  const profile = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        password: hashedPassword,
        // The three AssociateType values are deliberately identical to the
        // matching UserRole values, so this is a direct assignment.
        role: parsed.data.type,
        status: 'ACTIVE',
      },
    })
    return tx.associateProfile.create({
      data: {
        userId: user.id,
        type: parsed.data.type,
        firstName: parsed.data.firstName.trim(),
        lastName: parsed.data.lastName.trim(),
        phone: parsed.data.phone?.trim() || null,
        organization: parsed.data.organization?.trim() || null,
        serviceOffered: parsed.data.serviceOffered?.trim() || null,
        notes: parsed.data.notes?.trim() || null,
        coachId: parsed.data.coachId || null,
      },
    })
  })

  await audit(ctx.session.user.id, 'CREATE_ASSOCIATE', profile.id, {
    email,
    type: parsed.data.type,
  })

  revalidatePath('/admin/associates')
  revalidatePath('/admin/users')

  // Returned so the admin can read it off screen and pass it on by hand.
  // There is no email delivery in this application.
  return { success: true, tempPassword }
}

export async function resetAssociatePassword(associateId: string) {
  const ctx = await requireAdmin()
  if (!ctx.ok) return { error: ctx.error }

  const profile = await prisma.associateProfile.findUnique({
    where: { id: associateId },
    select: { id: true, userId: true },
  })
  if (!profile) return { error: 'Associate not found' }

  const tempPassword = generateTempPassword()
  await prisma.user.update({
    where: { id: profile.userId },
    data: { password: await bcrypt.hash(tempPassword, 12) },
  })

  await audit(ctx.session.user.id, 'RESET_ASSOCIATE_PASSWORD', profile.id, {})
  return { success: true, tempPassword }
}

export async function updateAssociate(associateId: string, data: unknown) {
  const ctx = await requireAdmin()
  if (!ctx.ok) return { error: ctx.error }

  const parsed = updateSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const profile = await prisma.associateProfile.findUnique({
    where: { id: associateId },
    select: { id: true, userId: true },
  })
  if (!profile) return { error: 'Associate not found' }

  await prisma.$transaction(async (tx) => {
    await tx.associateProfile.update({
      where: { id: associateId },
      // The schema is .partial(), so every field must be guarded. Writing
      // these unconditionally would null out phone/organization/serviceOffered/
      // notes/coachId on any update that omitted them.
      data: {
        ...(parsed.data.type !== undefined ? { type: parsed.data.type } : {}),
        ...(parsed.data.firstName !== undefined
          ? { firstName: parsed.data.firstName.trim() }
          : {}),
        ...(parsed.data.lastName !== undefined
          ? { lastName: parsed.data.lastName.trim() }
          : {}),
        ...(parsed.data.phone !== undefined
          ? { phone: parsed.data.phone.trim() || null }
          : {}),
        ...(parsed.data.organization !== undefined
          ? { organization: parsed.data.organization.trim() || null }
          : {}),
        ...(parsed.data.serviceOffered !== undefined
          ? { serviceOffered: parsed.data.serviceOffered.trim() || null }
          : {}),
        ...(parsed.data.notes !== undefined
          ? { notes: parsed.data.notes.trim() || null }
          : {}),
        ...(parsed.data.coachId !== undefined
          ? { coachId: parsed.data.coachId || null }
          : {}),
      },
    })
    // Keep the login role in step with the association type.
    if (parsed.data.type) {
      await tx.user.update({
        where: { id: profile.userId },
        data: { role: parsed.data.type },
      })
    }
  })

  await audit(ctx.session.user.id, 'UPDATE_ASSOCIATE', associateId, parsed.data)
  revalidatePath('/admin/associates')
  return { success: true }
}

export async function setAssociateStatus(associateId: string, active: boolean) {
  const ctx = await requireAdmin()
  if (!ctx.ok) return { error: ctx.error }

  const profile = await prisma.associateProfile.findUnique({
    where: { id: associateId },
    select: { id: true, userId: true },
  })
  if (!profile) return { error: 'Associate not found' }

  await prisma.$transaction([
    prisma.associateProfile.update({
      where: { id: associateId },
      data: { status: active ? 'ACTIVE' : 'INACTIVE' },
    }),
    prisma.user.update({
      where: { id: profile.userId },
      data: { status: active ? 'ACTIVE' : 'SUSPENDED' },
    }),
  ])

  await audit(ctx.session.user.id, active ? 'ACTIVATE_ASSOCIATE' : 'DEACTIVATE_ASSOCIATE', associateId, {})
  revalidatePath('/admin/associates')
  return { success: true }
}

export async function deleteAssociate(associateId: string) {
  const ctx = await requireAdmin()
  if (!ctx.ok) return { error: ctx.error }

  const profile = await prisma.associateProfile.findUnique({
    where: { id: associateId },
    select: { id: true, userId: true, firstName: true, lastName: true },
  })
  if (!profile) return { error: 'Associate not found' }

  // AssociateProfile cascades from User, so deleting the user removes both.
  await prisma.user.delete({ where: { id: profile.userId } })

  await audit(ctx.session.user.id, 'DELETE_ASSOCIATE', associateId, {
    name: `${profile.firstName} ${profile.lastName}`,
  })
  revalidatePath('/admin/associates')
  revalidatePath('/admin/users')
  return { success: true }
}

// ============================================
// Self-service
// ============================================

async function requireAssociate() {
  const session = await auth()
  if (!session || !isAssociateRole(session.user.role)) {
    return { ok: false as const, error: 'Unauthorized' }
  }
  const profile = await prisma.associateProfile.findUnique({
    where: { userId: session.user.id },
    include: { coach: { select: { firstName: true, lastName: true } } },
  })
  if (!profile) {
    return { ok: false as const, error: 'Profile not set up' }
  }
  return { ok: true as const, session, profile }
}

export async function getMyAssociateProfile() {
  const ctx = await requireAssociate()
  if (!ctx.ok) return { error: ctx.error }

  const p = ctx.profile
  return {
    profile: {
      id: p.id,
      type: p.type,
      status: p.status,
      firstName: p.firstName,
      lastName: p.lastName,
      email: ctx.session.user.email ?? '',
      phone: p.phone,
      organization: p.organization,
      serviceOffered: p.serviceOffered,
      coachName: p.coach ? `${p.coach.firstName} ${p.coach.lastName}` : null,
    },
  }
}

const selfUpdateSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(80),
  lastName: z.string().min(1, 'Last name is required').max(80),
  phone: z.string().max(40).optional(),
  organization: z.string().max(150).optional(),
  serviceOffered: z.string().max(2000).optional(),
})

export async function updateMyAssociateProfile(data: unknown) {
  const ctx = await requireAssociate()
  if (!ctx.ok) return { error: ctx.error }

  const parsed = selfUpdateSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  await prisma.associateProfile.update({
    where: { id: ctx.profile.id },
    data: {
      firstName: parsed.data.firstName.trim(),
      lastName: parsed.data.lastName.trim(),
      phone: parsed.data.phone?.trim() || null,
      organization: parsed.data.organization?.trim() || null,
      serviceOffered: parsed.data.serviceOffered?.trim() || null,
    },
  })

  revalidatePath('/associate')
  revalidatePath('/associate/profile')
  return { success: true }
}

/**
 * Self-service password change.
 *
 * This is the only way an associate can move off the temporary password an
 * admin read out to them: the app sends no email, so /forgot-password is a
 * dead end in production.
 */
export async function changeMyPassword(currentPassword: string, newPassword: string) {
  const ctx = await requireAssociate()
  if (!ctx.ok) return { error: ctx.error }

  const parsed = strongPassword.safeParse(newPassword)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid password' }
  }

  const user = await prisma.user.findUnique({
    where: { id: ctx.session.user.id },
    select: { id: true, password: true },
  })
  if (!user) return { error: 'Unauthorized' }

  const matches = await bcrypt.compare(currentPassword ?? '', user.password)
  if (!matches) return { error: 'Your current password is not correct' }

  await prisma.user.update({
    where: { id: user.id },
    data: { password: await bcrypt.hash(parsed.data, 12) },
  })

  return { success: true }
}
