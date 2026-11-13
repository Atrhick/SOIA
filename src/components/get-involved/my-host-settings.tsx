'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { saveMyHostSettings } from '@/lib/actions/discovery-admin'
import { TimeZoneSelect } from './time-zone-select'

const input = 'w-full h-10 rounded-lg border border-gray-300 px-3 text-sm'

/** A host's own time zone and meeting link. */
export function MyHostSettings({ timezone, meetingUrl, ageLabels, active }: { timezone: string; meetingUrl: string; ageLabels: string[]; active: boolean }) {
  const router = useRouter()
  const [tz, setTz] = useState(timezone)
  const [url, setUrl] = useState(meetingUrl)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setMsg(null)
    const r = await saveMyHostSettings({ timezone: tz, meetingUrl: url })
    setBusy(false)
    if ('error' in r) setMsg({ ok: false, text: r.error })
    else { setMsg({ ok: true, text: 'Saved.' }); router.refresh() }
  }

  return (
    <form onSubmit={save} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div>
        <h2 className="font-bold text-gray-900">Your host details</h2>
        <p className="text-sm text-gray-600 mt-1">
          {active ? 'You are taking new calls' : 'You are not taking new calls right now'} for: {ageLabels.join(', ') || 'no age ranges yet'}. An admin sets these.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="my-tz" className="block text-sm font-semibold text-gray-700 mb-1">Your time zone</label>
          <TimeZoneSelect id="my-tz" value={tz} onChange={setTz} className={input} />
          <p className="text-xs text-gray-600 mt-1">Your weekly times below are in this zone. Prospects see them in their own zone.</p>
        </div>
        <div>
          <label htmlFor="my-url" className="block text-sm font-semibold text-gray-700 mb-1">Meeting link (Zoom, Google Meet)</label>
          <input id="my-url" value={url} onChange={(e) => setUrl(e.target.value)} maxLength={500} className={input} placeholder="https://zoom.us/j/..." />
          <p className="text-xs text-gray-600 mt-1">Used for new bookings. Calls already booked keep their link.</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={busy} className="h-10 px-4 rounded-lg bg-primary-700 hover:bg-primary-800 text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Save</button>
        {msg && <span role={msg.ok ? 'status' : 'alert'} className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-700'}`}>{msg.text}</span>}
      </div>
    </form>
  )
}
