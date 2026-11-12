'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const focus = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2'

/**
 * Pages a list that is already in the browser. `resetKey` sends it back to page 1 whenever it
 * changes (pass the search/filter values).
 */
export function usePaged<T>(items: T[], size: number, resetKey?: string) {
  const [page, setPage] = useState(1)
  useEffect(() => { setPage(1) }, [resetKey])
  const pages = Math.max(1, Math.ceil(items.length / size))
  const p = Math.min(page, pages)
  return {
    page: p, pages, setPage, total: items.length,
    slice: items.slice((p - 1) * size, p * size),
    from: items.length ? (p - 1) * size + 1 : 0,
    to: Math.min(items.length, p * size),
  }
}

/** "Showing 1–25 of 140 people" plus previous/next. Renders nothing for an empty list. */
export function ClientPager({ paged, noun, className = 'mt-3' }: { paged: ReturnType<typeof usePaged<unknown>>; noun: string; className?: string }) {
  const { page, pages, total, from, to, setPage } = paged
  if (total === 0) return null
  return (
    <div className={`${className} flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600`}>
      <p>Showing <strong className="text-gray-900">{from}–{to}</strong> of <strong className="text-gray-900">{total}</strong> {noun}</p>
      {pages > 1 && (
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setPage(page - 1)} disabled={page <= 1} className={`rounded-md p-1.5 hover:bg-gray-100 disabled:text-gray-300 disabled:hover:bg-transparent ${focus}`} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
          <span className="px-1">Page {page} of {pages}</span>
          <button type="button" onClick={() => setPage(page + 1)} disabled={page >= pages} className={`rounded-md p-1.5 hover:bg-gray-100 disabled:text-gray-300 disabled:hover:bg-transparent ${focus}`} aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
        </div>
      )}
    </div>
  )
}
