'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Users,
  Search,
  Filter,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  Calendar,
  DollarSign,
  UserPlus,
  LayoutGrid,
  List,
  Mail,
  Phone,
  Building,
  Plus,
  X,
  Loader2,
  User,
  Link2,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react'
import { ProspectStatus } from '@prisma/client'
import { createManualProspect } from '@/lib/actions/prospects'
import { getCoachAssessmentLink } from '@/lib/actions/surveys'

interface Prospect {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  referrerName: string | null
  status: ProspectStatus
  companyName: string | null
  createdAt: string
  assessmentCompletedAt: string | null
  interviewCompletedAt: string | null
  paymentStatus: string | null
}

interface Stats {
  total: number
  assessmentCompleted: number
  orientationPending: number
  businessFormPending: number
  interviewPending: number
  approved: number
  paymentPending: number
  accountCreated: number
  rejected: number
}

interface ProspectsClientProps {
  prospects: Prospect[]
  stats: Stats
}

const STATUS_CONFIG: Record<ProspectStatus, { label: string; color: string; icon: typeof Clock }> = {
  ASSESSMENT_PENDING: { label: 'Assessment Pending', color: 'bg-gray-100 text-gray-800', icon: Clock },
  ASSESSMENT_COMPLETED: { label: 'Assessment Completed', color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
  ORIENTATION_SCHEDULED: { label: 'Orientation Scheduled', color: 'bg-purple-100 text-purple-800', icon: Calendar },
  ORIENTATION_COMPLETED: { label: 'Orientation Completed', color: 'bg-purple-100 text-purple-800', icon: CheckCircle },
  BUSINESS_FORM_PENDING: { label: 'Business Form Pending', color: 'bg-yellow-100 text-yellow-800', icon: FileText },
  BUSINESS_FORM_SUBMITTED: { label: 'Business Form Submitted', color: 'bg-yellow-100 text-yellow-800', icon: CheckCircle },
  INTERVIEW_SCHEDULED: { label: 'Interview Scheduled', color: 'bg-orange-100 text-orange-800', icon: Calendar },
  INTERVIEW_COMPLETED: { label: 'Interview Completed', color: 'bg-orange-100 text-orange-800', icon: CheckCircle },
  APPROVED: { label: 'Approved', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-800', icon: XCircle },
  ACCEPTANCE_PENDING: { label: 'Acceptance Pending', color: 'bg-indigo-100 text-indigo-800', icon: FileText },
  PAYMENT_PENDING: { label: 'Payment Pending', color: 'bg-amber-100 text-amber-800', icon: DollarSign },
  PAYMENT_COMPLETED: { label: 'Payment Completed', color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle },
  ACCOUNT_CREATED: { label: 'Account Created', color: 'bg-teal-100 text-teal-800', icon: UserPlus },
}

const PIPELINE_STAGES: ProspectStatus[] = [
  'ASSESSMENT_COMPLETED',
  'ORIENTATION_SCHEDULED',
  'ORIENTATION_COMPLETED',
  'BUSINESS_FORM_PENDING',
  'BUSINESS_FORM_SUBMITTED',
  'INTERVIEW_SCHEDULED',
  'INTERVIEW_COMPLETED',
  'APPROVED',
  'ACCEPTANCE_PENDING',
  'PAYMENT_PENDING',
  'PAYMENT_COMPLETED',
  'ACCOUNT_CREATED',
]

export function ProspectsClient({ prospects, stats }: ProspectsClientProps) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<ProspectStatus | ''>('')
  const [viewMode, setViewMode] = useState<'list' | 'pipeline'>('list')

  // Add Prospect Modal State
  const [showAddModal, setShowAddModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [newProspect, setNewProspect] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    referrerName: '',
  })

  // Assessment Link Modal State
  const [showAssessmentLinkModal, setShowAssessmentLinkModal] = useState(false)
  const [assessmentLink, setAssessmentLink] = useState<string | null>(null)
  const [isLoadingLink, setIsLoadingLink] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  const handleGetAssessmentLink = async () => {
    setIsLoadingLink(true)
    setLinkCopied(false)

    const result = await getCoachAssessmentLink()

    if ('error' in result && result.error) {
      setFormError(result.error)
      setIsLoadingLink(false)
      return
    }

    if (result.assessmentLink) {
      const fullLink = `${window.location.origin}${result.assessmentLink}`
      setAssessmentLink(fullLink)
      setShowAssessmentLinkModal(true)
    }
    setIsLoadingLink(false)
  }

  const handleCopyLink = async () => {
    if (assessmentLink) {
      await navigator.clipboard.writeText(assessmentLink)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    }
  }

  const handleAddProspect = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setIsSubmitting(true)

    const result = await createManualProspect({
      firstName: newProspect.firstName.trim(),
      lastName: newProspect.lastName.trim(),
      email: newProspect.email.trim(),
      phone: newProspect.phone.trim() || undefined,
      referrerName: newProspect.referrerName.trim() || undefined,
    })

    if ('error' in result && result.error) {
      setFormError(result.error)
      setIsSubmitting(false)
    } else {
      setShowAddModal(false)
      setNewProspect({ firstName: '', lastName: '', email: '', phone: '', referrerName: '' })
      router.refresh()
      setIsSubmitting(false)
    }
  }

  const filteredProspects = prospects.filter(p => {
    const matchesSearch = searchTerm === '' ||
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.companyName && p.companyName.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesFilter = filterStatus === '' || p.status === filterStatus

    return matchesSearch && matchesFilter
  })

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const getProspectsByStatus = (status: ProspectStatus) => {
    return filteredProspects.filter(p => p.status === status)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Coach Prospects</h1>
          <p className="text-gray-500 mt-1">
            Manage and track prospective coaches through the onboarding pipeline
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleGetAssessmentLink}
            disabled={isLoadingLink}
            className="inline-flex items-center gap-2 px-4 py-2 border border-primary-600 text-primary-600 rounded-lg hover:bg-primary-50 transition-colors font-medium disabled:opacity-50"
          >
            {isLoadingLink ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            Get Assessment Link
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
          >
            <Plus className="h-4 w-4" />
            Add Prospect
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <Users className="h-8 w-8 text-gray-400" />
            <span className="text-2xl font-bold text-gray-900">{stats.total}</span>
          </div>
          <p className="text-sm text-gray-500 mt-2">Total Prospects</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <AlertCircle className="h-8 w-8 text-blue-500" />
            <span className="text-2xl font-bold text-gray-900">{stats.assessmentCompleted}</span>
          </div>
          <p className="text-sm text-gray-500 mt-2">New Assessments</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <Calendar className="h-8 w-8 text-orange-500" />
            <span className="text-2xl font-bold text-gray-900">{stats.interviewPending}</span>
          </div>
          <p className="text-sm text-gray-500 mt-2">Pending Interviews</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <DollarSign className="h-8 w-8 text-amber-500" />
            <span className="text-2xl font-bold text-gray-900">{stats.paymentPending}</span>
          </div>
          <p className="text-sm text-gray-500 mt-2">Awaiting Payment</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <UserPlus className="h-8 w-8 text-green-500" />
            <span className="text-2xl font-bold text-gray-900">{stats.accountCreated}</span>
          </div>
          <p className="text-sm text-gray-500 mt-2">Accounts Created</p>
        </div>
      </div>

      {/* Filters & View Toggle */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex flex-col md:flex-row gap-4 flex-1">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search prospects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as ProspectStatus | '')}
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none bg-white min-w-[200px]"
              >
                <option value="">All Statuses</option>
                {PIPELINE_STAGES.map(status => (
                  <option key={status} value={status}>
                    {STATUS_CONFIG[status].label}
                  </option>
                ))}
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-2 border border-gray-300 rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('pipeline')}
              className={`p-2 rounded ${viewMode === 'pipeline' ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'list' ? (
        /* List View */
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {filteredProspects.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No prospects found</h3>
              <p className="text-gray-500 mt-1">
                {prospects.length === 0
                  ? 'Prospects will appear here when they complete assessments.'
                  : 'Try adjusting your search or filters.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Prospect
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Company
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Assessment Date
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredProspects.map((prospect) => {
                    const statusConfig = STATUS_CONFIG[prospect.status]
                    const StatusIcon = statusConfig.icon
                    return (
                      <tr key={prospect.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-10 w-10 flex-shrink-0 bg-primary-100 rounded-full flex items-center justify-center">
                              <span className="text-primary-700 font-medium">
                                {prospect.firstName[0]}{prospect.lastName[0]}
                              </span>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {prospect.firstName} {prospect.lastName}
                              </div>
                              {prospect.referrerName && (
                                <div className="text-sm text-gray-500">
                                  Referred by: {prospect.referrerName}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center text-sm text-gray-900">
                              <Mail className="h-3 w-3 mr-1 text-gray-400" />
                              {prospect.email}
                            </div>
                            {prospect.phone && (
                              <div className="flex items-center text-sm text-gray-500">
                                <Phone className="h-3 w-3 mr-1 text-gray-400" />
                                {prospect.phone}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusConfig.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {prospect.companyName ? (
                            <div className="flex items-center text-sm text-gray-900">
                              <Building className="h-3 w-3 mr-1 text-gray-400" />
                              {prospect.companyName}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(prospect.assessmentCompletedAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Link
                            href={`/admin/prospects/${prospect.id}`}
                            className="text-primary-600 hover:text-primary-900 inline-flex items-center"
                          >
                            View Details
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Pipeline View */
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {PIPELINE_STAGES.filter(s => s !== 'ASSESSMENT_PENDING').map(status => {
              const stageProspects = getProspectsByStatus(status)
              const statusConfig = STATUS_CONFIG[status]
              const StatusIcon = statusConfig.icon

              return (
                <div
                  key={status}
                  className="w-72 bg-gray-100 rounded-lg p-3 flex-shrink-0"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-700 text-sm flex items-center">
                      <StatusIcon className="h-4 w-4 mr-1" />
                      {statusConfig.label}
                    </h3>
                    <span className="bg-gray-200 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full">
                      {stageProspects.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {stageProspects.length === 0 ? (
                      <div className="bg-white rounded-lg p-3 text-center text-sm text-gray-400 border border-dashed border-gray-300">
                        No prospects
                      </div>
                    ) : (
                      stageProspects.map(prospect => (
                        <Link
                          key={prospect.id}
                          href={`/admin/prospects/${prospect.id}`}
                          className="block bg-white rounded-lg p-3 shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-center mb-2">
                            <div className="h-8 w-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-xs font-medium">
                              {prospect.firstName[0]}{prospect.lastName[0]}
                            </div>
                            <div className="ml-2">
                              <div className="text-sm font-medium text-gray-900">
                                {prospect.firstName} {prospect.lastName}
                              </div>
                            </div>
                          </div>
                          <div className="text-xs text-gray-500">
                            {prospect.email}
                          </div>
                          {prospect.companyName && (
                            <div className="text-xs text-gray-500 mt-1 flex items-center">
                              <Building className="h-3 w-3 mr-1" />
                              {prospect.companyName}
                            </div>
                          )}
                          <div className="text-xs text-gray-400 mt-2">
                            {formatDate(prospect.createdAt)}
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Add Prospect Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Add New Prospect</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleAddProspect} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      required
                      value={newProspect.firstName}
                      onChange={(e) => setNewProspect(prev => ({ ...prev, firstName: e.target.value }))}
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="John"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      required
                      value={newProspect.lastName}
                      onChange={(e) => setNewProspect(prev => ({ ...prev, lastName: e.target.value }))}
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Doe"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={newProspect.email}
                    onChange={(e) => setNewProspect(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="name@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="tel"
                    value={newProspect.phone}
                    onChange={(e) => setNewProspect(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Referrer Name
                </label>
                <div className="relative">
                  <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={newProspect.referrerName}
                    onChange={(e) => setNewProspect(prev => ({ ...prev, referrerName: e.target.value }))}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Who referred them?"
                  />
                </div>
              </div>

              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                  {formError}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Add Prospect
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assessment Link Modal */}
      {showAssessmentLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowAssessmentLinkModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Coach Assessment Link</h2>
              <button
                onClick={() => setShowAssessmentLinkModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-gray-600">
                Share this link with prospective coaches. When they complete the assessment, they will automatically appear in your prospects list.
              </p>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={assessmentLink || ''}
                    className="flex-1 bg-transparent border-none text-sm text-gray-700 focus:ring-0 p-0"
                  />
                  <button
                    onClick={handleCopyLink}
                    className={`p-2 rounded-lg transition-colors ${
                      linkCopied
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    title={linkCopied ? 'Copied!' : 'Copy link'}
                  >
                    {linkCopied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 mb-2">Assessment Questions</h4>
                <ol className="list-decimal list-inside space-y-2 text-sm text-blue-700">
                  <li>Are you passionate about youth development and in what way(s)?</li>
                  <li>Are you committed to your personal success?</li>
                  <li>Are you willing to go through continued transformation in becoming a better version of yourself?</li>
                </ol>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowAssessmentLinkModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
                <a
                  href={assessmentLink || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Preview Assessment
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
