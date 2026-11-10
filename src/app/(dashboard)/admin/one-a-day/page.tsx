import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { BoardRole, joinedByInviter, leaderboard, monthStart } from '@/lib/get-involved/queries'

export const dynamic = 'force-dynamic'

const ROLES: { v: BoardRole; label: string }[] = [{ v: 'ALL', label: 'Overall' }, { v: 'COACH', label: 'Coaches' }, { v: 'AMBASSADOR', label: 'Ambassadors' }]

export default async function AdminOneADayPage({ searchParams }: { searchParams: { role?: string; period?: string } }) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') redirect('/login')
  const role = (ROLES.find((r) => r.v === searchParams.role)?.v ?? 'ALL') as BoardRole
  const allTime = searchParams.period === 'all'
  const since = allTime ? null : monthStart()
  const rows = await leaderboard({ since, role })
  const created = since ? { gte: since } : undefined
  const [forms, joinedMap, kept] = await Promise.all([
    prisma.prospect.count({ where: { invitedById: { not: null }, createdAt: created } }),
    joinedByInviter(since),
    prisma.discoveryCall.count({ where: { status: 'KEPT', outcomeAt: created } }),
  ])
  const joined = Array.from(joinedMap.values()).reduce((a, b) => a + b, 0)
  const q = (o: { role?: string; period?: string }) => `/admin/one-a-day?role=${o.role ?? role}&period=${o.period ?? (allTime ? 'all' : 'month')}`

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">One-A-Day Leaderboard</h1>
        <p className="text-gray-600 mt-1">Ranked by people who joined, then by forms submitted. Coaches and ambassadors see the same board on their One-A-Day page.</p>
      </div>
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">{ROLES.map((r) => <Link key={r.v} href={q({ role: r.v })} aria-current={role === r.v ? 'true' : undefined} className={`h-9 px-4 rounded-full text-sm font-semibold border inline-flex items-center ${role === r.v ? 'bg-primary-700 border-primary-700 text-white' : 'border-gray-300 text-gray-700'}`}>{r.label}</Link>)}</div>
        <div className="flex gap-2">{[['month', 'This month'], ['all', 'All time']].map(([v, l]) => <Link key={v} href={q({ period: v })} aria-current={(v === 'all') === allTime ? 'true' : undefined} className={`h-9 px-4 rounded-full text-sm font-semibold border inline-flex items-center ${(v === 'all') === allTime ? 'bg-gray-900 border-gray-900 text-white' : 'border-gray-300 text-gray-700'}`}>{l}</Link>)}</div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[['Forms', forms], ['Calls kept', kept], ['Joined', joined], ['Form → joined', forms ? `${Math.round((joined / forms) * 100)}%` : '–']].map(([l, v]) => (
          <div key={l as string} className="bg-white border border-gray-200 rounded-xl p-4"><p className="text-2xl font-bold text-gray-900">{v}</p><p className="text-sm text-gray-600">{l}</p></div>
        ))}
      </div>
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        {rows.length === 0 ? <p className="text-sm text-gray-600">No invites yet in this period.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-600">{['Rank', 'Name', 'Role', 'Joined', 'Forms', 'Calls kept', 'Streak'].map((h) => <th key={h} className="py-2 pr-4 font-semibold whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.userId} className="border-t border-gray-100">
                  <td className="py-2.5 pr-4 font-bold text-primary-800">{r.rank}</td>
                  <td className="py-2.5 pr-4 font-semibold text-gray-900 whitespace-nowrap">{r.name}</td>
                  <td className="py-2.5 pr-4 whitespace-nowrap">{r.role === 'COACH' ? 'Coach' : 'Ambassador'}</td>
                  <td className="py-2.5 pr-4">{r.joined}</td>
                  <td className="py-2.5 pr-4">{r.forms}</td>
                  <td className="py-2.5 pr-4">{r.callsKept}</td>
                  <td className="py-2.5 pr-4 whitespace-nowrap">{r.streak > 0 ? `${r.streak} day${r.streak === 1 ? '' : 's'}` : '–'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
      <p className="text-sm text-gray-600">Streak = days in a row (Central Time) with at least one form or added person. Someone who signs up twice is only counted once, for the first person who invited them.</p>
    </div>
  )
}
