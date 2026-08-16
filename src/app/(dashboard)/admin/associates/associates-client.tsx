'use client'

import { useMemo, useState, useTransition } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AlertBanner } from '@/components/ui/alert-banner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Check, Copy, Handshake, KeyRound, Loader2, Plus, Trash2 } from 'lucide-react'
import { ASSOCIATE_ROLES, ASSOCIATE_LABELS, type AssociateRole } from '@/lib/roles'
import {
  createAssociate,
  deleteAssociate,
  resetAssociatePassword,
  setAssociateStatus,
} from '@/lib/actions/associates'

interface AssociateRow {
  id: string
  type: string
  status: string
  firstName: string
  lastName: string
  email: string
  userStatus: string
  phone: string | null
  organization: string | null
  serviceOffered: string | null
  notes: string | null
  coachId: string | null
  coachName: string | null
  createdAt: string
}

interface CoachOption {
  id: string
  name: string
}

const NO_COACH = '__none__'

export function AssociatesClient({
  associates,
  coaches,
}: {
  associates: AssociateRow[]
  coaches: CoachOption[]
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [filter, setFilter] = useState<'ALL' | AssociateRole>('ALL')

  const [showCreate, setShowCreate] = useState(false)
  const [tempPassword, setTempPassword] = useState<{ name: string; password: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AssociateRow | null>(null)

  const [form, setForm] = useState({
    email: '',
    type: 'VOLUNTEER' as AssociateRole,
    firstName: '',
    lastName: '',
    phone: '',
    organization: '',
    serviceOffered: '',
    coachId: NO_COACH,
  })

  const visible = useMemo(
    () => (filter === 'ALL' ? associates : associates.filter((a) => a.type === filter)),
    [associates, filter]
  )

  const counts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const a of associates) map[a.type] = (map[a.type] ?? 0) + 1
    return map
  }, [associates])

  const copyPassword = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* the password is on screen regardless */
    }
  }

  const handleCreate = () => {
    setError(null)
    setNotice(null)
    startTransition(async () => {
      const result = await createAssociate({
        ...form,
        coachId: form.coachId === NO_COACH ? undefined : form.coachId,
      })
      if (result?.error) {
        setError(result.error)
        return
      }
      if (result?.tempPassword) {
        setTempPassword({
          name: `${form.firstName} ${form.lastName}`,
          password: result.tempPassword,
        })
      }
      setShowCreate(false)
      setForm({
        email: '',
        type: 'VOLUNTEER',
        firstName: '',
        lastName: '',
        phone: '',
        organization: '',
        serviceOffered: '',
        coachId: NO_COACH,
      })
    })
  }

  const handleReset = (a: AssociateRow) => {
    setError(null)
    setNotice(null)
    startTransition(async () => {
      const result = await resetAssociatePassword(a.id)
      if (result?.error) setError(result.error)
      else if (result?.tempPassword) {
        setTempPassword({ name: `${a.firstName} ${a.lastName}`, password: result.tempPassword })
      }
    })
  }

  const handleToggleStatus = (a: AssociateRow) => {
    setError(null)
    startTransition(async () => {
      const result = await setAssociateStatus(a.id, a.status !== 'ACTIVE')
      if (result?.error) setError(result.error)
      else setNotice(a.status === 'ACTIVE' ? 'Associate deactivated' : 'Associate reactivated')
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <Handshake className="h-6 w-6 text-primary-600" />
            Associates
          </h1>
          <p className="text-gray-500 mt-1">
            Service providers, business affiliates and volunteers.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Associate
        </Button>
      </div>

      {error && (
        <AlertBanner variant="error" message={error} dismissible onDismiss={() => setError(null)} />
      )}
      {notice && (
        <AlertBanner
          variant="success"
          message={notice}
          dismissible
          onDismiss={() => setNotice(null)}
        />
      )}

      <div className="flex gap-2 flex-wrap">
        <FilterTab
          label={`All (${associates.length})`}
          active={filter === 'ALL'}
          onClick={() => setFilter('ALL')}
        />
        {ASSOCIATE_ROLES.map((r) => (
          <FilterTab
            key={r}
            label={`${ASSOCIATE_LABELS[r]} (${counts[r] ?? 0})`}
            active={filter === r}
            onClick={() => setFilter(r)}
          />
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {visible.length === 0 ? (
            <p className="p-6 text-gray-500">No associates in this category yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Association</th>
                    <th className="px-4 py-3">Organization</th>
                    <th className="px-4 py-3">Registered by</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visible.map((a) => (
                    <tr key={a.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">
                          {a.firstName} {a.lastName}
                        </p>
                        <p className="text-gray-500">{a.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="info">
                          {ASSOCIATE_LABELS[a.type as AssociateRole] ?? a.type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{a.organization ?? '-'}</td>
                      <td className="px-4 py-3 text-gray-700">{a.coachName ?? '-'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={a.status === 'ACTIVE' ? 'success' : 'outline'}>
                          {a.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={isPending}
                          onClick={() => handleReset(a)}
                          title="Reset password"
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={isPending}
                          onClick={() => handleToggleStatus(a)}
                        >
                          {a.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteTarget(a)}
                          aria-label={`Delete ${a.firstName} ${a.lastName}`}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add an associate</DialogTitle>
            <DialogDescription>
              A login is created immediately. The temporary password is shown once on the next
              screen — the application does not send email, so you must pass it on yourself.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[55vh] overflow-y-auto">
            <div>
              <Label htmlFor="a-type">Association</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((p) => ({ ...p, type: v as AssociateRole }))}
              >
                <SelectTrigger id="a-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSOCIATE_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ASSOCIATE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="a-first">First name</Label>
                <Input
                  id="a-first"
                  value={form.firstName}
                  onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="a-last">Last name</Label>
                <Input
                  id="a-last"
                  value={form.lastName}
                  onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="a-email">Email</Label>
              <Input
                id="a-email"
                type="email"
                placeholder="name@example.com"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="a-phone">Phone</Label>
              <Input
                id="a-phone"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="a-org">Organization</Label>
              <Input
                id="a-org"
                value={form.organization}
                onChange={(e) => setForm((p) => ({ ...p, organization: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="a-service">What they provide</Label>
              <Textarea
                id="a-service"
                rows={3}
                value={form.serviceOffered}
                onChange={(e) => setForm((p) => ({ ...p, serviceOffered: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="a-coach">Registered by (coach)</Label>
              <Select
                value={form.coachId}
                onValueChange={(v) => setForm((p) => ({ ...p, coachId: v }))}
              >
                <SelectTrigger id="a-coach">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_COACH}>None</SelectItem>
                  {coaches.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                isPending || !form.email.trim() || !form.firstName.trim() || !form.lastName.trim()
              }
            >
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Temporary password - the fix for the PARENT dead end */}
      <Dialog open={tempPassword !== null} onOpenChange={(o) => !o && setTempPassword(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Temporary password for {tempPassword?.name}</DialogTitle>
            <DialogDescription>
              Share this securely with them. They can change it from My Profile after signing in.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={tempPassword?.password ?? ''}
                className="flex-1 bg-white border border-amber-300 rounded-md px-3 py-2 font-mono text-sm"
                aria-label="Temporary password"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyPassword(tempPassword?.password ?? '')}
              >
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-sm text-amber-800 mt-3">
              This is shown once. If you lose it, use Reset Password to generate a new one.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setTempPassword(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete {deleteTarget?.firstName} {deleteTarget?.lastName}?
            </DialogTitle>
            <DialogDescription>
              This permanently removes their login and profile. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const result = await deleteAssociate(deleteTarget!.id)
                  if (result?.error) setError(result.error)
                  else setNotice('Associate deleted')
                  setDeleteTarget(null)
                })
              }
            >
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FilterTab({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={
        active
          ? 'rounded-full bg-primary-600 text-white px-3.5 py-1.5 text-sm font-medium'
          : 'rounded-full bg-white border border-gray-300 text-gray-700 px-3.5 py-1.5 text-sm hover:bg-gray-50'
      }
    >
      {label}
    </button>
  )
}
