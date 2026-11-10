import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { inviterDashboard } from '@/lib/get-involved/queries'
import { userDisplayName } from '@/lib/get-involved/server'
import { OneADayClient } from '@/components/get-involved/one-a-day-client'

export const dynamic = 'force-dynamic'

export default async function OneADayPage() {
  const session = await auth()
  if (!session || session.user.role !== 'AMBASSADOR') redirect('/login')
  const [data, name] = await Promise.all([inviterDashboard(session.user.id, 'AMBASSADOR'), userDisplayName(session.user.id)])
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">One-A-Day</h1>
        <p className="text-gray-600 mt-1">Reach out to one person a day. Community grows one person at a time.</p>
      </div>
      <OneADayClient data={data} roleLabel="Ambassadors" firstName={name?.first ?? ''} meId={session.user.id} />
    </div>
  )
}
