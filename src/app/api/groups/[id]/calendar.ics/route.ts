import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { buildGroupIcs } from '@/lib/groups/ics'

export const dynamic = 'force-dynamic'

/**
 * All of a group's meetings as an .ics file ("Add to my phone calendar").
 * Allowed: the group's coach, admins, current members, and current members' parents.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return new NextResponse('Please sign in.', { status: 401 })

  const group = await prisma.ambassadorGroup.findUnique({
    where: { id: params.id },
    include: {
      coach: { select: { userId: true } },
      members: { where: { leftAt: null }, select: { ambassador: { select: { userId: true, parentUserId: true } } } },
      sessions: { orderBy: { startsAt: 'asc' }, select: { id: true, weekNo: true, startsAt: true, endsAt: true, cancelled: true } },
    },
  })
  if (!group) return new NextResponse('Not found.', { status: 404 })

  const userId = session.user.id
  const role = session.user.role as string
  const allowed =
    role === 'ADMIN' ||
    role === 'SUB_ADMIN' ||
    group.coach.userId === userId ||
    group.members.some((m) => m.ambassador.userId === userId || m.ambassador.parentUserId === userId)
  if (!allowed) return new NextResponse('Not found.', { status: 404 })

  const body = buildGroupIcs({
    name: group.name,
    meetingLink: group.meetingLink,
    location: group.location,
    meetings: group.sessions,
  })
  const file = group.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'group'
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${file}-meetings.ics"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
