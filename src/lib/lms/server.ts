/**
 * Server-only LMS helpers. Not 'use server', so nothing here is a public endpoint.
 */
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import type { AnswerLearner } from './answer-access'
import type { ImportedCourse } from './markdown-import'

/** The learner with their coach's user id (ambassadors only), for the answer rules. */
export async function loadAnswerLearner(userId: string): Promise<AnswerLearner> {
  const amb = await prisma.ambassador.findUnique({
    where: { userId },
    select: { coach: { select: { userId: true } } },
  })
  return { userId, coachUserId: amb?.coach?.userId ?? null }
}

/** Display names for learners: ambassador or coach profile name, else the email. */
export async function learnerNames(userIds: string[]): Promise<Record<string, string>> {
  const ids = Array.from(new Set(userIds)).filter(Boolean)
  if (!ids.length) return {}
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      email: true,
      coachProfile: { select: { firstName: true, lastName: true } },
      ambassadorProfile: { select: { firstName: true, lastName: true } },
    },
  })
  const out: Record<string, string> = {}
  for (const u of users) {
    const p = u.ambassadorProfile ?? u.coachProfile
    const name = p ? `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() : ''
    out[u.id] = name || u.email
  }
  return out
}

/**
 * Ticks the ambassador onboarding task "Enroll in a Class" (type CLASS_SELECTION).
 * Used by the old classes enrolment and by LMS course enrolment. Never throws.
 */
export async function markClassSelectionDone(ambassadorId: string): Promise<void> {
  try {
    const task = await prisma.ambassadorOnboardingTask.findFirst({
      where: { type: 'CLASS_SELECTION', isActive: true },
      select: { id: true },
    })
    if (!task) return
    await prisma.ambassadorOnboardingProgress.upsert({
      where: { ambassadorId_taskId: { ambassadorId, taskId: task.id } },
      update: { status: 'APPROVED', completedAt: new Date() },
      create: { ambassadorId, taskId: task.id, status: 'APPROVED', completedAt: new Date() },
    })
  } catch (error) {
    console.error('Could not tick the class selection onboarding task:', error)
  }
}

type Db = Prisma.TransactionClient | typeof prisma

/** Writes a parsed markdown course as a new DRAFT course. Returns the new course id. */
export async function createCourseFromImport(
  db: Db,
  parsed: ImportedCourse,
  createdBy: string,
  overrides: { title?: string } = {}
): Promise<string> {
  const max = await db.lMSCourse.aggregate({ _max: { sortOrder: true } })
  const course = await db.lMSCourse.create({
    data: {
      title: overrides.title?.trim() || parsed.title,
      description: parsed.description,
      status: 'DRAFT',
      allowedRoles: parsed.allowedRoles,
      prerequisiteIds: [],
      estimatedDuration: parsed.estimatedDuration || null,
      category: parsed.category,
      tags: parsed.tags,
      outcomes: parsed.outcomes,
      audience: parsed.audience,
      dripDays: parsed.dripDays,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
      createdBy,
      modules: {
        create: parsed.modules.map((m, mi) => ({
          title: m.title,
          description: m.description,
          sortOrder: mi + 1,
          lessons: {
            create: m.lessons.map((l, li) => ({
              title: l.title,
              estimatedDuration: l.estimatedDuration,
              sortOrder: li + 1,
              contentBlocks: {
                create: l.blocks.map((b, bi) => ({
                  title: b.title,
                  type: b.type,
                  content: b.content as unknown as Prisma.InputJsonValue,
                  sortOrder: bi + 1,
                })),
              },
            })),
          },
        })),
      },
    },
    select: { id: true },
  })
  return course.id
}
