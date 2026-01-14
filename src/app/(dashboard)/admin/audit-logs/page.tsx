import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { AuditLogsClient } from './audit-logs-client'

async function getAuditLogs(page: number = 1, pageSize: number = 50) {
  const skip = (page - 1) * pageSize

  const [logs, totalCount] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.auditLog.count(),
  ])

  // Get unique user IDs to fetch user info
  const userIds = Array.from(new Set(logs.filter(l => l.userId).map(l => l.userId as string)))
  const users = userIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true },
      })
    : []

  const userMap = new Map(users.map(u => [u.id, u.email]))

  return {
    logs: logs.map(log => ({
      id: log.id,
      userId: log.userId,
      userEmail: log.userId ? userMap.get(log.userId) || 'Unknown' : 'System',
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      details: log.details,
      ipAddress: log.ipAddress,
      createdAt: log.createdAt.toISOString(),
    })),
    totalCount,
    totalPages: Math.ceil(totalCount / pageSize),
    currentPage: page,
  }
}

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: { page?: string }
}) {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  const page = parseInt(searchParams.page || '1', 10)
  const data = await getAuditLogs(page)

  return <AuditLogsClient data={data} />
}
