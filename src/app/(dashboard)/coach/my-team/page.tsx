import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { myTeam } from '@/lib/get-involved/queries'
import { userDisplayName } from '@/lib/get-involved/server'
import { MyTeamClient } from '@/components/get-involved/my-team-client'

export const dynamic = 'force-dynamic'

export default async function CoachMyTeamPage() {
  const session = await auth()
  if (!session || session.user.role !== 'COACH') redirect('/login')
  const [data, name] = await Promise.all([myTeam(session.user.id, 'COACH'), userDisplayName(session.user.id)])
  return <MyTeamClient data={data} rankLabel="coaches" firstName={name?.first ?? ''} oneADayPath="/coach/one-a-day" />
}
