import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getChannels } from '@/lib/actions/collaboration'
import { ChannelsAdminClient } from './channels-admin-client'

export default async function AdminChannelsPage() {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  const channelsResult = await getChannels()
  const channels = channelsResult.channels || []

  return (
    <ChannelsAdminClient
      channels={channels}
      userId={session.user.id}
    />
  )
}
