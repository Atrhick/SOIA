import Link from 'next/link'
import prisma from '@/lib/prisma'
import { ArrowLeft, Check, X, ClipboardCheck, FileText, AlertTriangle } from 'lucide-react'
import { requireGroupPageAccess } from '../../group-access'
import { currentWeek } from '@/lib/groups/current-week'
import { weekWindow, needsAttention, sortForCoach } from '@/lib/groups/week-status'
import { loadWeekStatuses } from '@/lib/groups/week-status-server'

function Mark({ label, done, pending }: { label: string; done: boolean; pending?: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-sm">
      {done ? (
        <Check className="h-5 w-5 text-green-600" aria-hidden />
      ) : pending ? (
        <span className="inline-block h-5 w-5 text-center text-gray-400" aria-hidden>-</span>
      ) : (
        <X className="h-5 w-5 text-red-600" aria-hidden />
      )}
      <span className="text-gray-700">{label}</span>
      <span className="sr-only">{done ? 'done' : pending ? 'not marked yet' : 'missing'}</span>
    </span>
  )
}

export default async function GroupWeekPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { week?: string }
}) {
  const { group } = await requireGroupPageAccess(params.id)

  const now = new Date()
  const live = currentWeek(group.startDate, group.weeks, now)
  const fallback = live ?? (now.getTime() < group.startDate.getTime() ? 1 : group.weeks)
  const asked = Number(searchParams.week)
  const weekNo = Number.isInteger(asked) && asked >= 1 && asked <= group.weeks ? asked : fallback
  const window = weekWindow(group.startDate, weekNo)

  const members = await prisma.ambassadorGroupMember.findMany({
    where: { groupId: group.id, joinedAt: { lt: window.end }, OR: [{ leftAt: null }, { leftAt: { gte: window.start } }] },
    include: { ambassador: { select: { id: true, userId: true, firstName: true, lastName: true } } },
  })
  const ambs = members.map((m) => m.ambassador)
  const statuses = await loadWeekStatuses(group, weekNo, ambs)
  const rows = sortForCoach(
    ambs.map((a) => ({ id: a.id, name: `${a.firstName} ${a.lastName}`.trim(), status: statuses.get(a.id)! })),
  )
  const flagged = rows.filter((r) => needsAttention(r.status)).length

  return (
    <div className="space-y-4">
      <Link href={`/coach/groups/${group.id}`} className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" /> {group.name}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">Week {weekNo} of {group.weeks}</h1>
          <p className="text-gray-600">
            {rows.length} in the group{flagged > 0 ? ` · ${flagged} need${flagged === 1 ? 's' : ''} attention` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/coach/groups/${group.id}/register`}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-primary-600 px-4 font-semibold text-white"
          >
            <ClipboardCheck className="h-5 w-5" /> Take the register
          </Link>
          <Link href="/coach/portfolio" className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border px-4 text-gray-700">
            <FileText className="h-5 w-5" /> Read portfolio work
          </Link>
        </div>
      </div>

      <nav aria-label="Pick a week" className="-mx-1 flex flex-wrap gap-2">
        {Array.from({ length: group.weeks }, (_, i) => i + 1).map((w) => (
          <Link
            key={w}
            href={`/coach/groups/${group.id}/week?week=${w}`}
            className={`min-h-[40px] rounded-full border px-3 py-2 text-sm ${
              w === weekNo ? 'border-primary-600 bg-primary-600 text-white' : 'bg-white text-gray-700'
            }`}
          >
            Week {w}
          </Link>
        ))}
      </nav>

      <p className="text-sm text-gray-500">
        Learn = finished a lesson that week. Meet = marked present or excused. Show = portfolio piece handed in. Invite = sent at
        least one One-A-Day invite that week. Two or more missing goes to the top.
      </p>

      {rows.length === 0 ? (
        <p className="text-gray-600">No ambassadors in this group for this week.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {rows.map((r) => {
            const flag = needsAttention(r.status)
            return (
              <li key={r.id} className={`rounded-xl border bg-white p-4 ${flag ? 'border-amber-400' : ''}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 font-semibold text-primary-700">
                    {(r.name?.[0] || '?').toUpperCase()}
                  </span>
                  <p className="min-w-0 flex-1 truncate font-semibold text-gray-900">{r.name}</p>
                  {flag && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                      <AlertTriangle className="h-3.5 w-3.5" /> Needs attention
                    </span>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Mark label="Learn" done={r.status.learn} />
                  <Mark label="Meet" done={r.status.meet.done} pending={!r.status.meet.done && !r.status.meet.missing} />
                  <Mark label="Show" done={r.status.show.done} />
                  <Mark label="Invite" done={r.status.invite} />
                </div>
                {r.status.show.state === 'REDO' && <p className="mt-2 text-sm text-gray-600">Asked to redo their portfolio piece.</p>}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
