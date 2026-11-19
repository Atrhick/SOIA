import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { TeamInbox } from '@/components/support/team-pages'

export const dynamic = 'force-dynamic'

/** Sub-admins' support inbox. Admins use /admin/support. */
export default async function TeamSupportPage({ searchParams }: { searchParams: { filter?: string; q?: string; page?: string } }) {
  const session = await auth()
  if (!session) redirect('/login')
  if (session.user.role === 'ADMIN') redirect('/admin/support')
  if (session.user.role !== 'SUB_ADMIN') redirect('/login')
  return <TeamInbox viewer={{ id: session.user.id, role: 'SUB_ADMIN' }} searchParams={searchParams} />
}
