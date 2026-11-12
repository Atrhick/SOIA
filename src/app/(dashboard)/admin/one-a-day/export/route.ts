/**
 * GET /admin/one-a-day/export?role=ALL|COACH|AMBASSADOR|YOUTH&period=all|YYYY-MM
 * CSV of the One-A-Day leaderboard as shown on the page. ADMIN only, not while impersonating.
 * Cells are defused against spreadsheet formulas (csvCell). Every export is written to the audit log.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { adminLeaderboard } from '@/lib/get-involved/leaderboard-extra'
import { ADMIN_BOARDS, boardToCsv, parseBoard, parsePeriod } from '@/lib/get-involved/leaderboard-period'
import { shareCountsByUser } from '@/lib/get-involved/outreach-stats'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN' || session.user.isImpersonating) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const now = new Date()
  const board = parseBoard(req.nextUrl.searchParams.get('role'))
  const period = parsePeriod(req.nextUrl.searchParams.get('period'), now)
  const [board_, shares] = await Promise.all([adminLeaderboard({ period, board, now }), shareCountsByUser(period)])
  const rows = board_.map((r) => ({ ...r, messagesSent: shares.get(r.userId)?.sent ?? 0, saidYes: shares.get(r.userId)?.saidYes ?? 0 }))
  await prisma.auditLog.create({
    data: {
      userId: session.user.id, action: 'EXPORT_LEADERBOARD_CSV', entityType: 'Leaderboard',
      details: JSON.stringify({ count: rows.length, board, period: period.key }),
    },
  })
  const boardLabel = ADMIN_BOARDS.find((b) => b.value === board)!.label
  return new NextResponse(boardToCsv(rows, period.label, boardLabel), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="one-a-day-${board.toLowerCase()}-${period.key}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
