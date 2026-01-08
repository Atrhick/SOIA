'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// ============================================
// CLOCK IN/OUT
// ============================================

export async function getCurrentClockStatus(userId: string) {
  try {
    const latestEntry = await prisma.timeClockEntry.findFirst({
      where: { userId },
      orderBy: { timestamp: 'desc' },
    })

    if (!latestEntry) {
      return { status: 'CLOCKED_OUT', lastEntry: null }
    }

    const status = latestEntry.type === 'CLOCK_IN' ? 'CLOCKED_IN' :
                   latestEntry.type === 'BREAK_START' ? 'ON_BREAK' :
                   'CLOCKED_OUT'

    return { status, lastEntry: latestEntry }
  } catch (error) {
    console.error('Error getting clock status:', error)
    return { status: 'CLOCKED_OUT', lastEntry: null }
  }
}

export async function clockIn(notes?: string, location?: { latitude: number; longitude: number }) {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  try {
    const entry = await prisma.timeClockEntry.create({
      data: {
        userId: session.user.id,
        type: 'CLOCK_IN',
        notes,
        latitude: location?.latitude,
        longitude: location?.longitude,
      },
    })

    revalidatePath('/coach/time')
    revalidatePath('/ambassador/time')

    return { success: true, entry }
  } catch (error) {
    console.error('Error clocking in:', error)
    return { error: 'Failed to clock in' }
  }
}

export async function clockOut(notes?: string, location?: { latitude: number; longitude: number }) {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  try {
    const entry = await prisma.timeClockEntry.create({
      data: {
        userId: session.user.id,
        type: 'CLOCK_OUT',
        notes,
        latitude: location?.latitude,
        longitude: location?.longitude,
      },
    })

    revalidatePath('/coach/time')
    revalidatePath('/ambassador/time')

    return { success: true, entry }
  } catch (error) {
    console.error('Error clocking out:', error)
    return { error: 'Failed to clock out' }
  }
}

export async function startBreak(notes?: string) {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  try {
    const entry = await prisma.timeClockEntry.create({
      data: {
        userId: session.user.id,
        type: 'BREAK_START',
        notes,
      },
    })

    revalidatePath('/coach/time')
    revalidatePath('/ambassador/time')

    return { success: true, entry }
  } catch (error) {
    console.error('Error starting break:', error)
    return { error: 'Failed to start break' }
  }
}

export async function endBreak(notes?: string) {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  try {
    const entry = await prisma.timeClockEntry.create({
      data: {
        userId: session.user.id,
        type: 'BREAK_END',
        notes,
      },
    })

    revalidatePath('/coach/time')
    revalidatePath('/ambassador/time')

    return { success: true, entry }
  } catch (error) {
    console.error('Error ending break:', error)
    return { error: 'Failed to end break' }
  }
}

export async function getClockHistory(userId: string, startDate?: Date, endDate?: Date) {
  try {
    const entries = await prisma.timeClockEntry.findMany({
      where: {
        userId,
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { timestamp: 'desc' },
    })

    return { entries }
  } catch (error) {
    console.error('Error getting clock history:', error)
    return { error: 'Failed to get clock history' }
  }
}

export async function getTodayClockEntries(userId: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  return getClockHistory(userId, today, tomorrow)
}

// ============================================
// TIME ENTRIES (Project-based time tracking)
// ============================================

const timeEntrySchema = z.object({
  projectId: z.string().optional().nullable(),
  taskId: z.string().optional().nullable(),
  description: z.string().optional(),
  startTime: z.string(),
  endTime: z.string().optional().nullable(),
  isBillable: z.boolean().default(false),
})

export async function createTimeEntry(formData: FormData) {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  const rawData = {
    projectId: formData.get('projectId') as string || null,
    taskId: formData.get('taskId') as string || null,
    description: formData.get('description') as string || undefined,
    startTime: formData.get('startTime') as string,
    endTime: formData.get('endTime') as string || null,
    isBillable: formData.get('isBillable') === 'true',
  }

  const validated = timeEntrySchema.safeParse(rawData)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Validation failed' }
  }

  try {
    const startTime = new Date(validated.data.startTime)
    const endTime = validated.data.endTime ? new Date(validated.data.endTime) : null
    const duration = endTime ? Math.round((endTime.getTime() - startTime.getTime()) / 60000) : null

    const entry = await prisma.timeEntry.create({
      data: {
        userId: session.user.id,
        projectId: validated.data.projectId,
        taskId: validated.data.taskId,
        description: validated.data.description,
        startTime,
        endTime,
        duration,
        isBillable: validated.data.isBillable,
      },
    })

    revalidatePath('/coach/time')
    revalidatePath('/ambassador/time')

    return { success: true, entryId: entry.id }
  } catch (error) {
    console.error('Error creating time entry:', error)
    return { error: 'Failed to create time entry' }
  }
}

