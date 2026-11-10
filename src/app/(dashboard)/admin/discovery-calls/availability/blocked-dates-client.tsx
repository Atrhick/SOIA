'use client'

/** "Block off a date" (board Availability): whole days a host is away, and the calls still booked on them. */
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { blockDiscoveryDate, unblockDiscoveryDate } from '@/lib/actions/discovery-admin'
import { MoveCall, smallBtn } from '../move-call'

export interface BlockedDay {
  day: string
  note: string | null
  calls: { id: string; name: string; startsAt: string }[]
}

const ring = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2'
const dayLabel = (day: string) => {
  const [y, m, d] = day.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)))
}
const timeIn = (iso: string, tz: string) => new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz, timeZoneName: 'short' }).format(new Date(iso))

export function BlockedDatesClient({ hostUserId, hostName, timezone, today, blocked, base = '/admin/discovery-calls', canMove = true }: { hostUserId: string; hostName: string; timezone: string; today: string; blocked: BlockedDay[]; base?: string; canMove?: boolean }) {
  const router = useRouter()
  const [day, setDay] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function block(e: React.FormEvent) {
    e.preventDefault()
    if (!day) { setMsg({ ok: false, text: 'Pick a date' }); return }
    setBusy('add'); setMsg(null)
    const r = await blockDiscoveryDate(hostUserId, { day, note })
    setBusy(null)
    if ('error' in r) { setMsg({ ok: false, text: r.error }); return }
    setMsg({ ok: true, text: r.message }); setDay(''); setNote('')
    router.refresh()
  }

  async function unblock(d: string) {
    setBusy(d); setMsg(null)
    const r = await unblockDiscoveryDate(hostUserId, d)
    setBusy(null)
    if ('error' in r) { setMsg({ ok: false, text: r.error }); return }
    setMsg({ ok: true, text: `${dayLabel(d)} is open again.` })
    router.refresh()
  }

  return (
    <section aria-labelledby="blocked-h" className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div>
        <h2 id="blocked-h" className="font-bold text-gray-900">Days off</h2>
        <p className="text-sm text-gray-600">Whole days {hostName} is away. No one can book them on these dates. Calls already booked stay on the calendar and are listed here so you can move them.</p>
      </div>
      <form onSubmit={block} className="flex flex-wrap items-end gap-3">
        <div className="min-w-0">
          <label htmlFor="block-day" className="block text-sm font-semibold text-gray-700 mb-1">Date</label>
          <input id="block-day" type="date" min={today} value={day} onChange={(e) => setDay(e.target.value)} className={`h-11 rounded-lg border border-gray-300 px-2 text-sm ${ring}`} />
        </div>
        <div className="min-w-0 flex-1 basis-48">
          <label htmlFor="block-note" className="block text-sm font-semibold text-gray-700 mb-1">Note (optional, staff only)</label>
          <input id="block-note" type="text" maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Away at a conference" className={`w-full h-11 rounded-lg border border-gray-300 px-3 text-sm ${ring}`} />
        </div>
        <button type="submit" disabled={busy !== null} className={`h-11 px-4 rounded-lg border border-primary-700 text-primary-800 bg-white hover:bg-primary-50 text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-60 ${ring}`}>{busy === 'add' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Block off a date</button>
      </form>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-700'}`}>{msg.text}</p>}

      {blocked.length === 0 ? <p className="text-sm text-gray-500">No days off coming up.</p> : (
        <ul className="divide-y divide-gray-100">
          {blocked.map((b) => (
            <li key={b.day} className="py-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 text-sm"><strong className="text-gray-900">{dayLabel(b.day)}</strong>{b.note && <span className="text-gray-600"> · {b.note}</span>}</p>
                <button type="button" disabled={busy !== null} onClick={() => unblock(b.day)} className={smallBtn}>{busy === b.day && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Unblock<span className="sr-only"> {dayLabel(b.day)}</span></button>
              </div>
              {b.calls.length > 0 && (
                <div className="rounded-lg border border-orange-300 bg-orange-50 p-3 space-y-2">
                  <p className="text-sm font-semibold text-orange-900">Still booked this day ({b.calls.length}). {canMove ? 'Move or cancel' : 'Open and cancel, or ask an admin to move'} {b.calls.length === 1 ? 'it' : 'them'}:</p>
                  <ul className="space-y-2">
                    {b.calls.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-sm text-gray-900 pt-1.5"><Link href={`${base}/${c.id}`} className={`font-semibold text-primary-700 hover:underline rounded ${ring}`}>{c.name}</Link> · {timeIn(c.startsAt, timezone)}</p>
                        {canMove && <MoveCall callId={c.id} name={c.name} tz={timezone} />}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
