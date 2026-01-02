'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  submitApplication,
  addClass,
  updateClassAttendance,
  deleteClass,
} from '@/lib/actions/resource-center'
import {
  Building2,
  Plus,
  Trash2,
  Users,
  Calendar,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  GraduationCap,
} from 'lucide-react'

interface Application {
  id: string
  proposedLocation: string
  communityDescription: string | null
  visionAndGoals: string | null
  capacityInfo: string | null
  status: string
  declineReason: string | null
  reviewedAt: string | null
  createdAt: string
}

interface ResourceCenterClass {
  id: string
  title: string
  date: string
  audienceType: string
  attendanceCount: number
  notes: string | null
}

interface ResourceCenter {
  id: string
  name: string
  location: string
  description: string | null
  classes: ResourceCenterClass[]
}

interface Stats {
  totalClasses: number
  totalParticipants: number
  ambassadorClasses: number
  adultClasses: number
}

const audienceLabels: Record<string, string> = {
  AMBASSADORS: 'Ambassadors',
  ADULTS: 'Adults',
  MIXED: 'Mixed',
}

const statusConfig: Record<string, { label: string; variant: 'secondary' | 'warning' | 'success' | 'destructive'; icon: typeof Clock }> = {
  NOT_SUBMITTED: { label: 'Not Submitted', variant: 'secondary', icon: Clock },
  UNDER_REVIEW: { label: 'Under Review', variant: 'warning', icon: AlertCircle },
  APPROVED: { label: 'Approved', variant: 'success', icon: CheckCircle },
  DECLINED: { label: 'Declined', variant: 'destructive', icon: XCircle },
}

