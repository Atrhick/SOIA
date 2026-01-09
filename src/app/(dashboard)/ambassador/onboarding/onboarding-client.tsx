'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { OnboardingJourney, OnboardingStep } from '@/components/ui/onboarding-journey'
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  MessageSquare,
  Users,
  Lightbulb,
  Zap,
  GraduationCap,
  ArrowRight,
  LucideIcon
} from 'lucide-react'
import Link from 'next/link'

const taskIcons: Record<string, LucideIcon> = {
  INTERVIEW: MessageSquare,
  WHATSAPP_TEAM: Users,
  BUSINESS_IDEA: Lightbulb,
  POWER_TEAM: Zap,
  CLASS_SELECTION: GraduationCap,
  MANUAL_STATUS: AlertCircle,
}

interface TaskProgress {
  id: string
  status: string
  notes: string | null
  completedAt: string | null
  task: {
    id: string
    label: string
    description: string | null
    type: string
    isRequired: boolean
    sortOrder: number
  }
}

interface AmbassadorOnboardingClientProps {
  progress: TaskProgress[]
  progressPercentage: number
  completedCount: number
  requiredCount: number
}

export function AmbassadorOnboardingClient({
  progress,
  progressPercentage,
  completedCount,
  requiredCount,
}: AmbassadorOnboardingClientProps) {

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return {
          color: 'bg-green-100 text-green-700 border-green-200',
          icon: CheckCircle2,
          iconColor: 'text-green-500',
          bgColor: 'bg-green-50 border-green-100',
        }
      case 'SUBMITTED':
        return {
          color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
          icon: Clock,
          iconColor: 'text-yellow-500',
          bgColor: 'bg-yellow-50 border-yellow-100',
        }
      case 'IN_PROGRESS':
        return {
          color: 'bg-blue-100 text-blue-700 border-blue-200',
          icon: Clock,
          iconColor: 'text-blue-500',
          bgColor: 'bg-blue-50 border-blue-100',
        }
      case 'REJECTED':
        return {
          color: 'bg-red-100 text-red-700 border-red-200',
          icon: AlertCircle,
          iconColor: 'text-red-500',
          bgColor: 'bg-red-50 border-red-100',
        }
      default:
        return {
          color: 'bg-gray-100 text-gray-700 border-gray-200',
          icon: AlertCircle,
          iconColor: 'text-gray-400',
          bgColor: 'bg-gray-50 border-gray-100',
        }
    }
  }

  const getTaskLink = (taskType: string) => {
    switch (taskType) {
      case 'BUSINESS_IDEA':
        return '/ambassador/business-idea'
      case 'CLASS_SELECTION':
        return '/ambassador/classes'
      default:
        return null
    }
  }

  // Find the first incomplete task to mark as current
  const firstIncompleteIndex = progress.findIndex(p => p.status !== 'APPROVED')

  // Convert progress to OnboardingStep format for the journey component
  const journeySteps: OnboardingStep[] = progress.map((p, index) => {
    let status: 'completed' | 'current' | 'pending'

    if (p.status === 'APPROVED') {
      status = 'completed'
    } else if (index === firstIncompleteIndex) {
      status = 'current'
    } else if (p.status === 'IN_PROGRESS' || p.status === 'SUBMITTED') {
      status = 'current'
    } else {
      status = 'pending'
    }

    return {
      id: p.id,
      title: p.task.label,
      description: p.task.description || 'Complete this step',
      icon: taskIcons[p.task.type] || AlertCircle,
      status,
      link: getTaskLink(p.task.type) || undefined,
    }
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Onboarding Journey</h1>
        <p className="text-gray-600 mt-1">
          Complete these steps to become an active ambassador
        </p>
      </div>

      {/* Journey Stepper Component */}
      <OnboardingJourney
        steps={journeySteps}
        completedCount={completedCount}
        totalCount={requiredCount}
      />

      {/* Detailed Tasks List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Task Details</h2>
        {progress.map((p, index) => {
          const statusConfig = getStatusConfig(p.status)
          const StatusIcon = statusConfig.icon
          const TaskIcon = taskIcons[p.task.type] || AlertCircle
          const taskLink = getTaskLink(p.task.type)

          return (
            <Card
              key={p.id}
              className={`border-2 transition-all ${statusConfig.bgColor}`}
            >
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  {/* Step Number */}
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    p.status === 'APPROVED'
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {p.status === 'APPROVED' ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <span className="font-semibold">{index + 1}</span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <TaskIcon className={`w-5 h-5 ${statusConfig.iconColor}`} />
                          <h3 className="font-semibold text-gray-900">
                            {p.task.label}
                          </h3>
                          {p.task.isRequired && (
                            <span className="text-xs text-red-500">*Required</span>
                          )}
                        </div>
                        {p.task.description && (
                          <p className="mt-1 text-sm text-gray-600">
                            {p.task.description}
                          </p>
                        )}
                      </div>
                      <Badge className={statusConfig.color}>
                        {p.status.replace('_', ' ')}
                      </Badge>
                    </div>

                    {/* Notes/Feedback */}
                    {p.notes && (
                      <div className="mt-3 p-3 bg-white/50 rounded-lg">
                        <p className="text-sm text-gray-600">{p.notes}</p>
                      </div>
                    )}

                    {/* Action Button */}
                    {taskLink && p.status !== 'APPROVED' && (
                      <Link
                        href={taskLink}
                        className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-amber-600 hover:text-amber-700"
                      >
                        {p.status === 'NOT_STARTED' ? 'Start' : 'Continue'}
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    )}

                    {/* Completion Info */}
                    {p.status === 'APPROVED' && p.completedAt && (
                      <p className="mt-2 text-xs text-gray-500">
                        Completed on {new Date(p.completedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Need Help?</CardTitle>
          <CardDescription>
            Some tasks require action from your coach or admin team
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <MessageSquare className="w-4 h-4 mt-0.5 text-amber-500" />
              <span><strong>Interview:</strong> Will be scheduled by the admin team</span>
            </li>
            <li className="flex items-start gap-2">
              <Users className="w-4 h-4 mt-0.5 text-amber-500" />
              <span><strong>WhatsApp Team:</strong> Created by admin after interview</span>
            </li>
            <li className="flex items-start gap-2">
              <Lightbulb className="w-4 h-4 mt-0.5 text-amber-500" />
              <span><strong>Business Idea:</strong> Submit your idea for review</span>
            </li>
            <li className="flex items-start gap-2">
              <Zap className="w-4 h-4 mt-0.5 text-amber-500" />
              <span><strong>Power Team:</strong> Invitation sent after approval</span>
            </li>
            <li className="flex items-start gap-2">
              <GraduationCap className="w-4 h-4 mt-0.5 text-amber-500" />
              <span><strong>Classes:</strong> Browse and enroll in available classes</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
