import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { BusinessIdeasClient } from './business-ideas-client'

export default async function AdminBusinessIdeasPage() {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  const businessIdeas = await prisma.businessIdea.findMany({
    include: {
      ambassador: {
        include: {
          coach: {
            select: { firstName: true, lastName: true },
          },
        },
      },
    },
    orderBy: [
      { status: 'asc' },
      { submittedAt: 'asc' },
    ],
  })

  // Serialize data
  const serializedIdeas = businessIdeas.map(idea => ({
    ...idea,
    submittedAt: idea.submittedAt?.toISOString() || null,
    reviewedAt: idea.reviewedAt?.toISOString() || null,
    createdAt: idea.createdAt.toISOString(),
    updatedAt: idea.updatedAt.toISOString(),
    ambassador: {
      ...idea.ambassador,
      dateOfBirth: idea.ambassador.dateOfBirth?.toISOString() || null,
      createdAt: idea.ambassador.createdAt.toISOString(),
      updatedAt: idea.ambassador.updatedAt.toISOString(),
      powerTeamJoinedAt: idea.ambassador.powerTeamJoinedAt?.toISOString() || null,
    },
  }))

  return <BusinessIdeasClient businessIdeas={serializedIdeas} />
}
