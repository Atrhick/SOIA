'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { isModuleOpen, moduleOpensAt, nextLessonId, progressPercent } from '@/lib/lms/course-rules'
import { learnerNames, markClassSelectionDone } from '@/lib/lms/server'
import { readExerciseContent, type ExerciseAnswers } from '@/lib/lms/exercise'

const LEARNING_PATHS = ['/coach/learning', '/ambassador/learning']

function revalidateLearning(courseId?: string) {
  for (const p of LEARNING_PATHS) {
    revalidatePath(p)
    if (courseId) revalidatePath(`${p}/${courseId}`)
  }
}

type ResumeModule = { lessons: { id: string; title: string }[] }

/** The exact lesson to resume, honouring drip. */
function resumeLesson(
  modules: ResumeModule[],
  completedIds: Set<string>,
  enrolledAt: Date | null,
  dripDays: number | null
): { id: string; title: string } | null {
  const id = nextLessonId(
    modules.map((m) => ({ lessons: m.lessons.map((l) => ({ id: l.id, completed: completedIds.has(l.id) })) })),
    { enrolledAt, dripDays }
  )
  if (!id) return null
  for (const m of modules) {
    const l = m.lessons.find((x) => x.id === id)
    if (l) return l
  }
  return null
}

// ============================================
// ENROLLMENT OPERATIONS
// ============================================

export async function getAvailableCourses() {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  try {
    const courses = await prisma.lMSCourse.findMany({
      where: {
        status: 'PUBLISHED',
        allowedRoles: { has: session.user.role },
      },
      orderBy: [{ sortOrder: 'asc' }, { publishedAt: 'desc' }],
      include: {
        modules: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            lessons: { orderBy: { sortOrder: 'asc' }, select: { id: true, title: true } },
          },
        },
        enrollments: {
          where: { userId: session.user.id },
          select: {
            id: true,
            status: true,
            progressPercentage: true,
            completedAt: true,
            lastAccessedAt: true,
            enrolledAt: true,
            lessonProgress: { where: { status: 'COMPLETED' }, select: { lessonId: true } },
          },
        },
        _count: {
          select: { enrollments: true },
        },
      },
    })

    const completedCourseIds = new Set(
      (
        await prisma.lMSEnrollment.findMany({
          where: { userId: session.user.id, status: 'COMPLETED' },
          select: { courseId: true },
        })
      ).map((e) => e.courseId)
    )

    const formattedCourses = courses.map((course) => {
      const enrollment = course.enrollments[0] || null
      const totalLessons = course.modules.reduce((acc, m) => acc + m.lessons.length, 0)
      const done = new Set(enrollment?.lessonProgress.map((p) => p.lessonId) ?? [])
      const next = enrollment ? resumeLesson(course.modules, done, enrollment.enrolledAt, course.dripDays) : null

      return {
        id: course.id,
        title: course.title,
        description: course.description,
        thumbnail: course.thumbnail,
        estimatedDuration: course.estimatedDuration,
        category: course.category,
        tags: course.tags,
        moduleCount: course.modules.length,
        lessonCount: totalLessons,
        enrollmentCount: course._count.enrollments,
        publishedAt: course.publishedAt?.toISOString() || null,
        prerequisitesMet: course.prerequisiteIds.every((id) => completedCourseIds.has(id)),
        isEnrolled: !!enrollment,
        enrollment: enrollment
          ? {
              id: enrollment.id,
              status: enrollment.status,
              progressPercentage: enrollment.progressPercentage,
              completedAt: enrollment.completedAt?.toISOString() || null,
              lastAccessedAt: enrollment.lastAccessedAt?.toISOString() || null,
              completedLessons: done.size,
              nextLessonId: next?.id ?? null,
              nextLessonTitle: next?.title ?? null,
            }
          : null,
      }
    })

    return { courses: formattedCourses }
  } catch (error) {
    console.error('Error fetching available courses:', error)
    return { error: 'Failed to fetch courses' }
  }
}

