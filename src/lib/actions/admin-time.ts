'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { entryRangeError, resolveZone, weekDays, type EntryView } from '@/lib/time'
import {
  ENTRY_INCLUDE,
  entryDiff,
  findOverlap,
  overlapMessage,
  projectsForUser,
  toEntryView,
} from '@/lib/time-entries'

async function requireAdmin() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') return { ok: false as const, error: 'Unauthorized' }
  // Edits are attributed to the admin who made them, which is only true when
  // they are signed in as themselves.
  if (session.user.isImpersonating) {
    return { ok: false as const, error: 'Not available while impersonating another user' }
  }
  return { ok: true as const, userId: session.user.id }
}

function revalidate() {
  revalidatePath('/admin/time')
  revalidatePath('/coach/time')
  revalidatePath('/ambassador/time')
}

const PROFILE_SELECT = {
  email: true,
  role: true,
  coachProfile: { select: { firstName: true, lastName: true } },
  ambassadorProfile: { select: { firstName: true, lastName: true } },
  associateProfile: { select: { firstName: true, lastName: true } },
} as const

type WithProfiles = {
  email: string
  coachProfile: { firstName: string; lastName: string } | null
  ambassadorProfile: { firstName: string; lastName: string } | null
  associateProfile: { firstName: string; lastName: string } | null
}

/** User has no name column, so it comes from whichever profile exists. */
function displayName(user: WithProfiles) {
  const p = user.coachProfile ?? user.ambassadorProfile ?? user.associateProfile
  const name = p ? `${p.firstName} ${p.lastName}`.trim() : ''
  return name || user.email
}

// ============================================
// Timesheet
// ============================================

export interface TimesheetPerson {
  userId: string
  name: string
  role: string
  entries: EntryView[]
}

export interface AdminProject {
  id: string
  name: string
  isShared: boolean
  archived: boolean
  ownerId: string
  ownerName: string | null
}

export interface Timesheet {
  timeZone: string
  asOf: string
  weekOffset: number
  days: string[]
  people: TimesheetPerson[]
  projects: AdminProject[]
}

/** Everyone's entries for one week, plus every running timer whenever it started. */
export async function getTimesheet(weekOffset = 0, timeZone?: string) {
  const ctx = await requireAdmin()
  if (!ctx.ok) return { error: ctx.error }

  const zone = resolveZone(timeZone)
  const days = weekDays(zone, weekOffset)
  const weekEnd = weekDays(zone, weekOffset + 1)[0]

  const [rows, projects] = await Promise.all([
    prisma.timeEntry.findMany({
      // Running timers belong to the current week's view only.
      where: {
        OR: [{ startTime: { gte: days[0], lt: weekEnd } }, ...(weekOffset === 0 ? [{ endTime: null }] : [])],
      },
      include: { ...ENTRY_INCLUDE, user: { select: { id: true, ...PROFILE_SELECT } } },
      orderBy: { startTime: 'asc' },
    }),
    prisma.project.findMany({
      select: { id: true, name: true, isShared: true, archivedAt: true, ownerId: true },
      orderBy: [{ isShared: 'desc' }, { name: 'asc' }],
    }),
  ])

  const people = new Map<string, TimesheetPerson>()
  for (const row of rows) {
    let person = people.get(row.userId)
    if (!person) {
      person = { userId: row.userId, name: displayName(row.user), role: row.user.role, entries: [] }
      people.set(row.userId, person)
    }
    person.entries.push(toEntryView(row))
  }

  const owners = await prisma.user.findMany({
    where: { id: { in: Array.from(new Set(projects.filter((p) => !p.isShared).map((p) => p.ownerId))) } },
    select: { id: true, ...PROFILE_SELECT },
  })
  const ownerNames = new Map(owners.map((o) => [o.id, displayName(o)]))

  const data: Timesheet = {
    timeZone: zone,
    asOf: new Date().toISOString(),
    weekOffset,
    days: days.map((d) => d.toISOString()),
    people: Array.from(people.values()).sort((a, b) => a.name.localeCompare(b.name)),
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      isShared: p.isShared,
      archived: p.archivedAt !== null,
      ownerId: p.ownerId,
      ownerName: p.isShared ? null : (ownerNames.get(p.ownerId) ?? null),
    })),
  }
  return data
}

export interface EntryHistoryItem {
  at: string
  editorName: string | null
  reason: string | null
  diff: Record<string, [string | null, string | null]>
}

export async function getEntryHistory(entryId: string) {
  const ctx = await requireAdmin()
  if (!ctx.ok) return { error: ctx.error }

  const entry = await prisma.timeEntry.findUnique({
    where: { id: entryId },
    select: {
      createdAt: true,
      isManual: true,
      user: { select: PROFILE_SELECT },
      changes: {
        orderBy: { createdAt: 'asc' },
        include: { editor: { select: PROFILE_SELECT } },
      },
    },
  })
  if (!entry) return { error: 'Entry not found.' }

  return {
    createdAt: entry.createdAt.toISOString(),
    createdBy: displayName(entry.user),
    isManual: entry.isManual,
    changes: entry.changes.map<EntryHistoryItem>((c) => ({
      at: c.createdAt.toISOString(),
      editorName: c.editor ? displayName(c.editor) : null,
      reason: c.reason,
      diff: c.diff as EntryHistoryItem['diff'],
    })),
  }
}

