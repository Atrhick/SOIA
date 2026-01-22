'use client'

import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { OnboardingJourney, OnboardingStep } from '@/components/ui/onboarding-journey'
import {
  CheckCircle2,
  Circle,
  Clock,
  Upload,
  Video,
  FileQuestion,
  CheckSquare,
  ArrowRight,
  LucideIcon,
  Users,
} from 'lucide-react'
import { OnboardingTaskButton } from './task-button'

const statusConfig = {
  NOT_STARTED: { label: 'Not Started', variant: 'secondary' as const, icon: Circle },
  IN_PROGRESS: { label: 'In Progress', variant: 'warning' as const, icon: Clock },
  SUBMITTED: { label: 'Submitted', variant: 'default' as const, icon: Clock },
  APPROVED: { label: 'Approved', variant: 'success' as const, icon: CheckCircle2 },
}

const taskTypeIcons: Record<string, LucideIcon> = {
  MANUAL_STATUS: CheckSquare,
  VIDEO: Video,
  QUIZ: FileQuestion,
  UPLOAD: Upload,
  BOOLEAN: CheckSquare,
}

// LMS Course and Survey IDs (migrated from old courses)
const LMS_ANTI_TRAFFICKING_COURSE_ID = 'cmkk6bhdw0000yub4q0jj1tn2'
const LMS_ANTI_TRAFFICKING_QUIZ_ID = 'cmkk6bhe50007yub4yvjxa220'

// Map task IDs to their action routes
const taskRoutes: Record<string, string> = {
  'upload-profile-photo': '/coach/onboarding/profile',
  'complete-coach-bio': '/coach/onboarding/profile',
  'watch-anti-human-trafficking-course': `/coach/learning/${LMS_ANTI_TRAFFICKING_COURSE_ID}`,
  'pass-anti-human-trafficking-quiz': `/coach/surveys/${LMS_ANTI_TRAFFICKING_QUIZ_ID}`,
  'recruit-two-ambassadors': '/coach/ambassadors',
}

interface Task {
  id: string
  label: string
  description: string | null
  type: string
  isRequired: boolean
  sortOrder: number
}

interface TaskProgress {
  taskId: string
  status: string
}

interface CoachOnboardingClientProps {
  tasks: Task[]
  progressMap: Record<string, TaskProgress>
  completedRequired: number
  requiredTasksCount: number
  completionPercentage: number
  coachStatus: string
  ambassadorsCount: number
  quizPassed: boolean
  courseCompleted: boolean
}

export function CoachOnboardingClient({
  tasks,
  progressMap,
  completedRequired,
  requiredTasksCount,
  completionPercentage,
  coachStatus,
  ambassadorsCount,
  quizPassed,
  courseCompleted,
}: CoachOnboardingClientProps) {

  // Helper to get the effective status for a task
  const getEffectiveStatus = (task: Task): string => {
    let status = progressMap[task.id]?.status || 'NOT_STARTED'
    // Override status for course if completed in LMS
    if (task.id === 'watch-anti-human-trafficking-course' && courseCompleted) {
      status = 'APPROVED'
    }
    // Override status for quiz if passed
    if (task.id === 'pass-anti-human-trafficking-quiz' && quizPassed) {
      status = 'APPROVED'
    }
    // Override status for ambassadors if requirement met
    if (task.id === 'recruit-two-ambassadors' && ambassadorsCount >= 2) {
      status = 'APPROVED'
    }
    return status
  }

  // Find the first incomplete task index
  const firstIncompleteIndex = tasks.findIndex(task => getEffectiveStatus(task) !== 'APPROVED')

  // Convert tasks to OnboardingStep format for the journey component
  const journeySteps: OnboardingStep[] = tasks.map((task, index) => {
    const status = getEffectiveStatus(task)
    const isCompleted = status === 'APPROVED'
    const isCurrent = index === firstIncompleteIndex

    let stepStatus: 'completed' | 'current' | 'pending'
    if (isCompleted) {
      stepStatus = 'completed'
    } else if (isCurrent || status === 'IN_PROGRESS' || status === 'SUBMITTED') {
      stepStatus = 'current'
    } else {
      stepStatus = 'pending'
    }

    return {
      id: task.id,
      title: task.label,
      description: task.description || 'Complete this step',
      icon: taskTypeIcons[task.type] || CheckSquare,
      status: stepStatus,
      link: taskRoutes[task.id] || undefined,
    }
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Onboarding Checklist</h1>
          <p className="text-gray-600">Complete all required tasks to become an Active Coach</p>
        </div>
        <div className="flex items-center gap-3">
          {coachStatus !== 'ACTIVE_COACH' && (
            <Link href="/coach?skip=true">
              <Button variant="outline" size="sm">
                View Dashboard
              </Button>
            </Link>
          )}
          <Badge
            variant={coachStatus === 'ACTIVE_COACH' ? 'success' : 'warning'}
            className="text-sm px-3 py-1"
          >
            {coachStatus === 'ACTIVE_COACH' ? 'Active Coach' : 'Onboarding Incomplete'}
          </Badge>
        </div>
      </div>

      {/* Journey Stepper Component */}
      <OnboardingJourney
        steps={journeySteps}
        completedCount={completedRequired}
        totalCount={requiredTasksCount}
      />

      {/* Task Details List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Task Details</h2>
        {tasks.map((task) => {
          const status = getEffectiveStatus(task)
          const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.NOT_STARTED
          const TypeIcon = taskTypeIcons[task.type] || CheckSquare
          const StatusIcon = config.icon
          const route = taskRoutes[task.id]

          return (
            <Card key={task.id}>
              <CardContent className="py-4">
                <div className="flex items-start gap-4">
                  <div className={`mt-1 p-2 rounded-lg ${
                    status === 'APPROVED' ? 'bg-green-100' : 'bg-gray-100'
                  }`}>
                    <TypeIcon className={`h-5 w-5 ${
                      status === 'APPROVED' ? 'text-green-600' : 'text-gray-500'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-900">{task.label}</h3>
                      {task.isRequired && (
                        <Badge variant="secondary" className="text-xs">Required</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mb-3">{task.description}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <StatusIcon className={`h-4 w-4 ${
                          status === 'APPROVED' ? 'text-green-500' :
                          status === 'IN_PROGRESS' || status === 'SUBMITTED' ? 'text-yellow-500' :
                          'text-gray-400'
                        }`} />
                        <Badge variant={config.variant}>{config.label}</Badge>
                      </div>
                      {status !== 'APPROVED' && (
                        <>
                          {route ? (
                            <Link href={route}>
                              <Button size="sm">
                                {status === 'NOT_STARTED' ? 'Start' : 'Continue'}
                                <ArrowRight className="ml-2 h-4 w-4" />
                              </Button>
                            </Link>
                          ) : task.type === 'BOOLEAN' ? (
                            <OnboardingTaskButton taskId={task.id} taskLabel={task.label} />
                          ) : (
                            <Button size="sm" variant="outline" disabled>
                              Admin Action Required
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

    </div>
  )
}
