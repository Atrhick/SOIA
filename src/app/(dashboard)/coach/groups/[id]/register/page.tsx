import Link from 'next/link'
import prisma from '@/lib/prisma'
import { ArrowLeft } from 'lucide-react'
import { requireGroupPageAccess, formatMeeting } from '../../group-access'
import { RegisterClient } from './register-client'

type Status = 'PRESENT' | 'ABSENT' | 'EXCUSED'

export default async function GroupRegisterPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { session?: string }
}) {
  const { group } = await requireGroupPageAccess(params.id)

  const sessions = await prisma.groupSession.findMany({
    where: { groupId: group.id },
    orderBy: { startsAt: 'asc' },
    select: { id: true, weekNo: true, startsAt: true, endsAt: true, cancelled: true },
  })

  // Chosen meeting, else the one closest to now (a meeting happening now wins).
  const now = Date.now()
  const active = sessions.filter((s) => !s.cancelled)
  const current =
    sessions.find((s) => s.id === searchParams.session) ||
    active.find((s) => s.startsAt.getTime() <= now && s.endsAt.getTime() >= now) ||
    [...active].sort((a, b) => Math.abs(a.startsAt.getTime() - now) - Math.abs(b.startsAt.getTime() - now))[0]

  const back = (
    <Link href={`/coach/groups/${group.id}`} className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
      <ArrowLeft className="h-4 w-4" /> {group.name}
    </Link>
  )

  if (!current) {
    return (
      <div className="space-y-4">
        {back}
        <p className="text-gray-600">This group has no meetings yet.</p>
      </div>
    )
  }

  const [members, marks] = await Promise.all([
    prisma.ambassadorGroupMember.findMany({
      where: { groupId: group.id, joinedAt: { lte: current.endsAt }, OR: [{ leftAt: null }, { leftAt: { gte: current.startsAt } }] },
      include: { ambassador: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { ambassador: { firstName: 'asc' } },
    }),
    prisma.groupAttendance.findMany({ where: { sessionId: current.id }, select: { ambassadorId: true, status: true } }),
  ])
  const markBy = new Map(marks.map((m) => [m.ambassadorId, m.status as Status]))
  // Anyone already marked for this meeting stays on the list even if they joined later.
  const memberIds = new Set(members.map((m) => m.ambassadorId))
  const extra = marks.filter((m) => !memberIds.has(m.ambassadorId)).map((m) => m.ambassadorId)
  const extraAmbs = extra.length
    ? await prisma.ambassador.findMany({ where: { id: { in: extra } }, select: { id: true, firstName: true, lastName: true } })
    : []

  const rows = [...members.map((m) => m.ambassador), ...extraAmbs].map((a) => ({
    ambassadorId: a.id,
    name: `${a.firstName} ${a.lastName}`.trim(),
    status: markBy.get(a.id) ?? null,
  }))

  return (
    <div className="space-y-4">
      {back}
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-gray-900">Register</h1>
        <p className="text-gray-600">
          Week {current.weekNo ?? '-'} · {formatMeeting(current.startsAt, group.timezone)}
          {current.cancelled && <span className="ml-2 text-red-600">(cancelled)</span>}
        </p>
      </div>

      <nav aria-label="Pick a meeting" className="-mx-1 flex flex-wrap gap-2">
        {sessions.map((s) => (
          <Link
            key={s.id}
            href={`/coach/groups/${group.id}/register?session=${s.id}`}
            className={`min-h-[40px] rounded-full border px-3 py-2 text-sm ${
              s.id === current.id ? 'border-primary-600 bg-primary-600 text-white' : 'bg-white text-gray-700'
            }`}
          >
            Week {s.weekNo ?? '-'}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p className="text-gray-600">No ambassadors in this group yet.</p>
      ) : (
        <RegisterClient key={current.id} sessionId={current.id} rows={rows} />
      )}
    </div>
  )
}
