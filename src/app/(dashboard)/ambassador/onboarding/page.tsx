import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  MessageSquare,
  Users,
  Lightbulb,
  Zap,
  GraduationCap,
  ArrowRight
} from 'lucide-react'
import Link from 'next/link'

const taskIcons: Record<string, React.ElementType> = {
  INTERVIEW: MessageSquare,
  WHATSAPP_TEAM: Users,
  BUSINESS_IDEA: Lightbulb,
  POWER_TEAM: Zap,
  CLASS_SELECTION: GraduationCap,
  MANUAL_STATUS: AlertCircle,
}

export default async function AmbassadorOnboardingPage() {
  const session = await auth()

  if (!session || session.user.role !== 'AMBASSADOR') {
    redirect('/login')
  }

  const ambassador = await prisma.ambassador.findUnique({
    where: { userId: session.user.id },
    include: {
      onboardingProgress: {
        include: { task: true },
        orderBy: { task: { sortOrder: 'asc' } },
      },
    },
  })

  if (!ambassador) {
    redirect('/login')
  }

  const requiredTasks = ambassador.onboardingProgress.filter(p => p.task.isRequired)
  const completedTasks = requiredTasks.filter(p => p.status === 'APPROVED')
  const progressPercentage = requiredTasks.length > 0
    ? Math.round((completedTasks.length / requiredTasks.length) * 100)
    : 0

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Onboarding Journey</h1>
        <p className="text-gray-600 mt-1">
          Complete these steps to become an active ambassador
        </p>
      </div>

      {/* Progress Overview */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Your Progress</h2>
              <p className="text-sm text-gray-500">
                {completedTasks.length} of {requiredTasks.length} required tasks completed
              </p>
            </div>
            <div className="text-3xl font-bold text-amber-500">{progressPercentage}%</div>
          </div>
          <Progress value={progressPercentage} className="h-3" />
        </CardContent>
      </Card>

      {/* Tasks List */}
      <div className="space-y-4">
        {ambassador.onboardingProgress.map((progress, index) => {
          const statusConfig = getStatusConfig(progress.status)
          const StatusIcon = statusConfig.icon
          const TaskIcon = taskIcons[progress.task.type] || AlertCircle
          const taskLink = getTaskLink(progress.task.type)

          return (
            <Card
              key={progress.id}
              className={`border-2 transition-all ${statusConfig.bgColor}`}
            >
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  {/* Step Number */}
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    progress.status === 'APPROVED'
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {progress.status === 'APPROVED' ? (
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
                            {progress.task.label}
                          </h3>
                          {progress.task.isRequired && (
                            <span className="text-xs text-red-500">*Required</span>
                          )}
                        </div>
                        {progress.task.description && (
                          <p className="mt-1 text-sm text-gray-600">
                            {progress.task.description}
                          </p>
                        )}
                      </div>
                      <Badge className={statusConfig.color}>
                        {progress.status.replace('_', ' ')}
                      </Badge>
                    </div>

                    {/* Notes/Feedback */}
                    {progress.notes && (
                      <div className="mt-3 p-3 bg-white/50 rounded-lg">
                        <p className="text-sm text-gray-600">{progress.notes}</p>
                      </div>
                    )}

                    {/* Action Button */}
                    {taskLink && progress.status !== 'APPROVED' && (
                      <Link
                        href={taskLink}
                        className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-amber-600 hover:text-amber-700"
                      >
                        {progress.status === 'NOT_STARTED' ? 'Start' : 'Continue'}
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    )}

                    {/* Completion Info */}
                    {progress.status === 'APPROVED' && progress.completedAt && (
                      <p className="mt-2 text-xs text-gray-500">
                        Completed on {new Date(progress.completedAt).toLocaleDateString()}
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
