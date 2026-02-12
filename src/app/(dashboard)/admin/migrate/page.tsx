import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import MigrateClient from './migrate-client'

export default async function MigratePage() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  return <MigrateClient />
}
