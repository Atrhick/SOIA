import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getChannels, getSharedDocuments } from '@/lib/actions/collaboration'
import { CollaborationAdminClient } from './collaboration-admin-client'

export default async function AdminCollaborationPage() {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  const [channelsResult, documentsResult] = await Promise.all([
    getChannels(),
    getSharedDocuments(),
  ])

  const channels = channelsResult.channels || []
  const documents = documentsResult.documents || []

  return (
    <CollaborationAdminClient
      channels={channels}
      documents={documents}
    />
  )
}
