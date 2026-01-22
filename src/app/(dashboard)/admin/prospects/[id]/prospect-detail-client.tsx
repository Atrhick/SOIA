'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Mail,
  Phone,
  Building,
  User,
  Calendar,
  FileText,
  DollarSign,
  CheckCircle,
  XCircle,
  Clock,
  UserPlus,
  Send,
  Copy,
  ExternalLink,
  AlertCircle,
  Loader2,
  Video,
  ClipboardList,
  Briefcase,
  MessageSquare,
  CreditCard,
  Trash2,
} from 'lucide-react'
import { ProspectJourney, ProspectStep } from '@/components/ui/onboarding-journey'
import { ProspectStatus } from '@prisma/client'
import {
  updateProspectStatus,
  completeOrientation,
  generateBusinessFormToken,
  generateOrientationToken,
  scheduleInterview,
  completeInterview,
  generateAcceptanceToken,
  createCoachFromProspect,
  deleteProspect,
  getProspectAssessmentResults,
} from '@/lib/actions/prospects'
import {
  getAvailableOrientationSlots,
  scheduleOrientationFromCalendar,
} from '@/lib/actions/admin-calendars'

interface StatusHistory {
  id: string
  fromStatus: ProspectStatus | null
  toStatus: ProspectStatus
  changedBy: string | null
  notes: string | null
  createdAt: string
}

interface Payment {
  status: string
  amount: number
  method: string
  paidAt: string | null
}

interface Prospect {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  phoneCountryCode: string | null
  referrerName: string | null
  status: ProspectStatus
  assessmentToken: string
  orientationToken: string | null
  businessFormToken: string | null
  acceptanceToken: string | null
  assessmentSurveyId: string | null
  assessmentSubmissionId: string | null
  assessmentCompletedAt: string | null
  orientationScheduledAt: string | null
  orientationCompletedAt: string | null
  orientationNotes: string | null
  companyName: string | null
  bio: string | null
  visionStatement: string | null
  missionStatement: string | null
  servicesInterested: string[]
  proposedCostOfServices: string | null
  businessFormSubmittedAt: string | null
  interviewScheduledAt: string | null
  interviewCompletedAt: string | null
  interviewNotes: string | null
  interviewResult: string | null
  termsAcceptedAt: string | null
  privacyAcceptedAt: string | null
  nonRefundAcknowledgedAt: string | null
  payment: Payment | null
  coachProfileId: string | null
  createdAt: string
  updatedAt: string
  statusHistory: StatusHistory[]
}

interface AssessmentAnswer {
  questionId: string
  questionText: string
  questionType: string
  textResponse: string | null
  likertValue: number | null
  selectedOptions: string[]
  isCorrect: boolean | null
}

interface AssessmentResults {
  surveyTitle: string
  surveyType: string
  submittedAt: string
  score: number | null
  passed: boolean | null
  answers: AssessmentAnswer[]
}

interface ProspectDetailClientProps {
  prospect: Prospect
}

const STATUS_LABELS: Record<ProspectStatus, string> = {
  ASSESSMENT_PENDING: 'Assessment Pending',
  ASSESSMENT_COMPLETED: 'Assessment Completed',
  ORIENTATION_SCHEDULED: 'Orientation Scheduled',
  ORIENTATION_COMPLETED: 'Orientation Completed',
  BUSINESS_FORM_PENDING: 'Business Form Pending',
  BUSINESS_FORM_SUBMITTED: 'Business Form Submitted',
  INTERVIEW_SCHEDULED: 'Interview Scheduled',
  INTERVIEW_COMPLETED: 'Interview Completed',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  ACCEPTANCE_PENDING: 'Acceptance Pending',
  PAYMENT_PENDING: 'Payment Pending',
  PAYMENT_COMPLETED: 'Payment Completed',
  ACCOUNT_CREATED: 'Account Created',
}

interface OrientationSlot {
  date: string
  dayOfWeek: number
  slotId: string
  startTime: string
  endTime: string
  timezone: string
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function ProspectDetailClient({ prospect }: ProspectDetailClientProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showScheduleModal, setShowScheduleModal] = useState<'orientation' | 'interview' | null>(null)
  const [scheduledDate, setScheduledDate] = useState('')
  const [notes, setNotes] = useState('')
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [tempPassword, setTempPassword] = useState<string | null>(null)

  // Orientation slots state
  const [orientationSlots, setOrientationSlots] = useState<OrientationSlot[]>([])
  const [selectedOrientationSlot, setSelectedOrientationSlot] = useState<OrientationSlot | null>(null)
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [orientationMeetingLink, setOrientationMeetingLink] = useState<string | null>(null)
  const [scheduledMeetingLink, setScheduledMeetingLink] = useState<string | null>(null)

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Link modal state
  const [showLinkModal, setShowLinkModal] = useState<'business-form' | 'orientation' | 'acceptance' | null>(null)
  const [modalLink, setModalLink] = useState<string | null>(null)

