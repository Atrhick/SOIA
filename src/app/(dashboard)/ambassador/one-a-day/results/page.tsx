import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { loadResults } from '@/components/get-involved/results/results-data'
import { ResultsView } from '@/components/get-involved/results/results-view'

export const dynamic = 'force-dynamic'

/** One-A-Day: "Your results": how it's going and the one next step. */
export default async function MyResultsPage() {
  const session = await auth()
  if (!session || session.user.role !== 'AMBASSADOR') redirect('/login')
  const data = await loadResults(session.user.id)
  return <ResultsView data={data} role="AMBASSADOR" />
}
