/**
 * Welcome invite for a newly created login. Server only and deliberately NOT a 'use server' file:
 * every export of a 'use server' file is a public endpoint, and this one takes any userId, revokes
 * that user's unused reset links and emails them a new one. Callers must already have authorized
 * the account creation.
 */
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { sendEmail, buildWelcomeEmail } from '@/lib/email'

// A welcome invite is not a reset: the recipient may not be at their desk when
// the account is created, so it lasts days rather than an hour.
const INVITE_TOKEN_EXPIRES_MINUTES = 60 * 24 * 7
const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3001'

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
