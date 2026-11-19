'use client'

/** A date in the viewer's own time zone ("Nov 20", or "Nov 20 at 4:12 p.m."). Filled in after load. */
import { useEffect, useState } from 'react'

export function formatLocal(iso: string, format: 'day' | 'dayTime'): string {
  const d = new Date(iso)
  const day = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d)
  if (format === 'day') return day
  const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(d).replace('AM', 'a.m.').replace('PM', 'p.m.')
  return `${day} at ${time}`
}

export function LocalDate({ iso, format = 'day' }: { iso: string | null; format?: 'day' | 'dayTime' }) {
  const [text, setText] = useState('')
  useEffect(() => { if (iso) setText(formatLocal(iso, format)) }, [iso, format])
  if (!iso) return null
  return <time dateTime={iso}>{text}</time>
}
