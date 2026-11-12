import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { memberResults } from '@/lib/get-involved/outreach-stats'
import { ResultsView } from '@/components/get-involved/results/results-view'

export const dynamic = 'force-dynamic'

/** One-A-Day: my streak, funnel, channels and my group this month. */
export default async function MyResultsPage() {
  const session = await auth()
  if (!session || session.user.role !== 'COACH') redirect('/login')
  const data = await memberResults(session.user.id)
  return <ResultsView data={data} basePath="/coach/one-a-day" />
}
