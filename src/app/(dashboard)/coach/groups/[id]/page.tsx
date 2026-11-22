import Link from 'next/link'
import prisma from '@/lib/prisma'
import { CalendarPlus, ClipboardCheck, ArrowLeft, ListChecks } from 'lucide-react'
import { requireGroupPageAccess, formatMeeting } from '../group-access'
import { WEEKDAYS } from '../group-form'
import { GroupDetailClient } from './group-detail-client'

export default async function GroupDetailPage({ params }: { params: { id: string } }) {
  const { group } = await requireGroupPageAccess(params.id)

  const [members, coachAmbassadors, sessions] = await Promise.all([
    prisma.ambassadorGroupMember.findMany({
      where: { groupId: group.id, leftAt: null },
      include: { ambassador: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { joinedAt: 'asc' },
    }),
    prisma.ambassador.findMany({
      where: { coachId: group.coachId },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { firstName: 'asc' },
    }),
    prisma.groupSession.findMany({ where: { groupId: group.id }, orderBy: { startsAt: 'asc' } }),
  ])

  const memberIds = new Set(members.map((m) => m.ambassadorId))
  const name = (a: { firstName: string; lastName: string }) => `${a.firstName} ${a.lastName}`.trim()
  const now = Date.now()
  const upcoming = sessions.filter((s) => s.endsAt.getTime() >= now)

  return (
    <div className="space-y-6">
      <Link href="/coach/groups" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" /> All groups
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-bold text-gray-900">{group.name}</h1>
          <p className="text-gray-600">
            {WEEKDAYS[group.meetingWeekday]}s at {group.meetingTime} ({group.timezone}) · {group.durationMin} minutes
          </p>
          {group.meetingLink && (
            <a href={group.meetingLink} target="_blank" rel="noreferrer" className="break-all text-sm text-primary-600 underline">
              {group.meetingLink}
            </a>
          )}
          {group.location && <p className="text-sm text-gray-600">{group.location}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/coach/groups/${group.id}/register`}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-primary-600 px-4 font-semibold text-white"
          >
            <ClipboardCheck className="h-5 w-5" /> Take the register
          </Link>
          <Link
            href={`/coach/groups/${group.id}/week`}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border px-4 text-gray-700"
          >
            <ListChecks className="h-5 w-5" /> This week
          </Link>
          <a
            href={`/api/groups/${group.id}/calendar.ics`}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border px-4 text-gray-700"
          >
            <CalendarPlus className="h-5 w-5" /> Add to my calendar
          </a>
        </div>
      </div>

      <section className="rounded-xl border bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Upcoming meetings</h2>
        {upcoming.length === 0 ? (
          <p className="text-gray-500">No more meetings planned for this group.</p>
        ) : (
          <ul className="divide-y">
            {upcoming.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="min-w-0">
                  <span className="font-medium">Week {s.weekNo ?? '-'}</span>{' '}
                  <span className="text-gray-600">{formatMeeting(s.startsAt, group.timezone)}</span>
                  {s.cancelled && <span className="ml-2 text-sm text-red-600">Cancelled</span>}
                </span>
                <Link href={`/coach/groups/${group.id}/register?session=${s.id}`} className="text-sm text-primary-600 underline">
                  Register
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <GroupDetailClient
        groupId={group.id}
        isActive={group.isActive}
        members={members.map((m) => ({ id: m.ambassador.id, name: name(m.ambassador) }))}
        available={coachAmbassadors.filter((a) => !memberIds.has(a.id)).map((a) => ({ id: a.id, name: name(a) }))}
        editValues={{
          name: group.name,
          meetingWeekday: group.meetingWeekday,
          meetingTime: group.meetingTime,
          timezone: group.timezone,
          durationMin: group.durationMin,
          meetingLink: group.meetingLink || '',
          location: group.location || '',
          startDate: group.startDate.toISOString().slice(0, 10),
          weeks: group.weeks,
        }}
      />
    </div>
  )
}
