import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { AdminClassesClient } from './admin-classes-client'

export default async function AdminClassesPage() {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  const classes = await prisma.coachClass.findMany({
    include: {
      coach: {
        include: {
          user: {
            select: { email: true },
          },
        },
      },
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
    id: c.id,
    title: c.title,
    description: c.description,
    date: c.date?.toISOString() || null,
    duration: c.duration,
    location: c.location,
    isOnline: c.isOnline,
    meetingLink: c.meetingLink,
    isFree: c.isFree,
    price: c.price?.toNumber() || null,
    maxCapacity: c.maxCapacity,
    isActive: c.isActive,
    createdAt: c.createdAt.toISOString(),
    coach: {
      id: c.coach.id,
      firstName: c.coach.firstName,
      lastName: c.coach.lastName,
      email: c.coach.user.email,
    },
    enrollments: c.enrollments.map(e => ({
      id: e.id,
      status: e.status,
      paymentStatus: e.paymentStatus,
      enrolledAt: e.enrolledAt.toISOString(),
      attendedAt: e.attendedAt?.toISOString() || null,
      ambassador: e.ambassador,
    })),
    _count: c._count,
  }))

  // Get stats
  const stats = {
    totalClasses: classes.length,
    activeClasses: classes.filter(c => c.isActive).length,
    totalEnrollments: classes.reduce((sum, c) => sum + c._count.enrollments, 0),
    onlineClasses: classes.filter(c => c.isOnline).length,
  }

  return <AdminClassesClient classes={serializedClasses} stats={stats} />
}
