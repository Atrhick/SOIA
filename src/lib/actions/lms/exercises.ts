'use server'

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { canCommentOnAnswers, canEditAnswers, canReadAnswers, type AnswerViewer } from '@/lib/lms/answer-access'
import { cleanAnswers, isExerciseComplete, readExerciseContent, MAX_COMMENT_CHARS, type ExerciseAnswers } from '@/lib/lms/exercise'
import { learnerNames, loadAnswerLearner } from '@/lib/lms/server'
import { progressPercent } from '@/lib/lms/course-rules'
import { updateContentProgress } from './enrollment'

const idSchema = z.string().min(1).max(64)

function viewerOf(session: { user: { id: string; role: string; isImpersonating?: boolean } }): AnswerViewer {
  return { userId: session.user.id, role: session.user.role, isImpersonating: !!session.user.isImpersonating }
}

// ============================================
// LEARNER: SAVE ANSWERS (autosave)
// ============================================

export async function saveExerciseAnswer(contentBlockId: string, rawAnswers: unknown) {
  const session = await auth()
  if (!session) return { error: 'Please sign in again' }
  if (!idSchema.safeParse(contentBlockId).success) return { error: 'Exercise not found' }

  try {
    const block = await prisma.lMSContentBlock.findUnique({
      where: { id: contentBlockId },
      select: {
        id: true,
        type: true,
        content: true,
        lesson: { select: { module: { select: { course: { select: { id: true, status: true, allowedRoles: true } } } } } },
      },
    })
    if (!block || block.type !== 'EXERCISE') return { error: 'Exercise not found' }
    const course = block.lesson.module.course
    if (course.status !== 'PUBLISHED' || !course.allowedRoles.includes(session.user.role)) {
      return { error: 'This course is not open to you' }
    }
    const learner = { userId: session.user.id, coachUserId: null }
    if (!canEditAnswers(viewerOf(session), learner)) {
      return { error: 'Answers can only be changed by the learner. You are viewing as someone else.' }
    }
    const enrolled = await prisma.lMSEnrollment.findUnique({
      where: { courseId_userId: { courseId: course.id, userId: session.user.id } },
      select: { id: true },
    })
    if (!enrolled) return { error: 'Join the course to save your answers' }

    const content = readExerciseContent(block.content)
    const answers = cleanAnswers(content, rawAnswers)
    const complete = isExerciseComplete(content, answers)
    const existing = await prisma.lMSExerciseAnswer.findUnique({
      where: { contentBlockId_userId: { contentBlockId, userId: session.user.id } },
      select: { completedAt: true },
    })
    const completedAt = complete ? existing?.completedAt ?? new Date() : null

    const row = await prisma.lMSExerciseAnswer.upsert({
      where: { contentBlockId_userId: { contentBlockId, userId: session.user.id } },
      update: { answers: answers as Prisma.InputJsonValue, completedAt },
      create: { contentBlockId, userId: session.user.id, answers: answers as Prisma.InputJsonValue, completedAt },
      select: { updatedAt: true },
    })

    let lessonComplete = false
    if (complete && !existing?.completedAt) {
      const r = await updateContentProgress(contentBlockId, 100, true)
      lessonComplete = 'lessonComplete' in r ? !!r.lessonComplete : false
    }
    return { success: true, complete, lessonComplete, savedAt: row.updatedAt.toISOString() }
  } catch (error) {
    console.error('Error saving exercise answer:', error)
    return { error: 'Could not save. Check your connection and try again.' }
  }
}

// ============================================
// COACH / ADMIN: COMMENTS
// ============================================

const commentSchema = z.object({
  answerId: idSchema,
  body: z.string().trim().min(1, 'Write a comment first').max(MAX_COMMENT_CHARS, `Keep it under ${MAX_COMMENT_CHARS} characters`),
})

export async function addExerciseComment(answerId: string, body: string) {
  const session = await auth()
  if (!session) return { error: 'Please sign in again' }
  const parsed = commentSchema.safeParse({ answerId, body })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Check the comment' }

  try {
    const answer = await prisma.lMSExerciseAnswer.findUnique({
      where: { id: parsed.data.answerId },
      select: { id: true, userId: true, contentBlock: { select: { lesson: { select: { module: { select: { courseId: true } } } } } } },
    })
    if (!answer) return { error: 'Answer not found' }
    const learner = await loadAnswerLearner(answer.userId)
    if (!canCommentOnAnswers(viewerOf(session), learner)) {
      return { error: 'Only this learner’s coach or an admin can comment' }
    }
    const comment = await prisma.lMSExerciseComment.create({
      data: { answerId: answer.id, authorId: session.user.id, body: parsed.data.body },
      select: { id: true, createdAt: true },
    })
    const courseId = answer.contentBlock.lesson.module.courseId
    revalidatePath(`/coach/learning/team/${answer.userId}/${courseId}`)
    revalidatePath(`/admin/lms/${courseId}/learners/${answer.userId}`)
    return { success: true, commentId: comment.id, createdAt: comment.createdAt.toISOString() }
  } catch (error) {
    console.error('Error adding exercise comment:', error)
    return { error: 'Could not save the comment' }
  }
}

