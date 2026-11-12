'use client'

/**
 * Host list for the Availability page: searchable and filterable, so it still works with many hosts.
 * Wide screens: a list beside the editor. Phones: a "Host: name / Change" button that opens the list.
 * Rows are plain links, so the editor's unsaved-changes guard catches a switch.
 */
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Search } from 'lucide-react'
import { HOST_STATUS_LABEL, type HostStatus } from '@/lib/get-involved/host-status'

export interface PickerHost {
  userId: string
  name: string
  email: string
  tag: string | null
  status: HostStatus
  /** e.g. "5 days · 40 h a week", or null with no weekly times. */
  summary: string | null
}

type Filter = 'ALL' | 'ATTENTION' | 'BOOKABLE' | 'PAUSED'
const FILTERS: { key: Filter; label: string; match: (s: HostStatus) => boolean }[] = [
  { key: 'ALL', label: 'All', match: () => true },
  { key: 'ATTENTION', label: 'Needs setup', match: (s) => s === 'NEEDS_TIMES' || s === 'NEEDS_AGES' },
  { key: 'BOOKABLE', label: 'Bookable', match: (s) => s === 'BOOKABLE' },
  { key: 'PAUSED', label: 'Paused', match: (s) => s === 'PAUSED' },
]
export const STATUS_DOT: Record<HostStatus, string> = { BOOKABLE: 'bg-green-600', NEEDS_TIMES: 'bg-amber-500', NEEDS_AGES: 'bg-amber-500', PAUSED: 'bg-gray-400' }
const ring = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2'
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?'

export function HostPicker({ hosts, currentId, base = '/admin/discovery-calls/availability' }: { hosts: PickerHost[]; currentId: string; base?: string }) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('ALL')
  const [open, setOpen] = useState(false)
  const current = hosts.find((h) => h.userId === currentId)
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, hosts.filter((h) => f.match(h.status)).length])) as Record<Filter, number>, [hosts])
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const f = FILTERS.find((x) => x.key === filter)!
    return hosts.filter((h) => f.match(h.status) && (!needle || h.name.toLowerCase().includes(needle) || h.email.toLowerCase().includes(needle)))
  }, [hosts, q, filter])
  const searchable = hosts.length > 5
  const filters = FILTERS.filter((f) => f.key === 'ALL' || counts[f.key] > 0)

  return (
    <nav aria-label="Hosts" className="bg-white border border-gray-200 rounded-xl lg:sticky lg:top-20">
      {/* Phones: show who is selected, open the list on demand */}
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="host-list-panel" className={`lg:hidden w-full flex items-center justify-between gap-3 p-4 text-left rounded-xl ${ring}`}>
        <span className="min-w-0">
          <span className="block text-xs text-gray-500">Host ({hosts.length})</span>
          <span className="block font-semibold text-gray-900 truncate">{current?.name ?? 'Choose a host'}</span>
        </span>
        <span className="flex-none inline-flex items-center gap-1 text-sm font-semibold text-primary-700">Change<ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden /></span>
      </button>

      <div id="host-list-panel" className={`${open ? 'block' : 'hidden'} lg:block border-t border-gray-100 lg:border-0`}>
        <div className="p-4 pb-3 space-y-3">
          <div className="hidden lg:flex items-baseline justify-between">
            <h2 className="font-bold text-gray-900">Hosts</h2>
            <span className="text-xs text-gray-500">{counts.BOOKABLE} of {hosts.length} bookable</span>
          </div>
          {searchable && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email" aria-label="Search hosts"
                className="w-full h-10 rounded-lg border border-gray-300 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600" />
            </div>
          )}
          {filters.length > 1 && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show">
              {filters.map((f) => (
                <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}
                  className={`h-8 px-2.5 rounded-full text-xs font-semibold border ${ring} ${filter === f.key ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'}`}>
                  {f.label} <span className={filter === f.key ? 'text-gray-300' : 'text-gray-500'}>{counts[f.key]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <ul className="max-h-[60vh] lg:max-h-[calc(100vh-16rem)] overflow-y-auto px-2 pb-2" aria-label={`${shown.length} host${shown.length === 1 ? '' : 's'}`}>
          {shown.length === 0 && <li className="px-3 py-6 text-center text-sm text-gray-500">No hosts match.</li>}
          {shown.map((h) => {
            const isCurrent = h.userId === currentId
            return (
              <li key={h.userId}>
                <Link href={`${base}?host=${h.userId}`} aria-current={isCurrent ? 'page' : undefined} onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${ring} ${isCurrent ? 'bg-primary-50 ring-1 ring-inset ring-primary-200' : 'hover:bg-gray-50'}`}>
                  <span className={`flex-none h-9 w-9 rounded-full inline-flex items-center justify-center text-xs font-bold ${isCurrent ? 'bg-primary-700 text-white' : 'bg-gray-100 text-gray-700'}`} aria-hidden>{initials(h.name)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className={`truncate text-sm font-semibold ${isCurrent ? 'text-primary-900' : 'text-gray-900'}`}>{h.name}</span>
                      {h.tag && <span className="flex-none text-[11px] font-semibold text-gray-500">{h.tag}</span>}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-gray-600">
                      <span className={`flex-none h-2 w-2 rounded-full ${STATUS_DOT[h.status]}`} aria-hidden />
                      <span className="truncate">{h.status === 'BOOKABLE' && h.summary ? h.summary : HOST_STATUS_LABEL[h.status]}</span>
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
