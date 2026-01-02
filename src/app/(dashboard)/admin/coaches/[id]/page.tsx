import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { CoachDetail } from './coach-detail'

async function getCoach(coachId: string) {
  return prisma.coachProfile.findUnique({
    where: { id: coachId },
    include: {
      user: true,
      recruiter: true,
      recruitedCoaches: true,
      ambassadors: true,
      onboardingProgress: {
        include: { task: true },
      },
      quizResults: {
        include: { course: true },
      },
    },
  })
}

async function getOnboardingTasks() {
  return prisma.onboardingTask.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  })
}

export default async function CoachPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  const [coach, tasks] = await Promise.all([
    getCoach(params.id),
    getOnboardingTasks(),
  ])

  if (!coach) {
    notFound()
  }

  return <CoachDetail coach={coach} onboardingTasks={tasks} />
}
