'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Lightbulb,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Loader2,
  FileText,
  Target,
  Package
} from 'lucide-react'
import { reviewBusinessIdea } from '@/lib/actions/business-idea'
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
  ambassador: {
    id: string
    firstName: string
    lastName: string
    coach: {
      firstName: string
      lastName: string
    }
  }
}

interface BusinessIdeasClientProps {
  businessIdeas: BusinessIdea[]
}

export function BusinessIdeasClient({ businessIdeas }: BusinessIdeasClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedIdea, setSelectedIdea] = useState<BusinessIdea | null>(null)
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false)
  const [reviewStatus, setReviewStatus] = useState<'UNDER_REVIEW' | 'APPROVED' | 'NEEDS_REVISION' | 'REJECTED'>('UNDER_REVIEW')
  const [feedback, setFeedback] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const filteredIdeas = businessIdeas.filter(idea => {
    const matchesSearch = search === '' ||
      idea.title.toLowerCase().includes(search.toLowerCase()) ||
      `${idea.ambassador.firstName} ${idea.ambassador.lastName}`.toLowerCase().includes(search.toLowerCase())

    if (statusFilter === 'all') return matchesSearch
    return matchesSearch && idea.status === statusFilter
  })

  const pendingCount = businessIdeas.filter(i => i.status === 'SUBMITTED' || i.status === 'UNDER_REVIEW').length

  const handleReview = async () => {
    if (!selectedIdea) return
    setIsSubmitting(true)

    const result = await reviewBusinessIdea(selectedIdea.id, reviewStatus, feedback || undefined)
    if (result.error) {
      alert(result.error)
    } else {
      setReviewDialogOpen(false)
      setSelectedIdea(null)
      setFeedback('')
      router.refresh()
    }
    setIsSubmitting(false)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <Badge className="bg-green-100 text-green-700"><CheckCircle2 className="w-3 h-3 mr-1" />Approved</Badge>
      case 'SUBMITTED':
        return <Badge className="bg-yellow-100 text-yellow-700"><Clock className="w-3 h-3 mr-1" />Submitted</Badge>
      case 'UNDER_REVIEW':
        return <Badge className="bg-blue-100 text-blue-700"><Clock className="w-3 h-3 mr-1" />Under Review</Badge>
      case 'NEEDS_REVISION':
        return <Badge className="bg-orange-100 text-orange-700"><AlertCircle className="w-3 h-3 mr-1" />Needs Revision</Badge>
      case 'REJECTED':
        return <Badge className="bg-red-100 text-red-700"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-700">Draft</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Business Ideas</h1>
          <p className="text-gray-600 mt-1">
            Review and approve ambassador business ideas
          </p>
        </div>
        {pendingCount > 0 && (
          <Badge className="bg-yellow-100 text-yellow-700 text-lg px-3 py-1">
            {pendingCount} pending review
          </Badge>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by title or ambassador..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="SUBMITTED">Submitted</SelectItem>
            <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="NEEDS_REVISION">Needs Revision</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Business Ideas List */}
      {filteredIdeas.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Lightbulb className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No business ideas found</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredIdeas.map((idea) => (
            <Card
              key={idea.id}
              className={`border-2 cursor-pointer hover:border-primary-200 transition-colors ${
                idea.status === 'SUBMITTED' ? 'border-yellow-200 bg-yellow-50/30' : ''
              }`}
              onClick={() => setSelectedIdea(idea)}
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Lightbulb className="w-5 h-5 text-amber-500" />
                      <h3 className="font-semibold text-gray-900">{idea.title}</h3>
                    </div>
                    <p className="text-sm text-gray-500 mb-2">
                      By {idea.ambassador.firstName} {idea.ambassador.lastName} |
                      Coach: {idea.ambassador.coach.firstName} {idea.ambassador.coach.lastName}
                    </p>
                    <p className="text-sm text-gray-600 line-clamp-2">{idea.description}</p>
                    {idea.submittedAt && (
                      <p className="text-xs text-gray-400 mt-2">
                        Submitted: {new Date(idea.submittedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {getStatusBadge(idea.status)}
                    {(idea.status === 'SUBMITTED' || idea.status === 'UNDER_REVIEW') && (
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedIdea(idea)
                          setReviewDialogOpen(true)
                        }}
                      >
                        Review
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* View Dialog */}
      <Dialog open={!!selectedIdea && !reviewDialogOpen} onOpenChange={(open) => { if (!open) setSelectedIdea(null) }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-4 border-b">
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <Lightbulb className="w-6 h-6 text-amber-500" />
                  {selectedIdea?.title}
                </DialogTitle>
                <DialogDescription className="mt-2">
                  <span className="text-gray-600">
                    By <span className="font-medium text-gray-900">{selectedIdea?.ambassador.firstName} {selectedIdea?.ambassador.lastName}</span>
                  </span>
                  <span className="mx-2 text-gray-400">•</span>
                  <span className="text-gray-600">
                    Coach: <span className="font-medium text-gray-900">{selectedIdea?.ambassador.coach.firstName} {selectedIdea?.ambassador.coach.lastName}</span>
                  </span>
                </DialogDescription>
              </div>
              {selectedIdea && getStatusBadge(selectedIdea.status)}
            </div>
          </DialogHeader>

          {selectedIdea && (
            <div className="space-y-6 py-4">
              {/* Submission Info */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                {selectedIdea.submittedAt && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    Submitted: {new Date(selectedIdea.submittedAt).toLocaleDateString()} at {new Date(selectedIdea.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
                {selectedIdea.reviewedAt && (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    Reviewed: {new Date(selectedIdea.reviewedAt).toLocaleDateString()}
                  </span>
                )}
              </div>

              {/* Business Idea Details */}
              <div className="space-y-5">
                {/* Description - Full Detail */}
                <div className="bg-white border rounded-lg p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
                    <FileText className="w-4 h-4 text-primary-500" />
                    Business Description
                  </div>
                  <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{selectedIdea.description}</p>
                </div>

                {/* Target Market */}
                <div className="bg-white border rounded-lg p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
                    <Target className="w-4 h-4 text-blue-500" />
                    Target Market
                  </div>
                  {selectedIdea.targetMarket ? (
                    <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{selectedIdea.targetMarket}</p>
                  ) : (
                    <p className="text-gray-400 italic">Not provided</p>
                  )}
                </div>

                {/* Resources Needed */}
                <div className="bg-white border rounded-lg p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
                    <Package className="w-4 h-4 text-green-500" />
                    Resources Needed
                  </div>
                  {selectedIdea.resources ? (
                    <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{selectedIdea.resources}</p>
                  ) : (
                    <p className="text-gray-400 italic">Not provided</p>
                  )}
                </div>

                {/* Previous Feedback */}
                {selectedIdea.feedback && (
                  <div className={`p-4 rounded-lg border-2 ${
                    selectedIdea.status === 'APPROVED' ? 'bg-green-50 border-green-200' :
                    selectedIdea.status === 'NEEDS_REVISION' ? 'bg-orange-50 border-orange-200' :
                    selectedIdea.status === 'REJECTED' ? 'bg-red-50 border-red-200' :
                    'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="text-sm font-semibold text-gray-900 mb-2">Previous Feedback</div>
                    <p className="text-gray-700">{selectedIdea.feedback}</p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {(selectedIdea.status === 'SUBMITTED' || selectedIdea.status === 'UNDER_REVIEW') && (
                <div className="pt-4 border-t flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setReviewStatus('UNDER_REVIEW')
                      setReviewDialogOpen(true)
                    }}
                    className="flex-1"
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    Mark In Progress
                  </Button>
                  <Button
                    onClick={() => {
                      setReviewStatus('APPROVED')
                      setReviewDialogOpen(true)
                    }}
                    className="flex-1 bg-primary-600 hover:bg-primary-700"
                  >
                    Review & Decide
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={(open) => { if (!open) { setReviewDialogOpen(false); setFeedback('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Business Idea</DialogTitle>
            <DialogDescription>
              {selectedIdea?.title} by {selectedIdea?.ambassador.firstName} {selectedIdea?.ambassador.lastName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Decision</label>
              <Select value={reviewStatus} onValueChange={(v) => setReviewStatus(v as typeof reviewStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNDER_REVIEW">
                    <span className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-500" />
                      Mark as In Progress
                    </span>
                  </SelectItem>
                  <SelectItem value="APPROVED">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      Approve
                    </span>
                  </SelectItem>
                  <SelectItem value="NEEDS_REVISION">
                    <span className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-orange-500" />
                      Needs Revision
                    </span>
                  </SelectItem>
                  <SelectItem value="REJECTED">
                    <span className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-red-500" />
                      Reject
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Feedback {(reviewStatus !== 'APPROVED' && reviewStatus !== 'UNDER_REVIEW') && <span className="text-red-500">*</span>}
              </label>
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder={
                  reviewStatus === 'UNDER_REVIEW'
                    ? 'Add optional notes about the review...'
                    : reviewStatus === 'APPROVED'
                      ? 'Add optional feedback for the ambassador...'
                      : 'Explain what needs to be improved...'
                }
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setReviewDialogOpen(false); setFeedback('') }}>
              Cancel
            </Button>
            <Button
              onClick={handleReview}
              disabled={isSubmitting || (reviewStatus !== 'APPROVED' && reviewStatus !== 'UNDER_REVIEW' && !feedback)}
              className={
                reviewStatus === 'UNDER_REVIEW' ? 'bg-blue-600 hover:bg-blue-700' :
                reviewStatus === 'APPROVED' ? 'bg-green-600 hover:bg-green-700' :
                reviewStatus === 'REJECTED' ? 'bg-red-600 hover:bg-red-700' :
                'bg-orange-600 hover:bg-orange-700'
              }
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {reviewStatus === 'UNDER_REVIEW' ? 'Mark In Progress' :
               reviewStatus === 'APPROVED' ? 'Approve' :
               reviewStatus === 'REJECTED' ? 'Reject' : 'Request Revision'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
