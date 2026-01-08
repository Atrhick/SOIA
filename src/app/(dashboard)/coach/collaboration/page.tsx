import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { isFeatureEnabled } from '@/lib/actions/feature-config'
import { getChannels, getSharedDocuments } from '@/lib/actions/collaboration'
import { MessageSquare } from 'lucide-react'
import { CollaborationClient } from './collaboration-client'

export default async function CoachCollaborationPage() {
  const session = await auth()

  if (!session || session.user.role !== 'COACH') {
    redirect('/login')
  }

  const featureEnabled = await isFeatureEnabled('COLLABORATION', 'COACH', session.user.id)
  if (!featureEnabled) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">Collaboration</h2>
          <p className="text-gray-500 mt-2">This feature is not currently enabled.</p>
        </div>
      </div>
    )
  }

  const [channelsResult, documentsResult] = await Promise.all([
    getChannels(),
    getSharedDocuments(),
  ])

  const channels = channelsResult.channels || []
  const documents = documentsResult.documents || []

  return (
    <CollaborationClient
      channels={channels}
      documents={documents}
      userRole="COACH"
      userId={session.user.id}
    />
  )
}
