import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { SenderSupportHome } from '@/components/support/sender-pages'

export const dynamic = 'force-dynamic'

export default async function AmbassadorSupportPage() {
  const session = await auth()
  if (!session || session.user.role !== 'AMBASSADOR') redirect('/login')
  return <SenderSupportHome userId={session.user.id} base="/ambassador/support" impersonating={!!session.user.isImpersonating} />
}
