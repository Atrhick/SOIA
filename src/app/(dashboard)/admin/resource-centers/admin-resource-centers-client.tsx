'use client'

import { useState } from 'react'
import { Building2, CheckCircle, XCircle, Clock, Users, Calendar, MapPin, ChevronDown, ChevronUp } from 'lucide-react'
import { reviewApplication } from '@/lib/actions/resource-center'

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
  coach: {
    id: string
    name: string
    email: string
    recruitedCount: number
  }
}

interface ResourceCenter {
  id: string
  name: string
  location: string
  description: string | null
  createdAt: string
  owner: {
    id: string
    name: string
    email: string
  }
  stats: {
    totalClasses: number
    totalParticipants: number
  }
}

interface Stats {
  totalCenters: number
  pendingApplications: number
  totalClasses: number
  totalParticipants: number
}

interface AdminResourceCentersClientProps {
  applications: Application[]
  resourceCenters: ResourceCenter[]
  stats: Stats
}

export function AdminResourceCentersClient({
  applications,
  resourceCenters,
  stats,
}: AdminResourceCentersClientProps) {
  const [activeTab, setActiveTab] = useState<'applications' | 'centers'>('applications')
  const [expandedApplication, setExpandedApplication] = useState<string | null>(null)
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [declineReason, setDeclineReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const pendingApplications = applications.filter((a) => a.status === 'UNDER_REVIEW')
  const reviewedApplications = applications.filter((a) => a.status !== 'UNDER_REVIEW')

  const handleReview = async (applicationId: string, decision: 'APPROVED' | 'DECLINED') => {
    setIsSubmitting(true)
    setError('')

    try {
      const result = await reviewApplication(
        applicationId,
        decision,
        decision === 'DECLINED' ? declineReason : undefined
      )

      if (result.error) {
        setError(result.error)
      } else {
        setReviewingId(null)
        setDeclineReason('')
      }
    } catch {
      setError('An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'UNDER_REVIEW':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="h-3 w-3" />
            Under Review
          </span>
        )
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3" />
            Approved
          </span>
        )
      case 'DECLINED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="h-3 w-3" />
            Declined
          </span>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Resource Centers</h1>
        <p className="text-gray-600">Manage resource center applications and active centers</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active Centers</p>
              <p className="text-2xl font-bold">{stats.totalCenters}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending Applications</p>
              <p className="text-2xl font-bold">{stats.pendingApplications}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Calendar className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Classes</p>
              <p className="text-2xl font-bold">{stats.totalClasses}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Participants</p>
              <p className="text-2xl font-bold">{stats.totalParticipants}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="-mb-px flex gap-4">
          <button
            onClick={() => setActiveTab('applications')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'applications'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Applications ({applications.length})
          </button>
          <button
            onClick={() => setActiveTab('centers')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'centers'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Active Centers ({resourceCenters.length})
          </button>
        </nav>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Applications Tab */}
      {activeTab === 'applications' && (
        <div className="space-y-6">
          {/* Pending Applications */}
          {pendingApplications.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Pending Review</h2>
              <div className="space-y-4">
                {pendingApplications.map((app) => (
                  <div key={app.id} className="bg-white rounded-lg border">
                    <div
                      className="p-4 cursor-pointer"
                      onClick={() =>
                        setExpandedApplication(expandedApplication === app.id ? null : app.id)
                      }
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="font-medium">{app.coach.name}</h3>
                            {getStatusBadge(app.status)}
                          </div>
                          <p className="text-sm text-gray-500">{app.coach.email}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {app.proposedLocation}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="h-4 w-4" />
                              {app.coach.recruitedCount} coaches recruited
                            </span>
                          </div>
                        </div>
                        <button className="text-gray-400">
                          {expandedApplication === app.id ? (
                            <ChevronUp className="h-5 w-5" />
                          ) : (
                            <ChevronDown className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {expandedApplication === app.id && (
                      <div className="border-t p-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {app.communityDescription && (
                            <div>
                              <h4 className="text-sm font-medium text-gray-700">
                                Community Description
                              </h4>
                              <p className="text-sm text-gray-600 mt-1">
                                {app.communityDescription}
                              </p>
                            </div>
                          )}
                          {app.visionAndGoals && (
                            <div>
                              <h4 className="text-sm font-medium text-gray-700">Vision & Goals</h4>
                              <p className="text-sm text-gray-600 mt-1">{app.visionAndGoals}</p>
                            </div>
                          )}
                          {app.capacityInfo && (
                            <div>
                              <h4 className="text-sm font-medium text-gray-700">
                                Capacity Information
                              </h4>
                              <p className="text-sm text-gray-600 mt-1">{app.capacityInfo}</p>
                            </div>
                          )}
                        </div>

                        <p className="text-xs text-gray-500">
                          Submitted {new Date(app.createdAt).toLocaleDateString()}
                        </p>

                        {reviewingId === app.id ? (
                          <div className="space-y-3 pt-2 border-t">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Decline Reason (required if declining)
                              </label>
                              <textarea
                                value={declineReason}
                                onChange={(e) => setDeclineReason(e.target.value)}
                                className="w-full rounded-lg border p-2 text-sm"
                                rows={2}
                                placeholder="Enter reason for declining..."
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleReview(app.id, 'APPROVED')}
                                disabled={isSubmitting}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleReview(app.id, 'DECLINED')}
                                disabled={isSubmitting || !declineReason.trim()}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                              >
                                Decline
                              </button>
                              <button
                                onClick={() => {
                                  setReviewingId(null)
                                  setDeclineReason('')
                                }}
                                className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="pt-2 border-t">
                            <button
                              onClick={() => setReviewingId(app.id)}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                            >
                              Review Application
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reviewed Applications */}
          {reviewedApplications.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Reviewed Applications</h2>
              <div className="space-y-4">
                {reviewedApplications.map((app) => (
                  <div key={app.id} className="bg-white rounded-lg border">
                    <div
                      className="p-4 cursor-pointer"
                      onClick={() =>
                        setExpandedApplication(expandedApplication === app.id ? null : app.id)
                      }
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="font-medium">{app.coach.name}</h3>
                            {getStatusBadge(app.status)}
                          </div>
                          <p className="text-sm text-gray-500">{app.coach.email}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {app.proposedLocation}
                            </span>
                            {app.reviewedAt && (
                              <span>
                                Reviewed {new Date(app.reviewedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <button className="text-gray-400">
                          {expandedApplication === app.id ? (
                            <ChevronUp className="h-5 w-5" />
                          ) : (
                            <ChevronDown className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {expandedApplication === app.id && (
                      <div className="border-t p-4 space-y-4">
                        {app.declineReason && (
                          <div className="bg-red-50 p-3 rounded-lg">
                            <h4 className="text-sm font-medium text-red-800">Decline Reason</h4>
                            <p className="text-sm text-red-700 mt-1">{app.declineReason}</p>
                          </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {app.communityDescription && (
                            <div>
                              <h4 className="text-sm font-medium text-gray-700">
                                Community Description
                              </h4>
                              <p className="text-sm text-gray-600 mt-1">
                                {app.communityDescription}
                              </p>
                            </div>
                          )}
                          {app.visionAndGoals && (
                            <div>
                              <h4 className="text-sm font-medium text-gray-700">Vision & Goals</h4>
                              <p className="text-sm text-gray-600 mt-1">{app.visionAndGoals}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {applications.length === 0 && (
            <div className="bg-white rounded-lg border p-8 text-center">
              <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <h3 className="font-medium text-gray-900">No Applications</h3>
              <p className="text-sm text-gray-500 mt-1">
                No resource center applications have been submitted yet.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Active Centers Tab */}
      {activeTab === 'centers' && (
        <div className="space-y-4">
          {resourceCenters.length > 0 ? (
            resourceCenters.map((center) => (
              <div key={center.id} className="bg-white rounded-lg border p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-lg">{center.name}</h3>
                    <p className="text-sm text-gray-500">{center.owner.email}</p>
                    <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                      <MapPin className="h-4 w-4" />
                      {center.location}
                    </div>
                    {center.description && (
                      <p className="text-sm text-gray-600 mt-2">{center.description}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-2xl font-bold text-blue-600">
                          {center.stats.totalClasses}
                        </p>
                        <p className="text-xs text-gray-500">Classes</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-green-600">
                          {center.stats.totalParticipants}
                        </p>
                        <p className="text-xs text-gray-500">Participants</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t text-xs text-gray-500">
                  Created {new Date(center.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white rounded-lg border p-8 text-center">
              <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <h3 className="font-medium text-gray-900">No Active Centers</h3>
              <p className="text-sm text-gray-500 mt-1">
                No resource centers have been approved yet.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
