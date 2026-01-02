'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { updateSponsorshipStatus, addAdminNotes } from '@/lib/actions/sponsorship'
import {
  HandCoins,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  DollarSign,
  FileText,
  User,
  MessageSquare,
  Eye,
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
  coach: {
    id: string
    name: string
    email: string
  }
}

interface Stats {
  total: number
  submitted: number
  underReview: number
  approved: number
  notApproved: number
  totalRequested: number
  totalApproved: number
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
  UNDER_REVIEW: { label: 'Under Review', variant: 'warning', icon: Eye },
  APPROVED_FULL: { label: 'Approved (Full)', variant: 'success', icon: CheckCircle },
  APPROVED_PARTIAL: { label: 'Approved (Partial)', variant: 'success', icon: CheckCircle },
  PAYMENT_PLAN: { label: 'Payment Plan', variant: 'success', icon: CheckCircle },
  NOT_APPROVED: { label: 'Not Approved', variant: 'destructive', icon: XCircle },
}

type StatusFilter = 'ALL' | 'PENDING' | 'DECIDED'

export function AdminSponsorshipClient({
  requests,
  stats,
}: {
  requests: SponsorshipRequest[]
  stats: Stats
}) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('ALL')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filteredRequests = requests.filter((r) => {
    if (filter === 'PENDING') {
      return ['SUBMITTED', 'UNDER_REVIEW'].includes(r.status)
    }
    if (filter === 'DECIDED') {
      return ['APPROVED_FULL', 'APPROVED_PARTIAL', 'PAYMENT_PLAN', 'NOT_APPROVED'].includes(r.status)
    }
    return true
  })

  const handleStatusUpdate = async (
    requestId: string,
    status: 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED_FULL' | 'APPROVED_PARTIAL' | 'PAYMENT_PLAN' | 'NOT_APPROVED',
    notes?: string
  ) => {
    setIsLoading(true)
    setError('')
    const result = await updateSponsorshipStatus(requestId, status, notes)
    if (result.error) {
      setError(result.error)
    }
    setIsLoading(false)
  }

  const handleAddNotes = async (requestId: string) => {
    const notes = prompt('Enter admin notes:')
    if (notes === null) return

    setIsLoading(true)
    setError('')
    const result = await addAdminNotes(requestId, notes)
    if (result.error) {
      setError(result.error)
    }
    setIsLoading(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sponsorship Requests</h1>
        <p className="text-gray-600">Review and manage all sponsorship requests</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-7">
        <Card>
          <CardContent className="py-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="py-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-700">{stats.submitted}</p>
              <p className="text-xs text-yellow-600">Submitted</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="py-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-700">{stats.underReview}</p>
              <p className="text-xs text-orange-600">Under Review</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50">
          <CardContent className="py-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-700">{stats.approved}</p>
              <p className="text-xs text-green-600">Approved</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-700">{stats.notApproved}</p>
              <p className="text-xs text-red-600">Not Approved</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">
                ${stats.totalRequested.toFixed(0)}
              </p>
              <p className="text-xs text-gray-500">Pending $</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                ${stats.totalApproved.toFixed(0)}
              </p>
              <p className="text-xs text-gray-500">Approved $</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        <Button
          variant={filter === 'ALL' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('ALL')}
        >
          All ({requests.length})
        </Button>
        <Button
          variant={filter === 'PENDING' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('PENDING')}
        >
          <Clock className="h-4 w-4 mr-1" />
          Pending ({stats.submitted + stats.underReview})
        </Button>
        <Button
          variant={filter === 'DECIDED' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('DECIDED')}
        >
          <CheckCircle className="h-4 w-4 mr-1" />
          Decided ({stats.approved + stats.notApproved})
        </Button>
      </div>

      {/* Requests List */}
      <Card>
        <CardHeader>
          <CardTitle>
            {filter === 'ALL' ? 'All Requests' : filter === 'PENDING' ? 'Pending Requests' : 'Decided Requests'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredRequests.length > 0 ? (
            <div className="space-y-4">
              {filteredRequests.map((request) => {
                const statusInfo = statusConfig[request.status]
                const StatusIcon = statusInfo.icon
                const isExpanded = expandedId === request.id

                return (
                  <div
                    key={request.id}
                    className="p-4 border rounded-lg space-y-3"
                  >
                    {/* Header Row */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <HandCoins className="h-5 w-5 text-gray-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-medium">
                              {requestTypeLabels[request.requestType]}
                            </h4>
                            <Badge variant={urgencyVariants[request.urgency]}>
                              {urgencyLabels[request.urgency]}
                            </Badge>
                            <span className="text-green-600 font-semibold">
                              ${request.amountRequested.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                            <User className="h-3 w-3" />
                            <span>{request.coach.name}</span>
                            <span className="text-gray-300">|</span>
                            <span>{request.coach.email}</span>
                          </div>
                          {request.beneficiaryType === 'AMBASSADOR' && request.ambassadorName && (
                            <p className="text-sm text-gray-500">
                              For Ambassador: {request.ambassadorName}
                            </p>
                          )}
                          {request.beneficiaryType === 'PROJECT' && request.projectName && (
                            <p className="text-sm text-gray-500">
                              Project: {request.projectName}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={statusInfo.variant} className="flex items-center gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {statusInfo.label}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setExpandedId(isExpanded ? null : request.id)}
                        >
                          {isExpanded ? 'Collapse' : 'Expand'}
                        </Button>
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <>
                        <div className="grid gap-4 md:grid-cols-3 text-sm border-t pt-3">
                          <div>
                            <span className="text-gray-500">Requested:</span>{' '}
                            <span className="font-medium text-green-600">
                              ${request.amountRequested.toFixed(2)}
                            </span>
                          </div>
                          {request.amountContributing !== null && (
                            <div>
                              <span className="text-gray-500">Coach Contributing:</span>{' '}
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
                          <p className="font-medium text-gray-700 mb-1">Reason:</p>
                          <p className="text-gray-600">{request.reason}</p>
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

                        {/* Action Buttons */}
                        <div className="pt-3 border-t flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAddNotes(request.id)}
                            disabled={isLoading}
                          >
                            <MessageSquare className="h-4 w-4 mr-1" />
                            Add Notes
                          </Button>

                          {request.status === 'SUBMITTED' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-orange-600 border-orange-200"
                              onClick={() => handleStatusUpdate(request.id, 'UNDER_REVIEW')}
                              disabled={isLoading}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Mark Under Review
                            </Button>
                          )}

                          {['SUBMITTED', 'UNDER_REVIEW'].includes(request.status) && (
                            <>
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => {
                                  const notes = prompt('Add approval notes (optional):')
                                  handleStatusUpdate(request.id, 'APPROVED_FULL', notes || undefined)
                                }}
                                disabled={isLoading}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Approve Full
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 border-green-200"
                                onClick={() => {
                                  const notes = prompt('Add notes about partial approval:')
                                  handleStatusUpdate(request.id, 'APPROVED_PARTIAL', notes || undefined)
                                }}
                                disabled={isLoading}
                              >
                                Approve Partial
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-blue-600 border-blue-200"
                                onClick={() => {
                                  const notes = prompt('Add payment plan details:')
                                  handleStatusUpdate(request.id, 'PAYMENT_PLAN', notes || undefined)
                                }}
                                disabled={isLoading}
                              >
                                Payment Plan
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 border-red-200"
                                onClick={() => {
                                  const notes = prompt('Add reason for not approving:')
                                  handleStatusUpdate(request.id, 'NOT_APPROVED', notes || undefined)
                                }}
                                disabled={isLoading}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Not Approved
                              </Button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <HandCoins className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-4 text-gray-500">
                {filter === 'PENDING'
                  ? 'No pending requests'
                  : filter === 'DECIDED'
                    ? 'No decided requests'
                    : 'No sponsorship requests yet'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
