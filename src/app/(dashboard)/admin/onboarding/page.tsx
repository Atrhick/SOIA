import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { OnboardingConfigClient } from './onboarding-config-client'

export default async function AdminOnboardingConfigPage() {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  // Fetch coach onboarding tasks
  const coachTasks = await prisma.onboardingTask.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      _count: {
        select: { progress: true },
      },
    },
  })

  // Fetch ambassador onboarding tasks
  const ambassadorTasks = await prisma.ambassadorOnboardingTask.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      _count: {
        select: { progress: true },
      },
    },
  })

  // Serialize the data
  const serializedCoachTasks = coachTasks.map((task) => ({
    id: task.id,
    label: task.label,
    description: task.description,
    type: task.type,
    isRequired: task.isRequired,
    sortOrder: task.sortOrder,
    isActive: task.isActive,
    progressCount: task._count.progress,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  }))

  const serializedAmbassadorTasks = ambassadorTasks.map((task) => ({
    id: task.id,
    label: task.label,
    description: task.description,
    type: task.type,
    isRequired: task.isRequired,
    sortOrder: task.sortOrder,
    isActive: task.isActive,
    progressCount: task._count.progress,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Onboarding Configuration</h1>
        <p className="text-gray-600">
          Manage onboarding tasks for coaches and ambassadors
        </p>
      </div>

      <OnboardingConfigClient
        coachTasks={serializedCoachTasks}
        ambassadorTasks={serializedAmbassadorTasks}
      />
    </div>
  )
}
