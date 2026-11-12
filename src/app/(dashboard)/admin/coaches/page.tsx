import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { Pager, parsePage } from '@/components/ui/pager'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Users, UserPlus, ChevronRight, CheckCircle2, Search } from 'lucide-react'
import { DeleteCoachButton } from './delete-coach-button'

const PAGE_SIZE = 25

type CoachFilter = 'all' | 'onboarding' | 'active' | 'suspended'

function coachWhere(filter: CoachFilter, q: string): Prisma.CoachProfileWhereInput {
  const and: Prisma.CoachProfileWhereInput[] = []
  if (filter === 'active') and.push({ coachStatus: 'ACTIVE_COACH' })
  if (filter === 'onboarding') and.push({ coachStatus: 'ONBOARDING_INCOMPLETE' })
  if (filter === 'suspended') and.push({ user: { status: 'SUSPENDED' } })
  if (q) {
    const words = q.split(/\s+/).filter(Boolean).slice(0, 4)
    for (const w of words) and.push({ OR: [
      { firstName: { contains: w, mode: 'insensitive' } },
      { lastName: { contains: w, mode: 'insensitive' } },
      { user: { email: { contains: w, mode: 'insensitive' } } },
    ] })
  }
  return and.length ? { AND: and } : {}
}

/** One page of coaches plus the filter counts, all done in the database. */
async function getCoaches(filter: CoachFilter, q: string, page: number) {
  const base = coachWhere('all', q)
  const [rows, total, all, active, onboarding, suspended, requiredTasksCount] = await Promise.all([
    prisma.coachProfile.findMany({
      where: coachWhere(filter, q),
      include: {
        user: { select: { id: true, email: true, status: true } },
        _count: { select: { ambassadors: true, recruitedCoaches: true } },
        onboardingProgress: {
          where: { status: 'APPROVED', task: { isActive: true, isRequired: true } },
          select: { id: true },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.coachProfile.count({ where: coachWhere(filter, q) }),
    prisma.coachProfile.count({ where: base }),
    prisma.coachProfile.count({ where: coachWhere('active', q) }),
    prisma.coachProfile.count({ where: coachWhere('onboarding', q) }),
    prisma.coachProfile.count({ where: coachWhere('suspended', q) }),
    prisma.onboardingTask.count({ where: { isActive: true, isRequired: true } }),
  ])
  const coaches = rows.map((coach) => {
    const completed = Math.min(coach.onboardingProgress.length, requiredTasksCount)
    return {
      ...coach,
      onboardingPercentage: requiredTasksCount > 0 ? Math.round((completed / requiredTasksCount) * 100) : 0,
      completedTasks: completed,
      totalRequiredTasks: requiredTasksCount,
    }
  })
  return { coaches, total, counts: { all, active, onboarding, suspended } as Record<string, number> }
}

interface PageProps {
  searchParams: Promise<{ filter?: string; q?: string; page?: string }>
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'onboarding', label: 'Still onboarding' },
  { key: 'active', label: 'Fully onboarded' },
  { key: 'suspended', label: 'Suspended' },
] as const

const accountLabel: Record<string, string> = { INACTIVE: 'Inactive', SUSPENDED: 'Suspended' }

export default async function CoachesPage({ searchParams }: PageProps) {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  const params = await searchParams
  const filter = FILTERS.some((f) => f.key === params.filter) ? (params.filter as (typeof FILTERS)[number]['key']) : 'all'
  const q = (params.q || '').trim().toLowerCase().slice(0, 100)

  const page = parsePage(params.page)
  const { coaches, total, counts } = await getCoaches(filter, q, page)
  // Overall numbers for the subtitle ignore the search box.
  const overall = q ? (await getCoaches('all', '', 1)).counts : counts

  const href = (f: string) => {
    const sp = new URLSearchParams()
    if (f !== 'all') sp.set('filter', f)
    if (q) sp.set('q', q)
    const s = sp.toString()
    return `/admin/coaches${s ? `?${s}` : ''}`
  }
  const th = 'px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Coaches</h1>
          <p className="text-gray-600">
            {overall.all} coach{overall.all === 1 ? '' : 'es'} · {overall.active} fully onboarded · {overall.onboarding} still onboarding
          </p>
        </div>
        <Link href="/admin/coaches/new">
          <Button>
            <UserPlus className="mr-2 h-4 w-4" />
            Add coach
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filter coaches" className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <Link key={f.key} href={href(f.key)} aria-current={filter === f.key ? 'page' : undefined}
              className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold ${filter === f.key ? 'border-primary-700 bg-primary-700 text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'}`}>
              {f.label}
              <span className={`rounded-full px-1.5 text-xs ${filter === f.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>{counts[f.key]}</span>
            </Link>
          ))}
        </nav>
        <form method="get" action="/admin/coaches" className="relative w-full sm:w-72">
          {filter !== 'all' && <input type="hidden" name="filter" value={filter} />}
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <label htmlFor="coach-q" className="sr-only">Search coaches</label>
          <input id="coach-q" name="q" type="search" defaultValue={params.q ?? ''} placeholder="Search name or email"
            className="h-9 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30" />
        </form>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {coaches.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Coaches, newest first, page {page}</caption>
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th scope="col" className={th}>Coach</th>
                  <th scope="col" className={th}>Onboarding</th>
                  <th scope="col" className={`${th} hidden md:table-cell text-right`}>Ambassadors</th>
                  <th scope="col" className={`${th} hidden lg:table-cell text-right`}>Coaches recruited</th>
                  <th scope="col" className={`${th} hidden lg:table-cell`}>Location</th>
                  <th scope="col" className={th}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {coaches.map((coach) => {
                  const name = `${coach.firstName} ${coach.lastName}`.trim()
                  const account = accountLabel[coach.user.status]
                  return (
                    <tr key={coach.id} className="group hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link href={`/admin/coaches/${coach.id}`} className="flex items-center gap-3 min-w-0">
                          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700" aria-hidden="true">
                            {(coach.firstName?.[0] || '?').toUpperCase()}{(coach.lastName?.[0] || '?').toUpperCase()}
                          </span>
                          <span className="min-w-0">
                            <span className="flex items-center gap-2">
                              <span className="truncate font-semibold text-gray-900 group-hover:text-primary-700">{name}</span>
                              {account && <Badge variant={coach.user.status === 'SUSPENDED' ? 'destructive' : 'secondary'} className="text-xs">{account}</Badge>}
                            </span>
                            <span className="block truncate text-gray-500">{coach.user.email}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {coach.coachStatus === 'ACTIVE_COACH' ? (
                          <span className="inline-flex items-center gap-1.5 font-medium text-green-700"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />Done</span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <span className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-200" aria-hidden="true">
                              <span className="block h-full rounded-full bg-amber-500" style={{ width: `${coach.onboardingPercentage}%` }} />
                            </span>
                            <span className="text-gray-700">{coach.completedTasks} of {coach.totalRequiredTasks} steps</span>
                          </span>
                        )}
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 text-right tabular-nums text-gray-900">{coach._count.ambassadors}</td>
                      <td className="hidden lg:table-cell px-4 py-3 text-right tabular-nums text-gray-900">{coach._count.recruitedCoaches}</td>
                      <td className="hidden lg:table-cell px-4 py-3 text-gray-600">{coach.region || coach.country || '–'}</td>
                      <td className="px-2 py-3">
                        <span className="flex items-center justify-end gap-1">
                          <Link href={`/admin/coaches/${coach.id}`} className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label={`Open ${name}`}>
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                          <DeleteCoachButton coachId={coach.id} name={name} />
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center">
            <Users className="mx-auto h-10 w-10 text-gray-300" />
            {overall.all === 0 ? (
              <>
                <p className="mt-3 text-gray-600">No coaches yet</p>
                <Link href="/admin/coaches/new"><Button className="mt-4"><UserPlus className="mr-2 h-4 w-4" />Add the first coach</Button></Link>
              </>
            ) : (
              <p className="mt-3 text-gray-600">
                No coaches match{q ? <> &quot;{params.q}&quot;</> : ' this filter'}. <Link href="/admin/coaches" className="font-semibold text-primary-700 hover:underline">Show all</Link>
              </p>
            )}
          </div>
        )}
      </div>
      <Pager page={page} pageSize={PAGE_SIZE} total={total} basePath="/admin/coaches" params={{ filter: filter === 'all' ? undefined : filter, q: q || undefined }} label="coaches" />
      <p className="text-xs text-gray-500">
        Newest first. Onboarding = required onboarding steps approved. Ambassadors = ambassadors assigned to this coach. Coaches recruited = coaches who signed up through them.
      </p>
    </div>
  )
}
