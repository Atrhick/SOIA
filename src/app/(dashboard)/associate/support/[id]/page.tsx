import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { isAssociateRole } from '@/lib/roles'
import { SenderSupportThread } from '@/components/support/sender-pages'

export const dynamic = 'force-dynamic'

export default async function AssociateSupportMessagePage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session || !isAssociateRole(session.user.role)) redirect('/login')
  return <SenderSupportThread userId={session.user.id} id={params.id} base="/associate/support" impersonating={!!session.user.isImpersonating} />
}
