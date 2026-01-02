'use server'

import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// Validation schemas
const createEventSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  location: z.string().optional(),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional(),
  requireOnboardingComplete: z.boolean().default(false),
  requiredApprovedAmbassadors: z.number().int().min(0).default(0),
})

// Helper to check admin
async function isAdmin() {
  const session = await auth()
  return session?.user.role === 'ADMIN'
}

// Helper to get current coach
async function getCurrentCoach() {
  const session = await auth()
  if (!session || session.user.role !== 'COACH') {
    return null
  }

  return prisma.coachProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      ambassadors: {
        where: { status: 'APPROVED' },
      },
    },
  })
}

// Admin: Create event
export async function createEvent(formData: FormData) {
  if (!(await isAdmin())) {
    return { error: 'Unauthorized' }
  }

  const data = {
    name: formData.get('name') as string,
    description: formData.get('description') as string || undefined,
    location: formData.get('location') as string || undefined,
    startDate: formData.get('startDate') as string,
    endDate: formData.get('endDate') as string || undefined,
    requireOnboardingComplete: formData.get('requireOnboardingComplete') === 'true',
    requiredApprovedAmbassadors: parseInt(formData.get('requiredApprovedAmbassadors') as string || '0'),
  }

  const validated = createEventSchema.safeParse(data)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Invalid input' }
  }

  try {
    await prisma.event.create({
      data: {
        name: validated.data.name,
        description: validated.data.description,
        location: validated.data.location,
        startDate: new Date(validated.data.startDate),
        endDate: validated.data.endDate ? new Date(validated.data.endDate) : null,
        requireOnboardingComplete: validated.data.requireOnboardingComplete,
        requiredApprovedAmbassadors: validated.data.requiredApprovedAmbassadors,
      },
    })

    revalidatePath('/admin/events')
    revalidatePath('/coach/events')
    return { success: true }
  } catch (error) {
    console.error('Error creating event:', error)
    return { error: 'Failed to create event' }
  }
}

// Admin: Update event
export async function updateEvent(eventId: string, formData: FormData) {
  if (!(await isAdmin())) {
    return { error: 'Unauthorized' }
  }

  const data = {
    name: formData.get('name') as string,
    description: formData.get('description') as string || undefined,
    location: formData.get('location') as string || undefined,
    startDate: formData.get('startDate') as string,
    endDate: formData.get('endDate') as string || undefined,
    requireOnboardingComplete: formData.get('requireOnboardingComplete') === 'true',
    requiredApprovedAmbassadors: parseInt(formData.get('requiredApprovedAmbassadors') as string || '0'),
    isActive: formData.get('isActive') === 'true',
  }

  const validated = createEventSchema.safeParse(data)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Invalid input' }
  }

  try {
    await prisma.event.update({
      where: { id: eventId },
      data: {
        name: validated.data.name,
        description: validated.data.description,
        location: validated.data.location,
        startDate: new Date(validated.data.startDate),
        endDate: validated.data.endDate ? new Date(validated.data.endDate) : null,
        requireOnboardingComplete: validated.data.requireOnboardingComplete,
        requiredApprovedAmbassadors: validated.data.requiredApprovedAmbassadors,
        isActive: data.isActive,
      },
    })

    revalidatePath('/admin/events')
    revalidatePath('/coach/events')
    return { success: true }
  } catch (error) {
    console.error('Error updating event:', error)
    return { error: 'Failed to update event' }
  }
}

// Admin: Delete event
export async function deleteEvent(eventId: string) {
  if (!(await isAdmin())) {
    return { error: 'Unauthorized' }
  }

  try {
    await prisma.event.delete({
      where: { id: eventId },
    })

    revalidatePath('/admin/events')
    revalidatePath('/coach/events')
    return { success: true }
  } catch (error) {
    console.error('Error deleting event:', error)
    return { error: 'Failed to delete event' }
  }
}

// Coach: Submit RSVP
export async function submitRSVP(eventId: string, status: 'YES' | 'NO' | 'MAYBE', notes?: string) {
  const coach = await getCurrentCoach()
  if (!coach) {
    return { error: 'Unauthorized' }
  }

  try {
    await prisma.eventRSVP.upsert({
      where: {
        eventId_coachId: {
          eventId,
          coachId: coach.id,
        },
      },
      update: {
        status,
        notes,
      },
      create: {
        eventId,
        coachId: coach.id,
        status,
        notes,
      },
    })

    revalidatePath('/coach/events')
    return { success: true }
  } catch (error) {
    console.error('Error submitting RSVP:', error)
    return { error: 'Failed to submit RSVP' }
  }
}

// Check if coach qualifies for event
export async function checkQualification(eventId: string) {
  const coach = await getCurrentCoach()
  if (!coach) {
    return { error: 'Unauthorized' }
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
  })

  if (!event) {
    return { error: 'Event not found' }
  }

  // Check requirements
  let isQualified = true
  const reasons: string[] = []

  // Check onboarding requirement
  if (event.requireOnboardingComplete && coach.coachStatus !== 'ACTIVE_COACH') {
    isQualified = false
    reasons.push('Onboarding must be complete')
  }

  // Check ambassador requirement
  if (event.requiredApprovedAmbassadors > 0) {
    const approvedCount = coach.ambassadors.length
    if (approvedCount < event.requiredApprovedAmbassadors) {
      isQualified = false
      reasons.push(`Need ${event.requiredApprovedAmbassadors} approved ambassadors (have ${approvedCount})`)
    }
  }

  // Update qualification status
  try {
    await prisma.eventQualificationStatus.upsert({
      where: {
        eventId_coachId: {
          eventId,
          coachId: coach.id,
        },
      },
      update: {
        status: isQualified ? 'QUALIFIED' : 'NOT_QUALIFIED',
      },
      create: {
        eventId,
        coachId: coach.id,
        status: isQualified ? 'QUALIFIED' : 'NOT_QUALIFIED',
      },
    })

    return { isQualified, reasons }
  } catch (error) {
    console.error('Error checking qualification:', error)
    return { error: 'Failed to check qualification' }
  }
}
