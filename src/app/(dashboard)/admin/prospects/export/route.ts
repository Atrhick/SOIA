/**
 * GET /admin/prospects/export?q=&age=&inviter=&role=&stage=
 * CSV of the Get Involved prospects list with the same filters as the page. ADMIN only (not while
 * impersonating: the impersonated role is never ADMIN anyway). Every export is written to the audit log.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { loadJourneyRows } from '../journey-data'
import { filterRows, filtersFrom, rowsToCsv } from '../journey-list'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN' || session.user.isImpersonating) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const filters = filtersFrom(req.nextUrl.searchParams)
  const rows = filterRows(await loadJourneyRows(), filters)
  await prisma.auditLog.create({
    data: {
      userId: session.user.id, action: 'EXPORT_PROSPECTS_CSV', entityType: 'Prospect',
      details: JSON.stringify({ count: rows.length, filters }),
    },
  })
  const stamp = new Date().toISOString().slice(0, 10)
  return new NextResponse(rowsToCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="prospects-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
