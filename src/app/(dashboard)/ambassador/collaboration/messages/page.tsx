import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { isFeatureEnabled } from '@/lib/actions/feature-config'
import { getDirectMessages, getUsersForDM } from '@/lib/actions/collaboration'
import { Mail } from 'lucide-react'
import { MessagesAmbassadorClient } from './messages-ambassador-client'

export default async function AmbassadorMessagesPage() {
  const session = await auth()

  if (!session || session.user.role !== 'AMBASSADOR') {
    redirect('/login')
  }

  const featureEnabled = await isFeatureEnabled('COLLABORATION', 'AMBASSADOR', session.user.id)
  if (!featureEnabled) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Mail className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">Messages</h2>
          <p className="text-gray-500 mt-2">This feature is not currently enabled.</p>
        </div>
      </div>
    )
  }

  const [dmResult, usersResult] = await Promise.all([
    getDirectMessages(),
    getUsersForDM(),
  ])

  // Filter out any null participants from DMs
  const directMessages = (dmResult.directMessages || []).map(dm => ({
    ...dm,
    participants: dm.participants.filter((p): p is NonNullable<typeof p> => p !== null),
  }))
  const availableUsers = usersResult.users || []

  return (
    <MessagesAmbassadorClient
      directMessages={directMessages}
      availableUsers={availableUsers}
      userId={session.user.id}
    />
  )
}
