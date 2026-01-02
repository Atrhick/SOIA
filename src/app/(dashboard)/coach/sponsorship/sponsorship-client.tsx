'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  createSponsorshipRequest,
  deleteSponsorshipRequest,
} from '@/lib/actions/sponsorship'
import {
  HandCoins,
  Plus,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  DollarSign,
  FileText,
} from 'lucide-react'

interface SponsorshipRequest {
  id: string
  requestType: string
  beneficiaryType: string
  ambassadorId: string | null
  ambassadorName: string | null
  projectName: string | null
  amountRequested: number
  amountContributing: number | null
  reason: string
  urgency: string
  status: string
  adminNotes: string | null
  decidedAt: string | null
  createdAt: string
}

interface Ambassador {
  id: string
  name: string
}

interface Stats {
  total: number
  pending: number
  approved: number
  totalApprovedAmount: number
}

const requestTypeLabels: Record<string, string> = {
  COACH_SPONSORSHIP: 'Coach Sponsorship',
  AMBASSADOR_SPONSORSHIP: 'Ambassador Sponsorship',
  PROJECT_FUNDING: 'Project Funding',
}

const urgencyLabels: Record<string, string> = {
  URGENT: 'Urgent',
  NORMAL: 'Normal',
  FLEXIBLE: 'Flexible',
}

const urgencyVariants: Record<string, 'destructive' | 'secondary' | 'success'> = {
  URGENT: 'destructive',
  NORMAL: 'secondary',
  FLEXIBLE: 'success',
}

const statusConfig: Record<string, { label: string; variant: 'secondary' | 'warning' | 'success' | 'destructive'; icon: typeof Clock }> = {
  SUBMITTED: { label: 'Submitted', variant: 'secondary', icon: Clock },
  UNDER_REVIEW: { label: 'Under Review', variant: 'warning', icon: AlertCircle },
  APPROVED_FULL: { label: 'Approved (Full)', variant: 'success', icon: CheckCircle },
  APPROVED_PARTIAL: { label: 'Approved (Partial)', variant: 'success', icon: CheckCircle },
  PAYMENT_PLAN: { label: 'Payment Plan', variant: 'success', icon: CheckCircle },
  NOT_APPROVED: { label: 'Not Approved', variant: 'destructive', icon: XCircle },
}

