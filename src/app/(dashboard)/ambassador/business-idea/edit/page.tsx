'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Lightbulb,
  Save,
  Send,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  FileText,
  Target,
  Package,
  Check,
  X,
  ArrowLeft
} from 'lucide-react'
import { saveBusinessIdea, submitBusinessIdea } from '@/lib/actions/business-idea'
import { cn } from '@/lib/utils'

interface BusinessIdea {
  id: string
  title: string
  description: string
  targetMarket: string | null
  resources: string | null
  status: string
  feedback: string | null
  submittedAt: string | null
  reviewedAt: string | null
}

interface AmbassadorWithIdea {
  id: string
  firstName: string
  businessIdea: BusinessIdea | null
}

// Toast notification component
function Toast({
  message,
  type,
  onClose
}: {
  message: string
  type: 'success' | 'error'
  onClose: () => void
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className={cn(
      'fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg',
      'animate-in slide-in-from-bottom-5 fade-in duration-300',
      type === 'success'
        ? 'bg-green-600 text-white'
        : 'bg-red-600 text-white'
    )}>
      {type === 'success' ? (
        <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
      ) : (
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
      )}
      <span className="font-medium">{message}</span>
      <button
        onClick={onClose}
        className="ml-2 p-1 hover:bg-white/20 rounded transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

export default function BusinessIdeaEditPage() {
  const router = useRouter()
  const [ambassador, setAmbassador] = useState<AmbassadorWithIdea | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [targetMarket, setTargetMarket] = useState('')
  const [resources, setResources] = useState('')

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type })
  }, [])

  const closeToast = useCallback(() => {
    setToast(null)
  }, [])

  useEffect(() => {
    fetchBusinessIdea()
  }, [])

  const fetchBusinessIdea = async () => {
    try {
      const response = await fetch('/api/ambassador/business-idea')
      if (response.ok) {
        const data = await response.json()
        setAmbassador(data.ambassador)
        if (data.ambassador?.businessIdea) {
          const idea = data.ambassador.businessIdea
          setTitle(idea.title || '')
          setDescription(idea.description || '')
          setTargetMarket(idea.targetMarket || '')
          setResources(idea.resources || '')
        }
      }
    } catch (err) {
      showToast('Failed to load business idea', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    setSaveSuccess(false)
    setIsSaving(true)

    const formData = new FormData()
    formData.set('title', title)
    formData.set('description', description)
    formData.set('targetMarket', targetMarket)
    formData.set('resources', resources)

    const result = await saveBusinessIdea(formData)
    setIsSaving(false)

    if (result.error) {
      showToast(result.error, 'error')
    } else {
      setSaveSuccess(true)
      setLastSaved(new Date())
      showToast('Draft saved successfully!', 'success')

      // Reset success state after animation, then redirect
      setTimeout(() => {
        setSaveSuccess(false)
        router.push('/ambassador/business-idea')
      }, 1500)
    }
  }

  const handleSubmit = async () => {
    if (!title || !description) {
      showToast('Title and description are required', 'error')
      return
    }

    setIsSubmitting(true)

    // First save
    const formData = new FormData()
    formData.set('title', title)
    formData.set('description', description)
    formData.set('targetMarket', targetMarket)
    formData.set('resources', resources)

    const saveResult = await saveBusinessIdea(formData)
    if (saveResult.error) {
      showToast(saveResult.error, 'error')
      setIsSubmitting(false)
      return
    }

    // Then submit
    const submitResult = await submitBusinessIdea()
    setIsSubmitting(false)

    if (submitResult.error) {
      showToast(submitResult.error, 'error')
    } else {
      showToast('Business idea submitted for review!', 'success')
      // Redirect to status page after brief delay
      setTimeout(() => {
        router.push('/ambassador/business-idea')
      }, 1500)
    }
  }

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return {
          color: 'bg-green-100 text-green-700 border-green-200',
          icon: CheckCircle2,
          iconColor: 'text-green-500',
          label: 'Approved',
        }
      case 'SUBMITTED':
      case 'UNDER_REVIEW':
        return {
          color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
          icon: Clock,
          iconColor: 'text-yellow-500',
          label: status === 'SUBMITTED' ? 'Submitted' : 'Under Review',
        }
      case 'NEEDS_REVISION':
        return {
          color: 'bg-orange-100 text-orange-700 border-orange-200',
          icon: AlertCircle,
          iconColor: 'text-orange-500',
          label: 'Needs Revision',
        }
      case 'REJECTED':
        return {
          color: 'bg-red-100 text-red-700 border-red-200',
          icon: AlertCircle,
          iconColor: 'text-red-500',
          label: 'Rejected',
        }
      default:
        return {
          color: 'bg-gray-100 text-gray-700 border-gray-200',
          icon: FileText,
          iconColor: 'text-gray-500',
          label: 'Draft',
        }
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    )
  }

  const idea = ambassador?.businessIdea
  const status = idea?.status || 'DRAFT'
  const statusConfig = getStatusConfig(status)
  const canEdit = status === 'DRAFT' || status === 'NEEDS_REVISION'

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={closeToast} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/ambassador/business-idea"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {idea ? 'Edit Business Idea' : 'Create Business Idea'}
            </h1>
            <p className="text-gray-600 mt-1">
              {canEdit
                ? 'Describe your business idea in detail'
                : 'View your submitted business idea'}
            </p>
          </div>
        </div>
        {idea && (
          <Badge className={statusConfig.color}>
            <statusConfig.icon className={`w-4 h-4 mr-1 ${statusConfig.iconColor}`} />
            {statusConfig.label}
          </Badge>
        )}
      </div>

      {/* Feedback Section */}
      {idea?.feedback && (
        <Card className={`border-2 ${
          status === 'APPROVED' ? 'border-green-200 bg-green-50' :
          status === 'NEEDS_REVISION' ? 'border-orange-200 bg-orange-50' :
          'border-red-200 bg-red-50'
        }`}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <statusConfig.icon className={`w-5 h-5 mt-0.5 ${statusConfig.iconColor}`} />
              <div>
                <h3 className="font-semibold text-gray-900">Coach Feedback</h3>
                <p className="mt-1 text-gray-700">{idea.feedback}</p>
                {idea.reviewedAt && (
                  <p className="mt-2 text-xs text-gray-500">
                    Reviewed on {new Date(idea.reviewedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Business Idea Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            Your Business Idea
          </CardTitle>
          <CardDescription>
            {canEdit
              ? 'Fill in the details below. You can save as draft and come back later.'
              : 'Your business idea has been submitted and is being reviewed.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-500" />
              Business Name / Title *
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What would you call your business?"
              disabled={!canEdit}
              className="disabled:bg-gray-50"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-gray-500" />
              Business Description *
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your business idea in detail. What problem does it solve? What products or services would you offer?"
              rows={6}
              disabled={!canEdit}
              className="disabled:bg-gray-50"
            />
          </div>

          {/* Target Market */}
          <div className="space-y-2">
            <Label htmlFor="targetMarket" className="flex items-center gap-2">
              <Target className="w-4 h-4 text-gray-500" />
              Target Market (Optional)
            </Label>
            <Textarea
              id="targetMarket"
              value={targetMarket}
              onChange={(e) => setTargetMarket(e.target.value)}
              placeholder="Who would be your customers? What age group, location, or interests would they have?"
              rows={3}
              disabled={!canEdit}
              className="disabled:bg-gray-50"
            />
          </div>

          {/* Resources */}
          <div className="space-y-2">
            <Label htmlFor="resources" className="flex items-center gap-2">
              <Package className="w-4 h-4 text-gray-500" />
              Resources Needed (Optional)
            </Label>
            <Textarea
              id="resources"
              value={resources}
              onChange={(e) => setResources(e.target.value)}
              placeholder="What resources, skills, or support would you need to start this business?"
              rows={3}
              disabled={!canEdit}
              className="disabled:bg-gray-50"
            />
          </div>

          {/* Actions */}
          {canEdit && (
            <div className="flex flex-col gap-4 pt-4 border-t">
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant={saveSuccess ? "default" : "outline"}
                  onClick={handleSave}
                  disabled={isSaving || isSubmitting}
                  className={cn(
                    'min-w-[140px] transition-all duration-300',
                    saveSuccess && 'bg-green-600 hover:bg-green-600 text-white border-green-600'
                  )}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : saveSuccess ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Saved!
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Draft
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSaving || isSubmitting || !title || !description}
                  className="min-w-[180px] bg-amber-500 hover:bg-amber-600"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Submit for Review
                    </>
                  )}
                </Button>
              </div>
              {/* Last saved indicator */}
              {lastSaved && (
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                  Last saved at {lastSaved.toLocaleTimeString()}
                </p>
              )}
            </div>
          )}

          {!canEdit && (
            <div className="pt-4 border-t">
              <Link href="/ambassador/business-idea">
                <Button variant="outline">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Status
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tips Section */}
      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tips for a Great Business Idea</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-amber-500 font-bold">1.</span>
                <span><strong>Solve a problem:</strong> Think about challenges you or people around you face. Great businesses solve real problems.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 font-bold">2.</span>
                <span><strong>Know your customer:</strong> Be specific about who would buy from you. The more you understand them, the better.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 font-bold">3.</span>
                <span><strong>Start small:</strong> You don&apos;t need a huge idea. Many successful businesses started with a simple concept.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 font-bold">4.</span>
                <span><strong>Be passionate:</strong> Choose something you care about. Your enthusiasm will show and help you succeed.</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
