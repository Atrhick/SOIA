'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AlertBanner } from '@/components/ui/alert-banner'
import { Loader2 } from 'lucide-react'
import { changeMyPassword, updateMyAssociateProfile } from '@/lib/actions/associates'

interface Profile {
  id: string
  type: string
  status: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  organization: string | null
  serviceOffered: string | null
  coachName: string | null
}

export function AssociateProfileClient({ profile }: { profile: Profile }) {
  const [isPending, startTransition] = useTransition()

  const [form, setForm] = useState({
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone ?? '',
    organization: profile.organization ?? '',
    serviceOffered: profile.serviceOffered ?? '',
  })
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileNotice, setProfileNotice] = useState<string | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwNotice, setPwNotice] = useState<string | null>(null)

  const set = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const saveProfile = (e: React.FormEvent) => {
    e.preventDefault()
    setProfileError(null)
    setProfileNotice(null)
    startTransition(async () => {
      const result = await updateMyAssociateProfile(form)
      if (result?.error) setProfileError(result.error)
      else setProfileNotice('Your details have been saved')
    })
  }

  const savePassword = (e: React.FormEvent) => {
    e.preventDefault()
    setPwError(null)
    setPwNotice(null)
    if (newPassword !== confirmPassword) {
      setPwError('The new passwords do not match')
      return
    }
    startTransition(async () => {
      const result = await changeMyPassword(currentPassword, newPassword)
      if (result?.error) {
        setPwError(result.error)
        return
      }
      setPwNotice('Your password has been changed')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    })
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">My Profile</h1>
        <p className="text-gray-500 mt-1">{profile.email}</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <h2 className="font-semibold text-gray-900 mb-4">Your details</h2>

          {profileError && (
            <AlertBanner variant="error" message={profileError} className="mb-4" />
          )}
          {profileNotice && (
            <AlertBanner variant="success" message={profileNotice} className="mb-4" />
          )}

          <form onSubmit={saveProfile} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  value={form.firstName}
                  onChange={(e) => set('firstName', e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  value={form.lastName}
                  onChange={(e) => set('lastName', e.target.value)}
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="organization">Organization</Label>
              <Input
                id="organization"
                value={form.organization}
                onChange={(e) => set('organization', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="serviceOffered">What you provide</Label>
              <Textarea
                id="serviceOffered"
                rows={3}
                value={form.serviceOffered}
                onChange={(e) => set('serviceOffered', e.target.value)}
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save details
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h2 className="font-semibold text-gray-900">Change password</h2>
          <p className="text-sm text-gray-500 mt-1 mb-4">
            At least 8 characters, with an uppercase letter, a lowercase letter and a number.
          </p>

          {pwError && <AlertBanner variant="error" message={pwError} className="mb-4" />}
          {pwNotice && <AlertBanner variant="success" message={pwNotice} className="mb-4" />}

          <form onSubmit={savePassword} className="space-y-4" noValidate>
            <div>
              <Label htmlFor="currentPassword">Current password</Label>
              <Input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Change password
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
