import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { isFeatureEnabled } from '@/lib/actions/feature-config'
import { getChannels } from '@/lib/actions/collaboration'
import { MessageSquare } from 'lucide-react'
import { ChannelsClient } from './channels-client'

export default async function CoachChannelsPage() {
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
          <h2 className="text-xl font-semibold text-gray-900">Channels</h2>
          <p className="text-gray-500 mt-2">This feature is not currently enabled.</p>
        </div>
      </div>
    )
  }

  const channelsResult = await getChannels()
  const channels = channelsResult.channels || []

  return (
    <ChannelsClient
      channels={channels}
      userRole="COACH"
      userId={session.user.id}
    />
  )
}
