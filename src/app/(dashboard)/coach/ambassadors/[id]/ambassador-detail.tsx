'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { updateAmbassador, deleteAmbassador } from '@/lib/actions/ambassadors'
import { ArrowLeft, Save, Trash2, User, Mail, Phone, MapPin, FileText } from 'lucide-react'
import type { Ambassador } from '@prisma/client'

const statusVariants = {
  PENDING: 'warning',
  APPROVED: 'success',
  INACTIVE: 'secondary',
  COMPLETED: 'default',
  ON_HOLD: 'destructive',
} as const

interface AmbassadorDetailProps {
  ambassador: Ambassador
}

export function AmbassadorDetail({ ambassador }: AmbassadorDetailProps) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setSuccess('')

    const formData = new FormData(e.currentTarget)
    const result = await updateAmbassador(ambassador.id, formData)

    if (result.error) {
      setError(result.error)
    } else {
      setSuccess('Ambassador updated successfully!')
      setIsEditing(false)
      router.refresh()
    }

    setIsLoading(false)
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this ambassador? This action cannot be undone.')) {
      return
    }

    setIsDeleting(true)
    const result = await deleteAmbassador(ambassador.id)

    if (result.error) {
      setError(result.error)
      setIsDeleting(false)
    } else {
      router.push('/coach/ambassadors')
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/coach/ambassadors">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {ambassador.firstName} {ambassador.lastName}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={statusVariants[ambassador.status]}>
                {ambassador.status}
              </Badge>
              <Badge variant="secondary">
                {ambassador.assessmentStatus.replace('_', ' ')}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isEditing && (
            <>
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
              <Button
                variant="destructive"
                size="icon"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>
      )}

      {success && (
        <div className="p-4 bg-green-50 text-green-600 rounded-lg">{success}</div>
      )}

      {isEditing ? (
        <Card>
          <CardHeader>
            <CardTitle>Edit Ambassador</CardTitle>
            <CardDescription>Update ambassador information</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  id="firstName"
                  name="firstName"
                  label="First Name"
                  defaultValue={ambassador.firstName}
                  required
                />
                <Input
                  id="lastName"
                  name="lastName"
                  label="Last Name"
                  defaultValue={ambassador.lastName}
                  required
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  id="email"
                  name="email"
                  label="Email"
                  type="email"
                  placeholder="name@example.com"
                  defaultValue={ambassador.email || ''}
                />
                <Input
                  id="phone"
                  name="phone"
                  label="Phone"
                  type="tel"
                  defaultValue={ambassador.phone || ''}
                />
              </div>

              <Input
                id="region"
                name="region"
                label="Region/Location"
                defaultValue={ambassador.region || ''}
              />

              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  defaultValue={ambassador.notes || ''}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={isLoading}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Ambassador Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Mail className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium">{ambassador.email || 'Not provided'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Phone className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Phone</p>
                    <p className="font-medium">{ambassador.phone || 'Not provided'}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <MapPin className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Region/Location</p>
                  <p className="font-medium">{ambassador.region || 'Not provided'}</p>
                </div>
              </div>

              {ambassador.notes && (
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <FileText className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Notes</p>
                    <p className="font-medium whitespace-pre-wrap">{ambassador.notes}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status Card */}
          <Card>
            <CardHeader>
              <CardTitle>Status Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-gray-500 mb-2">Ambassador Status</p>
                  <Badge variant={statusVariants[ambassador.status]} className="text-sm">
                    {ambassador.status}
                  </Badge>
                  <p className="text-xs text-gray-400 mt-2">
                    Status is managed by administrators
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-gray-500 mb-2">Assessment Status</p>
                  <Badge variant="secondary" className="text-sm">
                    {ambassador.assessmentStatus.replace('_', ' ')}
                  </Badge>
                </div>
              </div>

              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  <strong>Added:</strong> {new Date(ambassador.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  <strong>Last Updated:</strong> {new Date(ambassador.updatedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
