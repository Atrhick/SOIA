'use client'

import { useState, useEffect } from 'react'
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
  Package
} from 'lucide-react'
import { saveBusinessIdea, submitBusinessIdea } from '@/lib/actions/business-idea'
import { useRouter } from 'next/navigation'

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

export default function BusinessIdeaPage() {
  const router = useRouter()
  const [ambassador, setAmbassador] = useState<AmbassadorWithIdea | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [targetMarket, setTargetMarket] = useState('')
  const [resources, setResources] = useState('')

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
      setError('Failed to load business idea')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    setError(null)
    setSuccessMessage(null)
    setIsSaving(true)

    const formData = new FormData()
    formData.set('title', title)
    formData.set('description', description)
    formData.set('targetMarket', targetMarket)
    formData.set('resources', resources)

    const result = await saveBusinessIdea(formData)
    if (result.error) {
      setError(result.error)
    } else {
      setSuccessMessage('Business idea saved as draft')
      fetchBusinessIdea()
    }
    setIsSaving(false)
  }

  const handleSubmit = async () => {
    if (!title || !description) {
      setError('Title and description are required')
      return
    }

    setError(null)
    setSuccessMessage(null)
    setIsSubmitting(true)

    // First save
    const formData = new FormData()
    formData.set('title', title)
    formData.set('description', description)
    formData.set('targetMarket', targetMarket)
    formData.set('resources', resources)

    const saveResult = await saveBusinessIdea(formData)
    if (saveResult.error) {
      setError(saveResult.error)
      setIsSubmitting(false)
      return
    }

    // Then submit
    const submitResult = await submitBusinessIdea()
    if (submitResult.error) {
      setError(submitResult.error)
    } else {
      setSuccessMessage('Business idea submitted for review!')
      fetchBusinessIdea()
      router.refresh()
    }
    setIsSubmitting(false)
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Business Idea</h1>
          <p className="text-gray-600 mt-1">
            Share your business idea for review
          </p>
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
        <Card className={`border-2 ${status === 'APPROVED' ? 'border-green-200 bg-green-50' : status === 'NEEDS_REVISION' ? 'border-orange-200 bg-orange-50' : 'border-red-200 bg-red-50'}`}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <statusConfig.icon className={`w-5 h-5 mt-0.5 ${statusConfig.iconColor}`} />
              <div>
                <h3 className="font-semibold text-gray-900">Feedback from Reviewer</h3>
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

      {/* Error/Success Messages */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {successMessage}
        </div>
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
              ? 'Describe your business idea in detail. You can save as draft and come back later.'
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
            <div className="flex items-center gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={handleSave}
                disabled={isSaving || isSubmitting}
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Draft
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isSaving || isSubmitting || !title || !description}
                className="bg-amber-500 hover:bg-amber-600"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Submit for Review
              </Button>
            </div>
          )}

          {!canEdit && status !== 'APPROVED' && (
            <div className="pt-4 border-t">
              <p className="text-sm text-gray-500">
                Your business idea is currently being reviewed. You will be notified when there is an update.
              </p>
            </div>
          )}

          {status === 'APPROVED' && (
            <div className="pt-4 border-t">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">Your business idea has been approved!</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tips Section */}
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
    </div>
  )
}
