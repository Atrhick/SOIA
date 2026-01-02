import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { ResourceCenterClient } from './resource-center-client'

async function getCoachData() {
  const session = await auth()
  if (!session || session.user.role !== 'COACH') {
    return null
  }

  const coach = await prisma.coachProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      recruitedCoaches: true,
      resourceCenterApp: true,
      resourceCenter: {
        include: {
          classes: {
            orderBy: { date: 'desc' },
          },
        },
      },
    },
  })

  return coach
}

export default async function ResourceCenterPage() {
  const session = await auth()

  if (!session || session.user.role !== 'COACH') {
    redirect('/login')
  }

  const coach = await getCoachData()

  if (!coach) {
    redirect('/login')
  }

  // Serialize data
  const application = coach.resourceCenterApp
    ? {
        id: coach.resourceCenterApp.id,
        proposedLocation: coach.resourceCenterApp.proposedLocation,
        communityDescription: coach.resourceCenterApp.communityDescription,
        visionAndGoals: coach.resourceCenterApp.visionAndGoals,
        capacityInfo: coach.resourceCenterApp.capacityInfo,
        status: coach.resourceCenterApp.status,
        declineReason: coach.resourceCenterApp.declineReason,
        reviewedAt: coach.resourceCenterApp.reviewedAt?.toISOString() || null,
        createdAt: coach.resourceCenterApp.createdAt.toISOString(),
      }
    : null

  const resourceCenter = coach.resourceCenter
    ? {
        id: coach.resourceCenter.id,
        name: coach.resourceCenter.name,
        location: coach.resourceCenter.location,
        description: coach.resourceCenter.description,
        classes: coach.resourceCenter.classes.map((c) => ({
          id: c.id,
          title: c.title,
          date: c.date.toISOString(),
          audienceType: c.audienceType,
          attendanceCount: c.attendanceCount,
          notes: c.notes,
        })),
      }
    : null

  // Calculate stats if has resource center
  const stats = resourceCenter
    ? {
        totalClasses: resourceCenter.classes.length,
        totalParticipants: resourceCenter.classes.reduce((sum, c) => sum + c.attendanceCount, 0),
        ambassadorClasses: resourceCenter.classes.filter((c) => c.audienceType === 'AMBASSADORS').length,
        adultClasses: resourceCenter.classes.filter((c) => c.audienceType === 'ADULTS').length,
      }
    : null

  return (
    <ResourceCenterClient
      recruitedCount={coach.recruitedCoaches.length}
      application={application}
      resourceCenter={resourceCenter}
      stats={stats}
    />
  )
}
