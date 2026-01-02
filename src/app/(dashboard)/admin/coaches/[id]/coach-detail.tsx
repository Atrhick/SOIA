'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  updateCoach,
  updateCoachUserStatus,
  updateCoachOnboardingStatus,
  updateOnboardingTaskByAdmin,
  resetCoachPassword,
} from '@/lib/actions/coaches'
import {
  ArrowLeft,
  Save,
  User,
  Mail,
  Phone,
  MapPin,
  Users,
  CheckCircle2,
  Circle,
  Clock,
  Key,
  Shield,
} from 'lucide-react'
import type { CoachProfile, User as UserType, Ambassador, OnboardingTask, CoachOnboardingProgress, QuizResult, Course } from '@prisma/client'

type CoachWithRelations = CoachProfile & {
  user: UserType
  recruiter: CoachProfile | null
  recruitedCoaches: CoachProfile[]
  ambassadors: Ambassador[]
  onboardingProgress: (CoachOnboardingProgress & { task: OnboardingTask })[]
  quizResults: (QuizResult & { course: Course })[]
}

const userStatusVariants = {
  ACTIVE: 'success',
  INACTIVE: 'secondary',
  SUSPENDED: 'destructive',
} as const

const coachStatusVariants = {
  ACTIVE_COACH: 'success',
  ONBOARDING_INCOMPLETE: 'warning',
} as const

const taskStatusVariants = {
  NOT_STARTED: 'secondary',
  IN_PROGRESS: 'warning',
  SUBMITTED: 'default',
  APPROVED: 'success',
} as const

interface CoachDetailProps {
  coach: CoachWithRelations
  onboardingTasks: OnboardingTask[]
}

