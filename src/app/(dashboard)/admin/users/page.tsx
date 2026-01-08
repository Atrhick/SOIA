import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getAllUsers } from '@/lib/actions/users'
import { getAllFeatureConfigs } from '@/lib/actions/feature-config'
import { UsersAdminClient } from './users-admin-client'

export default async function AdminUsersPage() {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  const [usersResult, featuresResult] = await Promise.all([
    getAllUsers(),
    getAllFeatureConfigs(),
  ])

  const users = usersResult.users || []
  const features = featuresResult.configs || []

  return (
    <UsersAdminClient
      users={users}
      features={features}
    />
  )
}
