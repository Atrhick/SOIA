'use server'

import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { sendEmail, buildPasswordResetEmail, buildWelcomeEmail } from '@/lib/email'

const RESET_TOKEN_EXPIRES_MINUTES = 60
// A welcome invite is not a reset: the recipient may not be at their desk when
// the account is created, so it lasts days rather than an hour.
const INVITE_TOKEN_EXPIRES_MINUTES = 60 * 24 * 7
const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3001'

// ─── Request password reset ───────────────────────────────────────────────────

export async function requestPasswordReset(email: string): Promise<{ success: true } | { error: string }> {
  const parsed = z.string().email().safeParse(email)
  if (!parsed.success) {
    return { error: 'Invalid email address' }
  }

  // Always return success to prevent user enumeration
  const user = await prisma.user.findUnique({
    where: { email: parsed.data },
    select: { id: true, email: true, status: true },
  })

  if (!user || user.status !== 'ACTIVE') {
    return { success: true }
  }

  // Invalidate any existing unused tokens for this user
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  })

  // Generate a cryptographically secure token
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRES_MINUTES * 60 * 1000)

  await prisma.passwordResetToken.create({
    data: { userId: user.id, token, expiresAt },
  })

  const resetUrl = `${BASE_URL}/reset-password/${token}`

  await sendEmail({
    to: user.email,
    subject: 'Reset your NowTransformed password',
    html: buildPasswordResetEmail(resetUrl, RESET_TOKEN_EXPIRES_MINUTES),
  })

  return { success: true }
}

// ─── Welcome invite ───────────────────────────────────────────────────────────

/**
 * Emails a newly created user a one-time link to set their own password,
 * reusing the reset-token machinery.
 *
 * Preferred over emailing a generated password: the plaintext never leaves the
 * server, the link expires, and it can only be used once.
 *
 * Never throws and never blocks account creation - if delivery fails the admin
 * still has the temporary password on screen as a fallback.
 */
export async function sendWelcomeInvite(
  userId: string,
  firstName: string,
  roleLabel: string
): Promise<{ sent: boolean; error?: string }> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, status: true },
    })
    if (!user || user.status !== 'ACTIVE') {
      return { sent: false, error: 'User not found or inactive' }
    }

    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    })

    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + INVITE_TOKEN_EXPIRES_MINUTES * 60 * 1000)
    await prisma.passwordResetToken.create({ data: { userId: user.id, token, expiresAt } })

    const setupUrl = `${BASE_URL}/reset-password/${token}`
    const result = await sendEmail({
      to: user.email,
      subject: 'Your NowTransformed account is ready',
      html: buildWelcomeEmail(firstName, roleLabel, setupUrl, INVITE_TOKEN_EXPIRES_MINUTES / (60 * 24)),
    })

    return { sent: result.sent, error: result.error }
  } catch (error) {
    console.error('Error sending welcome invite:', error)
    return { sent: false, error: 'Could not send the welcome email' }
  }
}

// ─── Validate reset token (used on the reset page to check before showing form) ─

export async function validateResetToken(token: string): Promise<{ valid: true; email: string } | { valid: false }> {
  if (!token || token.length !== 64) return { valid: false }

  const record = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: { select: { email: true, status: true } } },
  })

  if (!record) return { valid: false }
  if (record.usedAt) return { valid: false }
  if (record.expiresAt < new Date()) return { valid: false }
  if (record.user.status !== 'ACTIVE') return { valid: false }

  return { valid: true, email: record.user.email }
}

// ─── Confirm password reset ───────────────────────────────────────────────────

const resetPasswordSchema = z.object({
  token: z.string().length(64),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
})

export async function confirmPasswordReset(
  token: string,
  password: string
): Promise<{ success: true } | { error: string }> {
  const parsed = resetPasswordSchema.safeParse({ token, password })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid input' }
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { token: parsed.data.token },
    include: { user: { select: { id: true, status: true } } },
  })

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { error: 'This reset link is invalid or has expired. Please request a new one.' }
  }

  if (record.user.status !== 'ACTIVE') {
    return { error: 'Account is not active.' }
  }

  const hashedPassword = await bcrypt.hash(parsed.data.password, 12)

  // Update password and mark token as used in a single transaction
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.user.id },
      data: { password: hashedPassword },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ])

  return { success: true }
}
