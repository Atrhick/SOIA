'use server'

import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isFeatureEnabled } from '@/lib/actions/feature-config'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { entryRangeError, isRunaway, resolveZone, weekDays, type EntryView, type ProjectOption } from '@/lib/time'
import {
  ENTRY_INCLUDE,
  entryDiff,
  findOverlap,
  overlapMessage,
  projectsForUser,
  toEntryView,
} from '@/lib/time-entries'

const TRACKER_ROLES = ['COACH', 'AMBASSADOR'] as const

/**
 * The user always comes from the session. An impersonating admin may look but
 * not write: the entry would be recorded as the coach's own time.
 */
async function requireTracker({ write = true } = {}) {
  const session = await auth()
  if (!session) return { ok: false as const, error: 'Unauthorized' }

  const role = session.user.role as (typeof TRACKER_ROLES)[number]
  if (!TRACKER_ROLES.includes(role)) return { ok: false as const, error: 'Unauthorized' }
  if (write && session.user.isImpersonating) {
    return { ok: false as const, error: 'Not available while impersonating another user' }
  }
  if (!(await isFeatureEnabled('TIME_CLOCK', role, session.user.id))) {
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
  revalidatePath('/admin/time')
}

/** Coaches log time to shared or their own projects, ambassadors to shared ones only. */
async function checkProject(userId: string, role: string, projectId: string | null | undefined) {
  if (!projectId) return { ok: true as const, projectId: null }
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...projectsForUser(userId, role) },
    select: { id: true },
  })
  if (!project) return { ok: false as const, error: 'That project is not available.' }
  return { ok: true as const, projectId: project.id }
}

// ============================================
// Reads
// ============================================

export interface MyTime {
  timeZone: string
  /** When this was read; the screen's clock starts here so it renders the same on server and client. */
  asOf: string
  readOnly: boolean
  /** False hides the project picker: an ambassador with no shared projects to pick from. */
  useProjects: boolean
  /** Only coaches add projects of their own. */
  canCreateProjects: boolean
  running: EntryView | null
  /** This week and last, newest first. */
  entries: EntryView[]
  weekStart: string
  projects: { shared: ProjectOption[]; mine: ProjectOption[] }
}

