import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getDirectMessages } from '@/lib/actions/collaboration'
import { MessagesAmbassadorClient } from '../../ambassador/collaboration/messages/messages-ambassador-client'

/**
 * A parent's conversations: only the ones they were added to (an adult talking privately with their under-18
 * child adds them automatically). getDirectMessages lists by membership, and parents have no directory of
 * people to start new conversations with.
 */
export default async function ParentMessagesPage() {
  const session = await auth()

  if (!session || session.user.role !== 'PARENT') {
    redirect('/login')
  }

  const dmResult = await getDirectMessages()
  const directMessages = (dmResult.directMessages || []).map(dm => ({
    ...dm,
    participants: dm.participants.filter((p): p is NonNullable<typeof p> => p !== null),
  }))

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        These are the conversations you have been added to as a parent. You can read everything here and reply at any time.
      </p>
      <MessagesAmbassadorClient directMessages={directMessages} availableUsers={[]} userId={session.user.id} />
    </div>
  )
}
