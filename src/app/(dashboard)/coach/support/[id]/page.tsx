import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { SenderSupportThread } from '@/components/support/sender-pages'

export const dynamic = 'force-dynamic'

export default async function CoachSupportMessagePage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session || session.user.role !== 'COACH') redirect('/login')
  return <SenderSupportThread userId={session.user.id} id={params.id} base="/coach/support" impersonating={!!session.user.isImpersonating} />
}
