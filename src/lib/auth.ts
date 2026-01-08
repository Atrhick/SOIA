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
  }
}

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

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
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
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        )

        if (!isPasswordValid) {
          return null
        }

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
      // Handle session updates (for impersonation)
      if (trigger === 'update' && session) {
        if (session.impersonate) {
          token.originalAdminId = token.id
          token.id = session.impersonate.id
          token.role = session.impersonate.role
          token.ambassadorId = session.impersonate.ambassadorId
          token.coachId = session.impersonate.coachId
          token.isImpersonating = true
        }
        if (session.stopImpersonating && token.originalAdminId) {
          token.id = token.originalAdminId
          token.role = 'ADMIN'
          token.ambassadorId = undefined
          token.coachId = undefined
          token.isImpersonating = false
          token.originalAdminId = undefined
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
  },
})
