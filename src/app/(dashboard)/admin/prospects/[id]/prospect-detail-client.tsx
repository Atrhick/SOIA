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
  RefreshCw,
} from 'lucide-react'
import { ProspectJourney, ProspectStep } from '@/components/ui/onboarding-journey'
import { ProspectStatus } from '@prisma/client'
import {
  updateProspectStatus,
  completeOrientation,
  generateBusinessFormToken,
  generateOrientationToken,
  generateBizDevInterviewToken,
  completeInterview,
  cancelInterviewBooking,
  checkPriorBookingAvailability,
  revertInterviewDecision,
  generateAcceptanceToken,
  createCoachFromProspect,
  deleteProspect,
  getProspectAssessmentResults,
} from '@/lib/actions/prospects'
import {
  getAvailableOrientationSlots,
  scheduleOrientationFromCalendar,
  scheduleInterviewDirect,
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

interface ServicePackage {
  id: string
  name: string
  description: string
  price: string
  duration?: string
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
  bizDevInterviewToken: string | null
  acceptanceToken: string | null
  assessmentSurveyId: string | null
  assessmentSubmissionId: string | null
  assessmentCompletedAt: string | null
  orientationScheduledAt: string | null
  orientationCompletedAt: string | null
  orientationNotes: string | null
  // Business Form - Legacy fields
  companyName: string | null
  bio: string | null
  visionStatement: string | null
  missionStatement: string | null
  servicesInterested: string[]
  proposedCostOfServices: string | null
  // Business Form - New fields
  tagline: string | null
  businessType: string | null
  businessTypeOther: string | null
  websiteUrl: string | null
  needsWebsiteHelp: boolean | null
  instagramHandle: string | null
  facebookHandle: string | null
  linkedinHandle: string | null
  tiktokHandle: string | null
  servicePackages: ServicePackage[] | null
  idealClient: string | null
  uniqueValue: string | null
  certifications: string | null
  threeYearRevenueGoal: string | null
  threeYearClientGoal: string | null
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
  interviewBooking: {
    id: string
    calendarId: string
    startTime: string
    endTime: string
    meetingLink: string | null
  } | null
  interviewBookingHistory: {
    id: string
    status: string
    startTime: string
    endTime: string
    createdAt: string
    cancellationReason: string | null
  }[]
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
  INTERVIEW_SCHEDULED: 'Biz Dev Interview Scheduled',
  INTERVIEW_COMPLETED: 'Biz Dev Interview Completed',
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

  // Interview direct scheduling state
  const [interviewDate, setInterviewDate] = useState('')
  const [interviewStartTime, setInterviewStartTime] = useState('')
  const [interviewEndTime, setInterviewEndTime] = useState('')

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Cancel interview state
  const [showCancelInterviewConfirm, setShowCancelInterviewConfirm] = useState(false)
  const [isCancellingInterview, setIsCancellingInterview] = useState(false)

  // Interview decision modal state
  const [showDecisionModal, setShowDecisionModal] = useState<'APPROVED' | 'REJECTED' | null>(null)
  const [decisionNotes, setDecisionNotes] = useState('')

  // Link modal state
  const [showLinkModal, setShowLinkModal] = useState<'business-form' | 'orientation' | 'biz-dev-interview' | 'acceptance' | null>(null)
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
      // If rejected, mark the decision step as rejected, skip everything after
      const rejectedAfter: ProspectStatus[] = ['ACCEPTANCE_PENDING', 'PAYMENT_PENDING', 'PAYMENT_COMPLETED', 'ACCOUNT_CREATED']
      if (stepStatuses.some(s => rejectedAfter.includes(s))) return 'skipped'
      if (stepStatuses.includes('APPROVED') || stepStatuses.includes('REJECTED')) return 'rejected'
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

    if (currentIndex >= maxStepIndex) return 'completed'
    if (currentIndex === minStepIndex - 1) return 'current'
    if (currentIndex >= minStepIndex) return 'current'
    return 'pending'
  }

  const preOnboardingSteps: ProspectStep[] = [
    { id: 'assessment', title: 'Assessment', shortTitle: 'Assessment', icon: ClipboardList, status: getStepStatus(['ASSESSMENT_PENDING', 'ASSESSMENT_COMPLETED']) },
    { id: 'orientation', title: 'Orientation', shortTitle: 'Orientation', icon: Video, status: getStepStatus(['ORIENTATION_SCHEDULED', 'ORIENTATION_COMPLETED']) },
    { id: 'business-form', title: 'Business Form', shortTitle: 'Biz Form', icon: Briefcase, status: getStepStatus(['BUSINESS_FORM_PENDING', 'BUSINESS_FORM_SUBMITTED']) },
    { id: 'interview', title: 'Biz Dev Interview', shortTitle: 'Biz Dev', icon: MessageSquare, status: getStepStatus(['INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED']) },
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

  // Fetch available interview slots when modal opens
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

  useEffect(() => {
    if (showScheduleModal === 'interview') {
      // Reset date/time fields when modal opens
      setInterviewDate('')
      setInterviewStartTime('')
      setInterviewEndTime('')
    }
  }, [showScheduleModal])

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

  const handleSendEmail = (link: string, type: 'business-form' | 'orientation' | 'biz-dev-interview' | 'acceptance') => {
    let subject: string
    let body: string

    switch (type) {
      case 'business-form':
        subject = 'Complete Your Business Development Form - Stage One In Action'
        body = `Hi ${prospect.firstName},\n\nPlease complete your Business Development Form using the link below:\n\n${link}\n\nThis form helps us understand your business goals and how we can best support you.\n\nBest regards,\nStage One In Action Team`
        break
      case 'orientation':
        subject = 'Schedule Your Orientation - Stage One In Action'
        body = `Hi ${prospect.firstName},\n\nPlease schedule your orientation using the link below:\n\n${link}\n\nWe look forward to meeting with you!\n\nBest regards,\nStage One In Action Team`
        break
      case 'biz-dev-interview':
        subject = 'Schedule Your Business Development Interview - Stage One In Action'
        body = `Hi ${prospect.firstName},\n\nPlease schedule your Business Development Interview using the link below:\n\n${link}\n\nThis interview is an important step in your onboarding journey. We're looking forward to discussing your business goals!\n\nBest regards,\nStage One In Action Team`
        break
      case 'acceptance':
        subject = 'Acceptance Letter & Payment - Stage One In Action'
        body = `Hi ${prospect.firstName},\n\nCongratulations! Please review your acceptance letter and complete your payment using the link below:\n\n${link}\n\nWe're excited to have you join us!\n\nBest regards,\nStage One In Action Team`
        break
    }

    const mailtoLink = `mailto:${prospect.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.open(mailtoLink, '_blank')
  }

  const handleScheduleInterview = async () => {
    if (!interviewDate || !interviewStartTime || !interviewEndTime) return
    setIsLoading(true)
    setError(null)

    // Validate end time is after start time
    const startDateTime = new Date(`${interviewDate}T${interviewStartTime}`)
    const endDateTime = new Date(`${interviewDate}T${interviewEndTime}`)
    if (endDateTime <= startDateTime) {
      setError('End time must be after start time')
      setIsLoading(false)
      return
    }

    // Validate not in the past
    if (startDateTime < new Date()) {
      setError('Cannot schedule an interview in the past')
      setIsLoading(false)
      return
    }

    // If rescheduling, cancel existing booking first
    if (isRescheduling) {
      const cancelResult = await cancelInterviewBooking(prospect.id, 'Rescheduled by admin')
      if (cancelResult.error) {
        setError(cancelResult.error)
        setIsLoading(false)
        return
      }
    }

    const result = await scheduleInterviewDirect(
      prospect.id,
      startDateTime.toISOString(),
      endDateTime.toISOString(),
    )
    if ('error' in result && result.error) {
      setError(result.error)
    } else {
      setSuccess(isRescheduling ? 'Interview rescheduled successfully' : 'Biz Dev Interview scheduled successfully')
      setShowScheduleModal(null)
      setInterviewDate('')
      setInterviewStartTime('')
      setInterviewEndTime('')
      setIsRescheduling(false)
      router.refresh()
    }
    setIsLoading(false)
  }

  const handleCompleteInterview = async () => {
    if (!showDecisionModal) return
    setIsLoading(true)
    setError(null)

    const result = await completeInterview(prospect.id, showDecisionModal, decisionNotes || undefined)
    if ('error' in result && result.error) {
      setError(result.error)
    } else {
      setSuccess(`Biz Dev Interview completed - Prospect ${showDecisionModal.toLowerCase()}`)
      setShowDecisionModal(null)
      setDecisionNotes('')
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


  const handleCancelInterview = async () => {
    setIsCancellingInterview(true)
    setError(null)

    const result = await cancelInterviewBooking(prospect.id)
    if (result.error) {
      setError(result.error)
      setIsCancellingInterview(false)
      setShowCancelInterviewConfirm(false)
    } else {
      setSuccess('Interview cancelled successfully')
      setShowCancelInterviewConfirm(false)
      setIsCancellingInterview(false)
      router.refresh()
    }
  }

  const [isRescheduling, setIsRescheduling] = useState(false)

  const handleRescheduleInterview = () => {
    setIsRescheduling(true)
    setShowScheduleModal('interview')
  }

  const [showRevertModal, setShowRevertModal] = useState(false)
  const [isReverting, setIsReverting] = useState(false)
  const [isCheckingBooking, setIsCheckingBooking] = useState(false)
  const [priorBookingInfo, setPriorBookingInfo] = useState<{
    available: boolean
    reason?: string
    booking?: { startTime: string; endTime: string }
  } | null>(null)

  const handleOpenRevertModal = async () => {
    setShowRevertModal(true)
    setIsCheckingBooking(true)
    setPriorBookingInfo(null)

    const result = await checkPriorBookingAvailability(prospect.id)
    if ('error' in result && result.error) {
      setPriorBookingInfo({ available: false, reason: 'error' })
    } else {
      setPriorBookingInfo(result as { available: boolean; reason?: string; booking?: { startTime: string; endTime: string } })
    }
    setIsCheckingBooking(false)
  }

  const handleRevertDecision = async (restorePrior: boolean) => {
    setIsReverting(true)
    setError(null)

    const result = await revertInterviewDecision(prospect.id, restorePrior)
    if ('error' in result && result.error) {
      setError(result.error)
      setIsReverting(false)
      return
    }

    if (result.rebooked) {
      setSuccess('Decision reverted - prior appointment restored')
      setShowRevertModal(false)
      router.refresh()
    } else {
      setSuccess('Decision reverted')
      setShowRevertModal(false)
      router.refresh()
      setTimeout(() => {
        setShowScheduleModal('interview')
      }, 500)
    }
    setIsReverting(false)
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
                setModalLink(link)
                setShowLinkModal('business-form')
              }}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Send className="h-4 w-4 mr-1" />
              View / Send Link
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
                  setModalLink(link)
                  setShowLinkModal('business-form')
                }}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Send className="h-4 w-4 mr-1" />
                View / Resend
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
            Schedule Biz Dev Interview
          </button>
        )
      case 'INTERVIEW_SCHEDULED':
        return (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setShowDecisionModal('APPROVED')}
              disabled={isLoading}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve
            </button>
            <button
              onClick={() => setShowDecisionModal('REJECTED')}
              disabled={isLoading}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </button>
            <button
              onClick={handleRescheduleInterview}
              disabled={isLoading}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reschedule
            </button>
            <button
              onClick={() => setShowCancelInterviewConfirm(true)}
              disabled={isLoading}
              className="inline-flex items-center px-3 py-2 border border-red-300 rounded-md text-sm font-medium text-red-700 bg-white hover:bg-red-50 disabled:opacity-50"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancel Interview
            </button>
          </div>
        )
      case 'APPROVED':
        return (
          <div className="space-y-2">
            {prospect.acceptanceToken ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Acceptance letter sent</span>
                <button
                  onClick={() => {
                    const link = `${window.location.origin}/acceptance/${prospect.acceptanceToken}`
                    setModalLink(link)
                    setShowLinkModal('acceptance')
                  }}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Send className="h-4 w-4 mr-1" />
                  View / Send Link
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
            )}
            <button
              onClick={() => handleOpenRevertModal()}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-500 hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Revert Decision
            </button>
          </div>
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
                setModalLink(link)
                setShowLinkModal('acceptance')
              }}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Send className="h-4 w-4 mr-1" />
              View / Resend
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
      case 'REJECTED':
        return (
          <button
            onClick={() => handleOpenRevertModal()}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Revert Decision
          </button>
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
        isRejected={prospect.status === 'REJECTED'}
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

          {/* Biz Dev Interview Information - Show if any interview data exists */}
          {(prospect.interviewScheduledAt || prospect.interviewCompletedAt || prospect.interviewNotes || prospect.interviewResult) && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="h-5 w-5 text-primary-600" />
                <h2 className="text-lg font-semibold text-gray-900">Biz Dev Interview Information</h2>
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
                    <label className="text-sm text-gray-500">Biz Dev Interview Notes</label>
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
              <div className="space-y-6">
                {/* Business Identity Section */}
                <div className="border-b border-gray-100 pb-4">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Business Identity</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {prospect.companyName && (
                      <div>
                        <label className="text-sm text-gray-500">Company Name</label>
                        <div className="flex items-center text-gray-900 mt-1">
                          <Building className="h-4 w-4 mr-2 text-gray-400" />
                          {prospect.companyName}
                        </div>
                      </div>
                    )}
                    {prospect.tagline && (
                      <div>
                        <label className="text-sm text-gray-500">Tagline</label>
                        <p className="text-gray-900 mt-1">{prospect.tagline}</p>
                      </div>
                    )}
                    {prospect.businessType && (
                      <div>
                        <label className="text-sm text-gray-500">Business Type</label>
                        <span className="inline-flex mt-1 px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                          {prospect.businessType === 'Other' && prospect.businessTypeOther
                            ? prospect.businessTypeOther
                            : prospect.businessType}
                        </span>
                      </div>
                    )}
                  </div>
                  {prospect.bio && (
                    <div className="mt-4">
                      <label className="text-sm text-gray-500">Professional Bio</label>
                      <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                        <p className="text-gray-700 whitespace-pre-wrap">{prospect.bio}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Online Presence Section */}
                {(prospect.websiteUrl || prospect.instagramHandle || prospect.facebookHandle || prospect.linkedinHandle || prospect.tiktokHandle || prospect.needsWebsiteHelp) && (
                  <div className="border-b border-gray-100 pb-4">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Online Presence</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {prospect.websiteUrl && (
                        <div>
                          <label className="text-sm text-gray-500">Website</label>
                          <a href={prospect.websiteUrl.startsWith('http') ? prospect.websiteUrl : `https://${prospect.websiteUrl}`} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline mt-1 block">
                            {prospect.websiteUrl}
                          </a>
                        </div>
                      )}
                      {prospect.needsWebsiteHelp && (
                        <div>
                          <label className="text-sm text-gray-500">Website Help</label>
                          <span className="inline-flex mt-1 px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-full text-sm font-medium">
                            Needs website assistance
                          </span>
                        </div>
                      )}
                      {prospect.instagramHandle && (
                        <div>
                          <label className="text-sm text-gray-500">Instagram</label>
                          <p className="text-gray-900 mt-1">{prospect.instagramHandle}</p>
                        </div>
                      )}
                      {prospect.facebookHandle && (
                        <div>
                          <label className="text-sm text-gray-500">Facebook</label>
                          <p className="text-gray-900 mt-1">{prospect.facebookHandle}</p>
                        </div>
                      )}
                      {prospect.linkedinHandle && (
                        <div>
                          <label className="text-sm text-gray-500">LinkedIn</label>
                          <p className="text-gray-900 mt-1">{prospect.linkedinHandle}</p>
                        </div>
                      )}
                      {prospect.tiktokHandle && (
                        <div>
                          <label className="text-sm text-gray-500">TikTok</label>
                          <p className="text-gray-900 mt-1">{prospect.tiktokHandle}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Services & Packages Section */}
                {prospect.servicePackages && prospect.servicePackages.length > 0 && (
                  <div className="border-b border-gray-100 pb-4">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Services & Packages</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {prospect.servicePackages.map((pkg) => (
                        <div key={pkg.id} className="border border-gray-200 rounded-lg p-4 bg-white">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-medium text-gray-900">{pkg.name}</h4>
                            <span className="text-primary-600 font-semibold">{pkg.price}</span>
                          </div>
                          {pkg.description && (
                            <p className="text-sm text-gray-600 mb-2">{pkg.description}</p>
                          )}
                          {pkg.duration && (
                            <p className="text-xs text-gray-500">Duration: {pkg.duration}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Legacy Services (for backward compatibility) */}
                {prospect.servicesInterested.length > 0 && (
                  <div className="border-b border-gray-100 pb-4">
                    <label className="text-sm text-gray-500">Services Interested (Legacy)</label>
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
                  <div className="border-b border-gray-100 pb-4">
                    <label className="text-sm text-gray-500">Proposed Pricing (Legacy)</label>
                    <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                      <p className="text-gray-700 whitespace-pre-wrap">{prospect.proposedCostOfServices}</p>
                    </div>
                  </div>
                )}

                {/* Target Audience Section */}
                {(prospect.idealClient || prospect.uniqueValue || prospect.certifications) && (
                  <div className="border-b border-gray-100 pb-4">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Target Audience & Differentiators</h3>
                    {prospect.idealClient && (
                      <div className="mb-4">
                        <label className="text-sm text-gray-500">Ideal Client</label>
                        <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                          <p className="text-gray-700 whitespace-pre-wrap">{prospect.idealClient}</p>
                        </div>
                      </div>
                    )}
                    {prospect.uniqueValue && (
                      <div className="mb-4">
                        <label className="text-sm text-gray-500">What Makes Them Unique</label>
                        <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                          <p className="text-gray-700 whitespace-pre-wrap">{prospect.uniqueValue}</p>
                        </div>
                      </div>
                    )}
                    {prospect.certifications && (
                      <div>
                        <label className="text-sm text-gray-500">Certifications & Credentials</label>
                        <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                          <p className="text-gray-700 whitespace-pre-wrap">{prospect.certifications}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Goals Section */}
                {(prospect.threeYearRevenueGoal || prospect.threeYearClientGoal || prospect.visionStatement || prospect.missionStatement) && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Goals & Vision</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      {prospect.threeYearRevenueGoal && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <label className="text-sm text-green-700 font-medium">3-Year Revenue Goal</label>
                          <p className="text-lg font-semibold text-green-900 mt-1">{prospect.threeYearRevenueGoal}</p>
                        </div>
                      )}
                      {prospect.threeYearClientGoal && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <label className="text-sm text-blue-700 font-medium">3-Year Client Goal</label>
                          <p className="text-lg font-semibold text-blue-900 mt-1">{prospect.threeYearClientGoal}</p>
                        </div>
                      )}
                    </div>
                    {prospect.visionStatement && (
                      <div className="mb-4">
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

            {/* Interview details when scheduled */}
            {prospect.status === 'INTERVIEW_SCHEDULED' && (
              <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                {/* Use booking time if available, fallback to interviewScheduledAt */}
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wide">Scheduled</label>
                  <div className="flex items-center text-sm text-gray-900 mt-1">
                    <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                    {formatDate(prospect.interviewBooking?.startTime || prospect.interviewScheduledAt)}
                  </div>
                </div>

                {prospect.interviewBooking?.meetingLink && (
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide">Meeting Link</label>
                    <a
                      href={prospect.interviewBooking.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center text-sm text-primary-600 hover:text-primary-700 mt-1"
                    >
                      <Video className="h-4 w-4 mr-2" />
                      Join Meeting
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  </div>
                )}

                {prospect.interviewBooking?.calendarId && (
                  <Link
                    href={`/admin/calendars/${prospect.interviewBooking.calendarId}?returnTo=${encodeURIComponent(`/admin/prospects/${prospect.id}`)}&returnLabel=${encodeURIComponent(`${prospect.firstName} ${prospect.lastName}`)}`}
                    className="flex items-center justify-center gap-2 w-full px-3 py-2 mt-2 text-sm font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
                  >
                    <Calendar className="h-4 w-4" />
                    View Calendar
                  </Link>
                )}

              </div>
            )}

            {/* Booking history - shown for any status with bookings */}
            {prospect.interviewBookingHistory.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <label className="text-xs text-gray-500 uppercase tracking-wide">Booking History</label>
                <div className="mt-1 space-y-1.5">
                  {prospect.interviewBookingHistory
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map(b => {
                      const isRescheduled = b.status === 'CANCELLED' && b.cancellationReason?.toLowerCase().includes('reschedule')
                      const isCancelled = b.status === 'CANCELLED' && !isRescheduled
                      const isCompleted = b.status === 'COMPLETED'
                      const isNoShow = b.status === 'NO_SHOW'
                      const isActive = b.status === 'PENDING' || b.status === 'CONFIRMED'

                      return (
                        <div key={b.id} className={`flex items-center text-xs rounded-md px-2 py-1 ${
                          isActive ? 'bg-blue-50 text-blue-700' :
                          isCompleted ? 'bg-green-50 text-green-700' :
                          isRescheduled ? 'bg-amber-50 text-amber-700' :
                          isNoShow ? 'bg-orange-50 text-orange-700' :
                          'bg-red-50 text-red-600'
                        }`}>
                          {isActive && <Clock className="h-3 w-3 mr-1.5 flex-shrink-0" />}
                          {isCompleted && <CheckCircle className="h-3 w-3 mr-1.5 flex-shrink-0" />}
                          {isRescheduled && <RefreshCw className="h-3 w-3 mr-1.5 flex-shrink-0" />}
                          {isNoShow && <AlertCircle className="h-3 w-3 mr-1.5 flex-shrink-0" />}
                          {isCancelled && <XCircle className="h-3 w-3 mr-1.5 flex-shrink-0" />}
                          <span className={isRescheduled || isCancelled ? 'line-through' : ''}>
                            {formatDate(b.startTime)}
                          </span>
                          <span className="ml-auto font-medium text-[10px] uppercase">
                            {isActive ? 'Scheduled' :
                             isCompleted ? 'Attended' :
                             isRescheduled ? 'Rescheduled' :
                             isNoShow ? 'No Show' :
                             'Cancelled'}
                          </span>
                        </div>
                      )
                    })}
                </div>
              </div>
            )}
          </div>

          {/* Prospect Links - Action Panel */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Prospect Links</h2>
            <p className="text-xs text-gray-500 mb-4">
              Share these links with the prospect to complete onboarding steps.
            </p>
            <div className="space-y-3">
              {/* Orientation Booking Link - show after assessment completion */}
              {prospect.assessmentCompletedAt && !prospect.orientationCompletedAt && (
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm font-medium text-green-800 mb-1">Orientation Booking</p>
                  <p className="text-xs text-green-600 mb-2">
                    {prospect.orientationToken
                      ? 'Self-schedule orientation'
                      : 'Generate booking link'
                    }
                  </p>
                  {prospect.orientationToken ? (
                    <button
                      onClick={() => {
                        const link = `${window.location.origin}/book/orientation/${prospect.orientationToken}`
                        setModalLink(link)
                        setShowLinkModal('orientation')
                      }}
                      className="w-full inline-flex items-center justify-center px-3 py-1.5 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700"
                    >
                      <Send className="h-4 w-4 mr-1" />
                      View / Send
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
                      className="w-full inline-flex items-center justify-center px-3 py-1.5 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                    >
                      <Send className="h-4 w-4 mr-1" />
                      Generate Link
                    </button>
                  )}
                </div>
              )}
              {prospect.businessFormToken && (
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-1">Business Form</p>
                  <p className="text-xs text-gray-500 mb-2 truncate">
                    {prospect.businessFormSubmittedAt ? 'Submitted' : 'Pending completion'}
                  </p>
                  <button
                    onClick={() => {
                      const link = `${window.location.origin}/business-form/${prospect.businessFormToken}`
                      setModalLink(link)
                      setShowLinkModal('business-form')
                    }}
                    className="w-full inline-flex items-center justify-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-white"
                  >
                    <Send className="h-4 w-4 mr-1" />
                    Send
                  </button>
                </div>
              )}
              {/* Biz Dev Interview Booking Link - show after business form submission */}
              {prospect.businessFormSubmittedAt && !prospect.interviewCompletedAt && (
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-sm font-medium text-amber-800 mb-1">Biz Dev Interview</p>
                  <p className="text-xs text-amber-600 mb-2">
                    {prospect.bizDevInterviewToken
                      ? 'Self-schedule interview'
                      : 'Generate booking link'
                    }
                  </p>
                  {prospect.bizDevInterviewToken ? (
                    <button
                      onClick={() => {
                        const link = `${window.location.origin}/book/biz-dev-interview/${prospect.bizDevInterviewToken}`
                        setModalLink(link)
                        setShowLinkModal('biz-dev-interview')
                      }}
                      className="w-full inline-flex items-center justify-center px-3 py-1.5 bg-amber-600 text-white rounded-md text-sm font-medium hover:bg-amber-700"
                    >
                      <Send className="h-4 w-4 mr-1" />
                      View / Send
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        setIsLoading(true)
                        const result = await generateBizDevInterviewToken(prospect.id)
                        if (result.error) {
                          setError(result.error)
                        } else if (result.token) {
                          const link = `${window.location.origin}/book/biz-dev-interview/${result.token}`
                          copyToClipboard(link)
                          router.refresh()
                        }
                        setIsLoading(false)
                      }}
                      disabled={isLoading}
                      className="w-full inline-flex items-center justify-center px-3 py-1.5 bg-amber-600 text-white rounded-md text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
                    >
                      <Send className="h-4 w-4 mr-1" />
                      Generate Link
                    </button>
                  )}
                </div>
              )}
              {prospect.acceptanceToken && (
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-1">Acceptance & Payment</p>
                  <p className="text-xs text-gray-500 mb-2">
                    {prospect.termsAcceptedAt ? 'Terms accepted' : 'Pending acceptance'}
                  </p>
                  <button
                    onClick={() => {
                      const link = `${window.location.origin}/acceptance/${prospect.acceptanceToken}`
                      setModalLink(link)
                      setShowLinkModal('acceptance')
                    }}
                    className="w-full inline-flex items-center justify-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-white"
                  >
                    <Send className="h-4 w-4 mr-1" />
                    Send
                  </button>
                </div>
              )}
              {/* Show message if no links available yet */}
              {!prospect.assessmentCompletedAt && !prospect.businessFormToken && !prospect.acceptanceToken && (
                <p className="text-xs text-gray-500 italic">
                  Links will appear as the prospect progresses.
                </p>
              )}
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

      {/* Schedule Biz Dev Interview Modal */}
      {showScheduleModal === 'interview' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                {isRescheduling ? 'Reschedule Biz Dev Interview' : 'Schedule Biz Dev Interview'}
              </h3>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Pick a date and time for the interview with {prospect.firstName} {prospect.lastName}.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={interviewDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setInterviewDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={interviewStartTime}
                    onChange={(e) => {
                      setInterviewStartTime(e.target.value)
                      // Auto-set end time to 1 hour later
                      if (e.target.value) {
                        const [h, m] = e.target.value.split(':').map(Number)
                        const endH = (h + 1) % 24
                        setInterviewEndTime(`${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <input
                    type="time"
                    value={interviewEndTime}
                    min={interviewStartTime}
                    onChange={(e) => setInterviewEndTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>

              {/* Preview */}
              {interviewDate && interviewStartTime && interviewEndTime && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-amber-800">
                    {new Date(interviewDate + 'T00:00:00').toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                  <p className="text-sm text-amber-700">
                    {new Date(`2000-01-01T${interviewStartTime}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                    {' - '}
                    {new Date(`2000-01-01T${interviewEndTime}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
              <button
                onClick={() => {
                  setShowScheduleModal(null)
                  setIsRescheduling(false)
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleScheduleInterview}
                disabled={!interviewDate || !interviewStartTime || !interviewEndTime || isLoading}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50"
              >
                {isLoading ? (isRescheduling ? 'Rescheduling...' : 'Scheduling...') : (isRescheduling ? 'Reschedule Interview' : 'Schedule Interview')}
              </button>
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

      {/* Cancel Interview Confirmation Modal */}
      {showCancelInterviewConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                Cancel Interview
              </h3>
            </div>
            <p className="text-gray-600 mb-2">
              Are you sure you want to cancel the Biz Dev Interview?
            </p>
            {prospect.interviewScheduledAt && (
              <p className="text-sm text-gray-500 mb-4">
                Scheduled for <strong>{formatDate(prospect.interviewScheduledAt)}</strong>
              </p>
            )}
            <p className="text-sm text-amber-600 mb-6">
              The booking will be cancelled and the prospect will be moved back to &quot;Business Form Submitted&quot; status.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCancelInterviewConfirm(false)}
                disabled={isCancellingInterview}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Keep Interview
              </button>
              <button
                onClick={handleCancelInterview}
                disabled={isCancellingInterview}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                {isCancellingInterview ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin inline" />
                    Cancelling...
                  </>
                ) : (
                  'Cancel Interview'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interview Decision Modal */}
      {showDecisionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                showDecisionModal === 'APPROVED' ? 'bg-green-100' : 'bg-red-100'
              }`}>
                {showDecisionModal === 'APPROVED' ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                {showDecisionModal === 'APPROVED' ? 'Approve Prospect' : 'Reject Prospect'}
              </h3>
            </div>
            <p className="text-gray-600 mb-4">
              {showDecisionModal === 'APPROVED'
                ? `Are you sure you want to approve ${prospect.firstName} ${prospect.lastName}? They will move to the acceptance and payment stage.`
                : `Are you sure you want to reject ${prospect.firstName} ${prospect.lastName}? This will end their onboarding process.`
              }
            </p>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                placeholder={showDecisionModal === 'APPROVED'
                  ? 'e.g. Strong business plan, great interview...'
                  : 'e.g. Reason for rejection...'
                }
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowDecisionModal(null)
                  setDecisionNotes('')
                }}
                disabled={isLoading}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCompleteInterview}
                disabled={isLoading}
                className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white disabled:opacity-50 ${
                  showDecisionModal === 'APPROVED'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin inline" />
                    Processing...
                  </>
                ) : showDecisionModal === 'APPROVED' ? (
                  'Confirm Approval'
                ) : (
                  'Confirm Rejection'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revert Decision Modal */}
      {showRevertModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <RefreshCw className="h-5 w-5 text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                Revert Decision
              </h3>
            </div>

            <p className="text-gray-600 mb-4">
              Revert the {prospect.status === 'REJECTED' ? 'rejection' : 'approval'} of <strong>{prospect.firstName} {prospect.lastName}</strong>? Decision notes will be cleared.
            </p>

            {/* Loading state */}
            {isCheckingBooking && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-amber-600 mr-2" />
                <span className="text-sm text-gray-500">Checking prior appointment...</span>
              </div>
            )}

            {/* Prior booking IS available */}
            {!isCheckingBooking && priorBookingInfo?.available && priorBookingInfo.booking && (
              <div className="space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">Prior appointment is available</span>
                  </div>
                  <div className="flex items-center text-sm text-green-700">
                    <Calendar className="h-4 w-4 mr-2 text-green-500" />
                    {formatDate(priorBookingInfo.booking.startTime)}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleRevertDecision(true)}
                    disabled={isReverting}
                    className="w-full px-4 py-2.5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                  >
                    {isReverting ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin inline" />Restoring...</>
                    ) : (
                      <><CheckCircle className="h-4 w-4 mr-2 inline" />Restore This Appointment</>
                    )}
                  </button>
                  <button
                    onClick={() => handleRevertDecision(false)}
                    disabled={isReverting}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {isReverting ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin inline" />Processing...</>
                    ) : (
                      <><Calendar className="h-4 w-4 mr-2 inline" />Schedule a New Interview</>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Prior booking NOT available */}
            {!isCheckingBooking && priorBookingInfo && !priorBookingInfo.available && (
              <div className="space-y-3">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-medium text-amber-800">Prior appointment unavailable</span>
                  </div>
                  <p className="text-xs text-amber-700">
                    {priorBookingInfo.reason === 'past'
                      ? 'The previous appointment date has already passed.'
                      : priorBookingInfo.reason === 'taken'
                        ? 'The previous time slot has been booked by someone else.'
                        : priorBookingInfo.reason === 'moved'
                          ? 'The calendar event has been moved to a different time.'
                          : priorBookingInfo.reason === 'deleted'
                            ? 'The calendar slot no longer exists.'
                            : 'No prior appointment was found.'}
                  </p>
                </div>

                <button
                  onClick={() => handleRevertDecision(false)}
                  disabled={isReverting}
                  className="w-full px-4 py-2.5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50"
                >
                  {isReverting ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin inline" />Processing...</>
                  ) : (
                    <><Calendar className="h-4 w-4 mr-2 inline" />Revert &amp; Schedule New Interview</>
                  )}
                </button>
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowRevertModal(false)}
                disabled={isReverting}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
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
