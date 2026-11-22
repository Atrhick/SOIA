import prisma from '@/lib/prisma'
import { buildWeekStatus, weekWindow, type WeekStatus } from './week-status'

/**
 * Week status for several ambassadors in one group and week. Server only.
 * Returns a map of ambassadorId -> WeekStatus.
 */
export async function loadWeekStatuses(
  group: { id: string; startDate: Date },
  weekNo: number,
  ambassadors: { id: string; userId: string | null }[],
): Promise<Map<string, WeekStatus>> {
  const window = weekWindow(group.startDate, weekNo)
  const ambIds = ambassadors.map((a) => a.id)
  const userIds = ambassadors.map((a) => a.userId).filter((u): u is string => !!u)
  const inWeek = { gte: window.start, lt: window.end }

  const [session, lms, listens, pieces, invites, shares] = await Promise.all([
    prisma.groupSession.findFirst({
      where: { groupId: group.id, weekNo },
      orderBy: { startsAt: 'asc' },
      select: { id: true, startsAt: true, cancelled: true, attendance: { where: { ambassadorId: { in: ambIds } }, select: { ambassadorId: true, status: true } } },
    }),
    userIds.length
      ? prisma.lMSLessonProgress.findMany({
          where: { completedAt: inWeek, enrollment: { userId: { in: userIds } } },
          select: { completedAt: true, enrollment: { select: { userId: true } } },
        })
      : Promise.resolve([]),
    userIds.length
      ? prisma.lessonListen.findMany({ where: { userId: { in: userIds }, completedAt: inWeek }, select: { userId: true, completedAt: true } })
      : Promise.resolve([]),
    prisma.portfolioSubmission.findMany({
      where: { ambassadorId: { in: ambIds }, weekNo },
      select: { ambassadorId: true, status: true, submittedAt: true },
    }),
    userIds.length
      ? prisma.outreachInvite.findMany({ where: { userId: { in: userIds }, status: 'SENT', sentAt: inWeek }, select: { userId: true, status: true, sentAt: true } })
      : Promise.resolve([]),
    // Invitations they sent themselves (copied link, WhatsApp, text, "I sent it") count too.
    userIds.length
      ? prisma.outreachShare.findMany({ where: { userId: { in: userIds }, sentAt: inWeek, firstName: { not: null } }, select: { userId: true, sentAt: true } })
      : Promise.resolve([]),
  ])

  const out = new Map<string, WeekStatus>()
  for (const a of ambassadors) {
    out.set(
      a.id,
      buildWeekStatus({
        weekNo,
        window,
        lessonCompletedAts: [
          ...lms.filter((l) => l.enrollment.userId === a.userId).map((l) => l.completedAt),
          ...listens.filter((l) => l.userId === a.userId).map((l) => l.completedAt),
        ],
        session: session ? { startsAt: session.startsAt, cancelled: session.cancelled } : null,
        attendance: session?.attendance.find((x) => x.ambassadorId === a.id)?.status ?? null,
        pieces: pieces.filter((p) => p.ambassadorId === a.id),
        invites: [
          ...invites.filter((i) => i.userId === a.userId),
          ...shares.filter((x) => x.userId === a.userId).map((x) => ({ userId: x.userId, status: 'SENT', sentAt: x.sentAt })),
        ],
      }),
    )
  }
  return out
}
