'use client'

import { useMemo } from 'react'
import { zoneOffset, zoneOptions } from '@/lib/get-involved/time-zones'

/** A world time-zone picker grouped by region, each option showing its current GMT offset. */
export function TimeZoneSelect({ id, value, onChange, className }: { id: string; value: string; onChange: (tz: string) => void; className?: string }) {
  const groups = useMemo(() => {
    const now = new Date()
    return zoneOptions(value).map((g) => ({ ...g, zones: g.zones.map((z) => ({ ...z, offset: zoneOffset(z.id, now) })) }))
  }, [value])
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={className}>
      {groups.map((g) => (
        <optgroup key={g.region} label={g.region}>
          {g.zones.map((z) => <option key={z.id} value={z.id}>{z.offset ? `(${z.offset}) ` : ''}{z.label}</option>)}
        </optgroup>
      ))}
    </select>
  )
}
