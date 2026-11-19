import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { TeamInbox } from '@/components/support/team-pages'

export const dynamic = 'force-dynamic'

export default async function AdminSupportPage({ searchParams }: { searchParams: { filter?: string; q?: string; page?: string } }) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') redirect('/login')
  return <TeamInbox viewer={{ id: session.user.id, role: 'ADMIN' }} searchParams={searchParams} />
}
