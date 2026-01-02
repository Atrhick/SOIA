import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { CoachEventsClient } from './coach-events-client'

async function getCoachEvents(coachId: string) {
  const events = await prisma.event.findMany({
    where: { isActive: true },
    orderBy: { startDate: 'asc' },
    include: {
      rsvps: {
        where: { coachId },
      },
      qualifications: {
        where: { coachId },
      },
    },
  })

  return events
}

async function getCoachData() {
  const session = await auth()
  if (!session || session.user.role !== 'COACH') {
    return null
  }

  const coach = await prisma.coachProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      ambassadors: {
        where: { status: 'APPROVED' },
      },
    },
  })

  return coach
}

export default async function EventsPage() {
  const session = await auth()

  if (!session || session.user.role !== 'COACH') {
    redirect('/login')
  }

  const coach = await getCoachData()

  if (!coach) {
    redirect('/login')
  }

  const events = await getCoachEvents(coach.id)

  // Serialize data with qualification status
  const serializedEvents = events.map((e) => {
    const rsvp = e.rsvps[0]
    const qualification = e.qualifications[0]

    // Calculate qualification
    let isQualified = true
    const qualificationReasons: string[] = []

    if (e.requireOnboardingComplete && coach.coachStatus !== 'ACTIVE_COACH') {
      isQualified = false
      qualificationReasons.push('Onboarding must be complete')
    }

    if (e.requiredApprovedAmbassadors > 0) {
      const approvedCount = coach.ambassadors.length
      if (approvedCount < e.requiredApprovedAmbassadors) {
        isQualified = false
        qualificationReasons.push(
          `Need ${e.requiredApprovedAmbassadors} approved ambassadors (have ${approvedCount})`
        )
      }
    }

    return {
      id: e.id,
      name: e.name,
      description: e.description,
      location: e.location,
      startDate: e.startDate.toISOString(),
      endDate: e.endDate?.toISOString() || null,
      requireOnboardingComplete: e.requireOnboardingComplete,
      requiredApprovedAmbassadors: e.requiredApprovedAmbassadors,
      rsvpStatus: rsvp?.status || null,
      isQualified,
      qualificationReasons,
    }
  })

  // Filter to only upcoming events
  const now = new Date()
  const upcomingEvents = serializedEvents.filter(
    (e) => new Date(e.startDate) >= now
  )
  const pastEvents = serializedEvents.filter(
    (e) => new Date(e.startDate) < now
  )

  return (
    <CoachEventsClient
      upcomingEvents={upcomingEvents}
      pastEvents={pastEvents}
    />
  )
}