export async function deleteExerciseComment(commentId: string) {
  const session = await auth()
  if (!session) return { error: 'Please sign in again' }
  if (!idSchema.safeParse(commentId).success) return { error: 'Comment not found' }
  try {
    const c = await prisma.lMSExerciseComment.findUnique({ where: { id: commentId }, select: { authorId: true } })
    if (!c) return { error: 'Comment not found' }
    if (session.user.isImpersonating || (c.authorId !== session.user.id && session.user.role !== 'ADMIN')) {
      return { error: 'You can only remove your own comments' }
    }
    await prisma.lMSExerciseComment.delete({ where: { id: commentId } })
    return { success: true }
  } catch (error) {
    console.error('Error deleting exercise comment:', error)
    return { error: 'Could not remove the comment' }
  }
}

// ============================================
// COACH / ADMIN: READ A LEARNER'S WORK
// ============================================

/** One learner's course: lessons, completion, every exercise with answers and comments. */
export async function getLearnerCourseWork(courseId: string, learnerUserId: string) {
  const session = await auth()
  if (!session) return { error: 'Unauthorized' }
  if (!idSchema.safeParse(courseId).success || !idSchema.safeParse(learnerUserId).success) return { error: 'Not found' }

  try {
    const learner = await loadAnswerLearner(learnerUserId)
    const viewer = viewerOf(session)
    if (!canReadAnswers(viewer, learner)) return { error: 'You can only see the work of your own ambassadors' }

    const course = await prisma.lMSCourse.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        title: true,
        modules: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            title: true,
            lessons: {
              orderBy: { sortOrder: 'asc' },
              select: {
                id: true,
                title: true,
                contentBlocks: {
                  where: { type: 'EXERCISE' },
                  orderBy: { sortOrder: 'asc' },
                  select: { id: true, title: true, content: true },
                },
              },
            },
          },
        },
      },
    })
    if (!course) return { error: 'Course not found' }

    const enrollment = await prisma.lMSEnrollment.findUnique({
      where: { courseId_userId: { courseId, userId: learnerUserId } },
      include: { lessonProgress: { select: { lessonId: true, status: true, completedAt: true } } },
    })
    const blockIds = course.modules.flatMap((m) => m.lessons.flatMap((l) => l.contentBlocks.map((b) => b.id)))
    const answers = await prisma.lMSExerciseAnswer.findMany({
      where: { userId: learnerUserId, contentBlockId: { in: blockIds } },
      include: { comments: { orderBy: { createdAt: 'asc' } } },
    })
    const names = await learnerNames([learnerUserId, ...answers.flatMap((a) => a.comments.map((c) => c.authorId))])
    const byBlock = new Map(answers.map((a) => [a.contentBlockId, a]))
    const progress = new Map(enrollment?.lessonProgress.map((p) => [p.lessonId, p]) ?? [])
    const totalLessons = course.modules.reduce((a, m) => a + m.lessons.length, 0)
    const completedLessons = enrollment?.lessonProgress.filter((p) => p.status === 'COMPLETED').length ?? 0

    return {
      work: {
        learner: { userId: learnerUserId, name: names[learnerUserId] || 'Learner' },
        course: { id: course.id, title: course.title },
        canComment: canCommentOnAnswers(viewer, learner),
        viewerId: session.user.id,
        isAdmin: session.user.role === 'ADMIN',
        enrollment: enrollment
          ? {
              status: enrollment.status,
              progressPercentage: progressPercent(completedLessons, totalLessons),
              completedLessons,
              totalLessons,
              enrolledAt: enrollment.enrolledAt.toISOString(),
              lastAccessedAt: enrollment.lastAccessedAt?.toISOString() ?? null,
              completedAt: enrollment.completedAt?.toISOString() ?? null,
            }
          : null,
        modules: course.modules.map((m) => ({
          id: m.id,
          title: m.title,
          lessons: m.lessons.map((l) => ({
            id: l.id,
            title: l.title,
            status: progress.get(l.id)?.status ?? 'NOT_STARTED',
            completedAt: progress.get(l.id)?.completedAt?.toISOString() ?? null,
            exercises: l.contentBlocks.map((b) => {
              const a = byBlock.get(b.id)
              return {
                id: b.id,
                title: b.title,
                content: readExerciseContent(b.content),
                answer: a
                  ? {
                      id: a.id,
                      answers: (a.answers as ExerciseAnswers) || {},
                      completedAt: a.completedAt?.toISOString() ?? null,
                      updatedAt: a.updatedAt.toISOString(),
                      comments: a.comments.map((c) => ({
                        id: c.id,
                        authorId: c.authorId,
                        authorName: names[c.authorId] || 'Team',
                        body: c.body,
                        createdAt: c.createdAt.toISOString(),
                      })),
                    }
                  : null,
              }
            }),
          })),
        })),
      },
    }
  } catch (error) {
    console.error('Error loading learner course work:', error)
    return { error: 'Failed to load this learner’s work' }
  }
}

