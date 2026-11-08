'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PhoneInput } from '@/components/ui/phone-input'
import { DateOfBirthInput } from '@/components/ui/date-of-birth-input'
import { AddressInput, type AddressData } from '@/components/ui/address-input'
import { adminUpdateAmbassador } from '@/lib/actions/ambassadors'

export interface EditableAmbassador {
  id: string
  userId: string | null
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  phoneCountryCode: string | null
  dateOfBirth: Date | null
  region: string | null
  address1: string | null
  address2: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  country: string | null
  notes: string | null
  coachId: string
  coach: { firstName: string; lastName: string; user: { email: string } }
}

interface Coach {
  id: string
  name: string
  email: string
}

// DOB is stored as midnight UTC, so read it back in UTC to avoid an
// off-by-one day in timezones west of Greenwich.
function toDateInput(date: Date | null): string {
  return date ? new Date(date).toISOString().slice(0, 10) : ''
}

function initialState(a: EditableAmbassador) {
  return {
    firstName: a.firstName,
    lastName: a.lastName,
    email: a.email ?? '',
    phone: a.phone ?? '',
    phoneCountryCode: a.phoneCountryCode ?? 'US',
    dateOfBirth: toDateInput(a.dateOfBirth),
    region: a.region ?? '',
    notes: a.notes ?? '',
    coachId: a.coachId,
    address: {
      address1: a.address1 ?? '',
      address2: a.address2 ?? '',
      city: a.city ?? '',
      state: a.state ?? '',
      postalCode: a.postalCode ?? '',
      country: a.country ?? 'US',
    } as AddressData,
  }
}

export function EditAmbassadorDialog({
  ambassador,
  coaches,
  onClose,
}: {
  ambassador: EditableAmbassador
  coaches: Coach[]
  onClose: () => void
}) {
  const router = useRouter()
  const [form, setForm] = useState(() => initialState(ambassador))
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // The coach list only holds active coaches; keep the current one selectable
  // even if their account has since been deactivated.
  const coachOptions = coaches.some((c) => c.id === ambassador.coachId)
    ? coaches
    : [
        {
          id: ambassador.coachId,
          name: `${ambassador.coach.firstName} ${ambassador.coach.lastName} (inactive)`,
          email: ambassador.coach.user.email,
        },
        ...coaches,
      ]

  const hasLogin = !!ambassador.userId
  const emailChanged = hasLogin && form.email.trim() !== (ambassador.email ?? '')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)

    const data = new FormData()
    data.set('firstName', form.firstName)
    data.set('lastName', form.lastName)
    data.set('email', form.email)
    data.set('phone', form.phone)
    data.set('phoneCountryCode', form.phoneCountryCode)
    data.set('dateOfBirth', form.dateOfBirth)
    data.set('region', form.region)
    data.set('notes', form.notes)
    data.set('coachId', form.coachId)
    data.set('address1', form.address.address1)
    data.set('address2', form.address.address2)
    data.set('city', form.address.city)
    data.set('state', form.address.state)
    data.set('postalCode', form.address.postalCode)
    data.set('country', form.address.country)

    const result = await adminUpdateAmbassador(ambassador.id, data)
    setIsSaving(false)

    if (result.error) {
      setError(result.error)
      return
    }
    router.refresh()
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Edit {ambassador.firstName} {ambassador.lastName}
          </DialogTitle>
          <DialogDescription>
            Update this ambassador&apos;s details or move them to another coach.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Basic Information</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-firstName">First Name *</Label>
                <Input
                  id="edit-firstName"
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-lastName">Last Name *</Label>
                <Input
                  id="edit-lastName"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-email">Email{hasLogin ? ' *' : ''}</Label>
              <Input
                id="edit-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="name@example.com"
                required={hasLogin}
              />
              {emailChanged && (
                <p className="text-xs text-amber-600">
                  This is also their sign-in email. After saving, they must sign in with the new
                  address. Let them know.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Date of Birth</Label>
              <DateOfBirthInput
                value={form.dateOfBirth}
                onChange={(value) => setForm({ ...form, dateOfBirth: value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Phone</Label>
              <PhoneInput
                value={form.phone}
                countryCode={form.phoneCountryCode}
                onChange={(value, countryCode) =>
                  setForm({ ...form, phone: value, phoneCountryCode: countryCode })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-region">Region</Label>
              <Input
                id="edit-region"
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Coach *</Label>
              <Select
                value={form.coachId}
                onValueChange={(value) => setForm({ ...form, coachId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a coach" />
                </SelectTrigger>
                <SelectContent>
                  {coachOptions.map((coach) => (
                    <SelectItem key={coach.id} value={coach.id}>
                      {coach.name} ({coach.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Address</h3>
            <AddressInput
              value={form.address}
              onChange={(address) => setForm({ ...form, address })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-notes">Notes</Label>
            <textarea
              id="edit-notes"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !form.firstName.trim() || !form.lastName.trim()}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
