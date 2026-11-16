import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { pushEnabled } from '@/lib/push'
import { userDisplayName } from '@/lib/get-involved/server'
import { AUDIENCE_GROUPS, countsFrom, type BroadcastCounts } from '@/lib/broadcast/core'
import { NotificationsClient, type SentRow } from './notifications-client'

export const dynamic = 'force-dynamic'

const SHOW = 20

export default async function AdminNotificationsPage() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') redirect('/login')

  const [recent, devices, people] = await Promise.all([
    prisma.broadcast.findMany({ orderBy: { createdAt: 'desc' }, take: SHOW, select: { id: true, title: true, body: true, createdAt: true, finishedAt: true, createdById: true, emailFallback: true } }),
    prisma.pushSubscription.groupBy({ by: ['userId'], where: { user: { status: 'ACTIVE' } } }).then((r) => r.length),
    prisma.user.count({ where: { status: 'ACTIVE', role: { not: 'PARENT' } } }),
  ])
  const ids = recent.map((b) => b.id)
  const grouped = ids.length ? await prisma.broadcastDelivery.groupBy({ by: ['broadcastId', 'status'], where: { broadcastId: { in: ids } }, _count: true }) : []
  const countsById = new Map<string, BroadcastCounts>()
  for (const id of ids) countsById.set(id, countsFrom(grouped.filter((g) => g.broadcastId === id)))
  const senders = new Map<string, string>()
  for (const uid of Array.from(new Set(recent.map((b) => b.createdById)))) senders.set(uid, (await userDisplayName(uid))?.full ?? 'An admin')

  const sent: SentRow[] = recent.map((b) => ({
    id: b.id,
    title: b.title,
    body: b.body,
    createdAt: b.createdAt.toISOString(),
    finished: !!b.finishedAt,
    sender: senders.get(b.createdById) ?? 'An admin',
    emailFallback: b.emailFallback,
    counts: countsById.get(b.id)!,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Send a notification</h1>
        <p className="mt-1 text-gray-600">
          A short message to the team. People who turned on notifications get it on their phone or computer; everyone else gets it by email.
          Right now {devices} of {people} active {people === 1 ? 'person has' : 'people have'} notifications on.
        </p>
        {!pushEnabled() && (
          <p role="status" className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Phone notifications aren&apos;t set up on this server, so every message goes by email.
          </p>
        )}
      </div>
      <NotificationsClient groups={AUDIENCE_GROUPS.map((g) => ({ key: g.key, label: g.label }))} sent={sent} />
    </div>
  )
}
