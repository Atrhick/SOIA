import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * Link-based pager for server-rendered lists: "Showing 26–50 of 312" and Previous / page numbers / Next.
 * `basePath` plus `params` are kept on every link; `page` is 1-based and set as `?page=`.
 */
export function Pager({ page, pageSize, total, basePath, params = {}, label = 'results', paramName = 'page' }: {
  page: number
  pageSize: number
  total: number
  basePath: string
  params?: Record<string, string | undefined>
  label?: string
  paramName?: string
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total === 0) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  const href = (p: number) => {
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v)
    if (p > 1) sp.set(paramName, String(p))
    const s = sp.toString()
    return `${basePath}${s ? `?${s}` : ''}`
  }
  // 1 … 4 5 [6] 7 8 … 20
  const nums: (number | '…')[] = []
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) nums.push(p)
    else if (nums[nums.length - 1] !== '…') nums.push('…')
  }
  const btn = 'inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm font-medium'
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
      <p>Showing <strong className="text-gray-900">{from}–{to}</strong> of <strong className="text-gray-900">{total}</strong> {label}</p>
      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center gap-1">
          {page > 1
            ? <Link href={href(page - 1)} className={`${btn} text-gray-700 hover:bg-gray-100`} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Link>
            : <span className={`${btn} text-gray-300`} aria-hidden="true"><ChevronLeft className="h-4 w-4" /></span>}
          {nums.map((n, i) => n === '…'
            ? <span key={`e${i}`} className="px-1 text-gray-400">…</span>
            : <Link key={n} href={href(n)} aria-current={n === page ? 'page' : undefined}
                className={`${btn} ${n === page ? 'bg-primary-700 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>{n}</Link>)}
          {page < pages
            ? <Link href={href(page + 1)} className={`${btn} text-gray-700 hover:bg-gray-100`} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Link>
            : <span className={`${btn} text-gray-300`} aria-hidden="true"><ChevronRight className="h-4 w-4" /></span>}
        </nav>
      )}
    </div>
  )
}

/** Parse a 1-based page number from a search param, clamped to at least 1. */
export function parsePage(v: string | undefined): number {
  const n = Number(v)
  return Number.isInteger(n) && n > 1 ? Math.min(n, 100000) : 1
}
