'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { setUserRoles } from '@/lib/actions/users'
import { ROLE_VIEW_NAMES, SWITCHABLE_ROLES, isSwitchableRole, rolesOf, type SwitchableRole } from '@/lib/roles'

const ROLE_HELP: Record<SwitchableRole, string> = {
  ADMIN: 'Runs the back office.',
  COACH: 'Has a coach dashboard and leads ambassadors.',
  AMBASSADOR: 'Has an ambassador dashboard.',
}

export interface RolesEditorUser {
  id: string
  role: string
  extraRoles: string[]
  firstName: string | null
  lastName: string | null
  coachId: string | null
  ambassadorId: string | null
}

/**
 * Ticks for the roles one login holds. The person then switches between those views from the menu
 * under their name, instead of keeping a separate login for each role.
 */
export function RolesEditor({ user, coaches, isSelf, onSaved }: {
  user: RolesEditorUser
  coaches: { id: string; name: string }[]
  isSelf: boolean
  onSaved: (role: string, extraRoles: string[], profiles: { coach: boolean; ambassador: boolean }) => void
}) {
  const held = rolesOf(user)
  const combinable = held.every(isSwitchableRole)
  const [roles, setRoles] = useState<SwitchableRole[]>(held.filter(isSwitchableRole))
  const [firstName, setFirstName] = useState(user.firstName ?? '')
  const [lastName, setLastName] = useState(user.lastName ?? '')
  const [coachId, setCoachId] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  if (!combinable) {
    return (
      <section className="space-y-1">
        <h3 className="font-medium">Roles</h3>
        <p className="text-sm text-gray-600">
          Only Admin, Coach and Ambassador can be combined on one login. To give this person more roles, set their main role to one of those first.
        </p>
      </section>
    )
  }

  const needsName = ((roles.includes('COACH') && !user.coachId) || (roles.includes('AMBASSADOR') && !user.ambassadorId)) && !user.firstName
  const needsCoach = roles.includes('AMBASSADOR') && !user.ambassadorId
  const changed = roles.length !== held.length || roles.some((r) => !held.includes(r))
  const toggle = (r: SwitchableRole) => {
    setMsg(null)
    setRoles((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : SWITCHABLE_ROLES.filter((x) => x === r || cur.includes(x))))
  }

  async function save() {
    setBusy(true)
    setMsg(null)
    const r = await setUserRoles({ userId: user.id, roles, firstName, lastName, ambassadorCoachId: needsCoach ? coachId : undefined })
    setBusy(false)
    if ('error' in r && r.error) { setMsg({ ok: false, text: r.error }); return }
    if ('success' in r && r.success) {
      onSaved(r.role, r.extraRoles, { coach: roles.includes('COACH'), ambassador: roles.includes('AMBASSADOR') })
      setMsg({ ok: true, text: roles.length > 1 ? 'Saved. They can now switch views from the menu under their name. If they are signed in, they need to refresh the page first.' : 'Saved.' })
    }
  }

  return (
    <section className="space-y-3 rounded-lg border border-gray-200 p-3">
      <div>
        <h3 className="font-medium">Roles</h3>
        <p className="text-sm text-gray-600">
          Tick every role this person has. With more than one, they keep one login and switch views from the menu under their name.
        </p>
      </div>
      <div className="space-y-2">
        {SWITCHABLE_ROLES.map((r) => {
          const lockedSelf = isSelf && r === 'ADMIN'
          return (
            <label key={r} className="flex items-start gap-3 rounded-md p-1">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5"
                checked={roles.includes(r)}
                disabled={busy || lockedSelf}
                onChange={() => toggle(r)}
              />
              <span>
                <span className="font-medium text-gray-900">{ROLE_VIEW_NAMES[r]}</span>
                <span className="block text-sm text-gray-600">{lockedSelf ? 'You can’t take away your own admin role.' : ROLE_HELP[r]}</span>
              </span>
            </label>
          )
        })}
      </div>

      {needsName && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="roles-first">First name</Label>
            <Input id="roles-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="roles-last">Last name</Label>
            <Input id="roles-last" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>
      )}

      {needsCoach && (
        <div>
          <Label htmlFor="roles-coach">Coach who leads them as an ambassador</Label>
          <select
            id="roles-coach"
            value={coachId}
            onChange={(e) => setCoachId(e.target.value)}
            className="mt-1 block h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-base"
          >
            <option value="">Choose a coach</option>
            {roles.includes('COACH') && <option value={user.coachId ?? 'SELF'}>Themselves</option>}
            {coaches.filter((c) => c.id !== user.coachId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      {msg && <p className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-700'}`} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}

      <Button type="button" onClick={save} disabled={busy || !changed || !roles.length || (needsCoach && !coachId)}>
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save roles
      </Button>
    </section>
  )
}
