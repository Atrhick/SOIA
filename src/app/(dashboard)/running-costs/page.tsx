import { redirect } from 'next/navigation'
import { Wallet } from 'lucide-react'
import { auth } from '@/lib/auth'
import { FeatureDisabled } from '@/components/ui/feature-disabled'
import { canViewRunningCosts, loadCostItems } from '@/lib/running-costs/server'
import { RunningCostsView } from '@/components/running-costs/running-costs-view'

export const dynamic = 'force-dynamic'

/** Read-only Running costs for anyone an admin granted the RUNNING_COSTS feature to. Admins edit at /admin/running-costs. */
export default async function RunningCostsPage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (session.user.role === 'ADMIN') redirect('/admin/running-costs')

  if (!(await canViewRunningCosts({ id: session.user.id, role: session.user.role }))) {
    return <FeatureDisabled title="Running costs" icon={Wallet} message="Ask an admin if you need to see this page." />
  }

  const items = await loadCostItems()
  return <RunningCostsView items={items} canEdit={false} />
}