export async function getCourseForLearner(courseId: string, opts: { preview?: boolean } = {}) {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }
  const preview = !!opts.preview
  if (preview && session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    const course = await prisma.lMSCourse.findUnique({
      where: preview
        ? { id: courseId }
        : {
            id: courseId,
            status: 'PUBLISHED',
            allowedRoles: { has: session.user.role },
          },
      include: {
        modules: {
          orderBy: { sortOrder: 'asc' },
          include: {
            lessons: {
              orderBy: { sortOrder: 'asc' },
              include: {
                contentBlocks: {
                  orderBy: { sortOrder: 'asc' },
                  select: {
                    id: true,
                    title: true,
                    type: true,
                    sortOrder: true,
                  },
                },
              },
            },
          },
        },
        enrollments: {
          where: { userId: preview ? '__preview__' : session.user.id },
          include: {
            lessonProgress: { select: { lessonId: true, status: true, completedAt: true } },
          },
        },
      },
    })

    if (!course) {
      return { error: 'Course not found or not available' }
    }

    const enrollment = course.enrollments[0] || null

    const lessonProgressMap: Record<string, { status: string; completedAt: string | null }> = {}
    enrollment?.lessonProgress.forEach((lp) => {
      lessonProgressMap[lp.lessonId] = {
        status: lp.status,
        completedAt: lp.completedAt?.toISOString() || null,
      }
    })
    const done = new Set(enrollment?.lessonProgress.filter((p) => p.status === 'COMPLETED').map((p) => p.lessonId) ?? [])

    const prereqCourses = course.prerequisiteIds.length
      ? await prisma.lMSCourse.findMany({ where: { id: { in: course.prerequisiteIds } }, select: { id: true, title: true } })
      : []
    const prereqDone = prereqCourses.length
      ? new Set(
          (
            await prisma.lMSEnrollment.findMany({
              where: { userId: session.user.id, courseId: { in: prereqCourses.map((c) => c.id) }, status: 'COMPLETED' },
              select: { courseId: true },
            })
          ).map((e) => e.courseId)
        )
      : new Set<string>()

    const enrolledAt = enrollment?.enrolledAt ?? null
    const now = new Date()
    const next = enrollment ? resumeLesson(course.modules, done, enrolledAt, course.dripDays) : null

    const formattedCourse = {
      id: course.id,
      title: course.title,
      description: course.description,
      thumbnail: course.thumbnail,
      estimatedDuration: course.estimatedDuration,
      category: course.category,
      tags: course.tags,
      outcomes: course.outcomes,
      audience: course.audience,
      dripDays: course.dripDays,
      status: course.status,
      isPreview: preview,
      prerequisites: prereqCourses.map((c) => ({ id: c.id, title: c.title, completed: prereqDone.has(c.id) })),
      nextLessonId: next?.id ?? null,
      modules: course.modules.map((module, index) => {
        const opensAt = enrollment ? moduleOpensAt(index, enrolledAt, course.dripDays) : null
        return {
          id: module.id,
          title: module.title,
          description: module.description,
          sortOrder: module.sortOrder,
          opensAt: opensAt?.toISOString() ?? null,
          isOpen: preview || !enrollment || isModuleOpen(index, enrolledAt, course.dripDays, now),
          lessons: module.lessons.map((lesson) => ({
            id: lesson.id,
            title: lesson.title,
            description: lesson.description,
            estimatedDuration: lesson.estimatedDuration,
            sortOrder: lesson.sortOrder,
            contentBlockCount: lesson.contentBlocks.length,
            exerciseCount: lesson.contentBlocks.filter((b) => b.type === 'EXERCISE').length,
            contentBlocks: lesson.contentBlocks,
            progress: lessonProgressMap[lesson.id] || { status: 'NOT_STARTED', completedAt: null },
          })),
        }
      }),
      enrollment: enrollment
        ? {
            id: enrollment.id,
            status: enrollment.status,
            progressPercentage: enrollment.progressPercentage,
            completedAt: enrollment.completedAt?.toISOString() || null,
            lastAccessedAt: enrollment.lastAccessedAt?.toISOString() || null,
            enrolledAt: enrollment.enrolledAt.toISOString(),
            certificateIssuedAt: enrollment.certificateIssuedAt?.toISOString() || null,
            totalTimeSpent: enrollment.totalTimeSpent,
          }
        : null,
    }

    return { course: formattedCourse }
  } catch (error) {
    console.error('Error fetching course for learner:', error)
    return { error: 'Failed to fetch course' }
  }
}

