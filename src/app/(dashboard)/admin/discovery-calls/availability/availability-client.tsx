'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { saveAvailability } from '@/lib/actions/discovery-admin'
import { zoneLabel, zoneOffset } from '@/lib/get-involved/time-zones'

interface Win { dayOfWeek: number; startMinute: number; endMinute: number }
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const ORDER = [1, 2, 3, 4, 5, 6, 0]
const TIMES = Array.from({ length: 49 }, (_, i) => i * 30)
const label = (m: number) => {
  if (m === 24 * 60) return '12:00 AM (midnight)'
  const h = Math.floor(m / 60), mm = m % 60
  return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

export function AvailabilityClient({ hostUserId, hostName, timezone, windows }: { hostUserId: string; hostName: string; timezone: string; windows: Win[] }) {
  const router = useRouter()
  const [list, setList] = useState<Win[]>(windows)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const set = (i: number, patch: Partial<Win>) => setList(list.map((w, j) => (j === i ? { ...w, ...patch } : w)))

  async function save() {
    setBusy(true); setMsg(null)
    const r = await saveAvailability(hostUserId, list)
    setBusy(false)
    if ('error' in r) setMsg({ ok: false, text: r.error })
    else { setMsg({ ok: true, text: 'Saved. Prospects see these times right away.' }); router.refresh() }
  }

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div>
        <h2 className="font-bold text-gray-900">{hostName}&apos;s weekly times</h2>
        <p className="text-sm text-gray-600">In {zoneLabel(timezone)} ({zoneOffset(timezone)}). Calls are 30 minutes; prospects can book from 12 hours ahead up to 3 weeks out. Booked calls block their slot automatically.</p>
      </div>
      <div className="divide-y divide-gray-100">
        {ORDER.map((d) => {
          const rows = list.map((w, i) => ({ w, i })).filter((x) => x.w.dayOfWeek === d)
          return (
            <div key={d} className="py-3 flex flex-wrap gap-3 items-start">
              <p className="w-28 pt-2 text-sm font-semibold text-gray-900">{DAYS[d]}</p>
              <div className="flex-1 min-w-[240px] space-y-2">
                {rows.length === 0 && <p className="pt-2 text-sm text-gray-500">Not available</p>}
                {rows.map(({ w, i }) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <select aria-label={`${DAYS[d]} start`} value={w.startMinute} onChange={(e) => set(i, { startMinute: Number(e.target.value) })} className="h-10 rounded-lg border border-gray-300 px-2 text-sm">{TIMES.slice(0, -1).map((t) => <option key={t} value={t}>{label(t)}</option>)}</select>
                    <span className="text-sm text-gray-600">to</span>
                    <select aria-label={`${DAYS[d]} end`} value={w.endMinute} onChange={(e) => set(i, { endMinute: Number(e.target.value) })} className="h-10 rounded-lg border border-gray-300 px-2 text-sm">{TIMES.slice(1).map((t) => <option key={t} value={t}>{label(t)}</option>)}</select>
                    <button type="button" aria-label={`Remove ${DAYS[d]} ${label(w.startMinute)} block`} onClick={() => setList(list.filter((_, j) => j !== i))} className="h-10 w-10 rounded-lg border border-gray-300 inline-flex items-center justify-center text-gray-600 hover:text-red-700"><Trash2 className="h-4 w-4" aria-hidden /></button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setList([...list, { dayOfWeek: d, startMinute: 9 * 60, endMinute: 12 * 60 }])} className="h-10 px-3 rounded-lg border border-gray-300 text-sm font-semibold inline-flex items-center gap-1.5"><Plus className="h-4 w-4" aria-hidden />Add time</button>
            </div>
          )
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={save} disabled={busy} className="h-10 px-5 rounded-lg bg-primary-700 hover:bg-primary-800 text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Save availability</button>
        {msg && <span role={msg.ok ? 'status' : 'alert'} className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-700'}`}>{msg.text}</span>}
      </div>
    </section>
  )
}
