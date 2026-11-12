import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getAllProspects, getProspectStats } from '@/lib/actions/prospects'
import { listRoleConfigs } from '@/lib/get-involved/roles'
import { ProspectsClient } from './prospects-client'
import { JourneyProspectsClient } from './journey-prospects-client'
import { JOURNEY_ROW_CAP, joinedLast30Days, loadJourneyRows } from './journey-data'
import { filtersFrom } from './journey-list'

export const dynamic = 'force-dynamic'

function ViewTabs({ active }: { active: 'journey' | 'pipeline' }) {
  const tab = (href: string, label: string, on: boolean) => (
    <Link
      href={href}
      aria-current={on ? 'page' : undefined}
      className={`h-9 px-4 rounded-full text-sm font-semibold border inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${on ? 'bg-primary-700 border-primary-700 text-white' : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'}`}
    >
      {label}
    </Link>
  )
  return (
    <nav aria-label="Prospect lists" className="flex flex-wrap gap-2">
      {tab('/admin/prospects', 'Get Involved', active === 'journey')}
      {tab('/admin/prospects?view=pipeline', 'Coach pipeline (older)', active === 'pipeline')}
    </nav>
  )
}

export default async function ProspectsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  if (searchParams.view === 'pipeline') {
    const [prospectsResult, statsResult] = await Promise.all([
      getAllProspects(),
      getProspectStats(),
    ])

    const prospects = prospectsResult.prospects || []
    const stats = statsResult.stats || {
      total: 0,
      assessmentCompleted: 0,
      orientationPending: 0,
      businessFormPending: 0,
      interviewPending: 0,
      approved: 0,
      paymentPending: 0,
      accountCreated: 0,
      rejected: 0,
    }

    return (
      <div className="space-y-6">
        <ViewTabs active="pipeline" />
        <ProspectsClient prospects={prospects} stats={stats} />
      </div>
    )
  }

  const now = new Date()
  const [rows, joined30, configs] = await Promise.all([loadJourneyRows(now), joinedLast30Days(now), listRoleConfigs()])
  const roleOptions = configs.map((c) => ({ value: c.role, label: c.label }))

  return (
    <div className="space-y-6">
      <ViewTabs active="journey" />
      <JourneyProspectsClient rows={rows} capped={rows.length >= JOURNEY_ROW_CAP ? JOURNEY_ROW_CAP : null} joined30={joined30} roleOptions={roleOptions} initialFilters={filtersFrom(searchParams)} />
    </div>
  )
}
