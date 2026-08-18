import { redirect } from 'next/navigation'
import { Users } from 'lucide-react'
import { auth } from '@/lib/auth'
import { isFeatureEnabled } from '@/lib/actions/feature-config'
import { FeatureDisabled } from '@/components/ui/feature-disabled'
import { getMyContacts } from '@/lib/actions/crm'
import { CrmClient } from './crm-client'

export default async function CoachCRMPage({
  searchParams,
}: {
  searchParams: { filter?: string }
}) {
  const session = await auth()
  if (!session || session.user.role !== 'COACH') {
    redirect('/login')
  }

  const featureEnabled = await isFeatureEnabled('CRM', 'COACH', session.user.id)
  if (!featureEnabled) {
    return <FeatureDisabled title="CRM" icon={Users} />
  }

  const filter = (searchParams.filter ?? 'NEEDS_ATTENTION') as Parameters<typeof getMyContacts>[0]
  const result = await getMyContacts(filter)

  if ('error' in result) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        {result.error}
      </div>
    )
  }

  return (
    <CrmClient
      contacts={result.contacts}
      counts={result.counts}
      needsAttention={result.needsAttention}
      activeFilter={filter ?? 'NEEDS_ATTENTION'}
    />
  )
}