export function CoachDetail({ coach, onboardingTasks }: CoachDetailProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'info' | 'onboarding' | 'security'>('info')
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Build progress map
  const progressMap = new Map(
    coach.onboardingProgress.map((p) => [p.taskId, p])
  )

  // Calculate onboarding completion
  const requiredTasks = onboardingTasks.filter((t) => t.isRequired)
  const completedRequired = requiredTasks.filter(
    (t) => progressMap.get(t.id)?.status === 'APPROVED'
  ).length
  const completionPercentage = requiredTasks.length > 0
    ? (completedRequired / requiredTasks.length) * 100
    : 0

  const handleUpdateProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setSuccess('')

    const formData = new FormData(e.currentTarget)
    const result = await updateCoach(coach.id, formData)

    if (result.error) {
      setError(result.error)
    } else {
      setSuccess('Profile updated successfully!')
      setIsEditing(false)
      router.refresh()
    }

    setIsLoading(false)
  }

  const handleStatusChange = async (status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED') => {
    setIsLoading(true)
    const result = await updateCoachUserStatus(coach.id, status)
    if (result.error) {
      setError(result.error)
    } else {
      setSuccess('Status updated!')
      router.refresh()
    }
    setIsLoading(false)
  }

  const handleCoachStatusChange = async (status: 'ONBOARDING_INCOMPLETE' | 'ACTIVE_COACH') => {
    setIsLoading(true)
    const result = await updateCoachOnboardingStatus(coach.id, status)
    if (result.error) {
      setError(result.error)
    } else {
      setSuccess('Coach status updated!')
      router.refresh()
    }
    setIsLoading(false)
  }

  const handleTaskStatusChange = async (
    taskId: string,
    status: 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED'
  ) => {
    const result = await updateOnboardingTaskByAdmin(coach.id, taskId, status)
    if (result.error) {
      setError(result.error)
    } else {
      router.refresh()
    }
  }

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setSuccess('')

    const formData = new FormData(e.currentTarget)
    const newPassword = formData.get('newPassword') as string

    const result = await resetCoachPassword(coach.id, newPassword)

    if (result.error) {
      setError(result.error)
    } else {
      setSuccess('Password reset successfully!')
      ;(e.target as HTMLFormElement).reset()
    }

    setIsLoading(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/coaches">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {coach.firstName} {coach.lastName}
            </h1>
            <p className="text-gray-600">{coach.user.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={userStatusVariants[coach.user.status]}>
            {coach.user.status}
          </Badge>
          <Badge variant={coachStatusVariants[coach.coachStatus]}>
            {coach.coachStatus === 'ACTIVE_COACH' ? 'Active Coach' : 'Onboarding'}
          </Badge>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>
      )}

      {success && (
        <div className="p-4 bg-green-50 text-green-600 rounded-lg">{success}</div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('info')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeTab === 'info'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Profile Info
        </button>
        <button
          onClick={() => setActiveTab('onboarding')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeTab === 'onboarding'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Onboarding
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeTab === 'security'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Security
        </button>
      </div>

      {/* Info Tab */}
      {activeTab === 'info' && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Profile Card */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Profile Information</CardTitle>
                {!isEditing && (
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                    Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input
                      id="firstName"
                      name="firstName"
                      label="First Name"
                      defaultValue={coach.firstName}
                      required
                    />
                    <Input
                      id="lastName"
                      name="lastName"
                      label="Last Name"
                      defaultValue={coach.lastName}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-1">
                      Bio
                    </label>
                    <textarea
                      id="bio"
                      name="bio"
                      rows={3}
                      defaultValue={coach.bio || ''}
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <Input
                    id="phone"
                    name="phone"
                    label="Phone"
                    defaultValue={coach.phone || ''}
                  />
                  <div className="grid gap-4 md:grid-cols-3">
                    <Input id="city" name="city" label="City" defaultValue={coach.city || ''} />
                    <Input id="region" name="region" label="Region" defaultValue={coach.region || ''} />
                    <Input id="country" name="country" label="Country" defaultValue={coach.country || ''} />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" isLoading={isLoading}>
                      <Save className="mr-2 h-4 w-4" />
                      Save
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Mail className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Email</p>
                      <p className="font-medium">{coach.user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Phone className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Phone</p>
                      <p className="font-medium">{coach.phone || 'Not provided'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <MapPin className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Location</p>
                      <p className="font-medium">
                        {[coach.city, coach.region, coach.country].filter(Boolean).join(', ') || 'Not provided'}
                      </p>
                    </div>
                  </div>
                  {coach.bio && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500 mb-1">Bio</p>
                      <p className="text-gray-700">{coach.bio}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats Card */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Ambassadors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{coach.ambassadors.length}</p>
                <p className="text-sm text-gray-500">
                  {coach.ambassadors.filter((a) => a.status === 'APPROVED').length} approved
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recruited Coaches</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{coach.recruitedCoaches.length}</p>
                {coach.recruiter && (
                  <p className="text-sm text-gray-500 mt-2">
                    Recruited by: {coach.recruiter.firstName} {coach.recruiter.lastName}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Onboarding Tab */}
      {activeTab === 'onboarding' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Onboarding Progress</CardTitle>
                  <CardDescription>
                    {completedRequired} of {requiredTasks.length} required tasks completed
                  </CardDescription>
                </div>
                <select
                  value={coach.coachStatus}
                  onChange={(e) => handleCoachStatusChange(e.target.value as 'ONBOARDING_INCOMPLETE' | 'ACTIVE_COACH')}
                  className="text-sm border rounded px-2 py-1"
                >
                  <option value="ONBOARDING_INCOMPLETE">Onboarding Incomplete</option>
                  <option value="ACTIVE_COACH">Active Coach</option>
                </select>
              </div>
            </CardHeader>
            <CardContent>
              <Progress value={completionPercentage} showLabel className="mb-6" />

              <div className="space-y-3">
                {onboardingTasks.map((task) => {
                  const progress = progressMap.get(task.id)
                  const status = progress?.status || 'NOT_STARTED'

                  return (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {status === 'APPROVED' ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : status === 'IN_PROGRESS' || status === 'SUBMITTED' ? (
                          <Clock className="h-5 w-5 text-yellow-500" />
                        ) : (
                          <Circle className="h-5 w-5 text-gray-300" />
                        )}
                        <div>
                          <p className="font-medium text-sm">{task.label}</p>
                          {task.isRequired && (
                            <Badge variant="secondary" className="text-xs">Required</Badge>
                          )}
                        </div>
                      </div>
                      <select
                        value={status}
                        onChange={(e) =>
                          handleTaskStatusChange(
                            task.id,
                            e.target.value as 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED'
                          )
                        }
                        className="text-sm border rounded px-2 py-1"
                      >
                        <option value="NOT_STARTED">Not Started</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="SUBMITTED">Submitted</option>
                        <option value="APPROVED">Approved</option>
                      </select>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Account Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-500 mb-2">User Status</p>
                <div className="flex gap-2">
                  <Button
                    variant={coach.user.status === 'ACTIVE' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleStatusChange('ACTIVE')}
                    disabled={isLoading}
                  >
                    Active
                  </Button>
                  <Button
                    variant={coach.user.status === 'INACTIVE' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleStatusChange('INACTIVE')}
                    disabled={isLoading}
                  >
                    Inactive
                  </Button>
                  <Button
                    variant={coach.user.status === 'SUSPENDED' ? 'destructive' : 'outline'}
                    size="sm"
                    onClick={() => handleStatusChange('SUSPENDED')}
                    disabled={isLoading}
                  >
                    Suspended
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Reset Password
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <Input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  label="New Password"
                  placeholder="Minimum 6 characters"
                  required
                  minLength={6}
                />
                <Button type="submit" isLoading={isLoading}>
                  Reset Password
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
