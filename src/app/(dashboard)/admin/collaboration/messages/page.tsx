import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getDirectMessages, getUsersForDM } from '@/lib/actions/collaboration'
import { MessagesAdminClient } from './messages-admin-client'

export default async function AdminMessagesPage() {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
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
    <MessagesAdminClient
      directMessages={directMessages}
      availableUsers={availableUsers}
      userId={session.user.id}
    />
  )
}
