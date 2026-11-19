import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { loginPath } from '@/lib/safe-callback'
import { TEAM_QUEUE_PATH } from '@/lib/program-info/paths'
import { QueueScreen } from '@/components/program-info/team/queue-screen'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Program pages' }

/** The team's queue of program pages (Team mockup). */
export default async function ProgramPagesQueuePage({ searchParams }: { searchParams: { show?: string | string[] } }) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') redirect(loginPath(`${TEAM_QUEUE_PATH}${typeof searchParams?.show === 'string' ? `?show=${encodeURIComponent(searchParams.show)}` : ''}`))
  return <QueueScreen show={searchParams?.show} selectedId={null} pageView={false} />
}