export function ResourceCenterClient({
  recruitedCount,
  application,
  resourceCenter,
  stats,
}: {
  recruitedCount: number
  application: Application | null
  resourceCenter: ResourceCenter | null
  stats: Stats | null
}) {
  const [showApplicationForm, setShowApplicationForm] = useState(false)
  const [showClassForm, setShowClassForm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const isEligible = recruitedCount >= 5
  const requiredCount = 5

  const handleApplicationSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const result = await submitApplication(formData)

    if (result.error) {
      setError(result.error)
    } else {
      setShowApplicationForm(false)
    }
    setIsLoading(false)
  }

  const handleClassSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const result = await addClass(formData)

    if (result.error) {
      setError(result.error)
    } else {
      setShowClassForm(false)
      ;(e.target as HTMLFormElement).reset()
    }
    setIsLoading(false)
  }

  const handleDeleteClass = async (classId: string) => {
    if (!confirm('Are you sure you want to delete this class?')) return
    setIsLoading(true)
    await deleteClass(classId)
    setIsLoading(false)
  }

  const handleUpdateAttendance = async (classId: string) => {
    const count = prompt('Enter attendance count:')
    if (count === null) return
    const numCount = parseInt(count)
    if (isNaN(numCount) || numCount < 0) {
      setError('Please enter a valid number')
      return
    }
    setIsLoading(true)
    await updateClassAttendance(classId, numCount)
    setIsLoading(false)
  }

  // If coach has approved resource center, show management view
  if (resourceCenter) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{resourceCenter.name}</h1>
            <p className="text-gray-600 flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {resourceCenter.location}
            </p>
          </div>
          <Button onClick={() => setShowClassForm(!showClassForm)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Class
          </Button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary-100 rounded-lg">
                    <GraduationCap className="h-6 w-6 text-primary-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.totalClasses}</p>
                    <p className="text-sm text-gray-500">Total Classes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <Users className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.totalParticipants}</p>
                    <p className="text-sm text-gray-500">Total Participants</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.ambassadorClasses}</p>
                    <p className="text-sm text-gray-500">Ambassador Classes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <Users className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.adultClasses}</p>
                    <p className="text-sm text-gray-500">Adult Classes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>
        )}

        {/* Add Class Form */}
        {showClassForm && (
          <Card>
            <CardHeader>
              <CardTitle>Add New Class</CardTitle>
              <CardDescription>Record a class or workshop</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleClassSubmit} className="space-y-4">
                <Input
                  name="title"
                  label="Class Title"
                  placeholder="Personal Development Workshop"
                  required
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    name="date"
                    label="Date"
                    type="datetime-local"
                    required
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Audience Type
                    </label>
                    <select
                      name="audienceType"
                      required
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="AMBASSADORS">Ambassadors</option>
                      <option value="ADULTS">Adults</option>
                      <option value="MIXED">Mixed</option>
                    </select>
                  </div>
                </div>
                <Input
                  name="attendanceCount"
                  label="Attendance Count"
                  type="number"
                  min="0"
                  defaultValue="0"
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes (optional)
                  </label>
                  <textarea
                    name="notes"
                    rows={2}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Any notes about this class..."
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowClassForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" isLoading={isLoading}>
                    Add Class
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Classes List */}
        <Card>
          <CardHeader>
            <CardTitle>Classes & Workshops</CardTitle>
          </CardHeader>
          <CardContent>
            {resourceCenter.classes.length > 0 ? (
              <div className="space-y-4">
                {resourceCenter.classes.map((cls) => (
                  <div key={cls.id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium">{cls.title}</h4>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(cls.date).toLocaleDateString()}
                          </span>
                          <Badge variant="secondary">
                            {audienceLabels[cls.audienceType]}
                          </Badge>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {cls.attendanceCount} attendees
                          </span>
                        </div>
                        {cls.notes && (
                          <p className="text-sm text-gray-500 mt-2">{cls.notes}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateAttendance(cls.id)}
                        >
                          Update Attendance
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600"
                          onClick={() => handleDeleteClass(cls.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <GraduationCap className="mx-auto h-12 w-12 text-gray-300" />
                <p className="mt-4 text-gray-500">No classes recorded yet</p>
                <Button className="mt-4" onClick={() => setShowClassForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Class
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // If has pending/reviewed application
  if (application) {
    const statusInfo = statusConfig[application.status]
    const StatusIcon = statusInfo.icon

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Resource Center</h1>
          <p className="text-gray-600">Your application status</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Resource Center Application
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant={statusInfo.variant} className="flex items-center gap-1">
                <StatusIcon className="h-4 w-4" />
                {statusInfo.label}
              </Badge>
              <span className="text-sm text-gray-500">
                Submitted {new Date(application.createdAt).toLocaleDateString()}
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-gray-500">Proposed Location</p>
                <p>{application.proposedLocation}</p>
              </div>
              {application.communityDescription && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Community Description</p>
                  <p>{application.communityDescription}</p>
                </div>
              )}
            </div>

            {application.visionAndGoals && (
              <div>
                <p className="text-sm font-medium text-gray-500">Vision & Goals</p>
                <p>{application.visionAndGoals}</p>
              </div>
            )}

            {application.status === 'DECLINED' && application.declineReason && (
              <div className="bg-red-50 border border-red-200 rounded p-4">
                <p className="font-medium text-red-700">Reason for decline:</p>
                <p className="text-red-600">{application.declineReason}</p>
              </div>
            )}

            {application.reviewedAt && (
              <p className="text-sm text-gray-400">
                Reviewed on {new Date(application.reviewedAt).toLocaleDateString()}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Eligibility and application view
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Resource Center</h1>
        <p className="text-gray-600">Apply to become a Resource Center Owner</p>
      </div>

      {/* Eligibility Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Eligibility Status
          </CardTitle>
          <CardDescription>
            Recruit {requiredCount} coaches to become eligible
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Progress
              value={(recruitedCount / requiredCount) * 100}
              className="flex-1"
            />
            <span className="font-medium">
              {recruitedCount} / {requiredCount}
            </span>
          </div>

          {isEligible ? (
            <div className="bg-green-50 border border-green-200 rounded p-4">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">You are eligible to apply!</span>
              </div>
              <p className="text-sm text-green-600 mt-1">
                You have recruited {recruitedCount} coaches and can now apply to become a Resource Center Owner.
              </p>
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
              <div className="flex items-center gap-2 text-yellow-700">
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">Keep recruiting!</span>
              </div>
              <p className="text-sm text-yellow-600 mt-1">
                You need to recruit {requiredCount - recruitedCount} more coach(es) to become eligible.
              </p>
            </div>
          )}

          {isEligible && !showApplicationForm && (
            <Button onClick={() => setShowApplicationForm(true)} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Apply to Become Resource Center Owner
            </Button>
          )}
        </CardContent>
      </Card>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>
      )}

      {/* Application Form */}
      {showApplicationForm && (
        <Card>
          <CardHeader>
            <CardTitle>Resource Center Application</CardTitle>
            <CardDescription>
              Tell us about your plans for your Resource Center
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleApplicationSubmit} className="space-y-4">
              <Input
                name="proposedLocation"
                label="Proposed Location (City, Region)"
                placeholder="Atlanta, Georgia"
                required
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Community Description
                </label>
                <textarea
                  name="communityDescription"
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Describe the community you plan to serve..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vision & Goals
                </label>
                <textarea
                  name="visionAndGoals"
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="What is your vision for this Resource Center?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Capacity Information
                </label>
                <textarea
                  name="capacityInfo"
                  rows={2}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Available spaces, facilities, etc."
                />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowApplicationForm(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" isLoading={isLoading}>
                  Submit Application
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