export async function updateTimeEntry(entryId: string, formData: FormData) {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  const rawData = {
    projectId: formData.get('projectId') as string || null,
    taskId: formData.get('taskId') as string || null,
    description: formData.get('description') as string || undefined,
    startTime: formData.get('startTime') as string,
    endTime: formData.get('endTime') as string || null,
    isBillable: formData.get('isBillable') === 'true',
  }

  const validated = timeEntrySchema.safeParse(rawData)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Validation failed' }
  }

  try {
    const startTime = new Date(validated.data.startTime)
    const endTime = validated.data.endTime ? new Date(validated.data.endTime) : null
    const duration = endTime ? Math.round((endTime.getTime() - startTime.getTime()) / 60000) : null

    await prisma.timeEntry.update({
      where: { id: entryId },
      data: {
        projectId: validated.data.projectId,
        taskId: validated.data.taskId,
        description: validated.data.description,
        startTime,
        endTime,
        duration,
        isBillable: validated.data.isBillable,
      },
    })

    revalidatePath('/coach/time')
    revalidatePath('/ambassador/time')

    return { success: true }
  } catch (error) {
    console.error('Error updating time entry:', error)
    return { error: 'Failed to update time entry' }
  }
}

export async function deleteTimeEntry(entryId: string) {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  try {
    await prisma.timeEntry.delete({
      where: { id: entryId },
    })

    revalidatePath('/coach/time')
    revalidatePath('/ambassador/time')

    return { success: true }
  } catch (error) {
    console.error('Error deleting time entry:', error)
    return { error: 'Failed to delete time entry' }
  }
}

export async function getTimeEntries(userId: string, startDate?: Date, endDate?: Date) {
  try {
    const entries = await prisma.timeEntry.findMany({
      where: {
        userId,
        startTime: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        project: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
      },
      orderBy: { startTime: 'desc' },
    })

    return { entries }
  } catch (error) {
    console.error('Error getting time entries:', error)
    return { error: 'Failed to get time entries' }
  }
}

export async function getWeeklyTimeStats(userId: string) {
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay())
  weekStart.setHours(0, 0, 0, 0)

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 7)

  try {
    const entries = await prisma.timeEntry.findMany({
      where: {
        userId,
        startTime: { gte: weekStart, lt: weekEnd },
      },
    })

    const totalMinutes = entries.reduce((sum, entry) => sum + (entry.duration || 0), 0)
    const billableMinutes = entries
      .filter((e) => e.isBillable)
      .reduce((sum, entry) => sum + (entry.duration || 0), 0)

    return {
      totalMinutes,
      totalHours: Math.round((totalMinutes / 60) * 10) / 10,
      billableMinutes,
      billableHours: Math.round((billableMinutes / 60) * 10) / 10,
      entryCount: entries.length,
    }
  } catch (error) {
    console.error('Error getting weekly stats:', error)
    return { totalMinutes: 0, totalHours: 0, billableMinutes: 0, billableHours: 0, entryCount: 0 }
  }
}

// Start a timer (creates an entry with no end time)
export async function startTimer(projectId?: string, taskId?: string, description?: string) {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  try {
    // Check if there's already a running timer
    const runningTimer = await prisma.timeEntry.findFirst({
      where: {
        userId: session.user.id,
        endTime: null,
      },
    })

    if (runningTimer) {
      return { error: 'You already have a timer running' }
    }

    const entry = await prisma.timeEntry.create({
      data: {
        userId: session.user.id,
        projectId: projectId || null,
        taskId: taskId || null,
        description,
        startTime: new Date(),
      },
    })

    revalidatePath('/coach/time')
    revalidatePath('/ambassador/time')

    return { success: true, entryId: entry.id }
  } catch (error) {
    console.error('Error starting timer:', error)
    return { error: 'Failed to start timer' }
  }
}

// Stop the running timer
export async function stopTimer() {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  try {
    const runningTimer = await prisma.timeEntry.findFirst({
      where: {
        userId: session.user.id,
        endTime: null,
      },
    })

    if (!runningTimer) {
      return { error: 'No timer running' }
    }

    const endTime = new Date()
    const duration = Math.round((endTime.getTime() - runningTimer.startTime.getTime()) / 60000)

    await prisma.timeEntry.update({
      where: { id: runningTimer.id },
      data: { endTime, duration },
    })

    revalidatePath('/coach/time')
    revalidatePath('/ambassador/time')

    return { success: true, duration }
  } catch (error) {
    console.error('Error stopping timer:', error)
    return { error: 'Failed to stop timer' }
  }
}

export async function getRunningTimer(userId: string) {
  try {
    const timer = await prisma.timeEntry.findFirst({
      where: {
        userId,
        endTime: null,
      },
      include: {
        project: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
      },
    })

    return { timer }
  } catch (error) {
    console.error('Error getting running timer:', error)
    return { timer: null }
  }
}