export async function getMyTime(timeZone?: string) {
  const ctx = await requireTracker({ write: false })
  if (!ctx.ok) return { error: ctx.error }

  const zone = resolveZone(timeZone)
  const days = weekDays(zone)
  const lastWeekStart = weekDays(zone, -1)[0]

  const [rows, projects] = await Promise.all([
    prisma.timeEntry.findMany({
      where: { userId: ctx.userId, OR: [{ startTime: { gte: lastWeekStart } }, { endTime: null }] },
      include: ENTRY_INCLUDE,
      orderBy: { startTime: 'desc' },
    }),
    prisma.project.findMany({
      where: projectsForUser(ctx.userId, ctx.role),
      select: { id: true, name: true, isShared: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const entries = rows.map(toEntryView)
  const data: MyTime = {
    timeZone: zone,
    asOf: new Date().toISOString(),
    readOnly: ctx.readOnly,
    useProjects: ctx.role === 'COACH' || projects.length > 0,
    canCreateProjects: ctx.role === 'COACH',
    running: entries.find((e) => !e.endTime) ?? null,
    entries,
    weekStart: days[0].toISOString(),
    projects: {
      shared: projects.filter((p) => p.isShared).map(({ id, name }) => ({ id, name })),
      mine: projects.filter((p) => !p.isShared).map(({ id, name }) => ({ id, name })),
    },
  }
  return data
}

// ============================================
// Timer
// ============================================

const startSchema = z.object({
  description: z.string().trim().max(500).optional(),
  projectId: z.string().cuid().nullable().optional(),
})

/** Starts a timer, stopping any that is already running (Resume on another entry switches). */
export async function startTimer(input: unknown) {
  const ctx = await requireTracker()
  if (!ctx.ok) return { error: ctx.error }

  const parsed = startSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const project = await checkProject(ctx.userId, ctx.role, parsed.data.projectId)
  if (!project.ok) return { error: project.error }

  // Switching would close a forgotten timer at now and record a phantom day.
  const current = await prisma.timeEntry.findFirst({ where: { userId: ctx.userId, endTime: null } })
  if (current && isRunaway({ startTime: current.startTime.toISOString(), endTime: null })) {
    return { error: 'Your last timer is still running. Set the time you stopped it first.' }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const now = new Date()
      await tx.timeEntry.updateMany({
        where: { userId: ctx.userId, endTime: null },
        data: { endTime: now },
      })
      await tx.timeEntry.create({
        data: {
          userId: ctx.userId,
          projectId: project.projectId,
          description: parsed.data.description || null,
          startTime: now,
        },
      })
    })
  } catch (error) {
    // Two starts racing: the one-running-timer index rejects the second.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { error: 'A timer is already running.' }
    }
    console.error('startTimer failed:', error)
    return { error: 'Could not start the timer.' }
  }

  revalidate()
  return { success: true }
}

const stopSchema = z.object({
  /** When the person actually stopped, for a timer they forgot. Defaults to now. */
  endTime: z.string().datetime().optional(),
})

export async function stopTimer(input: unknown = {}) {
  const ctx = await requireTracker()
  if (!ctx.ok) return { error: ctx.error }

  const parsed = stopSchema.safeParse(input)
  if (!parsed.success) return { error: 'Enter a valid end time.' }

  const running = await prisma.timeEntry.findFirst({ where: { userId: ctx.userId, endTime: null } })
  if (!running) return { error: 'No timer is running.' }

  const endTime = parsed.data.endTime ? new Date(parsed.data.endTime) : new Date()
  const rangeError = entryRangeError(running.startTime, endTime)
  if (rangeError) return { error: rangeError }

  // Conditional on still running, so a double click cannot stop it twice.
  const { count } = await prisma.timeEntry.updateMany({
    where: { id: running.id, endTime: null },
    data: { endTime },
  })
  if (count === 0) return { error: 'No timer is running.' }

  revalidate()
  return { success: true }
}

// ============================================
// Entries
// ============================================

const entrySchema = z.object({
  id: z.string().cuid().optional(),
  description: z.string().trim().max(500).optional(),
  projectId: z.string().cuid().nullable().optional(),
  startTime: z.string().datetime(),
  /**
   * Null when editing the running timer's description, project or start. If
   * the timer was stopped in the meantime (blur then Stop), its end is kept.
   */
  endTime: z.string().datetime().nullable(),
})

/** Adds time that was not timed, or edits one of your own entries. */
export async function saveEntry(input: unknown) {
  const ctx = await requireTracker()
  if (!ctx.ok) return { error: ctx.error }

  const parsed = entrySchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  const { id, description } = parsed.data

  const startTime = new Date(parsed.data.startTime)
  const project = await checkProject(ctx.userId, ctx.role, parsed.data.projectId)
  if (!project.ok) return { error: project.error }

  const result = await prisma.$transaction(async (tx) => {
    const existing = id
      ? await tx.timeEntry.findFirst({ where: { id, userId: ctx.userId } })
      : null
    if (id && !existing) return { error: 'Entry not found.' }
    if (!parsed.data.endTime && !existing) return { error: 'Enter an end time.' }
    // No end given on an existing entry: keep whatever end it has (null if still running).
    const endTime = parsed.data.endTime ? new Date(parsed.data.endTime) : (existing?.endTime ?? null)

    const rangeError = entryRangeError(startTime, endTime)
    if (rangeError) return { error: rangeError }

    const overlap = await findOverlap(tx, ctx.userId, startTime, endTime, id)
    if (overlap) return { error: overlapMessage(overlap) }

    const values = { description: description || null, projectId: project.projectId, startTime, endTime }
    if (!existing) {
      await tx.timeEntry.create({ data: { ...values, userId: ctx.userId, isManual: true } })
      return { success: true as const }
    }

    const diff = entryDiff(existing, values)
    if (diff) {
      await tx.timeEntry.update({ where: { id: existing.id }, data: values })
      await tx.timeEntryChange.create({ data: { entryId: existing.id, editorId: ctx.userId, diff } })
    }
    return { success: true as const }
  })

  if ('error' in result) return result
  revalidate()
  return result
}

export async function deleteEntry(entryId: unknown) {
  const ctx = await requireTracker()
  if (!ctx.ok) return { error: ctx.error }

  const parsed = z.string().cuid().safeParse(entryId)
  if (!parsed.success) return { error: 'Entry not found.' }

  // Scoped to the user, so nobody else's entry can match. Nothing deleted means
  // it is already gone (a second click before the list refreshed): still done.
  await prisma.timeEntry.deleteMany({ where: { id: parsed.data, userId: ctx.userId } })

  revalidate()
  return { success: true }
}

// ============================================
// Projects
// ============================================

const projectNameSchema = z.string().trim().min(1, 'Enter a project name').max(100)

/**
 * Creates a personal project for a coach. If the coach already has one by that
 * name, or a shared one exists, that is returned instead of a duplicate.
 */
export async function createMyProject(name: unknown) {
  const ctx = await requireTracker()
  if (!ctx.ok) return { error: ctx.error }
  if (ctx.role !== 'COACH') return { error: 'Unauthorized' }

  const parsed = projectNameSchema.safeParse(name)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid name' }

  const existing = await prisma.project.findFirst({
    where: { ...projectsForUser(ctx.userId, ctx.role), name: { equals: parsed.data, mode: 'insensitive' } },
    select: { id: true, name: true },
  })
  if (existing) return { success: true, project: existing }

  const project = await prisma.project.create({
    data: { name: parsed.data, ownerId: ctx.userId, ownerType: 'COACH', status: 'ACTIVE' },
    select: { id: true, name: true },
  })
  revalidate()
  return { success: true, project }
}
