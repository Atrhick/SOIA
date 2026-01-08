'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PhoneInput } from '@/components/ui/phone-input'
import { PasswordInput } from '@/components/ui/password-input'
import { DateOfBirthInput } from '@/components/ui/date-of-birth-input'
import { AddressInput, type AddressData } from '@/components/ui/address-input'
import { updateAmbassadorStatus } from '@/lib/actions/ambassadors'
import { createAmbassadorAccount } from '@/lib/actions/ambassador-auth'
import { Check, X, Users, Plus, AlertTriangle } from 'lucide-react'
import type { Ambassador, CoachProfile, User } from '@prisma/client'

type AmbassadorWithCoach = Ambassador & {
  coach: CoachProfile & {
    user: User
  }
}

interface Coach {
  id: string
  name: string
  email: string
}

const statusVariants = {
  PENDING: 'warning',
  APPROVED: 'success',
  INACTIVE: 'secondary',
  COMPLETED: 'default',
  ON_HOLD: 'destructive',
} as const

const statusOptions = [
  { value: 'PENDING', label: 'Pending', color: 'yellow' },
  { value: 'APPROVED', label: 'Approved', color: 'green' },
  { value: 'INACTIVE', label: 'Inactive', color: 'gray' },
  { value: 'COMPLETED', label: 'Completed', color: 'blue' },
  { value: 'ON_HOLD', label: 'On Hold', color: 'red' },
] as const

interface AdminAmbassadorTableProps {
  ambassadors: AmbassadorWithCoach[]
  coaches: Coach[]
}

function calculateAgeFromDate(dateString: string): number | null {
  if (!dateString) return null
  const today = new Date()
  const birthDate = new Date(dateString)
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  return age
}

