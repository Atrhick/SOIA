'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createGroup, updateGroup } from '@/lib/actions/ambassador-groups'
import { TIME_ZONE_GROUPS } from '@/lib/get-involved/time-zones'

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export interface GroupFormValues {
  name: string
  meetingWeekday: number
  meetingTime: string
  timezone: string
  durationMin: number
  meetingLink: string
  location: string
  startDate: string
  weeks: number
}

interface AmbassadorOption {
  id: string
  name: string
}

const field = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200'
const label = 'block text-sm font-medium text-gray-700 mb-1'

export function GroupForm({
  mode,
  groupId,
  initial,
  ambassadors = [],
  onDone,
}: {
  mode: 'create' | 'edit'
  groupId?: string
  initial: GroupFormValues
  ambassadors?: AmbassadorOption[]
  onDone?: () => void
}) {
  const router = useRouter()
  const [v, setV] = useState<GroupFormValues>(initial)
  const [picked, setPicked] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof GroupFormValues>(k: K, val: GroupFormValues[K]) => setV((p) => ({ ...p, [k]: val }))

  const zones = TIME_ZONE_GROUPS.some((g) => g.zones.some((z) => z.id === v.timezone))
    ? TIME_ZONE_GROUPS
    : [{ region: 'Your zone', zones: [{ id: v.timezone, city: v.timezone }] }, ...TIME_ZONE_GROUPS]

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const res =
        mode === 'create'
          ? await createGroup({ ...v, ambassadorIds: picked })
          : await updateGroup(groupId!, v)
      if ('error' in res) {
        setError(res.error)
        return
      }
      if (mode === 'create' && 'groupId' in res) {
        router.push(`/coach/groups/${res.groupId}`)
      } else {
        router.refresh()
        onDone?.()
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <div>
        <label className={label} htmlFor="g-name">Group name</label>
        <input id="g-name" className={field} value={v.name} onChange={(e) => set('name', e.target.value)} placeholder="Spring group" required />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="g-day">Meets every</label>
          <select id="g-day" className={field} value={v.meetingWeekday} onChange={(e) => set('meetingWeekday', Number(e.target.value))}>
            {WEEKDAYS.map((d, i) => (
              <option key={d} value={i}>{d}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="g-time">At</label>
          <input id="g-time" type="time" className={field} value={v.meetingTime} onChange={(e) => set('meetingTime', e.target.value)} required />
        </div>
        <div className="sm:col-span-2">
          <label className={label} htmlFor="g-tz">Time zone</label>
          <select id="g-tz" className={field} value={v.timezone} onChange={(e) => set('timezone', e.target.value)}>
            {zones.map((g) => (
              <optgroup key={g.region} label={g.region}>
                {g.zones.map((z) => (
                  <option key={z.id} value={z.id}>{z.city}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="g-dur">How long (minutes)</label>
          <input id="g-dur" type="number" min={15} max={240} step={5} className={field} value={v.durationMin} onChange={(e) => set('durationMin', Number(e.target.value))} />
        </div>
        {mode === 'create' && (
          <div>
            <label className={label} htmlFor="g-weeks">Number of weeks</label>
            <input id="g-weeks" type="number" min={1} max={52} className={field} value={v.weeks} onChange={(e) => set('weeks', Number(e.target.value))} />
          </div>
        )}
        {mode === 'create' && (
          <div className="sm:col-span-2">
            <label className={label} htmlFor="g-start">First meeting on or after</label>
            <input id="g-start" type="date" className={field} value={v.startDate} onChange={(e) => set('startDate', e.target.value)} required />
          </div>
        )}
      </div>
      <div>
        <label className={label} htmlFor="g-link">Meeting link (optional)</label>
        <input id="g-link" type="url" inputMode="url" className={field} value={v.meetingLink} onChange={(e) => set('meetingLink', e.target.value)} placeholder="https://zoom.us/j/..." />
      </div>
      <div>
        <label className={label} htmlFor="g-loc">Place (optional)</label>
        <input id="g-loc" className={field} value={v.location} onChange={(e) => set('location', e.target.value)} placeholder="Community center, room 2" />
      </div>
      {mode === 'edit' && (
        <p className="text-sm text-gray-500">
          Changes to the link, place and length apply to upcoming meetings. A new day or time is saved for the group but does not move meetings already set.
        </p>
      )}

      {mode === 'create' && (
        <fieldset>
          <legend className={label}>Who is in this group?</legend>
          {ambassadors.length === 0 ? (
            <p className="text-sm text-gray-500">You do not have any ambassadors yet. You can add them later.</p>
          ) : (
            <div className="space-y-1">
              {ambassadors.map((a) => (
                <label key={a.id} className="flex min-h-[44px] items-center gap-3 rounded-lg px-2 hover:bg-gray-50">
                  <input
                    type="checkbox"
                    className="h-5 w-5"
                    checked={picked.includes(a.id)}
                    onChange={(e) => setPicked((p) => (e.target.checked ? [...p, a.id] : p.filter((x) => x !== a.id)))}
                  />
                  <span className="min-w-0 truncate">{a.name}</span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-lg bg-primary-600 px-4 py-3 font-semibold text-white hover:bg-primary-700 disabled:opacity-60 sm:w-auto"
      >
        {saving ? 'Saving...' : mode === 'create' ? 'Create group and meetings' : 'Save changes'}
      </button>
    </form>
  )
}