  // Assessment results state (auto-loaded)
  const [assessmentResults, setAssessmentResults] = useState<AssessmentResults | null>(null)
  const [isLoadingAssessment, setIsLoadingAssessment] = useState(false)

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
  }

  const formatSlotDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // Build prospect journey steps based on current status
  const getStepStatus = (stepStatuses: ProspectStatus[]): ProspectStep['status'] => {
    if (prospect.status === 'REJECTED') {
      // If rejected, mark all steps up to interview as completed, rest as skipped
      const rejectedAfter: ProspectStatus[] = ['APPROVED', 'ACCEPTANCE_PENDING', 'PAYMENT_PENDING', 'PAYMENT_COMPLETED', 'ACCOUNT_CREATED']
      if (stepStatuses.some(s => rejectedAfter.includes(s))) return 'skipped'
    }

    const statusOrder: ProspectStatus[] = [
      'ASSESSMENT_PENDING', 'ASSESSMENT_COMPLETED',
      'ORIENTATION_SCHEDULED', 'ORIENTATION_COMPLETED',
      'BUSINESS_FORM_PENDING', 'BUSINESS_FORM_SUBMITTED',
      'INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED',
      'APPROVED', 'REJECTED',
      'ACCEPTANCE_PENDING', 'PAYMENT_PENDING', 'PAYMENT_COMPLETED', 'ACCOUNT_CREATED'
    ]

    const currentIndex = statusOrder.indexOf(prospect.status)
    const stepIndices = stepStatuses.map(s => statusOrder.indexOf(s))
    const maxStepIndex = Math.max(...stepIndices)
    const minStepIndex = Math.min(...stepIndices)

    if (currentIndex > maxStepIndex) return 'completed'
    if (currentIndex >= minStepIndex && currentIndex <= maxStepIndex) return 'current'
    return 'pending'
  }

  const preOnboardingSteps: ProspectStep[] = [
    { id: 'assessment', title: 'Assessment', shortTitle: 'Assessment', icon: ClipboardList, status: getStepStatus(['ASSESSMENT_PENDING', 'ASSESSMENT_COMPLETED']) },
    { id: 'orientation', title: 'Orientation', shortTitle: 'Orientation', icon: Video, status: getStepStatus(['ORIENTATION_SCHEDULED', 'ORIENTATION_COMPLETED']) },
    { id: 'business-form', title: 'Business Form', shortTitle: 'Biz Form', icon: Briefcase, status: getStepStatus(['BUSINESS_FORM_PENDING', 'BUSINESS_FORM_SUBMITTED']) },
    { id: 'interview', title: 'Interview', shortTitle: 'Interview', icon: MessageSquare, status: getStepStatus(['INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED']) },
    { id: 'decision', title: 'Decision', shortTitle: 'Decision', icon: prospect.status === 'REJECTED' ? XCircle : CheckCircle, status: getStepStatus(['APPROVED', 'REJECTED']) },
  ]

  const onboardingSteps: ProspectStep[] = [
    { id: 'acceptance', title: 'Acceptance', shortTitle: 'Accept', icon: FileText, status: getStepStatus(['ACCEPTANCE_PENDING']) },
    { id: 'payment', title: 'Payment', shortTitle: 'Payment', icon: CreditCard, status: getStepStatus(['PAYMENT_PENDING', 'PAYMENT_COMPLETED']) },
    { id: 'account', title: 'Account Created', shortTitle: 'Account', icon: UserPlus, status: getStepStatus(['ACCOUNT_CREATED']) },
  ]

  // Fetch available orientation slots when modal opens
  const fetchOrientationSlots = useCallback(async () => {
    setIsLoadingSlots(true)
    setError(null)
    try {
      const result = await getAvailableOrientationSlots(30)
      if (result.error) {
        setError(result.error)
      } else if (result.slots) {
        setOrientationSlots(result.slots)
        setOrientationMeetingLink(result.meetingLink || null)
      }
    } catch {
      setError('Failed to load available slots')
    } finally {
      setIsLoadingSlots(false)
    }
  }, [])

  // Auto-load assessment results on mount if prospect has completed assessment
  // (either has assessmentSubmissionId or assessmentCompletedAt indicating they took the assessment)
  useEffect(() => {
    const shouldLoadAssessment = (prospect.assessmentSubmissionId || prospect.assessmentCompletedAt) && !assessmentResults
    if (shouldLoadAssessment) {
      const loadAssessment = async () => {
        setIsLoadingAssessment(true)
        const result = await getProspectAssessmentResults(prospect.id)
        if (result.results) {
          setAssessmentResults(result.results)
        }
        setIsLoadingAssessment(false)
      }
      loadAssessment()
    }
  }, [prospect.assessmentSubmissionId, prospect.assessmentCompletedAt, prospect.id, assessmentResults])

  useEffect(() => {
    if (showScheduleModal === 'orientation') {
      fetchOrientationSlots()
      setSelectedOrientationSlot(null)
      setScheduledMeetingLink(null)
    }
  }, [showScheduleModal, fetchOrientationSlots])

  const handleScheduleOrientation = async () => {
    if (!selectedOrientationSlot) return
    setIsLoading(true)
    setError(null)

    const result = await scheduleOrientationFromCalendar(
      prospect.id,
      selectedOrientationSlot.slotId,
      selectedOrientationSlot.date
    )
    if ('error' in result && result.error) {
      setError(result.error)
      setIsLoading(false)
    } else {
      // Store meeting link to show in success modal
      setScheduledMeetingLink(result.meetingLink || null)
      setSuccess('Orientation scheduled successfully')
      setIsLoading(false)
      // Refresh the page data
      router.refresh()
    }
  }

  const handleCompleteOrientation = async () => {
    setIsLoading(true)
    setError(null)

    const result = await completeOrientation(prospect.id, notes)
    if ('error' in result && result.error) {
      setError(result.error)
    } else {
      setSuccess('Orientation marked as completed')
      router.refresh()
    }
    setIsLoading(false)
  }

  const handleGenerateBusinessFormLink = async () => {
    setIsLoading(true)
    setError(null)

    const result = await generateBusinessFormToken(prospect.id)
    if (result.error) {
      setError(result.error)
    } else if (result.token) {
      const link = `${window.location.origin}/business-form/${result.token}`
      setModalLink(link)
      setShowLinkModal('business-form')
      router.refresh()
    }
    setIsLoading(false)
  }

  const handleSendEmail = (link: string, type: 'business-form' | 'orientation' | 'acceptance') => {
    const subject = type === 'business-form'
      ? 'Complete Your Business Development Form - Stage One In Action'
      : type === 'orientation'
        ? 'Schedule Your Orientation - Stage One In Action'
        : 'Acceptance Letter & Payment - Stage One In Action'

    const body = type === 'business-form'
      ? `Hi ${prospect.firstName},\n\nPlease complete your Business Development Form using the link below:\n\n${link}\n\nThis form helps us understand your business goals and how we can best support you.\n\nBest regards,\nStage One In Action Team`
      : type === 'orientation'
        ? `Hi ${prospect.firstName},\n\nPlease schedule your orientation using the link below:\n\n${link}\n\nWe look forward to meeting with you!\n\nBest regards,\nStage One In Action Team`
        : `Hi ${prospect.firstName},\n\nCongratulations! Please review your acceptance letter and complete your payment using the link below:\n\n${link}\n\nWe're excited to have you join us!\n\nBest regards,\nStage One In Action Team`

    const mailtoLink = `mailto:${prospect.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.open(mailtoLink, '_blank')
  }

  const handleScheduleInterview = async () => {
    if (!scheduledDate) return
    setIsLoading(true)
    setError(null)

    const result = await scheduleInterview(prospect.id, new Date(scheduledDate))
    if ('error' in result && result.error) {
      setError(result.error)
    } else {
      setSuccess('Interview scheduled successfully')
      setShowScheduleModal(null)
      router.refresh()
    }
    setIsLoading(false)
  }

  const handleCompleteInterview = async (interviewResult: 'APPROVED' | 'REJECTED') => {
    setIsLoading(true)
    setError(null)

    const result = await completeInterview(prospect.id, interviewResult, notes)
    if ('error' in result && result.error) {
      setError(result.error)
    } else {
      setSuccess(`Interview completed - Prospect ${interviewResult.toLowerCase()}`)
      router.refresh()
    }
    setIsLoading(false)
  }

  const handleGenerateAcceptanceLink = async () => {
    setIsLoading(true)
    setError(null)

    const result = await generateAcceptanceToken(prospect.id)
    if (result.error) {
      setError(result.error)
    } else if (result.token) {
      const link = `${window.location.origin}/acceptance/${result.token}`
      setGeneratedLink(link)
      setSuccess('Acceptance link generated')
      router.refresh()
    }
    setIsLoading(false)
  }

  const handleCreateAccount = async () => {
    setIsLoading(true)
    setError(null)

    const result = await createCoachFromProspect(prospect.id)
    if (result.error) {
      setError(result.error)
    } else {
      setSuccess('Coach account created successfully')
      if (result.tempPassword) {
        setTempPassword(result.tempPassword)
      }
      router.refresh()
    }
    setIsLoading(false)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setSuccess('Copied to clipboard')
    setTimeout(() => setSuccess(null), 2000)
  }

  const handleDeleteProspect = async () => {
    setIsDeleting(true)
    setError(null)

    const result = await deleteProspect(prospect.id)
    if (result.error) {
      setError(result.error)
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    } else {
      // Redirect to prospects list after successful deletion
      router.push('/admin/prospects')
    }
  }


  const getNextActions = () => {
    switch (prospect.status) {
      case 'ASSESSMENT_COMPLETED':
        return (
          <button
            onClick={() => setShowScheduleModal('orientation')}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Schedule Orientation
          </button>
        )
      case 'ORIENTATION_SCHEDULED':
        return (
          <button
            onClick={handleCompleteOrientation}
            disabled={isLoading}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Mark Orientation Complete
          </button>
        )
      case 'ORIENTATION_COMPLETED':
        return prospect.businessFormToken ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Business form link sent</span>
            <button
              onClick={() => {
                const link = `${window.location.origin}/business-form/${prospect.businessFormToken}`
                copyToClipboard(link)
              }}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Copy className="h-4 w-4 mr-1" />
              Copy Link
            </button>
          </div>
        ) : (
          <button
            onClick={handleGenerateBusinessFormLink}
            disabled={isLoading}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
          >
            <Send className="h-4 w-4 mr-2" />
            Generate Business Form Link
          </button>
        )
      case 'BUSINESS_FORM_PENDING':
        return (
          <div className="flex items-center gap-2">
            <span className="text-sm text-amber-600">Waiting for prospect to complete form</span>
            {prospect.businessFormToken && (
              <button
                onClick={() => {
                  const link = `${window.location.origin}/business-form/${prospect.businessFormToken}`
                  copyToClipboard(link)
                }}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Copy className="h-4 w-4 mr-1" />
                Copy Link
              </button>
            )}
          </div>
        )
      case 'BUSINESS_FORM_SUBMITTED':
        return (
          <button
            onClick={() => setShowScheduleModal('interview')}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Schedule Interview
          </button>
        )
      case 'INTERVIEW_SCHEDULED':
        return (
          <div className="flex gap-2">
            <button
              onClick={() => handleCompleteInterview('APPROVED')}
              disabled={isLoading}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve
            </button>
            <button
              onClick={() => handleCompleteInterview('REJECTED')}
              disabled={isLoading}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </button>
          </div>
        )
      case 'APPROVED':
        return prospect.acceptanceToken ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Acceptance letter sent</span>
            <button
              onClick={() => {
                const link = `${window.location.origin}/acceptance/${prospect.acceptanceToken}`
                copyToClipboard(link)
              }}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Copy className="h-4 w-4 mr-1" />
              Copy Link
            </button>
          </div>
        ) : (
          <button
            onClick={handleGenerateAcceptanceLink}
            disabled={isLoading}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
          >
            <Send className="h-4 w-4 mr-2" />
            Send Acceptance Letter
          </button>
        )
      case 'ACCEPTANCE_PENDING':
      case 'PAYMENT_PENDING':
        return prospect.acceptanceToken ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-amber-600">
              {prospect.status === 'ACCEPTANCE_PENDING'
                ? 'Waiting for prospect to accept terms'
                : 'Waiting for payment'}
            </span>
            <button
              onClick={() => {
                const link = `${window.location.origin}/acceptance/${prospect.acceptanceToken}`
                copyToClipboard(link)
              }}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Copy className="h-4 w-4 mr-1" />
              Copy Link
            </button>
          </div>
        ) : null
      case 'PAYMENT_COMPLETED':
        return (
          <button
            onClick={handleCreateAccount}
            disabled={isLoading}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Create Coach Account
          </button>
        )
      case 'ACCOUNT_CREATED':
        return (
          <Link
            href={`/admin/coaches`}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View Coach Profile
          </Link>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/prospects"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {prospect.firstName} {prospect.lastName}
            </h1>
            <p className="text-gray-500">{prospect.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {getNextActions()}

          {/* Delete Button - only show if account not created */}
          {!prospect.coachProfileId && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center px-3 py-2 border border-red-300 rounded-md text-sm font-medium text-red-700 bg-white hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-3" />
          <p className="text-red-700">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start">
          <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-3" />
          <p className="text-green-700">{success}</p>
        </div>
      )}

      {/* Generated Link */}
      {generatedLink && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-700 mb-2">Generated Link (send this to the prospect):</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={generatedLink}
              readOnly
              className="flex-1 px-3 py-2 bg-white border border-blue-300 rounded-lg text-sm"
            />
            <button
              onClick={() => copyToClipboard(generatedLink)}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Temp Password */}
      {tempPassword && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-700 mb-2">Temporary Password (share securely with the new coach):</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={tempPassword}
              readOnly
              className="flex-1 px-3 py-2 bg-white border border-amber-300 rounded-lg text-sm font-mono"
            />
            <button
              onClick={() => copyToClipboard(tempPassword)}
              className="px-3 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Prospect Journey Progress */}
      <ProspectJourney
        preOnboardingSteps={preOnboardingSteps}
        onboardingSteps={onboardingSteps}
        coachProfileId={prospect.coachProfileId}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Information */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">Email</label>
                <div className="flex items-center text-gray-900">
                  <Mail className="h-4 w-4 mr-2 text-gray-400" />
                  {prospect.email}
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-500">Phone</label>
                <div className="flex items-center text-gray-900">
                  <Phone className="h-4 w-4 mr-2 text-gray-400" />
                  {prospect.phone || '-'}
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-500">Referred By</label>
                <div className="flex items-center text-gray-900">
                  <User className="h-4 w-4 mr-2 text-gray-400" />
                  {prospect.referrerName || '-'}
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-500">Created</label>
                <div className="flex items-center text-gray-900">
                  <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                  {formatDate(prospect.createdAt)}
                </div>
              </div>
            </div>
          </div>

          {/* Assessment Responses - Always show this section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary-600" />
                <h2 className="text-lg font-semibold text-gray-900">Assessment Responses</h2>
              </div>
              {prospect.assessmentCompletedAt && (
                <span className="text-sm text-gray-500">
                  Completed {formatDate(prospect.assessmentCompletedAt)}
                </span>
              )}
            </div>

            {isLoadingAssessment ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
                <span className="ml-2 text-gray-500">Loading assessment responses...</span>
              </div>
            ) : assessmentResults && assessmentResults.answers.length > 0 ? (
              <div className="space-y-4">
                {assessmentResults.answers.map((answer, index) => (
                  <div key={answer.questionId} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 mb-2">
                          {answer.questionText}
                        </p>
                        <div className="bg-gray-50 rounded-lg p-3">
                          {answer.textResponse ? (
                            <p className="text-gray-700 whitespace-pre-wrap">{answer.textResponse}</p>
                          ) : answer.likertValue !== null ? (
                            <p className="text-gray-700">Rating: {answer.likertValue}</p>
                          ) : answer.selectedOptions.length > 0 ? (
                            <ul className="list-disc list-inside text-gray-700">
                              {answer.selectedOptions.map((opt, i) => (
                                <li key={i}>{opt}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-gray-400 italic">No response provided</p>
                          )}
                        </div>
                        {answer.isCorrect !== null && (
                          <div className={`mt-2 text-sm ${answer.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                            {answer.isCorrect ? (
                              <span className="flex items-center gap-1">
                                <CheckCircle className="h-4 w-4" /> Correct
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <XCircle className="h-4 w-4" /> Incorrect
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : !prospect.assessmentCompletedAt && !prospect.assessmentSubmissionId ? (
              <div className="text-center py-6 bg-gray-50 rounded-lg">
                <ClipboardList className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 font-medium">No Assessment Submission</p>
                <p className="text-sm text-gray-400 mt-1">
                  This prospect was added manually without completing the assessment form.
                </p>
              </div>
            ) : (
              <div className="text-center py-6 bg-gray-50 rounded-lg">
                <AlertCircle className="h-10 w-10 text-amber-400 mx-auto mb-2" />
                <p className="text-gray-500 font-medium">Assessment Data Not Found</p>
                <p className="text-sm text-gray-400 mt-1">
                  The assessment responses could not be located. The prospect may have completed the assessment before data linking was implemented.
                </p>
              </div>
            )}
          </div>

          {/* Interview Information - Show if any interview data exists */}
          {(prospect.interviewScheduledAt || prospect.interviewCompletedAt || prospect.interviewNotes || prospect.interviewResult) && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="h-5 w-5 text-primary-600" />
                <h2 className="text-lg font-semibold text-gray-900">Interview Information</h2>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {prospect.interviewScheduledAt && (
                    <div>
                      <label className="text-sm text-gray-500">Scheduled</label>
                      <div className="flex items-center text-gray-900">
                        <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                        {formatDate(prospect.interviewScheduledAt)}
                      </div>
                    </div>
                  )}
                  {prospect.interviewCompletedAt && (
                    <div>
                      <label className="text-sm text-gray-500">Completed</label>
                      <div className="flex items-center text-gray-900">
                        <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                        {formatDate(prospect.interviewCompletedAt)}
                      </div>
                    </div>
                  )}
                  {prospect.interviewResult && (
                    <div>
                      <label className="text-sm text-gray-500">Result</label>
                      <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${
                        prospect.interviewResult === 'APPROVED'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {prospect.interviewResult === 'APPROVED' ? (
                          <CheckCircle className="h-4 w-4 mr-1" />
                        ) : (
                          <XCircle className="h-4 w-4 mr-1" />
                        )}
                        {prospect.interviewResult}
                      </div>
                    </div>
                  )}
                </div>
                {prospect.interviewNotes && (
                  <div>
                    <label className="text-sm text-gray-500">Interview Notes</label>
                    <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                      <p className="text-gray-700 whitespace-pre-wrap">{prospect.interviewNotes}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Business Information - Always show with status */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-primary-600" />
                <h2 className="text-lg font-semibold text-gray-900">Business Development Form</h2>
              </div>
              {prospect.businessFormSubmittedAt && (
                <span className="text-sm text-gray-500">
                  Submitted {formatDate(prospect.businessFormSubmittedAt)}
                </span>
              )}
            </div>

            {prospect.companyName || prospect.bio || prospect.visionStatement ? (
              <div className="space-y-4">
                {prospect.companyName && (
                  <div>
                    <label className="text-sm text-gray-500">Company Name</label>
                    <div className="flex items-center text-gray-900 mt-1">
                      <Building className="h-4 w-4 mr-2 text-gray-400" />
                      {prospect.companyName}
                    </div>
                  </div>
                )}
                {prospect.bio && (
                  <div>
                    <label className="text-sm text-gray-500">Bio</label>
                    <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                      <p className="text-gray-700 whitespace-pre-wrap">{prospect.bio}</p>
                    </div>
                  </div>
                )}
                {prospect.visionStatement && (
                  <div>
                    <label className="text-sm text-gray-500">Vision Statement</label>
                    <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                      <p className="text-gray-700 whitespace-pre-wrap">{prospect.visionStatement}</p>
                    </div>
                  </div>
                )}
                {prospect.missionStatement && (
                  <div>
                    <label className="text-sm text-gray-500">Mission Statement</label>
                    <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                      <p className="text-gray-700 whitespace-pre-wrap">{prospect.missionStatement}</p>
                    </div>
                  </div>
                )}
                {prospect.servicesInterested.length > 0 && (
                  <div>
                    <label className="text-sm text-gray-500">Services Interested</label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {prospect.servicesInterested.map((service, i) => (
                        <span
                          key={i}
                          className="px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-sm font-medium"
                        >
                          {service}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {prospect.proposedCostOfServices && (
                  <div>
                    <label className="text-sm text-gray-500">Proposed Pricing</label>
                    <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                      <p className="text-gray-700 whitespace-pre-wrap">{prospect.proposedCostOfServices}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6 bg-gray-50 rounded-lg">
                <Briefcase className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 font-medium">Not Yet Submitted</p>
                <p className="text-sm text-gray-400 mt-1">
                  {prospect.businessFormToken
                    ? 'Business development form link has been sent. Waiting for prospect to complete it.'
                    : 'Business development form has not been requested yet.'}
                </p>
              </div>
            )}
          </div>

          {/* Orientation Information - Show if any orientation data exists */}
          {(prospect.orientationScheduledAt || prospect.orientationCompletedAt || prospect.orientationNotes) && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Video className="h-5 w-5 text-primary-600" />
                <h2 className="text-lg font-semibold text-gray-900">Orientation Information</h2>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {prospect.orientationScheduledAt && (
                    <div>
                      <label className="text-sm text-gray-500">Scheduled</label>
                      <div className="flex items-center text-gray-900">
                        <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                        {formatDate(prospect.orientationScheduledAt)}
                      </div>
                    </div>
                  )}
                  {prospect.orientationCompletedAt && (
                    <div>
                      <label className="text-sm text-gray-500">Completed</label>
                      <div className="flex items-center text-gray-900">
                        <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                        {formatDate(prospect.orientationCompletedAt)}
                      </div>
                    </div>
                  )}
                </div>
                {prospect.orientationNotes && (
                  <div>
                    <label className="text-sm text-gray-500">Orientation Notes</label>
                    <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                      <p className="text-gray-700 whitespace-pre-wrap">{prospect.orientationNotes}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Terms & Payment Information */}
          {(prospect.termsAcceptedAt || prospect.payment) && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="h-5 w-5 text-primary-600" />
                <h2 className="text-lg font-semibold text-gray-900">Acceptance & Payment</h2>
              </div>
              <div className="space-y-4">
                {/* Terms Acceptance */}
                {prospect.termsAcceptedAt && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm text-gray-500">Terms Accepted</label>
                      <div className="flex items-center text-green-600 mt-1">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        {formatDate(prospect.termsAcceptedAt)}
                      </div>
                    </div>
                    {prospect.privacyAcceptedAt && (
                      <div>
                        <label className="text-sm text-gray-500">Privacy Accepted</label>
                        <div className="flex items-center text-green-600 mt-1">
                          <CheckCircle className="h-4 w-4 mr-2" />
                          {formatDate(prospect.privacyAcceptedAt)}
                        </div>
                      </div>
                    )}
                    {prospect.nonRefundAcknowledgedAt && (
                      <div>
                        <label className="text-sm text-gray-500">Refund Policy Acknowledged</label>
                        <div className="flex items-center text-green-600 mt-1">
                          <CheckCircle className="h-4 w-4 mr-2" />
                          {formatDate(prospect.nonRefundAcknowledgedAt)}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Payment Info */}
                {prospect.payment && (
                  <div className="pt-4 border-t border-gray-100">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Payment Details</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <label className="text-sm text-gray-500">Amount</label>
                        <div className="flex items-center text-gray-900 mt-1">
                          <DollarSign className="h-4 w-4 mr-1 text-gray-400" />
                          {prospect.payment.amount.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm text-gray-500">Method</label>
                        <div className="text-gray-900 mt-1">{prospect.payment.method}</div>
                      </div>
                      <div>
                        <label className="text-sm text-gray-500">Status</label>
                        <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${
                          prospect.payment.status === 'COMPLETED'
                            ? 'bg-green-100 text-green-800'
                            : prospect.payment.status === 'FAILED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                        }`}>
                          {prospect.payment.status}
                        </div>
                      </div>
                      {prospect.payment.paidAt && (
                        <div>
                          <label className="text-sm text-gray-500">Paid</label>
                          <div className="text-gray-900 mt-1">{formatDate(prospect.payment.paidAt)}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Generated Links Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Prospect Links</h2>
            <p className="text-sm text-gray-500 mb-4">
              Share these links with the prospect to complete their onboarding steps.
            </p>
            <div className="space-y-3">
              {/* Orientation Booking Link - show after assessment completion */}
              {prospect.assessmentCompletedAt && !prospect.orientationCompletedAt && (
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                  <div>
                    <p className="text-sm font-medium text-green-800">Orientation Booking</p>
                    <p className="text-xs text-green-600">
                      {prospect.orientationToken
                        ? 'Prospect can self-schedule their orientation call'
                        : 'Generate a secure link for the prospect to book orientation'
                      }
                    </p>
                  </div>
                  {prospect.orientationToken ? (
                    <button
                      onClick={() => {
                        const link = `${window.location.origin}/book/orientation/${prospect.orientationToken}`
                        copyToClipboard(link)
                      }}
                      className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700"
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy Link
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        setIsLoading(true)
                        const result = await generateOrientationToken(prospect.id)
                        if (result.error) {
                          setError(result.error)
                        } else if (result.token) {
                          const link = `${window.location.origin}/book/orientation/${result.token}`
                          copyToClipboard(link)
                          router.refresh()
                        }
                        setIsLoading(false)
                      }}
                      disabled={isLoading}
                      className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                    >
                      <Send className="h-4 w-4 mr-1" />
                      Generate Link
                    </button>
                  )}
                </div>
              )}
              {prospect.businessFormToken && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Business Development Form</p>
                    <p className="text-xs text-gray-500 truncate max-w-md">
                      /business-form/{prospect.businessFormToken}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const link = `${window.location.origin}/business-form/${prospect.businessFormToken}`
                      copyToClipboard(link)
                    }}
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-white"
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </button>
                </div>
              )}
              {prospect.acceptanceToken && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Acceptance & Payment</p>
                    <p className="text-xs text-gray-500 truncate max-w-md">
                      /acceptance/{prospect.acceptanceToken}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const link = `${window.location.origin}/acceptance/${prospect.acceptanceToken}`
                      copyToClipboard(link)
                    }}
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-white"
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </button>
                </div>
              )}
              {/* Show message if no links available yet */}
              {!prospect.assessmentCompletedAt && !prospect.businessFormToken && !prospect.acceptanceToken && (
                <p className="text-sm text-gray-500 italic">
                  Links will appear here as the prospect progresses through onboarding.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Status</h2>
            <div className="text-center py-4">
              <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
                prospect.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                prospect.status === 'ACCOUNT_CREATED' ? 'bg-green-100 text-green-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {STATUS_LABELS[prospect.status]}
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Status History</h2>
            <div className="space-y-4">
              {prospect.statusHistory.map((history, index) => (
                <div key={history.id} className="relative pl-6">
                  {index !== prospect.statusHistory.length - 1 && (
                    <div className="absolute left-2 top-6 bottom-0 w-0.5 bg-gray-200" />
                  )}
                  <div className="absolute left-0 top-1.5 h-4 w-4 rounded-full bg-primary-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {STATUS_LABELS[history.toStatus]}
                    </p>
                    {history.notes && (
                      <p className="text-sm text-gray-500 mt-0.5">{history.notes}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDate(history.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Notes</h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Enter notes for the next action..."
            />
          </div>
        </div>
      </div>

      {/* Schedule Orientation Modal */}
      {showScheduleModal === 'orientation' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Schedule Orientation
            </h3>

            {/* Show success state with meeting link */}
            {scheduledMeetingLink ? (
              <div className="space-y-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-green-800">Orientation Scheduled!</span>
                  </div>
                  <p className="text-sm text-green-700 mb-3">
                    Share this meeting link with the prospect:
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={scheduledMeetingLink}
                      readOnly
                      className="flex-1 px-3 py-2 bg-white border border-green-300 rounded-lg text-sm"
                    />
                    <button
                      onClick={() => copyToClipboard(scheduledMeetingLink)}
                      className="p-2 text-green-600 hover:bg-green-100 rounded-lg"
                    >
                      <Copy className="w-5 h-5" />
                    </button>
                    <a
                      href={scheduledMeetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-green-600 hover:bg-green-100 rounded-lg"
                    >
                      <ExternalLink className="w-5 h-5" />
                    </a>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setShowScheduleModal(null)
                      setScheduledMeetingLink(null)
                      setSelectedOrientationSlot(null)
                      router.refresh()
                    }}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {isLoadingSlots ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                    <span className="ml-2 text-gray-500">Loading available slots...</span>
                  </div>
                ) : orientationSlots.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500">No available slots in the next 30 days.</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Please configure slots on the orientation calendar.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-600">
                      Select an available time slot:
                    </p>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {orientationSlots.map((slot) => (
                        <button
                          key={`${slot.date}-${slot.slotId}`}
                          onClick={() => setSelectedOrientationSlot(slot)}
                          className={`w-full p-3 text-left rounded-lg border-2 transition-colors ${
                            selectedOrientationSlot?.date === slot.date && selectedOrientationSlot?.slotId === slot.slotId
                              ? 'border-primary-500 bg-primary-50'
                              : 'border-gray-200 hover:border-primary-300'
                          }`}
                        >
                          <div className="font-medium text-gray-900">
                            {formatSlotDate(slot.date)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {formatTime(slot.startTime)} - {formatTime(slot.endTime)} ({slot.timezone})
                          </div>
                        </button>
                      ))}
                    </div>

                    {orientationMeetingLink && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center gap-2 text-blue-800">
                          <Video className="w-4 h-4" />
                          <span className="text-sm font-medium">Meeting link will be provided after scheduling</span>
                        </div>
                      </div>
                    )}

                    {error && (
                      <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">
                        {error}
                      </div>
                    )}
                  </>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button
                    onClick={() => setShowScheduleModal(null)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleScheduleOrientation}
                    disabled={!selectedOrientationSlot || isLoading}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
                  >
                    {isLoading ? 'Scheduling...' : 'Schedule Orientation'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Schedule Interview Modal */}
      {showScheduleModal === 'interview' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Schedule Interview
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowScheduleModal(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleScheduleInterview}
                  disabled={!scheduledDate || isLoading}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
                >
                  {isLoading ? 'Scheduling...' : 'Schedule'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                Delete Prospect
              </h3>
            </div>
            <p className="text-gray-600 mb-2">
              Are you sure you want to delete this prospect?
            </p>
            <p className="text-sm text-gray-500 mb-4">
              <strong>{prospect.firstName} {prospect.lastName}</strong> ({prospect.email})
            </p>
            <p className="text-sm text-red-600 mb-6">
              This action cannot be undone. All data associated with this prospect will be permanently deleted.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteProspect}
                disabled={isDeleting}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin inline" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2 inline" />
                    Delete Prospect
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link Generated Modal */}
      {showLinkModal && modalLink && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                {showLinkModal === 'business-form' && 'Business Form Link Generated'}
                {showLinkModal === 'orientation' && 'Orientation Link Generated'}
                {showLinkModal === 'acceptance' && 'Acceptance Link Generated'}
              </h3>
            </div>
            <p className="text-gray-600 mb-4">
              Send this link to <strong>{prospect.firstName} {prospect.lastName}</strong> ({prospect.email})
            </p>

            {/* Link Display */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-gray-600 break-all font-mono">{modalLink}</p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(modalLink)
                  setSuccess('Link copied to clipboard!')
                }}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Link
              </button>
              <button
                onClick={() => handleSendEmail(modalLink, showLinkModal)}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
              >
                <Mail className="h-4 w-4 mr-2" />
                Send Email
              </button>
            </div>

            {/* Close Button */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowLinkModal(null)
                  setModalLink(null)
                }}
                className="w-full px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
