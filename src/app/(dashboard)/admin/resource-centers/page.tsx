import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { AdminResourceCentersClient } from './admin-resource-centers-client'

async function getAllData() {
  const [applications, resourceCenters] = await Promise.all([
    prisma.resourceCenterApplication.findMany({
      orderBy: [
        { status: 'asc' },
        { createdAt: 'desc' },
      ],
      include: {
        coach: {
          include: {
            user: true,
            recruitedCoaches: true,
          },
        },
      },
    }),
    prisma.resourceCenter.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        owner: {
          include: { user: true },
        },
        classes: true,
      },
    }),
  ])

  return { applications, resourceCenters }
}

export default async function AdminResourceCentersPage() {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  const { applications, resourceCenters } = await getAllData()

  // Serialize applications
  const serializedApplications = applications.map((a) => ({
    id: a.id,
    proposedLocation: a.proposedLocation,
    communityDescription: a.communityDescription,
    visionAndGoals: a.visionAndGoals,
    capacityInfo: a.capacityInfo,
    status: a.status,
    declineReason: a.declineReason,
    reviewedAt: a.reviewedAt?.toISOString() || null,
    createdAt: a.createdAt.toISOString(),
    coach: {
      id: a.coach.id,
      name: `${a.coach.firstName} ${a.coach.lastName}`,
      email: a.coach.user.email,
      recruitedCount: a.coach.recruitedCoaches.length,
    },
  }))

  // Serialize resource centers
  const serializedCenters = resourceCenters.map((rc) => ({
    id: rc.id,
    name: rc.name,
    location: rc.location,
    description: rc.description,
    createdAt: rc.createdAt.toISOString(),
    owner: {
      id: rc.owner.id,
      name: `${rc.owner.firstName} ${rc.owner.lastName}`,
      email: rc.owner.user.email,
    },
    stats: {
      totalClasses: rc.classes.length,
      totalParticipants: rc.classes.reduce((sum, c) => sum + c.attendanceCount, 0),
    },
  }))

  // Stats
  const stats = {
    totalCenters: resourceCenters.length,
    pendingApplications: applications.filter((a) => a.status === 'UNDER_REVIEW').length,
    totalClasses: resourceCenters.reduce((sum, rc) => sum + rc.classes.length, 0),
    totalParticipants: resourceCenters.reduce(
      (sum, rc) => sum + rc.classes.reduce((s, c) => s + c.attendanceCount, 0),
      0
    ),
  }

  return (
    <AdminResourceCentersClient
      applications={serializedApplications}
      resourceCenters={serializedCenters}
      stats={stats}
    />
  )
}