export async function enrollInCourse(courseId: string) {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  try {
    const course = await prisma.lMSCourse.findUnique({
      where: {
        id: courseId,
        status: 'PUBLISHED',
        allowedRoles: { has: session.user.role },
      },
      select: { id: true, title: true, prerequisiteIds: true },
    })

    if (!course) {
      return { error: 'Course not found or not available' }
    }

    if (course.prerequisiteIds.length > 0) {
      const completedPrereqs = await prisma.lMSEnrollment.count({
        where: {
          userId: session.user.id,
          courseId: { in: course.prerequisiteIds },
          status: 'COMPLETED',
        },
      })

      if (completedPrereqs < course.prerequisiteIds.length) {
        return { error: 'Finish the courses listed under "Before you start" first' }
      }
    }

    const existing = await prisma.lMSEnrollment.findUnique({
      where: {
        courseId_userId: {
          courseId,
          userId: session.user.id,
        },
      },
    })

    if (existing) {
      return { success: true, enrollmentId: existing.id }
    }

    const enrollment = await prisma.lMSEnrollment.create({
      data: {
        courseId,
        userId: session.user.id,
        status: 'NOT_STARTED',
        progressPercentage: 0,
      },
    })

    // Joining a course counts as the ambassador onboarding step "Enroll in a Class".
    if (session.user.role === 'AMBASSADOR') {
      const amb = await prisma.ambassador.findUnique({ where: { userId: session.user.id }, select: { id: true } })
      if (amb) {
        await markClassSelectionDone(amb.id)
        revalidatePath('/ambassador/onboarding')
        revalidatePath('/ambassador')
      }
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'ENROLL_LMS_COURSE',
        entityType: 'LMSEnrollment',
        entityId: enrollment.id,
        details: `Enrolled in course: ${course.title}`,
      },
    })

    revalidateLearning(courseId)
    return { success: true, enrollmentId: enrollment.id }
  } catch (error) {
    console.error('Error enrolling in course:', error)
    return { error: 'Failed to enroll in course' }
  }
}

