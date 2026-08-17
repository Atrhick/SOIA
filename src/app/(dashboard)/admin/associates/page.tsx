import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getAssociates } from '@/lib/actions/associates'
import { AssociatesClient } from './associates-client'

export default async function AdminAssociatesPage() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  const result = await getAssociates()
  if ('error' in result) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        {result.error}
      </div>
    )
  }

  return <AssociatesClient associates={result.associates} coaches={result.coaches} />
}
