import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getLiveTerms, listRoleConfigs } from '@/lib/get-involved/roles'
import { isGetInvolvedRole } from '@/lib/get-involved/core'
import { userDisplayName } from '@/lib/get-involved/server'
import { RoleSettingsClient, TermsVersionRow } from './role-settings-client'

export const dynamic = 'force-dynamic'

/** Prospects still moving through the journey (their settings are frozen in roleConfigSnapshot). */
const FINISHED = ['ACCOUNT_CREATED', 'NOT_A_FIT', 'DONATION_HANDOFF', 'PAUSED'] as const

export default async function RoleSettingsPage({ searchParams }: { searchParams: { role?: string } }) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') redirect('/login')

  const [configs, versions, inProgress] = await Promise.all([
    listRoleConfigs(),
    prisma.getInvolvedRoleTerms.findMany({
      orderBy: [{ role: 'asc' }, { version: 'desc' }],
      select: { id: true, role: true, version: true, body: true, createdAt: true, createdById: true, _count: { select: { acceptedBy: true } } },
    }),
    prisma.prospect.groupBy({
      by: ['journeyRole'],
      where: { journeyRole: { not: null }, journeyToken: { not: null }, status: { notIn: [...FINISHED] } },
      _count: { _all: true },
    }),
  ])
  const live = await Promise.all(configs.map((c) => getLiveTerms(c.role)))

  const names = new Map<string, string>()
  for (const id of Array.from(new Set(versions.map((v) => v.createdById).filter(Boolean) as string[]))) {
    names.set(id, (await userDisplayName(id))?.full ?? 'Unknown')
  }
  const history: TermsVersionRow[] = versions.map((v) => ({
    id: v.id,
    role: v.role,
    version: v.version,
    body: v.body,
    createdAt: v.createdAt.toISOString(),
    createdBy: v.createdById ? names.get(v.createdById) ?? 'Unknown' : null,
    acceptedCount: v._count.acceptedBy,
  }))

  const initialRole = isGetInvolvedRole(searchParams.role) ? searchParams.role : 'COACH'

  return (
    <RoleSettingsClient
      configs={configs}
      liveTerms={live.map((t) => ({ role: t.role, id: t.id, version: t.version, body: t.body, createdAt: t.createdAt?.toISOString() ?? null }))}
      history={history}
      inProgress={Object.fromEntries(inProgress.map((g) => [g.journeyRole as string, g._count._all]))}
      initialRole={initialRole}
    />
  )
}
