import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { inviterDashboard } from '@/lib/get-involved/queries'
import { withJourneyStages } from '@/lib/get-involved/leaderboard-extra'
import { userDisplayName } from '@/lib/get-involved/server'
import { OneADayClient } from '@/components/get-involved/one-a-day-client'

export const dynamic = 'force-dynamic'

export default async function OneADayPage() {
  const session = await auth()
  if (!session || session.user.role !== 'COACH') redirect('/login')
  const [base, name] = await Promise.all([inviterDashboard(session.user.id, 'COACH'), userDisplayName(session.user.id)])
  const data = await withJourneyStages(session.user.id, base)
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">One-A-Day</h1>
        <p className="text-gray-600 mt-1">Reach out to one person a day. Community grows one person at a time.</p>
      </div>
      <OneADayClient data={data} roleLabel="Coaches" firstName={name?.first ?? ''} meId={session.user.id} />
    </div>
  )
}
