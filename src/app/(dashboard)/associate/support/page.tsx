import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { isAssociateRole } from '@/lib/roles'
import { SenderSupportHome } from '@/components/support/sender-pages'

export const dynamic = 'force-dynamic'

export default async function AssociateSupportPage() {
  const session = await auth()
  if (!session || !isAssociateRole(session.user.role)) redirect('/login')
  return <SenderSupportHome userId={session.user.id} base="/associate/support" impersonating={!!session.user.isImpersonating} />
}
