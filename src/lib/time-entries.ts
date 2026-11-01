import type { Prisma } from '@prisma/client'
import type { EntryView } from '@/lib/time'

// Server-only helpers shared by actions/time.ts and actions/admin-time.ts.

type Tx = Prisma.TransactionClient

export const ENTRY_INCLUDE = { project: { select: { name: true } } } as const

type EntryRow = Prisma.TimeEntryGetPayload<{ include: typeof ENTRY_INCLUDE }>

export function toEntryView(e: EntryRow): EntryView {
  return {
    id: e.id,
    description: e.description,
    projectId: e.projectId,
    projectName: e.project?.name ?? null,
    startTime: e.startTime.toISOString(),
    endTime: e.endTime?.toISOString() ?? null,
    isManual: e.isManual,
  }
}

/** Projects `userId` may log time to: shared ones plus their own, never archived. */
export function projectsForUser(userId: string): Prisma.ProjectWhereInput {
  return { archivedAt: null, OR: [{ isShared: true }, { ownerId: userId }] }
}

/**
 * The entry of `userId`'s that overlaps [start, end), if any. A running timer
 * counts as lasting until now. `end` null means "still running from start".
 */
export async function findOverlap(
  tx: Tx,
  userId: string,
  start: Date,
  end: Date | null,
  excludeId?: string
) {
  const until = end ?? new Date()
  return tx.timeEntry.findFirst({
    where: {
      userId,
      id: excludeId ? { not: excludeId } : undefined,
      startTime: { lt: until },
      OR: [{ endTime: null }, { endTime: { gt: start } }],
    },
    include: ENTRY_INCLUDE,
  })
}

export function overlapMessage(e: { description: string | null }) {
  return `This overlaps ${e.description ? `"${e.description}"` : 'another entry'}. Change the times so they don't overlap.`
}

type Editable = { description: string | null; projectId: string | null; startTime: Date; endTime: Date | null }

/** { field: [before, after] } for each field an edit changes, or null if none. */
export function entryDiff(before: Editable, after: Editable) {
  const show = (v: Date | string | null) => (v instanceof Date ? v.toISOString() : v)
  const diff: Record<string, [string | null, string | null]> = {}
  for (const key of ['description', 'projectId', 'startTime', 'endTime'] as const) {
    const a = show(before[key])
    const b = show(after[key])
    if (a !== b) diff[key] = [a, b]
  }
  return Object.keys(diff).length ? diff : null
}