export async function getLessonContent(lessonId: string, opts: { preview?: boolean } = {}) {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }
  const preview = !!opts.preview
  if (preview && session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    const lesson = await prisma.lMSLesson.findUnique({
      where: { id: lessonId },
      include: {
        module: {
          include: {
            course: {
              select: {
                id: true,
                title: true,
                status: true,
                allowedRoles: true,
                dripDays: true,
                modules: {
                  orderBy: { sortOrder: 'asc' },
                  select: {
                    id: true,
                    title: true,
                    lessons: {
                      orderBy: { sortOrder: 'asc' },
                      select: { id: true, title: true, estimatedDuration: true },
                    },
                  },
                },
              },
            },
          },
        },
        contentBlocks: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    if (!lesson) {
      return { error: 'Lesson not found' }
    }
    const course = lesson.module.course

    if (
      !preview &&
      (course.status !== 'PUBLISHED' || !course.allowedRoles.includes(session.user.role))
    ) {
      return { error: 'Access denied' }
    }

    const enrollment = preview
      ? null
      : await prisma.lMSEnrollment.findUnique({
          where: {
            courseId_userId: {
              courseId: course.id,
              userId: session.user.id,
            },
          },
          include: {
            lessonProgress: { include: { contentProgress: true } },
          },
        })

    if (!preview && !enrollment) {
      return { error: 'Not enrolled in this course' }
    }

    const moduleIndex = course.modules.findIndex((m) => m.id === lesson.moduleId)
    const enrolledAt = enrollment?.enrolledAt ?? null
    if (!preview && !isModuleOpen(moduleIndex, enrolledAt, course.dripDays)) {
      return { error: 'Locked', opensAt: moduleOpensAt(moduleIndex, enrolledAt, course.dripDays)?.toISOString() ?? null }
    }

    // Get or create lesson progress (never in preview)
    let lessonStatus = 'NOT_STARTED'
    let lessonProgressId = ''
    const contentProgressMap: Record<string, { status: string; progressValue: number | null }> = {}
    if (enrollment) {
      let lessonProgress = enrollment.lessonProgress.find((p) => p.lessonId === lessonId)
      if (!lessonProgress) {
        lessonProgress = await prisma.lMSLessonProgress.create({
          data: {
            enrollmentId: enrollment.id,
            lessonId,
            status: 'IN_PROGRESS',
            startedAt: new Date(),
          },
          include: { contentProgress: true },
        })
      }
      await prisma.lMSEnrollment.update({
        where: { id: enrollment.id },
        data: {
          lastAccessedAt: new Date(),
          ...(enrollment.status === 'NOT_STARTED' ? { status: 'IN_PROGRESS' as const } : {}),
        },
      })
      lessonStatus = lessonProgress.status
      lessonProgressId = lessonProgress.id
      lessonProgress.contentProgress.forEach((cp) => {
        contentProgressMap[cp.contentBlockId] = { status: cp.status, progressValue: cp.progressValue }
      })
    }

    // Curriculum for the sidebar / drawer
    const completedIds = new Set(
      enrollment?.lessonProgress.filter((p) => p.status === 'COMPLETED').map((p) => p.lessonId) ?? []
    )
    if (lessonStatus === 'COMPLETED') completedIds.add(lessonId)
    const now = new Date()
    const curriculumModules = course.modules.map((m, i) => ({
      id: m.id,
      title: m.title,
      isOpen: preview || isModuleOpen(i, enrolledAt, course.dripDays, now),
      opensAt: preview ? null : moduleOpensAt(i, enrolledAt, course.dripDays)?.toISOString() ?? null,
      lessons: m.lessons.map((l) => ({
        id: l.id,
        title: l.title,
        estimatedDuration: l.estimatedDuration,
        completed: completedIds.has(l.id),
      })),
    }))
    const allLessons = curriculumModules.flatMap((m) => m.lessons.map((l) => ({ ...l, isOpen: m.isOpen })))
    const totalLessons = allLessons.length
    const completedLessons = allLessons.filter((l) => l.completed).length

    const currentIndex = allLessons.findIndex((l) => l.id === lessonId)
    const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null
    const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null

    // This learner's exercise answers (only their own; coaches and admins use the review pages)
    const exerciseIds = lesson.contentBlocks.filter((b) => b.type === 'EXERCISE').map((b) => b.id)
    const exercises: Record<
      string,
      {
        answers: ExerciseAnswers
        completedAt: string | null
        updatedAt: string | null
        comments: { id: string; authorName: string; body: string; createdAt: string }[]
      }
    > = {}
    if (exerciseIds.length && !preview) {
      const rows = await prisma.lMSExerciseAnswer.findMany({
        where: { userId: session.user.id, contentBlockId: { in: exerciseIds } },
        include: { comments: { orderBy: { createdAt: 'asc' } } },
      })
      const names = await learnerNames(rows.flatMap((r) => r.comments.map((c) => c.authorId)))
      for (const r of rows) {
        exercises[r.contentBlockId] = {
          answers: (r.answers as ExerciseAnswers) || {},
          completedAt: r.completedAt?.toISOString() ?? null,
          updatedAt: r.updatedAt.toISOString(),
          comments: r.comments.map((c) => ({
            id: c.id,
            authorName: names[c.authorId] || 'Your coach',
            body: c.body,
            createdAt: c.createdAt.toISOString(),
          })),
        }
      }
    }

    return {
      lesson: {
        id: lesson.id,
        title: lesson.title,
        description: lesson.description,
        estimatedDuration: lesson.estimatedDuration,
        moduleTitle: lesson.module.title,
        courseId: course.id,
        courseTitle: course.title,
        contentBlocks: lesson.contentBlocks.map((block) => ({
          id: block.id,
          title: block.title,
          type: block.type,
          content:
            block.type === 'EXERCISE'
              ? (readExerciseContent(block.content) as unknown as Record<string, unknown>)
              : (block.content as Record<string, unknown>) || {},
          completionThreshold: block.completionThreshold,
          sortOrder: block.sortOrder,
          progress: contentProgressMap[block.id] || { status: 'NOT_STARTED', progressValue: null },
        })),
      },
      progress: {
        lessonStatus,
        enrollmentId: enrollment?.id ?? '',
        lessonProgressId,
      },
      navigation: {
        prevLesson: prevLesson ? { id: prevLesson.id, title: prevLesson.title } : null,
        nextLesson: nextLesson ? { id: nextLesson.id, title: nextLesson.title, locked: !nextLesson.isOpen } : null,
        currentIndex: currentIndex + 1,
        totalLessons,
      },
      curriculum: {
        modules: curriculumModules,
        completedLessons,
        totalLessons,
        progressPercentage: progressPercent(completedLessons, totalLessons),
        courseCompleted: enrollment?.status === 'COMPLETED',
      },
      exercises,
      // Preview, or an admin viewing as this person: show answers but never change them.
      readOnly: preview || !!session.user.isImpersonating,
      isPreview: preview,
    }
  } catch (error) {
    console.error('Error fetching lesson content:', error)
    return { error: 'Failed to fetch lesson' }
  }
}

// ============================================
// PROGRESS TRACKING
// ============================================

export async function updateContentProgress(
  contentBlockId: string,
  progressValue?: number,
  markComplete?: boolean
) {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  try {
    const contentBlock = await prisma.lMSContentBlock.findUnique({
      where: { id: contentBlockId },
      include: {
        lesson: {
          include: {
            module: {
              include: {
                course: {
                  select: { id: true, allowedRoles: true, status: true },
                },
              },
            },
          },
        },
      },
    })

    if (!contentBlock) {
      return { error: 'Content not found' }
    }

    const course = contentBlock.lesson.module.course
    if (course.status !== 'PUBLISHED' || !course.allowedRoles.includes(session.user.role)) {
      return { error: 'Access denied' }
    }

    const enrollment = await prisma.lMSEnrollment.findUnique({
      where: {
        courseId_userId: {
          courseId: course.id,
          userId: session.user.id,
        },
      },
    })

    if (!enrollment) {
      return { error: 'Not enrolled' }
    }

    let lessonProgress = await prisma.lMSLessonProgress.findUnique({
      where: {
        enrollmentId_lessonId: {
          enrollmentId: enrollment.id,
          lessonId: contentBlock.lessonId,
        },
      },
    })

    if (!lessonProgress) {
      lessonProgress = await prisma.lMSLessonProgress.create({
        data: {
          enrollmentId: enrollment.id,
          lessonId: contentBlock.lessonId,
          status: 'IN_PROGRESS',
          startedAt: new Date(),
        },
      })
    }

    let isComplete = markComplete === true
    if (!isComplete && progressValue !== undefined && contentBlock.completionThreshold) {
      isComplete = progressValue >= contentBlock.completionThreshold
    }

    const existing = await prisma.lMSContentProgress.findUnique({
      where: { lessonProgressId_contentBlockId: { lessonProgressId: lessonProgress.id, contentBlockId } },
      select: { status: true },
    })
    // Never move a finished block back to "in progress".
    const alreadyComplete = existing?.status === 'COMPLETED'

    await prisma.lMSContentProgress.upsert({
      where: {
        lessonProgressId_contentBlockId: {
          lessonProgressId: lessonProgress.id,
          contentBlockId,
        },
      },
      update: {
        progressValue: progressValue ?? undefined,
        status: isComplete || alreadyComplete ? 'COMPLETED' : 'IN_PROGRESS',
        completedAt: isComplete && !alreadyComplete ? new Date() : undefined,
      },
      create: {
        lessonProgressId: lessonProgress.id,
        contentBlockId,
        status: isComplete ? 'COMPLETED' : 'IN_PROGRESS',
        progressValue: progressValue ?? null,
        startedAt: new Date(),
        completedAt: isComplete ? new Date() : null,
      },
    })

    const allContentBlocks = await prisma.lMSContentBlock.count({
      where: { lessonId: contentBlock.lessonId },
    })

    const completedContent = await prisma.lMSContentProgress.count({
      where: {
        lessonProgressId: lessonProgress.id,
        status: 'COMPLETED',
      },
    })

    const lessonComplete = completedContent >= allContentBlocks

    if (lessonComplete && lessonProgress.status !== 'COMPLETED') {
      await prisma.lMSLessonProgress.update({
        where: { id: lessonProgress.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      })
    }

    const courseCompleted = await updateCourseProgress(enrollment.id)

    revalidateLearning(course.id)
    return { success: true, isComplete, lessonComplete, courseCompleted }
  } catch (error) {
    console.error('Error updating content progress:', error)
    return { error: 'Failed to update progress' }
  }
}

export async function markLessonComplete(lessonId: string) {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  try {
    const lesson = await prisma.lMSLesson.findUnique({
      where: { id: lessonId },
      include: {
        module: {
          include: {
            course: { select: { id: true, allowedRoles: true, status: true } },
          },
        },
        contentBlocks: { select: { id: true } },
      },
    })

    if (!lesson) {
      return { error: 'Lesson not found' }
    }

    const course = lesson.module.course
    if (course.status !== 'PUBLISHED' || !course.allowedRoles.includes(session.user.role)) {
      return { error: 'Access denied' }
    }

    const enrollment = await prisma.lMSEnrollment.findUnique({
      where: {
        courseId_userId: {
          courseId: course.id,
          userId: session.user.id,
        },
      },
    })

    if (!enrollment) {
      return { error: 'Not enrolled' }
    }

    const lessonProgress = await prisma.lMSLessonProgress.upsert({
      where: {
        enrollmentId_lessonId: {
          enrollmentId: enrollment.id,
          lessonId,
        },
      },
      update: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
      create: {
        enrollmentId: enrollment.id,
        lessonId,
        status: 'COMPLETED',
        startedAt: new Date(),
        completedAt: new Date(),
      },
    })

    for (const block of lesson.contentBlocks) {
      await prisma.lMSContentProgress.upsert({
        where: {
          lessonProgressId_contentBlockId: {
            lessonProgressId: lessonProgress.id,
            contentBlockId: block.id,
          },
        },
        update: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
        create: {
          lessonProgressId: lessonProgress.id,
          contentBlockId: block.id,
          status: 'COMPLETED',
          startedAt: new Date(),
          completedAt: new Date(),
        },
      })
    }

    const courseCompleted = await updateCourseProgress(enrollment.id)

    revalidateLearning(course.id)
    return { success: true, courseCompleted }
  } catch (error) {
    console.error('Error marking lesson complete:', error)
    return { error: 'Failed to mark lesson complete' }
  }
}

/** Recomputes progress; returns true when the course is complete. Keeps the first completion date. */
async function updateCourseProgress(enrollmentId: string): Promise<boolean> {
  const enrollment = await prisma.lMSEnrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      course: {
        include: {
          modules: {
            include: {
              lessons: { select: { id: true } },
            },
          },
        },
      },
      lessonProgress: {
        where: { status: 'COMPLETED' },
        select: { lessonId: true },
      },
    },
  })

  if (!enrollment) return false

  const lessonIds = new Set(enrollment.course.modules.flatMap((m) => m.lessons.map((l) => l.id)))
  const totalLessons = lessonIds.size
  const completedLessons = enrollment.lessonProgress.filter((p) => lessonIds.has(p.lessonId)).length
  const progressPercentage = progressPercent(completedLessons, totalLessons)
  const isComplete = completedLessons >= totalLessons && totalLessons > 0
  const now = new Date()

  await prisma.lMSEnrollment.update({
    where: { id: enrollmentId },
    data: {
      progressPercentage,
      status: isComplete ? 'COMPLETED' : 'IN_PROGRESS',
      completedAt: isComplete ? enrollment.completedAt ?? now : null,
      // The certificate date never changes once issued.
      certificateIssuedAt: isComplete ? enrollment.certificateIssuedAt ?? now : enrollment.certificateIssuedAt,
    },
  })
  return isComplete
}

