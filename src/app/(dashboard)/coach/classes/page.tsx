import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ClassesClient } from './classes-client'

export default async function CoachClassesPage() {
  const session = await auth()

  if (!session || session.user.role !== 'COACH') {
    redirect('/login')
  }

  const coachProfile = await prisma.coachProfile.findUnique({
    where: { userId: session.user.id },
  })

  if (!coachProfile) {
    redirect('/login')
  }

  const classes = await prisma.coachClass.findMany({
    where: { coachId: coachProfile.id },
    include: {
      enrollments: {
        include: {
          ambassador: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      },
      _count: {
        select: { enrollments: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Serialize data for client component
  const serializedClasses = classes.map(c => ({
    ...c,
    date: c.date?.toISOString() || null,
    price: c.price?.toNumber() || null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    enrollments: c.enrollments.map(e => ({
      ...e,
      enrolledAt: e.enrolledAt.toISOString(),
      attendedAt: e.attendedAt?.toISOString() || null,
    })),
  }))

  return <ClassesClient classes={serializedClasses} />
}
