'use client'

import { useState } from 'react'
import { markAttendance } from '@/lib/actions/ambassador-groups'

type Status = 'PRESENT' | 'ABSENT' | 'EXCUSED'

const OPTIONS: { value: Status; label: string; on: string }[] = [
  { value: 'PRESENT', label: 'Present', on: 'bg-green-600 text-white border-green-600' },
  { value: 'ABSENT', label: 'Absent', on: 'bg-red-600 text-white border-red-600' },
  { value: 'EXCUSED', label: 'Excused', on: 'bg-amber-500 text-white border-amber-500' },
]

export function RegisterClient({
  sessionId,
  rows,
}: {
  sessionId: string
  rows: { ambassadorId: string; name: string; status: Status | null }[]
}) {
  const [marks, setMarks] = useState<Record<string, Status | null>>(
    Object.fromEntries(rows.map((r) => [r.ambassadorId, r.status])),
  )
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function mark(ambassadorId: string, status: Status) {
    const before = marks[ambassadorId]
    setError(null)
    setMarks((m) => ({ ...m, [ambassadorId]: status }))
    setSaving(ambassadorId)
    try {
      const res = await markAttendance({ sessionId, ambassadorId, status })
      if ('error' in res) {
        setMarks((m) => ({ ...m, [ambassadorId]: before }))
        setError(res.error)
      }
    } catch {
      setMarks((m) => ({ ...m, [ambassadorId]: before }))
      setError('That did not save. Please tap again.')
    } finally {
      setSaving(null)
    }
  }

  const done = Object.values(marks).filter(Boolean).length

  return (
    <div className="space-y-3">
      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <p className="text-sm text-gray-600">
        {done} of {rows.length} marked. Each tap saves straight away.
      </p>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.ambassadorId} className="rounded-xl border bg-white p-3">
            <div className="mb-2 flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 font-semibold text-primary-700">
                {(r.name?.[0] || '?').toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
              {saving === r.ambassadorId && <span className="text-xs text-gray-500">Saving...</span>}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {OPTIONS.map((o) => {
                const active = marks[r.ambassadorId] === o.value
                return (
                  <button
                    key={o.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => mark(r.ambassadorId, o.value)}
                    className={`min-h-[52px] rounded-lg border text-sm font-semibold transition-colors ${
                      active ? o.on : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {o.label}
                  </button>
                )
              })}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