// ============================================
// Corrections
// ============================================

const reasonSchema = z.string().trim().min(3, 'Give a reason for the change').max(500)

const adminEntrySchema = z.object({
  id: z.string().cuid(),
  description: z.string().trim().max(500).optional(),
  projectId: z.string().cuid().nullable().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  reason: reasonSchema,
})

/** Corrects anyone's entry, including stopping a forgotten timer. A reason is required and kept. */
export async function adminUpdateEntry(input: unknown) {
  const ctx = await requireAdmin()
  if (!ctx.ok) return { error: ctx.error }

  const parsed = adminEntrySchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  const { id, description, projectId, reason } = parsed.data

  const startTime = new Date(parsed.data.startTime)
  const endTime = new Date(parsed.data.endTime)
  const rangeError = entryRangeError(startTime, endTime)
  if (rangeError) return { error: rangeError }

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.timeEntry.findUnique({ where: { id }, include: { user: { select: { role: true } } } })
    if (!existing) return { error: 'Entry not found.' }

    // The project must be one the person could pick, or the one already on the entry.
    if (projectId && projectId !== existing.projectId) {
      const allowed = await tx.project.findFirst({
        where: { id: projectId, ...projectsForUser(existing.userId, existing.user.role) },
        select: { id: true },
      })
      if (!allowed) return { error: 'That project is not available to this person.' }
    }

    const overlap = await findOverlap(tx, existing.userId, startTime, endTime, id)
    if (overlap) return { error: overlapMessage(overlap) }

    const values = { description: description || null, projectId: projectId ?? null, startTime, endTime }
    const diff = entryDiff(existing, values)
    if (!diff) return { success: true as const }

    await tx.timeEntry.update({ where: { id }, data: values })
    await tx.timeEntryChange.create({ data: { entryId: id, editorId: ctx.userId, reason, diff } })
    return { success: true as const }
  })

  if ('error' in result) return result
  revalidate()
  return result
}

/** Deletes anyone's entry. The entry's history goes with it, so the audit log keeps the record. */
export async function adminDeleteEntry(input: unknown) {
  const ctx = await requireAdmin()
  if (!ctx.ok) return { error: ctx.error }

  const parsed = z.object({ id: z.string().cuid(), reason: reasonSchema }).safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const entry = await prisma.timeEntry.findUnique({ where: { id: parsed.data.id } })
  if (!entry) return { error: 'Entry not found.' }

  await prisma.$transaction([
    prisma.timeEntry.delete({ where: { id: entry.id } }),
    prisma.auditLog.create({
      data: {
        userId: ctx.userId,
        action: 'DELETE_TIME_ENTRY',
        entityType: 'TimeEntry',
        entityId: entry.id,
        details: JSON.stringify({
          reason: parsed.data.reason,
          ownerId: entry.userId,
          description: entry.description,
          projectId: entry.projectId,
          startTime: entry.startTime.toISOString(),
          endTime: entry.endTime?.toISOString() ?? null,
        }),
      },
    }),
  ])

  revalidate()
  return { success: true }
}

// ============================================
// Projects
// ============================================

const projectNameSchema = z.string().trim().min(1, 'Enter a project name').max(100)

export async function createSharedProject(name: unknown) {
  const ctx = await requireAdmin()
  if (!ctx.ok) return { error: ctx.error }

  const parsed = projectNameSchema.safeParse(name)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid name' }

  const duplicate = await prisma.project.findFirst({
    where: { isShared: true, archivedAt: null, name: { equals: parsed.data, mode: 'insensitive' } },
    select: { id: true },
  })
  if (duplicate) return { error: 'A shared project with that name already exists.' }

  await prisma.project.create({
    data: { name: parsed.data, ownerId: ctx.userId, ownerType: 'ADMIN', isShared: true, status: 'ACTIVE' },
  })
  revalidate()
  return { success: true }
}

const updateProjectSchema = z.object({
  id: z.string().cuid(),
  name: projectNameSchema.optional(),
  archived: z.boolean().optional(),
})

/** Renames or archives any project. Archived projects keep their hours. */
export async function updateProject(input: unknown) {
  const ctx = await requireAdmin()
  if (!ctx.ok) return { error: ctx.error }

  const parsed = updateProjectSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  const { id, name, archived } = parsed.data

  const { count } = await prisma.project.updateMany({
    where: { id },
    data: {
      name,
      archivedAt: archived === undefined ? undefined : archived ? new Date() : null,
    },
  })
  if (count === 0) return { error: 'Project not found.' }

  revalidate()
  return { success: true }
}