export async function getMyEnrollments() {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  try {
    const enrollments = await prisma.lMSEnrollment.findMany({
      where: { userId: session.user.id },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            thumbnail: true,
            estimatedDuration: true,
            category: true,
            dripDays: true,
            modules: {
              orderBy: { sortOrder: 'asc' },
              select: {
                lessons: { orderBy: { sortOrder: 'asc' }, select: { id: true, title: true } },
              },
            },
          },
        },
        lessonProgress: { where: { status: 'COMPLETED' }, select: { lessonId: true } },
      },
      orderBy: [{ lastAccessedAt: { sort: 'desc', nulls: 'last' } }, { enrolledAt: 'desc' }],
    })

    const formattedEnrollments = enrollments.map((e) => {
      const done = new Set(e.lessonProgress.map((p) => p.lessonId))
      const next = resumeLesson(e.course.modules, done, e.enrolledAt, e.course.dripDays)
      return {
        id: e.id,
        courseId: e.course.id,
        courseTitle: e.course.title,
        courseThumbnail: e.course.thumbnail,
        category: e.course.category,
        estimatedDuration: e.course.estimatedDuration,
        lessonCount: e.course.modules.reduce((acc, m) => acc + m.lessons.length, 0),
        completedLessons: done.size,
        nextLessonId: next?.id ?? null,
        nextLessonTitle: next?.title ?? null,
        status: e.status,
        progressPercentage: e.progressPercentage,
        completedAt: e.completedAt?.toISOString() || null,
        lastAccessedAt: e.lastAccessedAt?.toISOString() || null,
        enrolledAt: e.enrolledAt.toISOString(),
      }
    })

    return { enrollments: formattedEnrollments }
  } catch (error) {
    console.error('Error fetching enrollments:', error)
    return { error: 'Failed to fetch enrollments' }
  }
}

// ============================================
// CERTIFICATE
// ============================================

export async function getCertificate(courseId: string) {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }
  try {
    const enrollment = await prisma.lMSEnrollment.findUnique({
      where: { courseId_userId: { courseId, userId: session.user.id } },
      include: { course: { select: { id: true, title: true, estimatedDuration: true } } },
    })
    if (!enrollment || enrollment.status !== 'COMPLETED' || !enrollment.completedAt) {
      return { error: 'Finish every lesson to get your certificate' }
    }
    const names = await learnerNames([session.user.id])
    return {
      certificate: {
        id: enrollment.id.slice(-10).toUpperCase(),
        learnerName: names[session.user.id] || session.user.email || 'Learner',
        courseTitle: enrollment.course.title,
        courseId: enrollment.course.id,
        estimatedDuration: enrollment.course.estimatedDuration,
        completedAt: (enrollment.certificateIssuedAt ?? enrollment.completedAt).toISOString(),
      },
    }
  } catch (error) {
    console.error('Error loading certificate:', error)
    return { error: 'Failed to load certificate' }
  }
}
