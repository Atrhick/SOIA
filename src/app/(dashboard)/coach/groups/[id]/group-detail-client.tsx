'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addGroupMembers, removeGroupMember, archiveGroup } from '@/lib/actions/ambassador-groups'
import { GroupForm, type GroupFormValues } from '../group-form'

interface Person {
  id: string
  name: string
}

export function GroupDetailClient({
  groupId,
  isActive,
  members,
  available,
  editValues,
}: {
  groupId: string
  isActive: boolean
  members: Person[]
  available: Person[]
  editValues: GroupFormValues
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState<string[]>([])
  const [editing, setEditing] = useState(false)

  async function run(fn: () => Promise<{ error: string } | { success: true }>) {
    setError(null)
    setBusy(true)
    try {
      const res = await fn()
      if ('error' in res) setError(res.error)
      else router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-xl border bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Ambassadors in this group</h2>
        {members.length === 0 ? (
          <p className="text-gray-500">No one yet. Add ambassadors below.</p>
        ) : (
          <ul className="divide-y">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 font-semibold text-primary-700">
                  {(m.name?.[0] || '?').toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate">{m.name}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (confirm(`Take ${m.name} out of this group? They leave the group chat too.`)) {
                      run(() => removeGroupMember(groupId, m.id))
                    }
                  }}
                  className="min-h-[44px] rounded-lg px-3 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        {available.length > 0 && (
          <div className="mt-4 border-t pt-4">
            <h3 className="mb-2 font-medium text-gray-800">Add ambassadors</h3>
            <div className="space-y-1">
              {available.map((a) => (
                <label key={a.id} className="flex min-h-[44px] items-center gap-3 rounded-lg px-2 hover:bg-gray-50">
                  <input
                    type="checkbox"
                    className="h-5 w-5"
                    checked={adding.includes(a.id)}
                    onChange={(e) => setAdding((p) => (e.target.checked ? [...p, a.id] : p.filter((x) => x !== a.id)))}
                  />
                  <span className="min-w-0 truncate">{a.name}</span>
                </label>
              ))}
            </div>
            <button
              type="button"
              disabled={busy || adding.length === 0}
              onClick={() => run(async () => {
                const r = await addGroupMembers(groupId, adding)
                if (!('error' in r)) setAdding([])
                return r
              })}
              className="mt-3 w-full rounded-lg bg-primary-600 px-4 py-3 font-semibold text-white disabled:opacity-50 sm:w-auto"
            >
              Add to group
            </button>
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Group details</h2>
          <button type="button" onClick={() => setEditing((e) => !e)} className="min-h-[44px] rounded-lg border px-3 text-sm">
            {editing ? 'Close' : 'Edit details'}
          </button>
        </div>
        {editing && (
          <div className="mt-4">
            <GroupForm mode="edit" groupId={groupId} initial={editValues} onDone={() => setEditing(false)} />
          </div>
        )}
        <div className="mt-4 border-t pt-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (!isActive || confirm('Archive this group? It stays saved, but moves to the bottom of your list.')) {
                run(() => archiveGroup(groupId, isActive))
              }
            }}
            className="min-h-[44px] rounded-lg px-3 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          >
            {isActive ? 'Archive group' : 'Bring group back'}
          </button>
        </div>
      </section>
    </div>
  )
}
