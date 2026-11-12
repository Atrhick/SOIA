import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Prisma, AmbassadorStatus } from '@prisma/client'
import { Search } from 'lucide-react'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { Pager, parsePage } from '@/components/ui/pager'
import { AdminAmbassadorTable } from './ambassador-table'
import { getAllFeatureConfigs } from '@/lib/actions/feature-config'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

const FILTERS: { key: 'all' | AmbassadorStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'PENDING', label: 'Waiting for review' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'ON_HOLD', label: 'On hold' },
  { key: 'INACTIVE', label: 'Inactive' },
  { key: 'COMPLETED', label: 'Completed' },
]
type Filter = (typeof FILTERS)[number]['key']

function searchWhere(q: string): Prisma.AmbassadorWhereInput[] {
  return q.split(/\s+/).filter(Boolean).slice(0, 4).map((w) => ({
    OR: [
      { firstName: { contains: w, mode: 'insensitive' } },
      { lastName: { contains: w, mode: 'insensitive' } },
      { email: { contains: w, mode: 'insensitive' } },
      { coach: { firstName: { contains: w, mode: 'insensitive' } } },
      { coach: { lastName: { contains: w, mode: 'insensitive' } } },
    ],
  }))
}

/** One page of ambassadors plus a count per status, all done in the database. */
async function getAmbassadors(filter: Filter, q: string, page: number) {
  const search = searchWhere(q)
  const where: Prisma.AmbassadorWhereInput = { AND: [...search, ...(filter === 'all' ? [] : [{ status: filter }])] }
  const [rows, total, byStatus] = await Promise.all([
    prisma.ambassador.findMany({
      where,
      include: { coach: { include: { user: { select: { id: true, email: true, status: true } } } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.ambassador.count({ where }),
    prisma.ambassador.groupBy({ by: ['status'], where: { AND: search }, _count: { _all: true } }),
  ])
  const counts: Record<string, number> = { all: 0 }
  for (const s of byStatus) { counts[s.status] = s._count._all; counts.all += s._count._all }
  return { rows, total, counts }
}

export default async function AdminAmbassadorsPage({ searchParams }: { searchParams: { filter?: string; q?: string; page?: string } }) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') redirect('/login')

  const q = (searchParams.q || '').trim().slice(0, 100)
  const filter: Filter = FILTERS.some((f) => f.key === searchParams.filter) ? (searchParams.filter as Filter) : 'all'
  const page = parsePage(searchParams.page)

  const [{ rows, total, counts }, coaches, featuresResult] = await Promise.all([
    getAmbassadors(filter, q, page),
    prisma.coachProfile.findMany({
      where: { user: { status: 'ACTIVE' } },
      select: { id: true, firstName: true, lastName: true, user: { select: { email: true } } },
      orderBy: { firstName: 'asc' },
    }),
    getAllFeatureConfigs(),
  ])

  const href = (f: Filter) => {
    const sp = new URLSearchParams()
    if (f !== 'all') sp.set('filter', f)
    if (q) sp.set('q', q)
    const s = sp.toString()
    return `/admin/ambassadors${s ? `?${s}` : ''}`
  }
  const waiting = counts.PENDING ?? 0

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ambassadors</h1>
        <p className="text-gray-600 mt-1">
          {counts.all} ambassador{counts.all === 1 ? '' : 's'}{q ? ` matching "${q}"` : ''}
          {waiting > 0 && <> · <Link href={href('PENDING')} className="font-semibold text-amber-700 hover:underline">{waiting} waiting for review</Link></>}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filter ambassadors" className="flex flex-wrap gap-1.5">
          {FILTERS.filter((f) => f.key === 'all' || f.key === filter || (counts[f.key] ?? 0) > 0).map((f) => (
            <Link key={f.key} href={href(f.key)} aria-current={filter === f.key ? 'page' : undefined}
              className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold ${filter === f.key ? 'border-primary-700 bg-primary-700 text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'}`}>
              {f.label}
              <span className={`rounded-full px-1.5 text-xs ${filter === f.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>{counts[f.key] ?? 0}</span>
            </Link>
          ))}
        </nav>
        <form method="get" action="/admin/ambassadors" className="relative w-full sm:w-72">
          {filter !== 'all' && <input type="hidden" name="filter" value={filter} />}
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <label htmlFor="amb-q" className="sr-only">Search ambassadors</label>
          <input id="amb-q" name="q" type="search" defaultValue={q} placeholder="Search name, email or coach"
            className="h-9 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30" />
        </form>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <AdminAmbassadorTable
          ambassadors={rows}
          coaches={coaches.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}`, email: c.user.email }))}
          features={featuresResult.configs || []}
          emptyText={counts.all === 0 && !q ? undefined : q ? `No ambassadors match "${q}".` : 'No ambassadors with this status.'}
        />
        <div className="mt-4">
          <Pager page={page} pageSize={PAGE_SIZE} total={total} basePath="/admin/ambassadors" params={{ filter: filter === 'all' ? undefined : filter, q: q || undefined }} label="ambassadors" />
        </div>
      </div>
    </div>
  )
}
