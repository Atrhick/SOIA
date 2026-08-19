'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isFeatureEnabled } from '@/lib/actions/feature-config'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import {
  DEFAULT_TIME_ZONE,
  MAX_SHIFT_MINUTES,
  addDaysInZone,
  buildShifts,
  isValidTimeZone,
  punchRejection,
  startOfDayInZone,
  startOfWeekInZone,
  statusFromLatest,
  totalShiftMinutes,
  type ClockPunch,
} from '@/lib/time-clock'

// ============================================
// Guards
// ============================================

// Same `ok` discriminant used in program-pages.ts and crm.ts: a union whose
// members differ only by an optional property does not narrow reliably.

const CLOCK_ROLES = ['COACH', 'AMBASSADOR'] as const

/**
 * Every read and write derives the user from the session.
 *
 * The previous version took `userId` as an argument on all six read actions and
 * checked nothing at all. Server actions are public POST endpoints, so that let
 * anyone read anyone else's punch history - including the notes and the GPS
 * coordinates the schema stores.
 *
 * An impersonating admin may read a timesheet but never punch on it: a punch
 * would be recorded as the coach's own attendance with nothing tying it back to
 * the admin who made it.
 */
async function requireUser({ allowImpersonation = false } = {}) {
  const session = await auth()
  if (!session) return { ok: false as const, error: 'Unauthorized' }

  const role = session.user.role as (typeof CLOCK_ROLES)[number]
  if (!CLOCK_ROLES.includes(role)) {
    return { ok: false as const, error: 'Unauthorized' }
  }
  if (session.user.isImpersonating && !allowImpersonation) {
    return { ok: false as const, error: 'Not available while impersonating another user' }
  }

  const enabled = await isFeatureEnabled('TIME_CLOCK', role, session.user.id)
  if (!enabled) {
    return { ok: false as const, error: 'This feature is not enabled for your account' }
  }

  return {
    ok: true as const,
    userId: session.user.id,
    role,
    readOnly: Boolean(session.user.isImpersonating),
  }
}

function revalidate() {
  revalidatePath('/coach/time')
  revalidatePath('/ambassador/time')
}

function resolveZone(timeZone?: string) {
  return isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE
}

// ============================================
// Clock in / out
// ============================================

const punchSchema = z.object({
  type: z.enum(['CLOCK_IN', 'CLOCK_OUT', 'BREAK_START', 'BREAK_END']),
  notes: z.string().trim().max(500, 'Notes are limited to 500 characters').optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
})

/** Two identical punches this close together are a double submit, not two events. */
const DUPLICATE_WINDOW_MS = 3000

/**
 * The single entry point for attendance punches.
 *
 * Legal transitions are enforced here rather than only by which buttons the
 * screen renders, because a stale tab, a back button or a replayed request can
 * post anything. Clocking out from a break records the break end too, so the
 * log stays well formed.
 */
export async function punch(input: unknown) {
  const ctx = await requireUser()
  if (!ctx.ok) return { error: ctx.error }

  const parsed = punchSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid request' }
  }
  const { type, notes, latitude, longitude } = parsed.data

  try {
    const result = await prisma.$transaction(async (tx) => {
      const latest = await tx.timeClockEntry.findFirst({
        where: { userId: ctx.userId },
        orderBy: { timestamp: 'desc' },
        select: { type: true, timestamp: true },
      })

      if (
        latest &&
        latest.type === type &&
        Date.now() - latest.timestamp.getTime() < DUPLICATE_WINDOW_MS
      ) {
        // Swallow the repeat rather than writing a second identical punch.
        return { status: statusFromLatest(latest.type as ClockPunch), duplicate: true }
      }

      const status = statusFromLatest(latest?.type as ClockPunch | undefined)
      const rejection = punchRejection(status, type)
      if (rejection) return { rejection }

      // Clocking out while on a break closes the break first, so the pairing
      // never has to guess when the break ended.
      if (type === 'CLOCK_OUT' && status === 'ON_BREAK') {
        await tx.timeClockEntry.create({
          data: { userId: ctx.userId, type: 'BREAK_END' },
        })
      }

      await tx.timeClockEntry.create({
        data: { userId: ctx.userId, type, notes: notes || null, latitude, longitude },
      })

      return { status: statusFromLatest(type) }
    })

    if ('rejection' in result && result.rejection) {
      return { error: result.rejection }
    }

    revalidate()
    return { success: true, status: result.status }
  } catch (error) {
    console.error('Error recording punch:', error)
    return { error: 'Could not record that. Please try again.' }
  }
}