export function AdminAmbassadorTable({ ambassadors, coaches }: AdminAmbassadorTableProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    dateOfBirth: '',
    phone: '',
    phoneCountryCode: 'US',
    coachId: '',
    address: {
      address1: '',
      address2: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'US',
    } as AddressData,
    // Parent/Guardian fields (for under 18)
    parentFirstName: '',
    parentLastName: '',
    parentEmail: '',
    parentPhone: '',
    parentPhoneCountryCode: 'US',
    parentRelationship: '',
  })

  const age = calculateAgeFromDate(formData.dateOfBirth)
  const requiresParentalConsent = age !== null && age < 18

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    // Validate parental consent for under 18
    if (requiresParentalConsent) {
      if (!formData.parentFirstName || !formData.parentLastName || !formData.parentEmail) {
        setError('Parent/guardian information is required for ambassadors under 18')
        setIsSubmitting(false)
        return
      }
    }

    const form = new FormData()
    form.set('firstName', formData.firstName)
    form.set('lastName', formData.lastName)
    form.set('email', formData.email)
    form.set('password', formData.password)
    form.set('dateOfBirth', formData.dateOfBirth)
    form.set('phone', formData.phone)
    form.set('phoneCountryCode', formData.phoneCountryCode)
    form.set('coachId', formData.coachId)

    // Address fields
    form.set('address1', formData.address.address1)
    form.set('address2', formData.address.address2)
    form.set('city', formData.address.city)
    form.set('state', formData.address.state)
    form.set('postalCode', formData.address.postalCode)
    form.set('country', formData.address.country)

    // Parent fields (if required)
    if (requiresParentalConsent) {
      form.set('parentFirstName', formData.parentFirstName)
      form.set('parentLastName', formData.parentLastName)
      form.set('parentEmail', formData.parentEmail)
      form.set('parentPhone', formData.parentPhone)
      form.set('parentPhoneCountryCode', formData.parentPhoneCountryCode)
      form.set('parentRelationship', formData.parentRelationship)
    }

    const result = await createAmbassadorAccount(form)

    if (result.error) {
      setError(result.error)
    } else {
      setIsCreateOpen(false)
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        dateOfBirth: '',
        phone: '',
        phoneCountryCode: 'US',
        coachId: '',
        address: {
          address1: '',
          address2: '',
          city: '',
          state: '',
          postalCode: '',
          country: 'US',
        },
        parentFirstName: '',
        parentLastName: '',
        parentEmail: '',
        parentPhone: '',
        parentPhoneCountryCode: 'US',
        parentRelationship: '',
      })
    }
    setIsSubmitting(false)
  }

  const handleStatusChange = async (
    ambassadorId: string,
    status: 'PENDING' | 'APPROVED' | 'INACTIVE' | 'COMPLETED' | 'ON_HOLD'
  ) => {
    setLoadingId(ambassadorId)
    await updateAmbassadorStatus(ambassadorId, status)
    setLoadingId(null)
  }

  const createButton = (
    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Ambassador
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Ambassador</DialogTitle>
          <DialogDescription>
            Add a new ambassador (ages 10-24) and assign them to a coach.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCreateSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">
              {error}
            </div>
          )}

          {/* Basic Information Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Basic Information</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="name@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Password *</Label>
              <PasswordInput
                value={formData.password}
                onChange={(value) => setFormData({ ...formData, password: value })}
                showGenerator={true}
                showRequirements={true}
                showStrengthMeter={true}
              />
            </div>

            <div className="space-y-2">
              <Label>Date of Birth * (Age 10-24)</Label>
              <DateOfBirthInput
                value={formData.dateOfBirth}
                onChange={(value) => setFormData({ ...formData, dateOfBirth: value })}
                minAge={10}
                maxAge={24}
              />
            </div>

            <div className="space-y-2">
              <Label>Phone</Label>
              <PhoneInput
                value={formData.phone}
                countryCode={formData.phoneCountryCode}
                onChange={(value, countryCode) =>
                  setFormData({ ...formData, phone: value, phoneCountryCode: countryCode })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="coachId">Assign to Coach *</Label>
              <Select
                value={formData.coachId}
                onValueChange={(value) => setFormData({ ...formData, coachId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a coach" />
                </SelectTrigger>
                <SelectContent>
                  {coaches.map((coach) => (
                    <SelectItem key={coach.id} value={coach.id}>
                      {coach.name} ({coach.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Address Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Address</h3>
            <AddressInput
              value={formData.address}
              onChange={(address) => setFormData({ ...formData, address })}
            />
          </div>

          {/* Parental Consent Section (conditional) */}
          {requiresParentalConsent && (
            <div className="space-y-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
                <h3 className="text-sm font-semibold">Parent/Guardian Information Required</h3>
              </div>
              <p className="text-sm text-amber-600">
                This ambassador is under 18 years old. Parent/guardian consent and information is required.
                The parent/guardian will receive their own login to monitor the account.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="parentFirstName">Parent First Name *</Label>
                  <Input
                    id="parentFirstName"
                    value={formData.parentFirstName}
                    onChange={(e) => setFormData({ ...formData, parentFirstName: e.target.value })}
                    required={requiresParentalConsent}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parentLastName">Parent Last Name *</Label>
                  <Input
                    id="parentLastName"
                    value={formData.parentLastName}
                    onChange={(e) => setFormData({ ...formData, parentLastName: e.target.value })}
                    required={requiresParentalConsent}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="parentEmail">Parent Email *</Label>
                <Input
                  id="parentEmail"
                  type="email"
                  value={formData.parentEmail}
                  onChange={(e) => setFormData({ ...formData, parentEmail: e.target.value })}
                  placeholder="name@example.com"
                  required={requiresParentalConsent}
                />
                <p className="text-xs text-amber-600">
                  A login will be created for the parent to monitor their child's account.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Parent Phone</Label>
                <PhoneInput
                  value={formData.parentPhone}
                  countryCode={formData.parentPhoneCountryCode}
                  onChange={(value, countryCode) =>
                    setFormData({ ...formData, parentPhone: value, parentPhoneCountryCode: countryCode })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="parentRelationship">Relationship to Ambassador</Label>
                <Select
                  value={formData.parentRelationship}
                  onValueChange={(value) => setFormData({ ...formData, parentRelationship: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select relationship" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mother">Mother</SelectItem>
                    <SelectItem value="Father">Father</SelectItem>
                    <SelectItem value="Guardian">Legal Guardian</SelectItem>
                    <SelectItem value="Grandparent">Grandparent</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !formData.coachId || !formData.dateOfBirth}>
              {isSubmitting ? 'Creating...' : 'Create Ambassador'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )

  if (ambassadors.length === 0) {
    return (
      <div className="text-center py-8">
        <Users className="mx-auto h-12 w-12 text-gray-300" />
        <p className="mt-4 text-gray-500">No ambassadors in the system yet</p>
        <div className="mt-4">{createButton}</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">{createButton}</div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-3 font-medium text-gray-500">Ambassador</th>
              <th className="pb-3 font-medium text-gray-500">Coach</th>
              <th className="pb-3 font-medium text-gray-500">Region</th>
              <th className="pb-3 font-medium text-gray-500">Status</th>
              <th className="pb-3 font-medium text-gray-500">Assessment</th>
              <th className="pb-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {ambassadors.map((ambassador) => (
              <tr key={ambassador.id} className="hover:bg-gray-50">
                <td className="py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary-700">
                        {ambassador.firstName[0]}{ambassador.lastName[0]}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {ambassador.firstName} {ambassador.lastName}
                      </p>
                      <p className="text-sm text-gray-500">
                        {ambassador.email || 'No email'}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="py-4">
                  <p className="text-gray-900">
                    {ambassador.coach.firstName} {ambassador.coach.lastName}
                  </p>
                  <p className="text-sm text-gray-500">{ambassador.coach.user.email}</p>
                </td>
                <td className="py-4 text-gray-600">
                  {ambassador.region || '-'}
                </td>
                <td className="py-4">
                  <Badge variant={statusVariants[ambassador.status]}>
                    {ambassador.status}
                  </Badge>
                </td>
                <td className="py-4">
                  <Badge variant="secondary">
                    {ambassador.assessmentStatus.replace('_', ' ')}
                  </Badge>
                </td>
                <td className="py-4">
                  <div className="flex items-center gap-2">
                    {ambassador.status === 'PENDING' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 border-green-200 hover:bg-green-50"
                          onClick={() => handleStatusChange(ambassador.id, 'APPROVED')}
                          disabled={loadingId === ambassador.id}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => handleStatusChange(ambassador.id, 'ON_HOLD')}
                          disabled={loadingId === ambassador.id}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {ambassador.status !== 'PENDING' && (
                      <select
                        value={ambassador.status}
                        onChange={(e) =>
                          handleStatusChange(
                            ambassador.id,
                            e.target.value as 'PENDING' | 'APPROVED' | 'INACTIVE' | 'COMPLETED' | 'ON_HOLD'
                          )
                        }
                        disabled={loadingId === ambassador.id}
                        className="text-sm border rounded px-2 py-1"
                      >
                        {statusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
