import { notFound, redirect } from 'next/navigation'
import { Users } from 'lucide-react'
import { auth } from '@/lib/auth'
import { isFeatureEnabled } from '@/lib/actions/feature-config'
import { FeatureDisabled } from '@/components/ui/feature-disabled'
import { getContact } from '@/lib/actions/crm'
import { ContactDetailClient } from './contact-detail-client'

export default async function ContactDetailPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session || session.user.role !== 'COACH') {
    redirect('/login')
  }

  const featureEnabled = await isFeatureEnabled('CRM', 'COACH', session.user.id)
  if (!featureEnabled) {
    return <FeatureDisabled title="CRM" icon={Users} />
  }

  const result = await getContact(params.id)
  if ('error' in result) {
    notFound()
  }

  return (
    <ContactDetailClient
      contact={result.contact}
      activities={result.activities}
      readOnly={result.readOnly}
    />
  )
}
