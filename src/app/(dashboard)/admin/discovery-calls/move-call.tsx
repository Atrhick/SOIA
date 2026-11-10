'use client'

/**
 * "Move" for an upcoming discovery call (board ACalls): pick another open time and move the call.
 * Used on the Calls list and under blocked dates on the Availability page.
 */
import { useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { MoveSlot, moveDiscoveryCall, slotsForMove } from '@/lib/actions/discovery-admin'

const ring = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2'
export const smallBtn = `h-9 px-3 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-800 hover:bg-gray-50 inline-flex items-center gap-1.5 disabled:opacity-60 ${ring}`
const fmtIn = (iso: string, tz: string) => new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: tz, timeZoneName: 'short' }).format(new Date(iso))

export function MoveCall({ callId, name, tz = 'America/Chicago' }: { callId: string; name: string; tz?: string }) {
  const ct = (iso: string) => fmtIn(iso, tz)
  const router = useRouter()
  const id = useId()
  const [open, setOpen] = useState(false)
  const [slots, setSlots] = useState<MoveSlot[] | null>(null)
  const [pick, setPick] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  async function toggle() {
    if (open) { setOpen(false); return }
    setOpen(true); setErr(null); setOk(null); setSlots(null); setPick('')
    const r = await slotsForMove(callId)
    if ('error' in r) setErr(r.error)
    else setSlots(r.slots)
  }

  async function move() {
    if (!pick) return
    setBusy(true); setErr(null)
    const r = await moveDiscoveryCall(callId, { startsAt: pick })
    setBusy(false)
    if ('error' in r) { setErr(r.error); return }
    setOk(`Moved to ${ct(pick)}. We emailed ${name} and the host.`)
    setOpen(false)
    router.refresh()
  }

  return (
    <div className="w-full sm:w-auto">
      <button type="button" className={smallBtn} aria-expanded={open} aria-controls={`${id}-panel`} onClick={toggle}>Move<span className="sr-only"> {name}&apos;s call</span></button>
      {open && (
        <div id={`${id}-panel`} className="mt-2 w-full rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
          {!slots && !err && <p className="text-sm text-gray-600 inline-flex items-center gap-1.5"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Finding open times…</p>}
          {slots && slots.length === 0 && <p className="text-sm text-gray-700">No other open times for this age range in the next 3 weeks. Add hours on the Availability tab.</p>}
          {slots && slots.length > 0 && (
            <>
              <label htmlFor={`${id}-sel`} className="block text-sm font-semibold text-gray-700">New time (Central)</label>
              <select id={`${id}-sel`} value={pick} onChange={(e) => setPick(e.target.value)} className="w-full max-w-full h-10 rounded-lg border border-gray-300 bg-white px-2 text-sm">
                <option value="">Choose a time</option>
                {slots.map((s) => <option key={s.startsAt} value={s.startsAt}>{ct(s.startsAt)} · {s.hosts.join(', ')}</option>)}
              </select>
              <p className="text-xs text-gray-600">Same rules as the prospect&apos;s own booking. They, their parent (17 and under), the host and the inviter get the usual &quot;call moved&quot; email.</p>
              <button type="button" disabled={!pick || busy} onClick={move} className={`h-9 px-3 rounded-lg bg-primary-700 hover:bg-primary-800 text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-60 ${ring}`}>{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Move and email them</button>
            </>
          )}
        </div>
      )}
      {err && <p role="alert" className="mt-1 text-sm text-red-700">{err}</p>}
      {ok && <p role="status" className="mt-1 text-sm text-green-700">{ok}</p>}
    </div>
  )
}
