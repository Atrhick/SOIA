import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'

/** For coach group pages: the group's own coach, or an admin. Anyone else goes to /login. */
export async function requireGroupPageAccess(groupId: string) {
  const session = await auth()
  if (!session?.user) redirect('/login')
  const role = session.user.role as string
  const group = await prisma.ambassadorGroup.findUnique({
    where: { id: groupId },
    include: { coach: { select: { id: true, userId: true } } },
  })
  if (!group) redirect('/coach/groups')
  const isAdmin = role === 'ADMIN' || role === 'SUB_ADMIN'
  if (!isAdmin && !(role === 'COACH' && group.coach.userId === session.user.id)) redirect('/login')
  return { session, group }
}

/** "Tue 25 Nov, 6:00 PM" in the group's time zone. */
export function formatMeeting(d: Date, tz: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d)
}
