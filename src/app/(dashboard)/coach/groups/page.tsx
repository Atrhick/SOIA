import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Users, ChevronRight } from 'lucide-react'
import { GroupForm, WEEKDAYS } from './group-form'

export default async function CoachGroupsPage() {
  const session = await auth()
  if (!session || session.user.role !== 'COACH') redirect('/login')

  const coach = await prisma.coachProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      ambassadors: { select: { id: true, firstName: true, lastName: true }, orderBy: { firstName: 'asc' } },
      ambassadorGroups: {
        orderBy: [{ isActive: 'desc' }, { startDate: 'desc' }],
        include: {
          _count: { select: { members: { where: { leftAt: null } } } },
          sessions: { where: { startsAt: { gte: new Date() }, cancelled: false }, orderBy: { startsAt: 'asc' }, take: 1 },
        },
      },
    },
  })
  if (!coach) redirect('/login')

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-gray-900">My groups</h1>
        <p className="text-gray-600">Your ambassadors meet with you once a week. Here you set up each group and take the register.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your groups</CardTitle>
        </CardHeader>
        <CardContent>
          {coach.ambassadorGroups.length === 0 ? (
            <p className="text-gray-500">No groups yet. Start one below.</p>
          ) : (
            <ul className="divide-y">
              {coach.ambassadorGroups.map((g) => {
                const next = g.sessions[0]
                return (
                  <li key={g.id}>
                    <Link href={`/coach/groups/${g.id}`} className="flex items-center gap-3 py-3">
                      <Users className="h-5 w-5 shrink-0 text-primary-600" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-gray-900">
                          {g.name} {!g.isActive && <span className="text-sm text-gray-500">(archived)</span>}
                        </p>
                        <p className="text-sm text-gray-500">
                          {WEEKDAYS[g.meetingWeekday]}s at {g.meetingTime} · {g._count.members} ambassador{g._count.members === 1 ? '' : 's'}
                          {next ? ` · next: week ${next.weekNo ?? ''}` : ''}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>New group</CardTitle>
        </CardHeader>
        <CardContent>
          <GroupForm
            mode="create"
            initial={{
              name: '',
              meetingWeekday: 2,
              meetingTime: '18:00',
              timezone: 'America/New_York',
              durationMin: 60,
              meetingLink: '',
              location: '',
              startDate: today,
              weeks: 8,
            }}
            ambassadors={coach.ambassadors.map((a) => ({ id: a.id, name: `${a.firstName} ${a.lastName}`.trim() }))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
