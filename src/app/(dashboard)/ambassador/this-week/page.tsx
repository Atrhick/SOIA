import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CalendarPlus, Check, BookOpen, Users, FileText, Lightbulb, Send } from 'lucide-react'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { currentWeek } from '@/lib/groups/current-week'
import { activeGroupFor } from '@/lib/groups/portfolio-server'
import { loadWeekStatuses } from '@/lib/groups/week-status-server'
import { formatMeeting } from '../../coach/groups/group-access'

type Row = {
  key: string
  title: string
  icon: typeof Check
  done: boolean
  note: string
  action: { label: string; href: string; download?: boolean } | null
}

export default async function AmbassadorThisWeekPage() {
  const session = await auth()
  if (!session || session.user.role !== 'AMBASSADOR') redirect('/login')

  const ambassador = await prisma.ambassador.findUnique({
    where: { userId: session.user.id },
    select: { id: true, userId: true },
  })
  if (!ambassador) redirect('/login')

  const g = await activeGroupFor(ambassador.id)
  const group = g
    ? await prisma.ambassadorGroup.findUnique({
        where: { id: g.id },
        select: { id: true, name: true, startDate: true, weeks: true, timezone: true, meetingLink: true, location: true },
      })
    : null

  if (!group) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">This week</h1>
        <div className="rounded-xl border bg-white p-5">
          <p className="text-gray-700">
            You are not in a group yet. Your coach will add you to one soon, and then your week will show up here.
          </p>
        </div>
      </div>
    )
  }

  const now = new Date()
  const live = currentWeek(group.startDate, group.weeks, now)
  const before = now.getTime() < group.startDate.getTime()
  const weekNo = live ?? (before ? 1 : group.weeks)

  const [statuses, nextMeeting] = await Promise.all([
    loadWeekStatuses(group, weekNo, [ambassador]),
    prisma.groupSession.findFirst({
      where: { groupId: group.id, cancelled: false, endsAt: { gte: now } },
      orderBy: { startsAt: 'asc' },
      select: { startsAt: true, weekNo: true },
    }),
  ])
  const s = statuses.get(ambassador.id)!
  const icsHref = `/api/groups/${group.id}/calendar.ics`

  const meetNote: Record<string, string> = {
    NO_MEETING: 'No meeting set for this week yet.',
    CANCELLED: 'This week’s meeting was cancelled.',
    NOT_MARKED: s.meet.startsAt ? `Meeting: ${formatMeeting(s.meet.startsAt, group.timezone)}` : 'Your coach has not taken the register yet.',
    PRESENT: 'You were there. Well done.',
    EXCUSED: 'You were excused this week.',
    ABSENT: 'You missed this meeting. Talk to your coach about catching up.',
  }
  const showNote: Record<string, string> = {
    NONE: 'Hand in this week’s piece for your portfolio.',
    HANDED_IN: 'Handed in. Your coach will reply.',
    REPLIED: 'Your coach replied. Have a read.',
    REDO: 'Your coach asked you to have another go.',
  }

  const rows: Row[] = [
    {
      key: 'learn', title: 'Learn', icon: BookOpen, done: s.learn,
      note: s.learn ? 'You finished a lesson this week.' : 'Finish one lesson this week.',
      action: s.learn ? null : { label: 'Go to lessons', href: '/ambassador/learning' },
    },
    {
      key: 'meet', title: 'Meet', icon: Users, done: s.meet.done, note: meetNote[s.meet.state],
      action: s.meet.done || s.meet.state === 'ABSENT' ? null : { label: 'Add to my calendar', href: icsHref, download: true },
    },
    {
      key: 'show', title: 'Show', icon: FileText, done: s.show.done, note: showNote[s.show.state],
      action:
        s.show.state === 'HANDED_IN'
          ? null
          : { label: s.show.state === 'REPLIED' ? 'Read the reply' : s.show.state === 'REDO' ? 'Try again' : 'Hand it in', href: '/ambassador/portfolio' },
    },
    {
      key: 'do', title: 'Do', icon: Lightbulb, done: false,
      note: 'Take a step on your business idea. (We don’t tick this one yet.)',
      action: { label: 'My business idea', href: '/ambassador/business-idea' },
    },
    {
      key: 'invite', title: 'Invite', icon: Send, done: s.invite,
      note: s.invite ? 'You invited someone this week. Thank you.' : 'Invite one person this week.',
      action: s.invite ? null : { label: 'Invite someone', href: '/ambassador/one-a-day' },
    },
  ]
  const pct = Math.round((s.doneCount / 5) * 100)

  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-gray-900">This week</h1>
        <p className="text-gray-600">
          {group.name} · {live ? `Week ${weekNo} of ${group.weeks}` : before ? `Starts ${formatMeeting(group.startDate, group.timezone)}` : 'Your weeks are finished'}
        </p>
      </div>

      {nextMeeting && (
        <section className="rounded-xl border bg-white p-4">
          <h2 className="text-lg font-semibold text-gray-900">Next meeting</h2>
          <p className="text-gray-700">
            Week {nextMeeting.weekNo ?? '-'} · {formatMeeting(nextMeeting.startsAt, group.timezone)}
          </p>
          {group.meetingLink && (
            <a href={group.meetingLink} target="_blank" rel="noreferrer" className="break-all text-sm text-primary-600 underline">
              {group.meetingLink}
            </a>
          )}
          {group.location && <p className="text-sm text-gray-600">{group.location}</p>}
          <a
            href={icsHref}
            className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-lg border px-4 font-medium text-gray-700"
          >
            <CalendarPlus className="h-5 w-5" /> Add to my calendar
          </a>
        </section>
      )}

      <section className="rounded-xl border bg-white p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-gray-900">Your week</h2>
          <span className="font-medium text-gray-700">{s.doneCount} of 5 done</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200" role="progressbar" aria-valuenow={s.doneCount} aria-valuemin={0} aria-valuemax={5}>
          <div className="h-full rounded-full bg-green-500" style={{ width: `${pct}%` }} />
        </div>

        <ul className="mt-4 divide-y">
          {rows.map((r) => (
            <li key={r.key} className="flex flex-wrap items-center gap-3 py-3">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${r.done ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                aria-label={r.done ? 'Done' : 'Not done yet'}
              >
                {r.done ? <Check className="h-5 w-5" /> : <r.icon className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900">{r.title}</p>
                <p className="text-sm text-gray-600">{r.note}</p>
              </div>
              {r.action &&
                (r.action.download ? (
                  <a href={r.action.href} className="inline-flex min-h-[44px] items-center rounded-lg bg-primary-600 px-4 font-semibold text-white">
                    {r.action.label}
                  </a>
                ) : (
                  <Link href={r.action.href} className="inline-flex min-h-[44px] items-center rounded-lg bg-primary-600 px-4 font-semibold text-white">
                    {r.action.label}
                  </Link>
                ))}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
