import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { ageRangeLabel } from '@/lib/get-involved/core'
import { userDisplayName } from '@/lib/get-involved/server'
import { DiscoveryTabs } from '@/components/get-involved/discovery-tabs'
import { CallsClient, CallRow } from './calls-client'

export const dynamic = 'force-dynamic'

export default async function DiscoveryCallsPage({ searchParams }: { searchParams: { who?: string } }) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') redirect('/login')
  const mine = searchParams.who !== 'all'
  const now = new Date()
  const calls = await prisma.discoveryCall.findMany({
    where: {
      ...(mine ? { hostId: session.user.id } : {}),
      OR: [{ status: 'BOOKED' }, { updatedAt: { gte: new Date(now.getTime() - 30 * 86400_000) } }],
    },
    orderBy: { startsAt: 'asc' },
    take: 300,
    include: { prospect: { select: { id: true, firstName: true, lastName: true, ageRange: true, phone: true, email: true, parentName: true, parentEmail: true, invitedById: true } } },
  })
  const names = new Map<string, string>()
  for (const id of Array.from(new Set(calls.flatMap((c) => [c.hostId, c.prospect.invitedById]).filter(Boolean) as string[]))) {
    names.set(id, (await userDisplayName(id))?.full ?? 'Unknown')
  }
  const rows: CallRow[] = calls.map((c) => ({
    id: c.id,
    prospectId: c.prospect.id,
    name: `${c.prospect.firstName} ${c.prospect.lastName}`,
    email: c.prospect.email,
    phone: c.prospect.phone,
    age: ageRangeLabel(c.prospect.ageRange),
    minor: c.prospect.ageRange === 'UNDER_18',
    parent: c.prospect.parentName ? `${c.prospect.parentName} · ${c.prospect.parentEmail ?? ''}` : null,
    inviter: c.prospect.invitedById ? names.get(c.prospect.invitedById) ?? null : null,
    host: c.hostId ? names.get(c.hostId) ?? null : null,
    startsAt: c.startsAt.toISOString(),
    status: c.status,
    meetingUrl: c.meetingUrl,
    notes: c.notes,
  }))
  const isHost = !!(await prisma.discoveryHost.findUnique({ where: { userId: session.user.id }, select: { id: true } }))
  return (
    <div className="space-y-6">
      <DiscoveryTabs active="/admin/discovery-calls" />
      <CallsClient rows={rows} now={now.toISOString()} mine={mine} isHost={isHost} />
    </div>
  )
}