const closeShiftSchema = z.object({
  endedAt: z.coerce.date(),
  notes: z.string().trim().max(500).optional(),
})

/**
 * Close an open shift at a time the person types in.
 *
 * Without this, someone who forgot to clock out on Friday can only clock out
 * now, banking a 70-hour shift they then have no way to correct.
 */
export async function clockOutAt(input: unknown) {
  const ctx = await requireUser()
  if (!ctx.ok) return { error: ctx.error }

  const parsed = closeShiftSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'Enter a valid date and time' }
  }
  const { endedAt, notes } = parsed.data

  try {
    const result = await prisma.$transaction(async (tx) => {
      const openFrom = await tx.timeClockEntry.findFirst({
        where: { userId: ctx.userId, type: 'CLOCK_IN' },
        orderBy: { timestamp: 'desc' },
        select: { timestamp: true },
      })
      const latest = await tx.timeClockEntry.findFirst({
        where: { userId: ctx.userId },
        orderBy: { timestamp: 'desc' },
        select: { type: true },
      })

      const status = statusFromLatest(latest?.type as ClockPunch | undefined)
      if (status === 'CLOCKED_OUT' || !openFrom) {
        return { rejection: 'You are not clocked in.' }
      }
      if (endedAt.getTime() <= openFrom.timestamp.getTime()) {
        return { rejection: 'The end time has to be after you clocked in.' }
      }
      if (endedAt.getTime() > Date.now() + 60_000) {
        return { rejection: 'The end time cannot be in the future.' }
      }

      if (status === 'ON_BREAK') {
        await tx.timeClockEntry.create({
          data: { userId: ctx.userId, type: 'BREAK_END', timestamp: endedAt },
        })
      }
      await tx.timeClockEntry.create({
        data: {
          userId: ctx.userId,
          type: 'CLOCK_OUT',
          timestamp: endedAt,
          notes: notes || 'Clock-out time entered by the user',
        },
      })
      return {}
    })

    if ('rejection' in result && result.rejection) return { error: result.rejection }

    revalidate()
    return { success: true }
  } catch (error) {
    console.error('Error closing shift:', error)
    return { error: 'Could not close that shift. Please try again.' }
  }
}

// ============================================
// Reads
// ============================================

/**
 * Everything the time clock screen renders, derived in one place so the status
 * badge, today's list and the weekly total can never disagree.
 */
export async function getMyTimeClock(timeZone?: string) {
  const ctx = await requireUser({ allowImpersonation: true })
  if (!ctx.ok) return { error: ctx.error }

  const zone = resolveZone(timeZone)
  const now = new Date()
  const weekStart = startOfWeekInZone(now, zone)
  const dayStart = startOfDayInZone(now, zone)
  const dayEnd = addDaysInZone(dayStart, 1, zone)

  // Reach back before the window so a shift that started earlier is paired with
  // the clock-out that falls inside it.
  const lookbackStart = addDaysInZone(weekStart, -7, zone)

  const [events, latest, runningTimer, timerEntries] = await Promise.all([
    prisma.timeClockEntry.findMany({
      where: { userId: ctx.userId, timestamp: { gte: lookbackStart } },
      orderBy: { timestamp: 'asc' },
      select: { id: true, type: true, timestamp: true, notes: true },
    }),
    prisma.timeClockEntry.findFirst({
      where: { userId: ctx.userId },
      orderBy: { timestamp: 'desc' },
      select: { type: true, timestamp: true },
    }),
    prisma.timeEntry.findFirst({
      where: { userId: ctx.userId, endTime: null },
      include: { project: { select: { id: true, name: true } }, task: { select: { id: true, title: true } } },
    }),
    prisma.timeEntry.findMany({
      where: { userId: ctx.userId, startTime: { gte: weekStart }, endTime: { not: null } },
      select: { duration: true, isBillable: true },
    }),
  ])

  const serialised = events.map((e) => ({
    id: e.id,
    type: e.type as ClockPunch,
    timestamp: e.timestamp.toISOString(),
    notes: e.notes,
  }))

  const shifts = buildShifts(serialised, now)
  const weekShifts = shifts.filter((s) => new Date(s.start) >= weekStart)
  const todayShifts = shifts.filter((s) => {
    const start = new Date(s.start)
    return start >= dayStart && start < dayEnd
  })

  const status = statusFromLatest(latest?.type as ClockPunch | undefined)
  const openShift = shifts.find((s) => s.open) ?? null

  const timerMinutes = timerEntries.reduce((sum, e) => sum + (e.duration ?? 0), 0)
  const billableMinutes = timerEntries
    .filter((e) => e.isBillable)
    .reduce((sum, e) => sum + (e.duration ?? 0), 0)

  return {
    readOnly: ctx.readOnly,
    timeZone: zone,
    status,
    since: latest?.timestamp.toISOString() ?? null,
    openShift,
    /** The open shift has run past a plausible working day. */
    staleShift: Boolean(openShift && openShift.workedMinutes > MAX_SHIFT_MINUTES),
    todayEvents: serialised
      .filter((e) => {
        const at = new Date(e.timestamp)
        return at >= dayStart && at < dayEnd
      })
      .reverse(),
    todayShifts,
    weekShifts,
    weekStart: weekStart.toISOString(),
    weekEnd: addDaysInZone(weekStart, 7, zone).toISOString(),
    weekTotals: totalShiftMinutes(weekShifts),
    todayTotals: totalShiftMinutes(todayShifts),
    projectTimer: runningTimer
      ? {
          id: runningTimer.id,
          startTime: runningTimer.startTime.toISOString(),
          description: runningTimer.description,
          project: runningTimer.project,
          task: runningTimer.task,
        }
      : null,
    projectWeek: {
      totalMinutes: timerMinutes,
      billableMinutes,
      entryCount: timerEntries.length,
    },
  }
}

