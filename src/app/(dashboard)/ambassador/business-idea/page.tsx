'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Lightbulb,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  FileText,
  ArrowRight,
  Plus,
  Eye,
  Edit3
} from 'lucide-react'

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

  useEffect(() => {
    fetchBusinessIdea()
  }, [])

  const fetchBusinessIdea = async () => {
    try {
      const response = await fetch('/api/ambassador/business-idea')
      if (response.ok) {
        const data = await response.json()
        setAmbassador(data.ambassador)
      }
    } catch (err) {
      console.error('Failed to load business idea')
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return {
          color: 'bg-green-100 text-green-700 border-green-200',
          bgColor: 'bg-green-50 border-green-200',
          icon: CheckCircle2,
          iconColor: 'text-green-500',
          label: 'Approved',
          description: 'Your business idea has been approved! You can now move forward with your plan.',
        }
      case 'SUBMITTED':
      case 'UNDER_REVIEW':
        return {
          color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
          bgColor: 'bg-yellow-50 border-yellow-200',
          icon: Clock,
          iconColor: 'text-yellow-500',
          label: status === 'SUBMITTED' ? 'Submitted' : 'Under Review',
          description: 'Your business idea is being reviewed by your coach. You will receive feedback soon.',
        }
      case 'NEEDS_REVISION':
        return {
          color: 'bg-orange-100 text-orange-700 border-orange-200',
          bgColor: 'bg-orange-50 border-orange-200',
          icon: AlertCircle,
          iconColor: 'text-orange-500',
          label: 'Needs Revision',
          description: 'Your coach has provided feedback. Please review and update your business idea.',
        }
      case 'REJECTED':
        return {
          color: 'bg-red-100 text-red-700 border-red-200',
          bgColor: 'bg-red-50 border-red-200',
          icon: AlertCircle,
          iconColor: 'text-red-500',
          label: 'Rejected',
          description: 'Your business idea was not approved. Please review the feedback and try a different approach.',
        }
      default:
        return {
          color: 'bg-gray-100 text-gray-700 border-gray-200',
          bgColor: 'bg-gray-50 border-gray-200',
          icon: FileText,
          iconColor: 'text-gray-500',
          label: 'Draft',
          description: 'Your business idea is saved as a draft. Complete and submit it when ready.',
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
  const status = idea?.status || 'NONE'
  const statusConfig = getStatusConfig(status)
  const canEdit = status === 'DRAFT' || status === 'NEEDS_REVISION'

  // No business idea yet
  if (!idea) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Business Idea</h1>
          <p className="text-gray-600 mt-1">
            Share your business idea as part of your ambassador journey
          </p>
        </div>

        {/* Empty State */}
        <Card className="border-2 border-dashed">
          <CardContent className="py-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lightbulb className="w-8 h-8 text-amber-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Create Your Business Idea
              </h2>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Every great business starts with an idea. Share yours and get feedback from your coach to help you succeed.
              </p>
              <Link href="/ambassador/business-idea/edit">
                <Button className="bg-amber-500 hover:bg-amber-600">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Business Idea
                </Button>
              </Link>
            </div>
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
                <span><strong>Solve a problem:</strong> Think about challenges you or people around you face.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 font-bold">2.</span>
                <span><strong>Know your customer:</strong> Be specific about who would buy from you.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 font-bold">3.</span>
                <span><strong>Start small:</strong> You don&apos;t need a huge idea. Many successful businesses started simple.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 font-bold">4.</span>
                <span><strong>Be passionate:</strong> Choose something you care about.</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Has a business idea - show status
  const StatusIcon = statusConfig.icon

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Business Idea</h1>
          <p className="text-gray-600 mt-1">
            Track the status of your business idea submission
          </p>
        </div>
        <Badge className={statusConfig.color}>
          <StatusIcon className={`w-4 h-4 mr-1 ${statusConfig.iconColor}`} />
          {statusConfig.label}
        </Badge>
      </div>

      {/* Status Card */}
      <Card className={`border-2 ${statusConfig.bgColor}`}>
        <CardContent className="py-6">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              status === 'APPROVED' ? 'bg-green-100' :
              status === 'SUBMITTED' || status === 'UNDER_REVIEW' ? 'bg-yellow-100' :
              status === 'NEEDS_REVISION' ? 'bg-orange-100' :
              status === 'REJECTED' ? 'bg-red-100' : 'bg-gray-100'
            }`}>
              <StatusIcon className={`w-6 h-6 ${statusConfig.iconColor}`} />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                {statusConfig.label}
              </h2>
              <p className="text-gray-600 mb-4">
                {statusConfig.description}
              </p>

              {/* Action Button */}
              <Link href="/ambassador/business-idea/edit">
                <Button
                  variant={canEdit ? 'default' : 'outline'}
                  className={canEdit ? 'bg-amber-500 hover:bg-amber-600' : ''}
                >
                  {canEdit ? (
                    <>
                      <Edit3 className="w-4 h-4 mr-2" />
                      {status === 'DRAFT' ? 'Continue Editing' : 'Revise Idea'}
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4 mr-2" />
                      View Details
                    </>
                  )}
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Business Idea Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            {idea.title}
          </CardTitle>
          {idea.submittedAt && (
            <CardDescription>
              Submitted on {new Date(idea.submittedAt).toLocaleDateString()}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 line-clamp-3">{idea.description}</p>

          {(idea.targetMarket || idea.resources) && (
            <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-2 gap-4">
              {idea.targetMarket && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Target Market</h4>
                  <p className="text-sm text-gray-700 line-clamp-2">{idea.targetMarket}</p>
                </div>
              )}
              {idea.resources && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Resources Needed</h4>
                  <p className="text-sm text-gray-700 line-clamp-2">{idea.resources}</p>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 pt-4 border-t">
            <Link
              href="/ambassador/business-idea/edit"
              className="text-amber-600 hover:text-amber-700 text-sm font-medium flex items-center gap-1"
            >
              View full details
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Feedback Section */}
      {idea.feedback && (
        <Card className={`border-2 ${
          status === 'APPROVED' ? 'border-green-200 bg-green-50' :
          status === 'NEEDS_REVISION' ? 'border-orange-200 bg-orange-50' :
          'border-red-200 bg-red-50'
        }`}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <StatusIcon className={`w-5 h-5 ${statusConfig.iconColor}`} />
              Coach Feedback
            </CardTitle>
            {idea.reviewedAt && (
              <CardDescription>
                Reviewed on {new Date(idea.reviewedAt).toLocaleDateString()}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <p className="text-gray-700">{idea.feedback}</p>

            {status === 'NEEDS_REVISION' && (
              <div className="mt-4">
                <Link href="/ambassador/business-idea/edit">
                  <Button className="bg-amber-500 hover:bg-amber-600">
                    <Edit3 className="w-4 h-4 mr-2" />
                    Revise Your Idea
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Next Steps for Approved */}
      {status === 'APPROVED' && (
        <Card className="border-2 border-green-200 bg-green-50">
          <CardContent className="py-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">
                  Congratulations! Your idea is approved!
                </h3>
                <p className="text-gray-600 mb-4">
                  Continue your onboarding journey to learn more about turning your idea into reality.
                </p>
                <Link href="/ambassador/onboarding">
                  <Button className="bg-green-600 hover:bg-green-700">
                    Continue Onboarding
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
