import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import type { UserRole } from '@prisma/client'

declare module 'next-auth' {
  interface User {
    role: UserRole
    ambassadorId?: string
    coachId?: string
  }
  interface Session {
    user: {
      id: string
      email: string
      role: UserRole
      ambassadorId?: string
      coachId?: string
      isImpersonating?: boolean
      originalAdminId?: string
    }
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    id: string
    role: UserRole
    ambassadorId?: string
    coachId?: string
    isImpersonating?: boolean
    originalAdminId?: string
    impersonatingAt?: number
  }
}

// ─── SEC-4: In-memory login rate limiter ─────────────────────────────────────
// Tracks failed login attempts per email. Resets on successful login or after
// the window expires. In a multi-instance deployment, replace with Redis.

const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const LOCKOUT_MS = 15 * 60 * 1000 // 15 minutes after hitting the limit

interface AttemptRecord {
  count: number
  windowStart: number
  lockedUntil?: number
}

const loginAttempts = new Map<string, AttemptRecord>()

function isRateLimited(email: string): boolean {
  const key = email.toLowerCase()
  const now = Date.now()
  const record = loginAttempts.get(key)

  if (!record) return false

  // Lockout active
  if (record.lockedUntil && now < record.lockedUntil) return true

  // Window expired — clean up
  if (now - record.windowStart > WINDOW_MS) {
    loginAttempts.delete(key)
    return false
  }

  return false
}

function recordFailedAttempt(email: string): void {
  const key = email.toLowerCase()
  const now = Date.now()
  const record = loginAttempts.get(key)

  if (!record || now - record.windowStart > WINDOW_MS) {
    loginAttempts.set(key, { count: 1, windowStart: now })
    return
  }

  const newCount = record.count + 1
  if (newCount >= MAX_ATTEMPTS) {
    loginAttempts.set(key, { count: newCount, windowStart: record.windowStart, lockedUntil: now + LOCKOUT_MS })
  } else {
    loginAttempts.set(key, { count: newCount, windowStart: record.windowStart })
  }
}

function clearAttempts(email: string): void {
  loginAttempts.delete(email.toLowerCase())
}

// ─── SEC-5: Impersonation timeout ─────────────────────────────────────────────
const IMPERSONATION_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes

// ─────────────────────────────────────────────────────────────────────────────

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const email = credentials.email as string

        // SEC-4: Check rate limit before hitting the DB
        if (isRateLimited(email)) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            ambassadorProfile: {
              select: { id: true }
            },
            coachProfile: {
              select: { id: true }
            }
          }
        })

        if (!user || user.status !== 'ACTIVE') {
          // Still record an attempt to prevent user enumeration via timing
          recordFailedAttempt(email)
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        )

        if (!isPasswordValid) {
          recordFailedAttempt(email)
          return null
        }

        // Successful login — clear any previous failed attempts
        clearAttempts(email)

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          ambassadorId: user.ambassadorProfile?.id,
          coachId: user.coachProfile?.id,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string
        token.role = user.role
        token.ambassadorId = user.ambassadorId
        token.coachId = user.coachId
      }

      // SEC-5: Auto-expire impersonation after 30 minutes
      if (token.isImpersonating && token.impersonatingAt) {
        if (Date.now() - token.impersonatingAt > IMPERSONATION_TIMEOUT_MS) {
          token.id = token.originalAdminId!
          token.role = 'ADMIN'
          token.ambassadorId = undefined
          token.coachId = undefined
          token.isImpersonating = false
          token.originalAdminId = undefined
          token.impersonatingAt = undefined
        }
      }

      // Handle session updates (for impersonation)
      if (trigger === 'update' && session) {
        if (session.impersonate) {
          token.originalAdminId = token.id
          token.id = session.impersonate.id
          token.role = session.impersonate.role
          token.ambassadorId = session.impersonate.ambassadorId
          token.coachId = session.impersonate.coachId
          token.isImpersonating = true
          token.impersonatingAt = Date.now() // SEC-5: Record start time
        }
        if (session.stopImpersonating && token.originalAdminId) {
          token.id = token.originalAdminId
          token.role = 'ADMIN'
          token.ambassadorId = undefined
          token.coachId = undefined
          token.isImpersonating = false
          token.originalAdminId = undefined
          token.impersonatingAt = undefined
        }
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id
        session.user.role = token.role
        session.user.ambassadorId = token.ambassadorId
        session.user.coachId = token.coachId
        session.user.isImpersonating = token.isImpersonating
        session.user.originalAdminId = token.originalAdminId
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    updateAge: 24 * 60 * 60, // Refresh every 24 hours
  },
})
