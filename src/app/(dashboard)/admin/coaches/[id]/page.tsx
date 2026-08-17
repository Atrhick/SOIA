import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { CoachDetail } from './coach-detail'

async function getCoach(coachId: string) {
  return prisma.coachProfile.findUnique({
    where: { id: coachId },
    include: {
      // Never select the whole User row here: CoachDetail is a client
      // component, so every field fetched is serialized into the page HTML.
      // Only email and status are actually used.
      user: { select: { id: true, email: true, status: true } },
      recruiter: { select: { id: true, firstName: true, lastName: true } },
      recruitedCoaches: { select: { id: true, firstName: true, lastName: true } },
      ambassadors: { select: { id: true, firstName: true, lastName: true, status: true, email: true } },
      onboardingProgress: {
        include: { task: true },
      },
      quizResults: {
        include: { course: { select: { id: true, name: true } } },
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