export function SponsorshipClient({
  requests,
  ambassadors,
  stats,
}: {
  requests: SponsorshipRequest[]
  ambassadors: Ambassador[]
  stats: Stats
}) {
  const [showForm, setShowForm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [beneficiaryType, setBeneficiaryType] = useState('SELF')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const result = await createSponsorshipRequest(formData)

    if (result.error) {
      setError(result.error)
    } else {
      setShowForm(false)
      setBeneficiaryType('SELF')
      ;(e.target as HTMLFormElement).reset()
    }
    setIsLoading(false)
  }

  const handleDelete = async (requestId: string) => {
    if (!confirm('Are you sure you want to delete this request?')) return
    setIsLoading(true)
    await deleteSponsorshipRequest(requestId)
    setIsLoading(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sponsorship Requests</h1>
          <p className="text-gray-600">Submit and track sponsorship requests</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          New Request
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary-100 rounded-lg">
                <FileText className="h-6 w-6 text-primary-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-gray-500">Total Requests</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-sm text-gray-500">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.approved}</p>
                <p className="text-sm text-gray-500">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">${stats.totalApprovedAmount.toFixed(2)}</p>
                <p className="text-sm text-gray-500">Total Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>
      )}

      {/* New Request Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HandCoins className="h-5 w-5" />
              New Sponsorship Request
            </CardTitle>
            <CardDescription>
              Submit a request for sponsorship or funding
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Request Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Request Type
                </label>
                <select
                  name="requestType"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  onChange={(e) => {
                    const value = e.target.value
                    if (value === 'COACH_SPONSORSHIP') {
                      setBeneficiaryType('SELF')
                    } else if (value === 'AMBASSADOR_SPONSORSHIP') {
                      setBeneficiaryType('AMBASSADOR')
                    } else if (value === 'PROJECT_FUNDING') {
                      setBeneficiaryType('PROJECT')
                    }
                  }}
                >
                  <option value="COACH_SPONSORSHIP">Coach Sponsorship (for yourself)</option>
                  <option value="AMBASSADOR_SPONSORSHIP">Ambassador Sponsorship</option>
                  <option value="PROJECT_FUNDING">Project Funding</option>
                </select>
              </div>

              {/* Hidden beneficiary type */}
              <input type="hidden" name="beneficiaryType" value={beneficiaryType} />

              {/* Ambassador Selection */}
              {beneficiaryType === 'AMBASSADOR' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Ambassador
                  </label>
                  <select
                    name="ambassadorId"
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Choose an ambassador...</option>
                    {ambassadors.map((amb) => (
                      <option key={amb.id} value={amb.id}>
                        {amb.name}
                      </option>
                    ))}
                  </select>
                  {ambassadors.length === 0 && (
                    <p className="text-sm text-yellow-600 mt-1">
                      You have no active ambassadors. Add an ambassador first.
                    </p>
                  )}
                </div>
              )}

              {/* Project Name */}
              {beneficiaryType === 'PROJECT' && (
                <Input
                  name="projectName"
                  label="Project Name"
                  placeholder="Enter project name"
                  required
                />
              )}

              {/* Amount */}
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  name="amountRequested"
                  label="Amount Requested ($)"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  required
                />
                <Input
                  name="amountContributing"
                  label="Your Contribution ($, optional)"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                />
              </div>

              {/* Urgency */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Urgency
                </label>
                <select
                  name="urgency"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="NORMAL">Normal</option>
                  <option value="URGENT">Urgent</option>
                  <option value="FLEXIBLE">Flexible</option>
                </select>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for Request
                </label>
                <textarea
                  name="reason"
                  rows={4}
                  required
                  minLength={10}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Please provide details about why you need this sponsorship..."
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false)
                    setBeneficiaryType('SELF')
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" isLoading={isLoading}>
                  Submit Request
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Requests List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length > 0 ? (
            <div className="space-y-4">
              {requests.map((request) => {
                const statusInfo = statusConfig[request.status]
                const StatusIcon = statusInfo.icon

                return (
                  <div
                    key={request.id}
                    className="p-4 border rounded-lg space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium">
                            {requestTypeLabels[request.requestType]}
                          </h4>
                          <Badge variant={urgencyVariants[request.urgency]}>
                            {urgencyLabels[request.urgency]}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {request.beneficiaryType === 'AMBASSADOR' && request.ambassadorName
                            ? `For: ${request.ambassadorName}`
                            : request.beneficiaryType === 'PROJECT' && request.projectName
                              ? `Project: ${request.projectName}`
                              : 'For yourself'}
                        </p>
                      </div>
                      <Badge variant={statusInfo.variant} className="flex items-center gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {statusInfo.label}
                      </Badge>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3 text-sm">
                      <div>
                        <span className="text-gray-500">Requested:</span>{' '}
                        <span className="font-medium text-green-600">
                          ${request.amountRequested.toFixed(2)}
                        </span>
                      </div>
                      {request.amountContributing && (
                        <div>
                          <span className="text-gray-500">Contributing:</span>{' '}
                          <span className="font-medium">
                            ${request.amountContributing.toFixed(2)}
                          </span>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-500">Submitted:</span>{' '}
                        {new Date(request.createdAt).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="bg-gray-50 p-3 rounded text-sm">
                      <p className="text-gray-700">{request.reason}</p>
                    </div>

                    {request.adminNotes && (
                      <div className="bg-blue-50 p-3 rounded text-sm">
                        <p className="font-medium text-blue-700 mb-1">Admin Notes:</p>
                        <p className="text-blue-600">{request.adminNotes}</p>
                      </div>
                    )}

                    {request.decidedAt && (
                      <p className="text-xs text-gray-400">
                        Decision made on {new Date(request.decidedAt).toLocaleDateString()}
                      </p>
                    )}

                    {request.status === 'SUBMITTED' && (
                      <div className="pt-2 border-t">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600"
                          onClick={() => handleDelete(request.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete Request
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <HandCoins className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-4 text-gray-500">No sponsorship requests yet</p>
              <Button className="mt-4" onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Submit First Request
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
