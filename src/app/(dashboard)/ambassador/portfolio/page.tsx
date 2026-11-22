import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { currentWeek } from '@/lib/groups/current-week'
import { activeGroupFor } from '@/lib/groups/portfolio-server'
import { PortfolioClient, type MyPiece } from './portfolio-client'

export default async function AmbassadorPortfolioPage() {
  const session = await auth()
  if (!session || session.user.role !== 'AMBASSADOR') redirect('/login')

  const ambassador = await prisma.ambassador.findUnique({ where: { userId: session.user.id }, select: { id: true } })
  if (!ambassador) redirect('/login')

  const [group, rows] = await Promise.all([
    activeGroupFor(ambassador.id),
    prisma.portfolioSubmission.findMany({
      where: { ambassadorId: ambassador.id },
      orderBy: [{ weekNo: 'asc' }, { submittedAt: 'desc' }],
    }),
  ])
  const week = group ? currentWeek(group.startDate, group.weeks) : null
  const totalWeeks = group?.weeks ?? 8

  const pieces: MyPiece[] = rows.map((r) => ({
    id: r.id,
    weekNo: r.weekNo,
    title: r.title,
    body: r.body,
    fileUrl: r.fileUrl,
    fileType: r.fileType,
    status: r.status,
    submittedAt: r.submittedAt.toISOString(),
    feedback: r.feedback,
    feedbackAt: r.feedbackAt?.toISOString() ?? null,
  }))

  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-gray-900">My portfolio</h1>
        <p className="text-gray-600">
          Each week ends with a piece of work for your portfolio. Hand it in here and your coach will reply.
        </p>
      </div>
      <PortfolioClient
        pieces={pieces}
        defaultWeek={week ?? 1}
        totalWeeks={Math.max(totalWeeks, ...pieces.map((p) => p.weekNo))}
        groupName={group?.name ?? null}
        readOnly={Boolean(session.user.isImpersonating)}
      />
    </div>
  )
}