// ============================================
// Project timer
// ============================================

const timerStartSchema = z.object({
  projectId: z.string().cuid().optional().nullable(),
  taskId: z.string().cuid().optional().nullable(),
  description: z.string().trim().max(500).optional(),
})

export async function startTimer(input: unknown) {
  const ctx = await requireUser()
  if (!ctx.ok) return { error: ctx.error }

  const parsed = timerStartSchema.safeParse(input ?? {})
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid request' }
  }

  try {
    const entry = await prisma.$transaction(async (tx) => {
      const running = await tx.timeEntry.findFirst({
        where: { userId: ctx.userId, endTime: null },
        select: { id: true },
      })
      if (running) return null
      return tx.timeEntry.create({
        data: {
          userId: ctx.userId,
          projectId: parsed.data.projectId || null,
          taskId: parsed.data.taskId || null,
          description: parsed.data.description || null,
          startTime: new Date(),
        },
      })
    })

    if (!entry) return { error: 'You already have a timer running' }

    revalidate()
    return { success: true, entryId: entry.id, startTime: entry.startTime.toISOString() }
  } catch (error) {
    // The partial unique index on (userId) where endTime is null turns the
    // check-then-create race into a constraint violation instead of a second
    // running timer.
    if (typeof error === 'object' && error && (error as { code?: string }).code === 'P2002') {
      return { error: 'You already have a timer running' }
    }
    console.error('Error starting timer:', error)
    return { error: 'Could not start the timer. Please try again.' }
  }
}

export async function stopTimer() {
  const ctx = await requireUser()
  if (!ctx.ok) return { error: ctx.error }

  try {
    const running = await prisma.timeEntry.findFirst({
      where: { userId: ctx.userId, endTime: null },
    })
    if (!running) return { error: 'No timer is running' }

    const endTime = new Date()
    const duration = Math.max(
      0,
      Math.round((endTime.getTime() - running.startTime.getTime()) / 60000)
    )

    await prisma.timeEntry.update({
      where: { id: running.id },
      data: { endTime, duration },
    })

    revalidate()
    return { success: true, duration }
  } catch (error) {
    console.error('Error stopping timer:', error)
    return { error: 'Could not stop the timer. Please try again.' }
  }
}

// ============================================
// Project time entries
// ============================================

/** A single entry longer than this is a mistake, not a work session. */
const MAX_ENTRY_MINUTES = 24 * 60

