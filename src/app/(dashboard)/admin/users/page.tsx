import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getAllUsers } from '@/lib/actions/users'
import { getAllFeatureConfigs } from '@/lib/actions/feature-config'
import prisma from '@/lib/prisma'
import { UsersAdminClient } from './users-admin-client'

export default async function AdminUsersPage({ searchParams }: { searchParams: { q?: string } }) {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  const [usersResult, featuresResult, lastSeen] = await Promise.all([
    getAllUsers(),
    getAllFeatureConfigs(),
    // "Last active" column (kept out of getAllUsers so that shared action stays as it is).
    prisma.user.findMany({ where: { lastSeenAt: { not: null } }, select: { id: true, lastSeenAt: true } }),
  ])

  const seen = new Map(lastSeen.map((u) => [u.id, u.lastSeenAt?.toISOString() ?? null]))
  const users = (usersResult.users || []).map((u) => ({ ...u, lastSeenAt: seen.get(u.id) ?? null }))
  const features = featuresResult.configs || []

  return (
    <UsersAdminClient
      users={users}
      features={features}
      currentUserId={session.user.id}
      initialQuery={(searchParams.q ?? '').slice(0, 200)}
    />
  )
}
