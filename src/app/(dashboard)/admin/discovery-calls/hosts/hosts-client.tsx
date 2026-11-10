'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { removeDiscoveryHost, saveDiscoveryHost } from '@/lib/actions/discovery-admin'
import { AGE_RANGES, AgeRangeValue } from '@/lib/get-involved/core'
import { TimeZoneSelect } from '@/components/get-involved/time-zone-select'

interface HostInfo { displayName: string; active: boolean; ageRanges: string[]; meetingUrl: string; timezone: string; blocks: number }
interface Person { userId: string; email: string; role: string; name: string; host: HostInfo | null }

const ROLE_TAG: Record<string, string> = { ADMIN: 'Admin', COACH: 'Coach' }

const input = 'w-full h-10 rounded-lg border border-gray-300 px-3 text-sm'

export function HostsClient({ people }: { people: Person[] }) {
  const hosts = people.filter((p) => p.host)
  const others = people.filter((p) => !p.host)
  const [adding, setAdding] = useState<string>('')
  const coverage = AGE_RANGES.map((a) => ({ ...a, n: hosts.filter((h) => h.host!.active && h.host!.ageRanges.includes(a.value) && h.host!.blocks > 0).length }))

  return (
    <div className="space-y-6">
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-bold text-gray-900">Coverage</h2>
        <p className="text-sm text-gray-600 mt-1">Prospects only see times from active hosts who cover their age range and have set availability.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
          {coverage.map((c) => (
            <div key={c.value} className={`rounded-lg border p-3 ${c.n === 0 ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
              <p className="text-sm font-semibold text-gray-900">{c.label}</p>
              <p className={`text-xs ${c.n === 0 ? 'text-red-800 font-semibold' : 'text-gray-600'}`}>{c.n === 0 ? 'No one: these prospects cannot book' : `${c.n} host${c.n === 1 ? '' : 's'}`}</p>
            </div>
          ))}
        </div>
      </section>

      {hosts.map((p) => <HostEditor key={p.userId} person={p} />)}

      <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <h2 className="font-bold text-gray-900">Add a host</h2>
        <p className="text-sm text-gray-600">Admins and coaches can host. A coach host sees only their own calls, under Discovery Calls in their menu, and sets their own times there.</p>
        {others.length === 0 ? <p className="text-sm text-gray-600">Every active admin and coach is already a host.</p> : (
          <>
            <label htmlFor="add-host" className="block text-sm font-semibold text-gray-700">Person</label>
            <select id="add-host" value={adding} onChange={(e) => setAdding(e.target.value)} className={`${input} sm:max-w-md`}>
              <option value="">Choose an admin or coach</option>
              {(['ADMIN', 'COACH'] as const).map((role) => {
                const list = others.filter((o) => o.role === role)
                return list.length ? (
                  <optgroup key={role} label={role === 'ADMIN' ? 'Admins' : 'Coaches'}>
                    {list.map((o) => <option key={o.userId} value={o.userId}>{o.name ? `${o.name} · ${o.email}` : o.email}</option>)}
                  </optgroup>
                ) : null
              })}
            </select>
            {adding && <HostEditor key={adding} person={others.find((o) => o.userId === adding)!} isNew onDone={() => setAdding('')} />}
          </>
        )}
      </section>
    </div>
  )
}

function HostEditor({ person, isNew, onDone }: { person: Person; isNew?: boolean; onDone?: () => void }) {
  const router = useRouter()
  const h = person.host
  const [name, setName] = useState(h?.displayName ?? person.name)
  const [ranges, setRanges] = useState<string[]>(h?.ageRanges ?? [])
  const [url, setUrl] = useState(h?.meetingUrl ?? '')
  const [tz, setTz] = useState(h?.timezone ?? 'America/Chicago')
  const [active, setActive] = useState(h?.active ?? true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function save() {
    setBusy(true); setMsg(null)
    const r = await saveDiscoveryHost({ userId: person.userId, displayName: name, ageRanges: ranges as AgeRangeValue[], meetingUrl: url, timezone: tz, active })
    setBusy(false)
    if ('error' in r) setMsg({ ok: false, text: r.error })
    else { setMsg({ ok: true, text: 'Saved.' }); onDone?.(); router.refresh() }
  }
  async function remove() {
    setBusy(true); setMsg(null)
    const r = await removeDiscoveryHost(person.userId)
    setBusy(false)
    if ('error' in r) setMsg({ ok: false, text: r.error })
    else router.refresh()
  }

  const Wrap = isNew ? 'div' : 'section'
  return (
    <Wrap className={isNew ? 'space-y-4 border-t border-gray-100 pt-4' : 'bg-white border border-gray-200 rounded-xl p-5 space-y-4'}>
      {!isNew && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><h2 className="font-bold text-gray-900">{h?.displayName}{ROLE_TAG[person.role] && <span className="ml-2 align-middle text-xs font-semibold rounded-full px-2 py-0.5 bg-gray-100 text-gray-700">{ROLE_TAG[person.role]}</span>}</h2><p className="text-xs text-gray-600">{person.email}</p></div>
          <div className="flex items-center gap-2">
            {h && h.blocks === 0 && <span className="text-xs font-semibold rounded-full px-2.5 py-1 bg-amber-100 text-amber-800">No availability set</span>}
            <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>{active ? 'Taking calls' : 'Off'}</span>
          </div>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <div><label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor={`dn-${person.userId}`}>Name prospects see</label><input id={`dn-${person.userId}`} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={input} placeholder="e.g. Lina Lopez" /></div>
        <div><label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor={`mu-${person.userId}`}>Meeting link (Zoom)</label><input id={`mu-${person.userId}`} value={url} onChange={(e) => setUrl(e.target.value)} maxLength={500} className={input} placeholder="https://zoom.us/j/..." /></div>
        <div><label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor={`tz-${person.userId}`}>Their time zone</label><TimeZoneSelect id={`tz-${person.userId}`} value={tz} onChange={setTz} className={input} /></div>
        <fieldset>
          <legend className="block text-sm font-semibold text-gray-700 mb-1">Age ranges they take</legend>
          <div className="flex flex-wrap gap-2">
            {AGE_RANGES.map((a) => {
              const on = ranges.includes(a.value)
              return <button key={a.value} type="button" aria-pressed={on} onClick={() => setRanges(on ? ranges.filter((r) => r !== a.value) : [...ranges, a.value])} className={`h-10 px-3 rounded-lg border text-sm ${on ? 'border-2 border-primary-700 bg-primary-100 text-primary-800 font-semibold' : 'border-gray-300 text-gray-700'}`}>{a.label}</button>
            })}
          </div>
        </fieldset>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-800"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-[18px] w-[18px] accent-primary-700" />Taking new calls</label>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={save} disabled={busy} className="h-10 px-4 rounded-lg bg-primary-700 hover:bg-primary-800 text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{isNew ? 'Add host' : 'Save'}</button>
        {!isNew && <Link href={`/admin/discovery-calls/availability?host=${person.userId}`} className="h-10 px-4 rounded-lg border border-gray-300 text-sm font-semibold inline-flex items-center">Set availability</Link>}
        {!isNew && <button onClick={remove} disabled={busy} className="h-10 px-4 rounded-lg border border-red-300 text-red-700 text-sm font-semibold">Remove host</button>}
        {msg && <span role={msg.ok ? 'status' : 'alert'} className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-700'}`}>{msg.text}</span>}
      </div>
    </Wrap>
  )
}