const timeEntrySchema = z
  .object({
    projectId: z.string().cuid().optional().nullable(),
    taskId: z.string().cuid().optional().nullable(),
    description: z.string().trim().max(500).optional(),
    startTime: z.coerce.date(),
    endTime: z.coerce.date().optional().nullable(),
    isBillable: z.boolean().default(false),
  })
  .refine((d) => !d.endTime || d.endTime > d.startTime, {
    message: 'The end time has to be after the start time',
    path: ['endTime'],
  })
  .refine(
    (d) => !d.endTime || d.endTime.getTime() - d.startTime.getTime() <= MAX_ENTRY_MINUTES * 60000,
    { message: 'An entry cannot be longer than 24 hours', path: ['endTime'] }
  )

function readEntryForm(formData: FormData) {
  const endTime = formData.get('endTime') as string | null
  return {
    projectId: (formData.get('projectId') as string) || null,
    taskId: (formData.get('taskId') as string) || null,
    description: (formData.get('description') as string) || undefined,
    startTime: formData.get('startTime') as string,
    endTime: endTime || null,
    isBillable: formData.get('isBillable') === 'true',
  }
}

export async function createTimeEntry(formData: FormData) {
  const ctx = await requireUser()
  if (!ctx.ok) return { error: ctx.error }

  const validated = timeEntrySchema.safeParse(readEntryForm(formData))
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? 'Validation failed' }
  }
  const { startTime, endTime } = validated.data

  try {
    const entry = await prisma.timeEntry.create({
      data: {
        userId: ctx.userId,
        projectId: validated.data.projectId,
        taskId: validated.data.taskId,
        description: validated.data.description,
        startTime,
        endTime,
        duration: endTime ? Math.round((endTime.getTime() - startTime.getTime()) / 60000) : null,
        isBillable: validated.data.isBillable,
      },
    })

    revalidate()
    return { success: true, entryId: entry.id }
  } catch (error) {
    console.error('Error creating time entry:', error)
    return { error: 'Could not save that entry. Please try again.' }
  }
}

export async function updateTimeEntry(entryId: string, formData: FormData) {
  const ctx = await requireUser()
  if (!ctx.ok) return { error: ctx.error }

  const validated = timeEntrySchema.safeParse(readEntryForm(formData))
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? 'Validation failed' }
  }
  const { startTime, endTime } = validated.data

  try {
    // Scoped to the owner: without this, any signed-in user could rewrite any
    // entry in the table by guessing an id.
    const updated = await prisma.timeEntry.updateMany({
      where: { id: entryId, userId: ctx.userId },
      data: {
        projectId: validated.data.projectId,
        taskId: validated.data.taskId,
        description: validated.data.description,
        startTime,
        endTime,
        duration: endTime ? Math.round((endTime.getTime() - startTime.getTime()) / 60000) : null,
        isBillable: validated.data.isBillable,
      },
    })
    if (updated.count === 0) return { error: 'Entry not found' }

    revalidate()
    return { success: true }
  } catch (error) {
    console.error('Error updating time entry:', error)
    return { error: 'Could not update that entry. Please try again.' }
  }
}

export async function deleteTimeEntry(entryId: string) {
  const ctx = await requireUser()
  if (!ctx.ok) return { error: ctx.error }

  try {
    const deleted = await prisma.timeEntry.deleteMany({
      where: { id: entryId, userId: ctx.userId },
    })
    if (deleted.count === 0) return { error: 'Entry not found' }

    revalidate()
    return { success: true }
  } catch (error) {
    console.error('Error deleting time entry:', error)
    return { error: 'Could not delete that entry. Please try again.' }
  }
}

export async function getMyTimeEntries(rangeStart?: string, rangeEnd?: string) {
  const ctx = await requireUser({ allowImpersonation: true })
  if (!ctx.ok) return { error: ctx.error }

  const gte = rangeStart ? new Date(rangeStart) : undefined
  const lte = rangeEnd ? new Date(rangeEnd) : undefined

  try {
    const entries = await prisma.timeEntry.findMany({
      where: {
        userId: ctx.userId,
        ...(gte || lte ? { startTime: { gte, lte } } : {}),
      },
      include: {
        project: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
      },
      orderBy: { startTime: 'desc' },
      take: 200,
    })

    return {
      entries: entries.map((e) => ({
        id: e.id,
        description: e.description,
        startTime: e.startTime.toISOString(),
        endTime: e.endTime?.toISOString() ?? null,
        duration: e.duration,
        isBillable: e.isBillable,
        project: e.project,
        task: e.task,
      })),
    }
  } catch (error) {
    console.error('Error getting time entries:', error)
    return { error: 'Could not load your entries' }
  }
}
