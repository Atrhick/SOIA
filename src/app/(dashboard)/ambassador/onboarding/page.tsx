import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AmbassadorOnboardingClient } from './onboarding-client'

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

  // Serialize data for client component
  const serializedProgress = ambassador.onboardingProgress.map(p => ({
    id: p.id,
    status: p.status,
    notes: p.notes,
    completedAt: p.completedAt?.toISOString() || null,
    task: {
      id: p.task.id,
      label: p.task.label,
      description: p.task.description,
      type: p.task.type,
      isRequired: p.task.isRequired,
      sortOrder: p.task.sortOrder,
    },
  }))

  const requiredTasks = ambassador.onboardingProgress.filter(p => p.task.isRequired)
  const completedTasks = requiredTasks.filter(p => p.status === 'APPROVED')
  const progressPercentage = requiredTasks.length > 0
    ? Math.round((completedTasks.length / requiredTasks.length) * 100)
    : 0

  return (
    <AmbassadorOnboardingClient
      progress={serializedProgress}
      progressPercentage={progressPercentage}
      completedCount={completedTasks.length}
      requiredCount={requiredTasks.length}
    />
  )
}
