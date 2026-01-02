import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { AdminEventsClient } from './admin-events-client'

async function getAllEvents() {
  return prisma.event.findMany({
    orderBy: { startDate: 'desc' },
    include: {
      rsvps: {
        include: {
          coach: true,
        },
      },
      qualifications: {
        include: {
          coach: true,
        },
      },
    },
  })
}

export default async function AdminEventsPage() {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  const events = await getAllEvents()

  // Serialize data
  const serializedEvents = events.map((e) => ({
    id: e.id,
    name: e.name,
    description: e.description,
    location: e.location,
    startDate: e.startDate.toISOString(),
    endDate: e.endDate?.toISOString() || null,
    requireOnboardingComplete: e.requireOnboardingComplete,
    requiredApprovedAmbassadors: e.requiredApprovedAmbassadors,
    isActive: e.isActive,
    createdAt: e.createdAt.toISOString(),
    rsvpCounts: {
      yes: e.rsvps.filter((r) => r.status === 'YES').length,
      no: e.rsvps.filter((r) => r.status === 'NO').length,
      maybe: e.rsvps.filter((r) => r.status === 'MAYBE').length,
    },
    qualifiedCount: e.qualifications.filter((q) => q.status === 'QUALIFIED').length,
  }))

  // Stats
  const now = new Date()
  const stats = {
    total: events.length,
    upcoming: events.filter((e) => new Date(e.startDate) > now).length,
    active: events.filter((e) => e.isActive).length,
    totalRsvps: events.reduce((sum, e) => sum + e.rsvps.filter((r) => r.status === 'YES').length, 0),
  }

  return <AdminEventsClient events={serializedEvents} stats={stats} />
}
