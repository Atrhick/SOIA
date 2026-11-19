import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { loginPath } from '@/lib/safe-callback'
import { teamPagePath } from '@/lib/program-info/paths'
import { QueueScreen } from '@/components/program-info/team/queue-screen'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Program page' }

/** One program page for the team; the queue shows beside it on wide screens. */
export default async function ProgramPageTeamPage({ params, searchParams }: { params: { id: string }; searchParams: { show?: string | string[] } }) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') redirect(loginPath(teamPagePath(params.id)))
  return <QueueScreen show={searchParams?.show} selectedId={params.id} pageView />
}
