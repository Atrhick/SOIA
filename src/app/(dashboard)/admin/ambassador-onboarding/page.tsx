import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AmbassadorOnboardingClient } from './ambassador-onboarding-client'

export default async function AdminAmbassadorOnboardingPage() {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  const ambassadors = await prisma.ambassador.findMany({
    where: {
      userId: { not: null },
    },
    include: {
      user: {
        select: { email: true, status: true },
      },
      coach: {
        select: { firstName: true, lastName: true },
      },
      onboardingProgress: {
        include: { task: true },
        orderBy: { task: { sortOrder: 'asc' } },
      },
      businessIdea: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  const tasks = await prisma.ambassadorOnboardingTask.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  })

  // Serialize data
  const serializedAmbassadors = ambassadors.map(a => ({
    ...a,
    dateOfBirth: a.dateOfBirth?.toISOString() || null,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    powerTeamJoinedAt: a.powerTeamJoinedAt?.toISOString() || null,
    onboardingProgress: a.onboardingProgress.map(p => ({
      ...p,
      completedAt: p.completedAt?.toISOString() || null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      task: {
        ...p.task,
        createdAt: p.task.createdAt.toISOString(),
        updatedAt: p.task.updatedAt.toISOString(),
      },
    })),
    businessIdea: a.businessIdea ? {
      ...a.businessIdea,
      submittedAt: a.businessIdea.submittedAt?.toISOString() || null,
      reviewedAt: a.businessIdea.reviewedAt?.toISOString() || null,
      createdAt: a.businessIdea.createdAt.toISOString(),
      updatedAt: a.businessIdea.updatedAt.toISOString(),
    } : null,
  }))

  const serializedTasks = tasks.map(t => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }))

  return (
    <AmbassadorOnboardingClient
      ambassadors={serializedAmbassadors}
      tasks={serializedTasks}
    />
  )
}
