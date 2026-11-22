import { redirect } from 'next/navigation'
import type { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { CoachPortfolioClient, type CoachPiece } from './coach-portfolio-client'

const STATUS_ORDER: Record<string, number> = { SUBMITTED: 0, REDO: 1, REVIEWED: 2 }

export default async function CoachPortfolioPage({
  searchParams,
}: {
  searchParams: { group?: string; week?: string }
}) {
  const session = await auth()
  if (!session || (session.user.role !== 'COACH' && session.user.role !== 'ADMIN')) redirect('/login')
  const isAdmin = session.user.role === 'ADMIN'

  let coachId: string | null = null
  if (!isAdmin) {
    const coach = await prisma.coachProfile.findUnique({ where: { userId: session.user.id }, select: { id: true } })
    if (!coach) redirect('/login')
    coachId = coach.id
  }

  const groups = await prisma.ambassadorGroup.findMany({
    where: coachId ? { coachId } : {},
    select: { id: true, name: true },
    orderBy: { startDate: 'desc' },
  })

  const groupId = searchParams.group && groups.some((g) => g.id === searchParams.group) ? searchParams.group : null
  const weekNo = Number(searchParams.week)
  const where: Prisma.PortfolioSubmissionWhereInput = {
    ...(coachId ? { ambassador: { coachId } } : {}),
    ...(groupId ? { groupId } : {}),
    ...(Number.isInteger(weekNo) && weekNo >= 1 && weekNo <= 52 ? { weekNo } : {}),
  }

  const rows = await prisma.portfolioSubmission.findMany({
    where,
    orderBy: { submittedAt: 'desc' },
    take: 300,
    include: {
      ambassador: { select: { firstName: true, lastName: true } },
      group: { select: { name: true } },
    },
  })
  rows.sort((a, b) => (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3))

  const pieces: CoachPiece[] = rows.map((r) => ({
    id: r.id,
    ambassadorName: `${r.ambassador.firstName} ${r.ambassador.lastName}`.trim(),
    groupName: r.group?.name ?? null,
    weekNo: r.weekNo,
    title: r.title,
    body: r.body,
    fileUrl: r.fileUrl,
    fileType: r.fileType,
    status: r.status,
    submittedAt: r.submittedAt.toISOString(),
    feedback: r.feedback,
  }))

  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-gray-900">Portfolio work</h1>
        <p className="text-gray-600">
          {isAdmin ? 'Every ambassador' : 'Your ambassadors'}&apos; weekly pieces. New ones are at the top. Read each one and send a reply.
        </p>
      </div>
      <form className="flex flex-wrap items-end gap-3" method="get">
        <label className="block min-w-0">
          <span className="text-sm font-medium text-gray-700">Group</span>
          <select name="group" defaultValue={groupId ?? ''} className="mt-1 block min-h-[44px] w-full max-w-full rounded-lg border border-gray-300 px-3">
            <option value="">All groups</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Week</span>
          <select name="week" defaultValue={Number.isInteger(weekNo) && weekNo > 0 ? String(weekNo) : ''} className="mt-1 block min-h-[44px] rounded-lg border border-gray-300 px-3">
            <option value="">All weeks</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((w) => <option key={w} value={w}>Week {w}</option>)}
          </select>
        </label>
        <button type="submit" className="min-h-[44px] rounded-lg border bg-white px-5 text-gray-700 hover:bg-gray-50">Show</button>
      </form>
      <CoachPortfolioClient pieces={pieces} readOnly={Boolean(session.user.isImpersonating)} />
    </div>
  )
}
