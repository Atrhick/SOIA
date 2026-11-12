'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Download, Search, Users } from 'lucide-react'
import { AGE_RANGES } from '@/lib/get-involved/core'
import { ClientPager, usePaged } from '@/components/ui/client-pager'
import { COUNT_STAGES, JourneyRow, LIST_STAGES, ListFilters, ListStage, exportHref, filterRows, stageInfo } from './journey-list'

const FIELD = 'w-full h-11 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2'

export function JourneyProspectsClient({ rows, capped, joined30, roleOptions, initialFilters }: {
  rows: JourneyRow[]
  capped: number | null
  joined30: number
  roleOptions: { value: string; label: string }[]
  initialFilters: ListFilters
}) {
  const [f, setF] = useState<ListFilters>(initialFilters)
  const set = (k: keyof ListFilters, v: string) => setF((old) => ({ ...old, [k]: v }))

  // Keep the filters in the address bar so a filtered list can be bookmarked or shared (no refetch).
  useEffect(() => {
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries(f)) if (v) sp.set(k, v)
    const qs = sp.toString()
    try { window.history.replaceState(null, '', `/admin/prospects${qs ? `?${qs}` : ''}`) } catch { /* ignore */ }
  }, [f])

  const shown = useMemo(() => filterRows(rows, f), [rows, f])
  const paged = usePaged(shown, 50, JSON.stringify(f))
  const counts = useMemo(() => {
    const c = {} as Record<ListStage, number>
    for (const s of LIST_STAGES) c[s.value] = 0
    for (const r of rows) c[r.stage]++
    return c
  }, [rows])
  const inviters = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of rows) if (r.inviterId) m.set(r.inviterId, r.inviterName ?? 'Unknown')
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [rows])
  const filtered = Object.values(f).some(Boolean)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">Prospects</h1>
          <p className="text-gray-600 mt-1">Everyone in the Get Involved journey. Click a name to open their record.</p>
        </div>
        <a
          href={exportHref(f)}
          download
          className={`h-10 px-4 rounded-xl border border-primary-700 text-primary-700 bg-white hover:bg-primary-50 text-sm font-semibold inline-flex items-center gap-2 ${FOCUS}`}
        >
          <Download className="h-4 w-4" aria-hidden />
          Export CSV{filtered ? ' (filtered)' : ''}
        </a>
      </div>

      <section aria-label="People in each stage" className="bg-white border border-gray-200 rounded-2xl p-3">
        <ul className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {COUNT_STAGES.map((s) => {
            const on = f.stage === s
            const n = s === 'JOINED' ? joined30 : counts[s]
            const label = s === 'JOINED' ? 'Joined (30 days)' : stageInfo(s).label
            return (
              <li key={s}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => set('stage', on ? '' : s)}
                  className={`w-full text-left rounded-xl px-3 py-2.5 border transition-colors ${FOCUS} ${on ? 'bg-sky-100 border-sky-200' : 'bg-gray-50 border-transparent hover:bg-gray-100'}`}
                >
                  <span className="block text-xl font-bold text-gray-900">{n}</span>
                  <span className="block text-xs text-gray-600">{label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-label="Prospect list" className="bg-white border border-gray-200 rounded-2xl p-4 md:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))] gap-3">
          <div>
            <label htmlFor="pf-q" className="block text-xs font-semibold text-gray-700 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden />
              <input id="pf-q" type="search" value={f.q} onChange={(e) => set('q', e.target.value)} placeholder="Name, email or phone" className={`${FIELD} pl-9`} maxLength={200} />
            </div>
          </div>
          <div>
            <label htmlFor="pf-age" className="block text-xs font-semibold text-gray-700 mb-1">Age range</label>
            <select id="pf-age" value={f.age} onChange={(e) => set('age', e.target.value)} className={FIELD}>
              <option value="">All</option>
              {AGE_RANGES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="pf-inv" className="block text-xs font-semibold text-gray-700 mb-1">Invited by</label>
            <select id="pf-inv" value={f.inviter} onChange={(e) => set('inviter', e.target.value)} className={FIELD}>
              <option value="">Anyone</option>
              {inviters.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              <option value="none">No inviter</option>
            </select>
          </div>
          <div>
            <label htmlFor="pf-role" className="block text-xs font-semibold text-gray-700 mb-1">Role chosen</label>
            <select id="pf-role" value={f.role} onChange={(e) => set('role', e.target.value)} className={FIELD}>
              <option value="">Any</option>
              {roleOptions.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              <option value="none">No role yet</option>
            </select>
          </div>
          <div>
            <label htmlFor="pf-stage" className="block text-xs font-semibold text-gray-700 mb-1">Stage</label>
            <select id="pf-stage" value={f.stage} onChange={(e) => set('stage', e.target.value)} className={FIELD}>
              <option value="">All stages</option>
              {LIST_STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 mt-4">
          <p className="text-sm text-gray-600" aria-live="polite">
            {shown.length === rows.length ? `${rows.length} ${rows.length === 1 ? 'person' : 'people'}` : `Showing ${shown.length} of ${rows.length}`}
          </p>
          {filtered && (
            <button type="button" onClick={() => setF({ q: '', age: '', inviter: '', role: '', stage: '' })} className={`text-sm font-semibold text-primary-700 hover:underline rounded ${FOCUS}`}>
              Clear filters
            </button>
          )}
        </div>

        {shown.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-10 w-10 text-gray-300 mx-auto mb-3" aria-hidden />
            <p className="font-semibold text-gray-900">{rows.length === 0 ? 'No one in the journey yet' : 'No one matches these filters'}</p>
            <p className="text-sm text-gray-600 mt-1">
              {rows.length === 0 ? 'People appear here when they fill in a Get Involved form or an inviter adds them.' : 'Try a different search or clear the filters.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop and tablet: table */}
            <div className="hidden md:block mt-2 overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Get Involved prospects</caption>
                <thead>
                  <tr className="text-left text-xs text-gray-600 border-b border-gray-100">
                    <th scope="col" className="py-2 pr-3 font-semibold">Name</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Age</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Invited by</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Role</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Stage</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Last activity</th>
                    <th scope="col" className="py-2 font-semibold"><span className="sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody>
                  {paged.slice.map((r) => (
                    <tr key={r.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="py-3 pr-3 font-semibold text-gray-900">
                        <Link href={`/admin/prospects/${r.id}`} className={`hover:underline rounded ${FOCUS}`}>{r.name}</Link>
                      </td>
                      <td className="py-3 pr-3 whitespace-nowrap text-gray-800">{r.ageLabel}</td>
                      <td className="py-3 pr-3 text-gray-800">{r.inviterName ?? '–'}</td>
                      <td className="py-3 pr-3 text-gray-800">{r.roleLabel ?? '–'}</td>
                      <td className="py-3 pr-3"><span className={`inline-block whitespace-nowrap text-xs font-semibold rounded-full px-2.5 py-1 ${r.stageClass}`}>{r.stageLabel}</span></td>
                      <td className="py-3 pr-3 text-gray-800">{r.lastActivity}</td>
                      <td className="py-3 text-right">
                        <Link href={`/admin/prospects/${r.id}`} aria-label={`Open ${r.name}`} className={`text-primary-700 font-medium underline rounded ${FOCUS}`}>Open</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Phone: one card per person, no sideways scroll */}
            <ul className="md:hidden mt-2 divide-y divide-gray-100">
              {paged.slice.map((r) => (
                <li key={r.id}>
                  <Link href={`/admin/prospects/${r.id}`} className={`block py-3 rounded-lg ${FOCUS}`}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-gray-900 break-words min-w-0">{r.name}</span>
                      <span className={`shrink-0 text-xs font-semibold rounded-full px-2.5 py-1 ${r.stageClass}`}>{r.stageLabel}</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1 break-words">
                      {r.ageLabel}{r.roleLabel ? ` · ${r.roleLabel}` : ''}{r.inviterName ? ` · Invited by ${r.inviterName}` : ''}
                    </p>
                    <p className="text-sm text-gray-800 mt-0.5">{r.lastActivity}</p>
                  </Link>
                </li>
              ))}
            </ul>
            <ClientPager paged={paged} noun="people" />
          </>
        )}
        {capped && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            This list holds the {capped.toLocaleString()} most recently active people. Older records are still saved; open them from Discovery calls or the person&apos;s inviter.
          </p>
        )}
      </section>
    </div>
  )
}
