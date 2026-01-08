import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { SectionHeader } from '@/components/ui/page-header'
import { InlineEmptyState } from '@/components/ui/empty-state'
import {
  ClipboardList,
  Lightbulb,
  GraduationCap,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  User,
  Calendar,
  MessageSquare,
} from 'lucide-react'

export default async function AmbassadorDashboardPage() {
  const session = await auth()

  if (!session || session.user.role !== 'AMBASSADOR') {
    redirect('/login')
  }

  const ambassador = await prisma.ambassador.findUnique({
    where: { userId: session.user.id },
    include: {
      coach: {
        select: { firstName: true, lastName: true },
      },
      onboardingProgress: {
        include: { task: true },
      },
      businessIdea: true,
      classEnrollments: {
        include: {
          class: {
            select: { title: true, date: true },
          },
        },
      },
    },
  })

  if (!ambassador) {
    redirect('/login')
  }

  // Calculate onboarding progress
  const requiredTasks = ambassador.onboardingProgress.filter(p => p.task.isRequired)
  const completedTasks = requiredTasks.filter(p => p.status === 'APPROVED')
  const progressPercentage = requiredTasks.length > 0
    ? Math.round((completedTasks.length / requiredTasks.length) * 100)
    : 0

  // Get time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'success' | 'warning' | 'info' | 'destructive' | 'secondary'; label: string }> = {
      APPROVED: { variant: 'success', label: 'Approved' },
      SUBMITTED: { variant: 'warning', label: 'Submitted' },
      IN_PROGRESS: { variant: 'info', label: 'In Progress' },
      REJECTED: { variant: 'destructive', label: 'Rejected' },
      ENROLLED: { variant: 'info', label: 'Enrolled' },
      COMPLETED: { variant: 'success', label: 'Completed' },
    }
    const config = variants[status] || { variant: 'secondary' as const, label: status.replace('_', ' ') }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section - Amber themed */}
      <div className="relative overflow-hidden bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-6 text-white shadow-lg">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjEuNSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjEpIi8+PC9nPjwvc3ZnPg==')] opacity-50"></div>
        <div className="relative">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">
                {getGreeting()}, {ambassador.firstName}!
              </h1>
              <p className="mt-1 text-amber-100 flex items-center gap-2">
                <User className="h-4 w-4" />
                Your coach: {ambassador.coach.firstName} {ambassador.coach.lastName}
              </p>
            </div>
            <Badge
              variant={ambassador.status === 'APPROVED' ? 'success' : 'warning'}
              size="lg"
              className="bg-white/20 text-white border-white/30"
            >
              {ambassador.status === 'APPROVED' ? 'Active' : ambassador.status}
            </Badge>
          </div>
        </div>
      </div>

      {/* Onboarding Progress Card */}
      <Card variant="default">
        <CardHeader>
          <SectionHeader
            title="Onboarding Progress"
            icon={ClipboardList}
            iconClassName="text-amber-500"
            actions={
              <Link href="/ambassador/onboarding">
                <Button variant="ghost" size="sm">
                  View All <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            }
          />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Progress bar */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  {completedTasks.length} of {requiredTasks.length} tasks completed
                </span>
                <span className="text-lg font-bold text-amber-600">{progressPercentage}%</span>
              </div>
              <Progress value={progressPercentage} className="h-2.5" />
            </div>

            {/* Task list preview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {ambassador.onboardingProgress.slice(0, 4).map((progress) => (
                <div
                  key={progress.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors"
                >
                  {progress.status === 'APPROVED' ? (
                    <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    </div>
                  ) : progress.status === 'SUBMITTED' ? (
                    <div className="h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-yellow-600" />
                    </div>
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                      <AlertCircle className="w-4 h-4 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {progress.task.label}
                    </p>
                    {getStatusBadge(progress.status)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Business Idea & Classes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Business Idea Card */}
        <Card variant="default">
          <CardHeader>
            <SectionHeader
              title="Business Idea"
              icon={Lightbulb}
              iconClassName="text-amber-500"
              actions={
                <Link href="/ambassador/business-idea">
                  <Button variant="ghost" size="sm">
                    {ambassador.businessIdea ? 'View' : 'Create'} <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              }
            />
          </CardHeader>
          <CardContent>
            {ambassador.businessIdea ? (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100">
                  <h3 className="font-semibold text-gray-900 mb-2">
                    {ambassador.businessIdea.title}
                  </h3>
                  {getStatusBadge(ambassador.businessIdea.status)}
                </div>
                {ambassador.businessIdea.feedback && (
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                    <p className="text-xs font-medium text-blue-700 mb-1">Coach Feedback</p>
                    <p className="text-sm text-blue-800">
                      {ambassador.businessIdea.feedback}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <InlineEmptyState
                icon={Lightbulb}
                message="No business idea submitted yet"
                action={{
                  label: 'Create Business Idea',
                  href: '/ambassador/business-idea',
                }}
              />
            )}
          </CardContent>
        </Card>

        {/* Classes Card */}
        <Card variant="default">
          <CardHeader>
            <SectionHeader
              title="My Classes"
              icon={GraduationCap}
              iconClassName="text-amber-500"
              actions={
                <Link href="/ambassador/classes">
                  <Button variant="ghost" size="sm">
                    Browse <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              }
            />
          </CardHeader>
          <CardContent>
            {ambassador.classEnrollments.length > 0 ? (
              <div className="space-y-3">
                {ambassador.classEnrollments.slice(0, 3).map((enrollment) => (
                  <div
                    key={enrollment.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center">
                        <GraduationCap className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {enrollment.class.title}
                        </p>
                        {enrollment.class.date && (
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            <Calendar className="h-3 w-3" />
                            {new Date(enrollment.class.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                    {getStatusBadge(enrollment.status)}
                  </div>
                ))}
              </div>
            ) : (
              <InlineEmptyState
                icon={GraduationCap}
                message="No classes enrolled yet"
                action={{
                  label: 'Browse Classes',
                  href: '/ambassador/classes',
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card variant="default">
        <CardHeader>
          <SectionHeader title="Quick Actions" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link href="/ambassador/onboarding" className="quick-action group">
              <ClipboardList className="h-6 w-6 text-gray-400 quick-action-icon mb-2 group-hover:text-amber-600" />
              <span className="text-sm font-medium text-gray-700 group-hover:text-amber-700">
                Continue Onboarding
              </span>
            </Link>
            <Link href="/ambassador/time" className="quick-action group">
              <Clock className="h-6 w-6 text-gray-400 quick-action-icon mb-2 group-hover:text-amber-600" />
              <span className="text-sm font-medium text-gray-700 group-hover:text-amber-700">
                Clock In/Out
              </span>
            </Link>
            <Link href="/ambassador/collaboration" className="quick-action group">
              <MessageSquare className="h-6 w-6 text-gray-400 quick-action-icon mb-2 group-hover:text-amber-600" />
              <span className="text-sm font-medium text-gray-700 group-hover:text-amber-700">
                Collaboration
              </span>
            </Link>
            <Link href="/ambassador/profile" className="quick-action group">
              <User className="h-6 w-6 text-gray-400 quick-action-icon mb-2 group-hover:text-amber-600" />
              <span className="text-sm font-medium text-gray-700 group-hover:text-amber-700">
                My Profile
              </span>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
