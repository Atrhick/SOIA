import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { TeamThread } from '@/components/support/team-pages'

export const dynamic = 'force-dynamic'

export default async function AdminSupportMessagePage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') redirect('/login')
  return <TeamThread viewer={{ id: session.user.id, role: 'ADMIN' }} id={params.id} />
}
