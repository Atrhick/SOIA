import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Download } from 'lucide-react'
import { auth } from '@/lib/auth'
import { adminBoardTotals, adminLeaderboard, firstInviteAt } from '@/lib/get-involved/leaderboard-extra'
import { ADMIN_BOARDS, boardHref, memberKindLabel, parseBoard, parsePeriod, periodOptions } from '@/lib/get-involved/leaderboard-period'
import { NEEDS_HELP_DAYS, adminGroups, programStats } from '@/lib/get-involved/outreach-stats'
import { ChannelTable, ProgramOverview } from './program-funnel'
import { GroupsClient, NudgeList } from './groups-client'
import { Pager, parsePage } from '@/components/ui/pager'

export const dynamic = 'force-dynamic'

const BOARD_PAGE = 25

const focusRing = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2'

export default async function AdminOneADayPage({ searchParams }: { searchParams: { role?: string; period?: string; lp?: string } }) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') redirect('/login')
  const now = new Date()
  const board = parseBoard(searchParams.role)
  const period = parsePeriod(searchParams.period, now)
  const [rows, totals, earliest, program, groups] = await Promise.all([
    adminLeaderboard({ period, board, now }),
    adminBoardTotals(period, now),
    firstInviteAt(),
    programStats(period),
    adminGroups(period, now),
  ])
  const options = periodOptions(earliest, now, 24, period)
  const lp = parsePage(searchParams.lp)
  const pageRows = rows.slice((lp - 1) * BOARD_PAGE, lp * BOARD_PAGE)
  const boardLabel = ADMIN_BOARDS.find((b) => b.value === board)!.label
  const canExport = !session.user.isImpersonating

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">One-A-Day</h1>
        <p className="text-gray-600 mt-1">Coaches and ambassadors aim to invite one person a day. See how it&apos;s going, who could use a nudge, and who&apos;s leading.</p>
      </div>

      <div className="flex flex-wrap gap-3 items-end justify-between">
        <form method="get" action="/admin/one-a-day" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="role" value={board} />
          <div>
            <label htmlFor="period" className="block text-sm font-semibold text-gray-700 mb-1">Period</label>
            <select id="period" name="period" defaultValue={period.key} className={`h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm max-w-full ${focusRing}`}>
              {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <button type="submit" className={`h-10 px-4 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-800 hover:border-gray-400 ${focusRing}`}>Show</button>
        </form>
        {canExport && (
          <a href={boardHref('/admin/one-a-day/export', board, period.key)} download
            className={`h-10 px-4 rounded-lg border border-sky-300 bg-white text-primary-700 text-sm font-semibold inline-flex items-center gap-2 ${focusRing}`}>
            <Download className="h-4 w-4" aria-hidden />Export CSV<span className="sr-only"> of {boardLabel}, {period.label}</span>
          </a>
        )}
      </div>

      <ProgramOverview stats={program} activeToday={totals.activeToday} periodLabel={period.key === 'all' ? 'all time' : period.current ? 'this month' : period.label} />
      <NudgeList data={groups} canAct={!session.user.isImpersonating} needsHelpDays={NEEDS_HELP_DAYS} />

      <section aria-labelledby="board-h" className="bg-white border border-gray-200 rounded-xl p-5 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="board-h" className="text-lg font-bold text-gray-900">Leaderboard · {period.label}</h2>
          <nav aria-label="Leaderboard boards" className="flex flex-wrap gap-1.5">
            {ADMIN_BOARDS.map((b) => (
              <Link key={b.value} href={boardHref('/admin/one-a-day', b.value, period.key)} aria-current={board === b.value ? 'page' : undefined}
                className={`h-8 px-3 rounded-full text-sm font-semibold border inline-flex items-center ${focusRing} ${board === b.value ? 'bg-primary-700 border-primary-700 text-white' : 'border-gray-300 text-gray-700 hover:border-gray-400'}`}>
                {b.label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="text-sm text-gray-600 mt-1">Ranked by people who joined, then forms filled. Members see this same board on their One-A-Day page.</p>
        {rows.length === 0 ? <p className="text-sm text-gray-600 mt-3">No invites in this period yet.</p> : (
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-sm">
              <caption className="sr-only">{boardLabel} leaderboard, {period.label}</caption>
              <thead><tr className="text-left text-xs uppercase tracking-wide text-gray-600 border-b border-gray-200">{['#', 'Name', 'Role', 'Joined', 'Forms', 'Calls kept', 'Streak', 'Team size'].map((h) => <th key={h} scope="col" className="py-2 pr-4 font-semibold whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody>{pageRows.map((r) => (
                <tr key={r.userId} className="border-b border-gray-100">
                  <td className="py-2.5 pr-4 font-bold text-primary-800">{r.rank}</td>
                  <th scope="row" className="py-2.5 pr-4 font-semibold text-gray-900 whitespace-nowrap text-left">{r.name}</th>
                  <td className="py-2.5 pr-4 whitespace-nowrap text-gray-700">{memberKindLabel(r.kind)}</td>
                  <td className="py-2.5 pr-4">{r.joined}</td>
                  <td className="py-2.5 pr-4">{r.forms}</td>
                  <td className="py-2.5 pr-4">{r.callsKept}</td>
                  <td className="py-2.5 pr-4 whitespace-nowrap">{r.streak > 0 ? `${r.streak} day${r.streak === 1 ? '' : 's'}` : '–'}</td>
                  <td className="py-2.5 pr-4">{r.teamSize}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <div className="mt-3"><Pager page={lp} pageSize={BOARD_PAGE} total={rows.length} basePath="/admin/one-a-day" paramName="lp" params={{ role: board === 'ALL' ? undefined : board, period: searchParams.period }} label="members" /></div>
        <details className="mt-3 text-sm text-gray-600">
          <summary className="cursor-pointer font-semibold text-gray-700">How this is counted</summary>
          <p className="mt-2">
            Streak = days in a row (Central Time) with at least one form or added person{period.current ? '' : `, as of the last day of ${period.label}`}. Team size = everyone they invited who now has a login (all time).
            Youth ambassadors joined through the Youth ambassador role or are 17 and under; the Ambassadors board shows the rest.
            Someone who signs up twice is only counted once, for the first person who invited them.
          </p>
        </details>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChannelTable stats={program} />
        <GroupsClient data={groups} canAct={!session.user.isImpersonating} />
      </div>
    </div>
  )
}
