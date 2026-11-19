import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { loadCostItems } from '@/lib/running-costs/server'
import { RunningCostsView } from '@/components/running-costs/running-costs-view'

export const dynamic = 'force-dynamic'

export default async function AdminRunningCostsPage() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') redirect('/login')

  const items = await loadCostItems()
  // Viewing as someone else: look, don't change (the actions refuse it too).
  return <RunningCostsView items={items} canEdit={!session.user.isImpersonating} />
}
