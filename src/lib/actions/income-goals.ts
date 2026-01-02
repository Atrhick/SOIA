'use server'

import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'

// Validation schemas
const weeklyGoalSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  targetValue: z.number().int().positive('Target must be a positive number'),
  weekStart: z.string().min(1, 'Week start date is required'),
  notes: z.string().optional(),
})

const incomeEntrySchema = z.object({
  date: z.string().min(1, 'Date is required'),
  activityType: z.enum(['OWN_SERVICES', 'TEACHING_CLASSES', 'FUNDRAISING', 'OTHER']),
  description: z.string().optional(),
  amount: z.number().positive('Amount must be positive'),
})

// Helper to get current coach
async function getCurrentCoach() {
  const session = await auth()
  if (!session || session.user.role !== 'COACH') {
    return null
  }

  return prisma.coachProfile.findUnique({
    where: { userId: session.user.id },
  })
}

// Weekly Goals Actions
export async function createWeeklyGoal(formData: FormData) {
  const coach = await getCurrentCoach()
  if (!coach) {
    return { error: 'Unauthorized' }
  }

  const data = {
    title: formData.get('title') as string,
    targetValue: parseInt(formData.get('targetValue') as string),
    weekStart: formData.get('weekStart') as string,
    notes: formData.get('notes') as string || undefined,
  }

  const validated = weeklyGoalSchema.safeParse(data)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Invalid input' }
  }

  try {
    const weekStart = new Date(validated.data.weekStart)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)

    // Check for existing goal in same week
    const existingGoal = await prisma.weeklyGoal.findFirst({
      where: {
        coachId: coach.id,
        weekStart: {
          gte: weekStart,
          lt: weekEnd,
        },
      },
    })

    if (existingGoal) {
      return { error: 'A goal already exists for this week' }
    }

    await prisma.weeklyGoal.create({
      data: {
        coachId: coach.id,
        title: validated.data.title,
        targetValue: validated.data.targetValue,
        weekStart,
        weekEnd,
        notes: validated.data.notes,
      },
    })

    revalidatePath('/coach/income-goals')
    return { success: true }
  } catch (error) {
    console.error('Error creating weekly goal:', error)
    return { error: 'Failed to create goal' }
  }
}

export async function updateWeeklyGoal(goalId: string, formData: FormData) {
  const coach = await getCurrentCoach()
  if (!coach) {
    return { error: 'Unauthorized' }
  }

  const goal = await prisma.weeklyGoal.findUnique({
    where: { id: goalId },
  })

  if (!goal || goal.coachId !== coach.id) {
    return { error: 'Goal not found' }
  }

  const actualValue = formData.get('actualValue')
  const notes = formData.get('notes') as string
  const status = formData.get('status') as string

  try {
    const updateData: {
      actualValue?: number
      notes?: string
      status?: 'PENDING' | 'COMPLETED' | 'PARTIALLY_COMPLETED' | 'NOT_COMPLETED'
    } = {}

    if (actualValue !== null && actualValue !== '') {
      updateData.actualValue = parseInt(actualValue as string)
    }
    if (notes !== null) {
      updateData.notes = notes
    }
    if (status) {
      updateData.status = status as 'PENDING' | 'COMPLETED' | 'PARTIALLY_COMPLETED' | 'NOT_COMPLETED'
    }

    await prisma.weeklyGoal.update({
      where: { id: goalId },
      data: updateData,
    })

    revalidatePath('/coach/income-goals')
    return { success: true }
  } catch (error) {
    console.error('Error updating weekly goal:', error)
    return { error: 'Failed to update goal' }
  }
}

export async function deleteWeeklyGoal(goalId: string) {
  const coach = await getCurrentCoach()
  if (!coach) {
    return { error: 'Unauthorized' }
  }

  const goal = await prisma.weeklyGoal.findUnique({
    where: { id: goalId },
  })

  if (!goal || goal.coachId !== coach.id) {
    return { error: 'Goal not found' }
  }

  try {
    await prisma.weeklyGoal.delete({
      where: { id: goalId },
    })

    revalidatePath('/coach/income-goals')
    return { success: true }
  } catch (error) {
    console.error('Error deleting weekly goal:', error)
    return { error: 'Failed to delete goal' }
  }
}

