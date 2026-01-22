import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { CoachOnboardingClient } from './onboarding-client'

// LMS Course and Survey IDs (migrated from old courses)
const LMS_ANTI_TRAFFICKING_COURSE_ID = 'cmkk6bhdw0000yub4q0jj1tn2'
const LMS_ANTI_TRAFFICKING_QUIZ_ID = 'cmkk6bhe50007yub4yvjxa220'

async function getOnboardingData(userId: string) {
  const [coachProfile, tasks, lmsEnrollment, quizSubmission] = await Promise.all([
    prisma.coachProfile.findUnique({
      where: { userId },
      include: {
        onboardingProgress: {
          include: { task: true },
        },
        ambassadors: {
          where: { status: 'APPROVED' },
        },
      },
    }),
    prisma.onboardingTask.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    }),
    // Check LMS course completion
    prisma.lMSEnrollment.findFirst({
      where: {
        userId,
        courseId: LMS_ANTI_TRAFFICKING_COURSE_ID,
        status: 'COMPLETED',
      },
    }),
    // Check Survey quiz submission (passed)
    prisma.surveySubmission.findFirst({
      where: {
        userId,
        surveyId: LMS_ANTI_TRAFFICKING_QUIZ_ID,
        passed: true,
      },
    }),
  ])

  return { coachProfile, tasks, lmsEnrollment, quizSubmission }
}

export default async function OnboardingPage() {
  const session = await auth()

  if (!session || session.user.role !== 'COACH') {
    redirect('/login')
  }

  const { coachProfile, tasks, lmsEnrollment, quizSubmission } = await getOnboardingData(session.user.id)

  if (!coachProfile) {
    redirect('/login')
  }

  // Build progress map
  const progressMap: Record<string, { taskId: string; status: string }> = {}
  coachProfile.onboardingProgress.forEach((p) => {
    progressMap[p.taskId] = { taskId: p.taskId, status: p.status }
  })

  // Serialize tasks
  const serializedTasks = tasks.map((t) => ({
    id: t.id,
    label: t.label,
    description: t.description,
    type: t.type,
    isRequired: t.isRequired,
    sortOrder: t.sortOrder,
  }))

  // Calculate completion
  const requiredTasks = tasks.filter((t) => t.isRequired)
  const completedRequired = requiredTasks.filter(
    (t) => progressMap[t.id]?.status === 'APPROVED'
  ).length
  const completionPercentage = requiredTasks.length > 0
    ? (completedRequired / requiredTasks.length) * 100
    : 0

  // Check if quiz passed (now using Survey submission)
  const quizPassed = quizSubmission !== null

  // Check if course completed (LMS enrollment)
  const courseCompleted = lmsEnrollment !== null

  return (
    <CoachOnboardingClient
      tasks={serializedTasks}
      progressMap={progressMap}
      completedRequired={completedRequired}
      requiredTasksCount={requiredTasks.length}
      completionPercentage={completionPercentage}
      coachStatus={coachProfile.coachStatus}
      ambassadorsCount={coachProfile.ambassadors.length}
      quizPassed={quizPassed}
      courseCompleted={courseCompleted}
    />
  )
}
