import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { templateRows } from '@/lib/get-involved/outreach-templates-server'
import { FIRST_KEYS } from '@/lib/get-involved/outreach-templates'
import { TemplatesClient, type TemplateStats } from './templates-client'

export const dynamic = 'force-dynamic'

export default async function OutreachTemplatesPage() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') redirect('/login')

  const [rows, byChannel, yesByChannel, afterYes] = await Promise.all([
    templateRows(),
    prisma.outreachShare.groupBy({ by: ['channel'], where: { kind: 'FIRST' }, _count: { _all: true } }),
    prisma.outreachShare.groupBy({ by: ['channel'], where: { kind: 'FIRST', outcome: 'YES' }, _count: { _all: true } }),
    prisma.outreachShare.count({ where: { kind: 'AFTER_YES' } }),
  ])
  // Real numbers from OutreachShare: first messages logged per channel and the share marked "yes".
  const stats: TemplateStats = {}
  for (const k of FIRST_KEYS) {
    const used = byChannel.find((r) => r.channel === k)?._count._all ?? 0
    const yes = yesByChannel.find((r) => r.channel === k)?._count._all ?? 0
    stats[k] = { used, yesPct: k === 'POST' || used === 0 ? null : Math.round((yes / used) * 100) }
  }
  stats.AFTER_YES = { used: afterYes, yesPct: null }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-600">Admin / One-A-Day</p>
        <h1 className="text-2xl font-bold text-gray-900">Message templates</h1>
        <p className="text-gray-600 mt-1">The words coaches and ambassadors copy. They can edit their own copy; these are the starting points.</p>
      </div>
      <TemplatesClient rows={rows} stats={stats} />
    </div>
  )
}