// Income Entry Actions
export async function createIncomeEntry(formData: FormData) {
  const coach = await getCurrentCoach()
  if (!coach) {
    return { error: 'Unauthorized' }
  }

  const data = {
    date: formData.get('date') as string,
    activityType: formData.get('activityType') as string,
    description: formData.get('description') as string || undefined,
    amount: parseFloat(formData.get('amount') as string),
  }

  const validated = incomeEntrySchema.safeParse(data)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Invalid input' }
  }

  try {
    await prisma.incomeEntry.create({
      data: {
        coachId: coach.id,
        date: new Date(validated.data.date),
        activityType: validated.data.activityType,
        description: validated.data.description,
        amount: new Decimal(validated.data.amount),
      },
    })

    revalidatePath('/coach/income-goals')
    return { success: true }
  } catch (error) {
    console.error('Error creating income entry:', error)
    return { error: 'Failed to create income entry' }
  }
}

export async function updateIncomeEntry(entryId: string, formData: FormData) {
  const coach = await getCurrentCoach()
  if (!coach) {
    return { error: 'Unauthorized' }
  }

  const entry = await prisma.incomeEntry.findUnique({
    where: { id: entryId },
  })

  if (!entry || entry.coachId !== coach.id) {
    return { error: 'Income entry not found' }
  }

  const data = {
    date: formData.get('date') as string,
    activityType: formData.get('activityType') as string,
    description: formData.get('description') as string || undefined,
    amount: parseFloat(formData.get('amount') as string),
  }

  const validated = incomeEntrySchema.safeParse(data)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Invalid input' }
  }

  try {
    await prisma.incomeEntry.update({
      where: { id: entryId },
      data: {
        date: new Date(validated.data.date),
        activityType: validated.data.activityType,
        description: validated.data.description,
        amount: new Decimal(validated.data.amount),
      },
    })

    revalidatePath('/coach/income-goals')
    return { success: true }
  } catch (error) {
    console.error('Error updating income entry:', error)
    return { error: 'Failed to update income entry' }
  }
}

export async function deleteIncomeEntry(entryId: string) {
  const coach = await getCurrentCoach()
  if (!coach) {
    return { error: 'Unauthorized' }
  }

  const entry = await prisma.incomeEntry.findUnique({
    where: { id: entryId },
  })

  if (!entry || entry.coachId !== coach.id) {
    return { error: 'Income entry not found' }
  }

  try {
    await prisma.incomeEntry.delete({
      where: { id: entryId },
    })

    revalidatePath('/coach/income-goals')
    return { success: true }
  } catch (error) {
    console.error('Error deleting income entry:', error)
    return { error: 'Failed to delete income entry' }
  }
}

// Get summary stats for a coach
export async function getIncomeGoalsSummary(period: 'week' | 'month' | 'year' = 'month') {
  const coach = await getCurrentCoach()
  if (!coach) {
    return { error: 'Unauthorized' }
  }

  const now = new Date()
  let startDate: Date

  switch (period) {
    case 'week':
      startDate = new Date(now)
      startDate.setDate(now.getDate() - now.getDay())
      startDate.setHours(0, 0, 0, 0)
      break
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      break
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1)
      break
  }

  try {
    const [incomeEntries, goals] = await Promise.all([
      prisma.incomeEntry.findMany({
        where: {
          coachId: coach.id,
          date: { gte: startDate },
        },
      }),
      prisma.weeklyGoal.findMany({
        where: {
          coachId: coach.id,
          weekStart: { gte: startDate },
        },
      }),
    ])

    const totalIncome = incomeEntries.reduce(
      (sum, entry) => sum + Number(entry.amount),
      0
    )

    const incomeByType = incomeEntries.reduce(
      (acc, entry) => {
        const type = entry.activityType
        acc[type] = (acc[type] || 0) + Number(entry.amount)
        return acc
      },
      {} as Record<string, number>
    )

    const goalsCompleted = goals.filter((g) => g.status === 'COMPLETED').length
    const goalsPending = goals.filter((g) => g.status === 'PENDING').length

    return {
      success: true,
      data: {
        totalIncome,
        incomeByType,
        totalEntries: incomeEntries.length,
        goalsCompleted,
        goalsPending,
        totalGoals: goals.length,
      },
    }
  } catch (error) {
    console.error('Error getting summary:', error)
    return { error: 'Failed to get summary' }
  }
}