/** Coach: every ambassador of theirs with progress in each course they joined. */
export async function getMyTeamLearning() {
  const session = await auth()
  if (!session || session.user.role !== 'COACH') return { error: 'Unauthorized' }
  try {
    const coach = await prisma.coachProfile.findUnique({ where: { userId: session.user.id }, select: { id: true } })
    if (!coach) return { error: 'Coach profile not found' }
    const ambassadors = await prisma.ambassador.findMany({
      where: { coachId: coach.id, userId: { not: null } },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: { id: true, firstName: true, lastName: true, userId: true, status: true },
    })
    const userIds = ambassadors.map((a) => a.userId!).filter(Boolean)
    const enrollments = userIds.length
      ? await prisma.lMSEnrollment.findMany({
          where: { userId: { in: userIds } },
          select: {
            userId: true,
            status: true,
            progressPercentage: true,
            lastAccessedAt: true,
            completedAt: true,
            course: { select: { id: true, title: true } },
          },
          orderBy: { enrolledAt: 'asc' },
        })
      : []
    const answerCounts = userIds.length
      ? await prisma.lMSExerciseAnswer.groupBy({ by: ['userId'], where: { userId: { in: userIds } }, _count: { _all: true } })
      : []
    const counts = new Map(answerCounts.map((a) => [a.userId, a._count._all]))
    return {
      team: ambassadors.map((a) => ({
        ambassadorId: a.id,
        userId: a.userId!,
        name: `${a.firstName} ${a.lastName}`.trim(),
        status: a.status,
        exercisesAnswered: counts.get(a.userId!) ?? 0,
        courses: enrollments
          .filter((e) => e.userId === a.userId)
          .map((e) => ({
            courseId: e.course.id,
            title: e.course.title,
            status: e.status,
            progressPercentage: e.progressPercentage,
            lastAccessedAt: e.lastAccessedAt?.toISOString() ?? null,
            completedAt: e.completedAt?.toISOString() ?? null,
          })),
      })),
    }
  } catch (error) {
    console.error('Error loading team learning:', error)
    return { error: 'Failed to load your ambassadors’ learning' }
  }
}

/** Admin: everyone enrolled in a course, with progress and answer counts. */
export async function getCourseLearners(courseId: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') return { error: 'Unauthorized' }
  if (!idSchema.safeParse(courseId).success) return { error: 'Not found' }
  try {
    const course = await prisma.lMSCourse.findUnique({ where: { id: courseId }, select: { id: true, title: true } })
    if (!course) return { error: 'Course not found' }
    const enrollments = await prisma.lMSEnrollment.findMany({
      where: { courseId },
      orderBy: [{ lastAccessedAt: { sort: 'desc', nulls: 'last' } }, { enrolledAt: 'desc' }],
      select: { userId: true, status: true, progressPercentage: true, enrolledAt: true, lastAccessedAt: true, completedAt: true },
    })
    const names = await learnerNames(enrollments.map((e) => e.userId))
    const answerCounts = await prisma.lMSExerciseAnswer.groupBy({
      by: ['userId'],
      where: { userId: { in: enrollments.map((e) => e.userId) }, contentBlock: { lesson: { module: { courseId } } } },
      _count: { _all: true },
    })
    const counts = new Map(answerCounts.map((a) => [a.userId, a._count._all]))
    return {
      course,
      learners: enrollments.map((e) => ({
        userId: e.userId,
        name: names[e.userId] || 'Learner',
        status: e.status,
        progressPercentage: e.progressPercentage,
        enrolledAt: e.enrolledAt.toISOString(),
        lastAccessedAt: e.lastAccessedAt?.toISOString() ?? null,
        completedAt: e.completedAt?.toISOString() ?? null,
        exercisesAnswered: counts.get(e.userId) ?? 0,
      })),
    }
  } catch (error) {
    console.error('Error loading course learners:', error)
    return { error: 'Failed to load learners' }
  }
}
