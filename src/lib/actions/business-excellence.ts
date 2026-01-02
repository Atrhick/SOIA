'use server'

import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// Validation schemas
const outreachTargetSchema = z.object({
  category: z.enum([
    'NEW_CONTACTS',
    'FOLLOW_UPS',
    'INVITATIONS_PRESENTATIONS',
    'SOCIAL_MEDIA_POSTS',
    'REFERRALS_INTRODUCTIONS',
    'COLLABORATION_OUTREACH',
  ]),
  period: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
  target: z.number().int().min(0),
})

const outreachLogSchema = z.object({
  date: z.string().min(1),
  category: z.enum([
    'NEW_CONTACTS',
    'FOLLOW_UPS',
    'INVITATIONS_PRESENTATIONS',
    'SOCIAL_MEDIA_POSTS',
    'REFERRALS_INTRODUCTIONS',
    'COLLABORATION_OUTREACH',
  ]),
  quantity: z.number().int().min(1),
  notes: z.string().optional(),
})

// Helper to get current coach
async function getCurrentCoach() {
  const session = await auth()
  if (!session || session.user.role !== 'COACH') {
    return null
  }

  return prisma.coachProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      businessExcellenceCRM: true,
      websiteContentStatus: true,
      outreachTargets: true,
      outreachLogs: {
        orderBy: { date: 'desc' },
        take: 50,
      },
    },
  })
}

// Toggle CRM activation
export async function toggleCRMActivation(activated: boolean, provider?: string) {
  const coach = await getCurrentCoach()
  if (!coach) {
    return { error: 'Unauthorized' }
  }

  try {
    await prisma.businessExcellenceCRM.upsert({
      where: { coachId: coach.id },
      create: {
        coachId: coach.id,
        crmActivated: activated,
        crmProvider: provider,
        activationDate: activated ? new Date() : null,
      },
      update: {
        crmActivated: activated,
        crmProvider: provider,
        activationDate: activated ? new Date() : null,
      },
    })

    revalidatePath('/coach/business-excellence')
    return { success: true }
  } catch (error) {
    console.error('Error toggling CRM:', error)
    return { error: 'Failed to update CRM status' }
  }
}

// Update website content status
export async function updateWebsiteContent(formData: FormData) {
  const coach = await getCurrentCoach()
  if (!coach) {
    return { error: 'Unauthorized' }
  }

  const data = {
    logoSubmitted: formData.get('logoSubmitted') === 'true',
    logoUrl: formData.get('logoUrl') as string || null,
    servicesSubmitted: formData.get('servicesSubmitted') === 'true',
    servicesDescription: formData.get('servicesDescription') as string || null,
    productsSubmitted: formData.get('productsSubmitted') === 'true',
    productsDescription: formData.get('productsDescription') as string || null,
    aboutSubmitted: formData.get('aboutSubmitted') === 'true',
    aboutContent: formData.get('aboutContent') as string || null,
    testimonialsSubmitted: formData.get('testimonialsSubmitted') === 'true',
    testimonialsCount: parseInt(formData.get('testimonialsCount') as string || '0'),
    contactInfoSubmitted: formData.get('contactInfoSubmitted') === 'true',
    contactEmail: formData.get('contactEmail') as string || null,
    contactPhone: formData.get('contactPhone') as string || null,
  }

  try {
    await prisma.websiteContentStatus.upsert({
      where: { coachId: coach.id },
      create: {
        coachId: coach.id,
        ...data,
      },
      update: data,
    })

    revalidatePath('/coach/business-excellence')
    return { success: true }
  } catch (error) {
    console.error('Error updating website content:', error)
    return { error: 'Failed to update website content' }
  }
}

// Set outreach target
export async function setOutreachTarget(data: {
  category: string
  period: string
  target: number
}) {
  const coach = await getCurrentCoach()
  if (!coach) {
    return { error: 'Unauthorized' }
  }

  const validated = outreachTargetSchema.safeParse(data)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Invalid input' }
  }

  try {
    await prisma.outreachActivityTarget.upsert({
      where: {
        coachId_category_period: {
          coachId: coach.id,
          category: validated.data.category,
          period: validated.data.period,
        },
      },
      create: {
        coachId: coach.id,
        category: validated.data.category,
        period: validated.data.period,
        target: validated.data.target,
      },
      update: {
        target: validated.data.target,
      },
    })

    revalidatePath('/coach/business-excellence')
    return { success: true }
  } catch (error) {
    console.error('Error setting outreach target:', error)
    return { error: 'Failed to set target' }
  }
}

// Log outreach activity
export async function logOutreachActivity(formData: FormData) {
  const coach = await getCurrentCoach()
  if (!coach) {
    return { error: 'Unauthorized' }
  }

  const data = {
    date: formData.get('date') as string,
    category: formData.get('category') as string,
    quantity: parseInt(formData.get('quantity') as string || '0'),
    notes: formData.get('notes') as string || undefined,
  }

  const validated = outreachLogSchema.safeParse(data)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Invalid input' }
  }

  try {
    await prisma.outreachActivityLog.create({
      data: {
        coachId: coach.id,
        date: new Date(validated.data.date),
        category: validated.data.category as any,
        quantity: validated.data.quantity,
        notes: validated.data.notes,
      },
    })

    revalidatePath('/coach/business-excellence')
    return { success: true }
  } catch (error) {
    console.error('Error logging outreach:', error)
    return { error: 'Failed to log activity' }
  }
}

// Delete outreach log
export async function deleteOutreachLog(logId: string) {
  const coach = await getCurrentCoach()
  if (!coach) {
    return { error: 'Unauthorized' }
  }

  const log = await prisma.outreachActivityLog.findFirst({
    where: {
      id: logId,
      coachId: coach.id,
    },
  })

  if (!log) {
    return { error: 'Log not found' }
  }

  try {
    await prisma.outreachActivityLog.delete({
      where: { id: logId },
    })

    revalidatePath('/coach/business-excellence')
    return { success: true }
  } catch (error) {
    console.error('Error deleting log:', error)
    return { error: 'Failed to delete log' }
  }
}

// Get outreach stats for a period
export async function getOutreachStats(period: 'DAILY' | 'WEEKLY' | 'MONTHLY') {
  const coach = await getCurrentCoach()
  if (!coach) {
    return { error: 'Unauthorized' }
  }

  const now = new Date()
  let startDate: Date

  switch (period) {
    case 'DAILY':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      break
    case 'WEEKLY':
      const dayOfWeek = now.getDay()
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek)
      break
    case 'MONTHLY':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      break
  }

  const logs = await prisma.outreachActivityLog.findMany({
    where: {
      coachId: coach.id,
      date: { gte: startDate },
    },
  })

  const targets = await prisma.outreachActivityTarget.findMany({
    where: {
      coachId: coach.id,
      period,
    },
  })

  // Calculate totals by category
  const totals: Record<string, number> = {}
  logs.forEach((log) => {
    totals[log.category] = (totals[log.category] || 0) + log.quantity
  })

  // Create stats with progress
  const stats = targets.map((target) => ({
    category: target.category,
    target: target.target,
    actual: totals[target.category] || 0,
    progress: target.target > 0 ? Math.round(((totals[target.category] || 0) / target.target) * 100) : 0,
  }))

  return { stats }
}
