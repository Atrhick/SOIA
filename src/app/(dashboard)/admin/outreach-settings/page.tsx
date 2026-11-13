import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Search } from 'lucide-react'
import { auth } from '@/lib/auth'
import { getOutreachSettings, listOfferPrograms, nextMonthStart, type OfferFilter } from '@/lib/get-involved/offer'
import { Pager, parsePage } from '@/components/ui/pager'
import { SPONSOR_LINE } from '@/lib/get-involved/scripts'
import { ProgramOfferTable, SiteCard } from './outreach-settings-client'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25
const FILTERS: { key: OfferFilter; label: string }[] = [
  { key: 'all', label: 'All live programs' },
  { key: 'offer', label: 'Offer on' },
  { key: 'none', label: 'No offer' },
]

export default async function OutreachSettingsPage({ searchParams }: { searchParams: { q?: string; filter?: string; page?: string } }) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') redirect('/login')
  const q = (searchParams.q || '').trim().slice(0, 100)
  const filter: OfferFilter = FILTERS.some((f) => f.key === searchParams.filter) ? (searchParams.filter as OfferFilter) : 'all'
  const page = parsePage(searchParams.page)
  const [{ programs, total, counts }, site] = await Promise.all([
    listOfferPrograms({ q, filter, page, pageSize: PAGE_SIZE }),
    getOutreachSettings(),
  ])
  const reset = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' }).format(nextMonthStart())
  const href = (f: OfferFilter) => {
    const sp = new URLSearchParams()
    if (f !== 'all') sp.set('filter', f)
    if (q) sp.set('q', q)
    const s = sp.toString()
    return `/admin/outreach-settings${s ? `?${s}` : ''}`
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Outreach settings</h1>
        <p className="text-gray-600 mt-1">Sponsored-seat offers for each live program, and the details every outreach email uses.</p>
      </div>

      <section aria-labelledby="programs-h" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="programs-h" className="text-lg font-bold text-gray-900">Program offers</h2>
            <p className="text-sm text-gray-600">Owners set their own prices; you set the sponsored seats. &quot;Offered&quot; counts seats the team offered on calls this month. Seats reset on the 1st (next: {reset}).</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Filter programs" className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <Link key={f.key} href={href(f.key)} aria-current={filter === f.key ? 'page' : undefined}
                className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold ${filter === f.key ? 'border-primary-700 bg-primary-700 text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'}`}>
                {f.label}
                <span className={`rounded-full px-1.5 text-xs ${filter === f.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>{counts[f.key]}</span>
              </Link>
            ))}
          </nav>
          <form method="get" action="/admin/outreach-settings" className="relative w-full sm:w-72">
            {filter !== 'all' && <input type="hidden" name="filter" value={filter} />}
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <label htmlFor="prog-q" className="sr-only">Search programs</label>
            <input id="prog-q" name="q" type="search" defaultValue={q} placeholder="Search program or owner"
              className="h-9 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30" />
          </form>
        </div>

        <ProgramOfferTable programs={programs} emptyText={
          counts.all === 0 && !q
            ? 'No program pages are live yet. Offers can be set once a program page is approved and published.'
            : q ? `No live programs match "${q}".` : 'No programs in this filter.'
        } />
        <Pager page={page} pageSize={PAGE_SIZE} total={total} basePath="/admin/outreach-settings" params={{ filter: filter === 'all' ? undefined : filter, q: q || undefined }} label="programs" />

        <details className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
          <summary className="cursor-pointer font-semibold text-gray-900">How sponsored seats work</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Before the call, people only read: &quot;{SPONSOR_LINE}&quot; No prices, no seat counts, no promises.</li>
            <li>The team qualifies them on the free call. If they&apos;re a good fit, the host presses &quot;Offer a sponsored seat&quot; on the call record.</li>
            <li>A seat is used when the team offers it, not when a call is booked. &quot;Undo offer&quot; gives it back in the same month.</li>
            <li>Seats reset on the 1st of each month. 0 or empty seats = no sponsorship line anywhere for that program.</li>
            <li>When every seat has been offered, the sign-up page offers the waiting list for next month. Never a fake countdown.</li>
            <li>Program owners can change the two prices on their program page; each change shows here with who made it.</li>
            <li>Payment isn&apos;t taken in this app: the program owner collects the fee.</li>
          </ul>
        </details>
      </section>

      <SiteCard site={site} />
    </div>
  )
}
