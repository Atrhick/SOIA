import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Download } from 'lucide-react'
import { auth } from '@/lib/auth'
import { adminBoardTotals, adminLeaderboard, firstInviteAt } from '@/lib/get-involved/leaderboard-extra'
import { ADMIN_BOARDS, boardHref, memberKindLabel, parseBoard, parsePeriod, periodOptions } from '@/lib/get-involved/leaderboard-period'
import { adminGroups, programStats } from '@/lib/get-involved/outreach-stats'
import { ProgramFunnel } from './program-funnel'
import { GroupsClient } from './groups-client'

export const dynamic = 'force-dynamic'

const focusRing = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2'

export default async function AdminOneADayPage({ searchParams }: { searchParams: { role?: string; period?: string } }) {
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
  const boardLabel = ADMIN_BOARDS.find((b) => b.value === board)!.label
  const canExport = !session.user.isImpersonating
  const tiles: [string, string | number][] = [
    [period.key === 'all' ? 'Forms (all time)' : `Forms in ${period.label}`, totals.forms],
    ['Calls kept', totals.kept],
    [period.key === 'all' ? 'Joined (all time)' : `Joined in ${period.label}`, totals.joined],
    ['People active today', totals.activeToday],
    ['Form → joined', totals.forms ? `${Math.round((totals.joined / totals.forms) * 100)}%` : '–'],
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">One-A-Day Leaderboard</h1>
        <p className="text-gray-600 mt-1">Ranked by people who joined, then by forms submitted. Coaches and ambassadors see the same board on their One-A-Day page.</p>
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

      <ProgramFunnel stats={program} periodLabel={period.key === 'all' ? 'all time' : period.current ? 'this month' : period.label} />
      <GroupsClient data={groups} canAct={!session.user.isImpersonating} />

      <nav aria-label="Leaderboard boards" className="flex flex-wrap gap-2">
        {ADMIN_BOARDS.map((b) => (
          <Link key={b.value} href={boardHref('/admin/one-a-day', b.value, period.key)} aria-current={board === b.value ? 'page' : undefined}
            className={`h-9 px-4 rounded-full text-sm font-semibold border inline-flex items-center ${focusRing} ${board === b.value ? 'bg-primary-700 border-primary-700 text-white' : 'border-gray-300 text-gray-700 hover:border-gray-400'}`}>
            {b.label}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {tiles.map(([l, v]) => (
          <div key={l} className="bg-white border border-gray-200 rounded-xl p-4 min-w-0"><p className="text-2xl font-bold text-gray-900">{v}</p><p className="text-sm text-gray-600 break-words">{l}</p></div>
        ))}
      </div>

      <section aria-labelledby="board-h" className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 id="board-h" className="font-bold text-gray-900 mb-3">{boardLabel} · {period.label}</h2>
        {rows.length === 0 ? <p className="text-sm text-gray-600">No invites in this period.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">{boardLabel} leaderboard, {period.label}</caption>
              <thead><tr className="text-left text-xs text-gray-600">{['Rank', 'Name', 'Role', 'Joined', 'Forms', 'Calls kept', 'Streak', 'Team size'].map((h) => <th key={h} scope="col" className="py-2 pr-4 font-semibold whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.userId} className="border-t border-gray-100">
                  <td className="py-2.5 pr-4 font-bold text-primary-800">{r.rank}</td>
                  <th scope="row" className="py-2.5 pr-4 font-semibold text-gray-900 whitespace-nowrap text-left">{r.name}</th>
                  <td className="py-2.5 pr-4 whitespace-nowrap">{memberKindLabel(r.kind)}</td>
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
      </section>
      <p className="text-sm text-gray-600">
        Streak = days in a row (Central Time) with at least one form or added person{period.current ? '' : `, as of the last day of ${period.label}`}. Team size = everyone they invited who now has a login (all time).
        People active today = coaches and ambassadors with at least one form or added person today. Youth ambassadors joined through the Youth ambassador role or are 17 and under; the Ambassadors board shows the rest.
        Someone who signs up twice is only counted once, for the first person who invited them.
      </p>
    </div>
  )
}
