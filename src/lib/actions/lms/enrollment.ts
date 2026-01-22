'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'

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
          select: {
            id: true,
            _count: { select: { lessons: true } },
          },
        },
        enrollments: {
          where: { userId: session.user.id },
          select: {
            id: true,
            status: true,
            progressPercentage: true,
            completedAt: true,
          },
        },
        _count: {
          select: { enrollments: true },
        },
      },
    })

    // Serialize and format data
    const formattedCourses = courses.map((course) => {
      const enrollment = course.enrollments[0] || null
      const totalLessons = course.modules.reduce((acc, m) => acc + m._count.lessons, 0)

      return {
        id: course.id,
        title: course.title,
        description: course.description,
        thumbnail: course.thumbnail,
        estimatedDuration: course.estimatedDuration,
        moduleCount: course.modules.length,
        lessonCount: totalLessons,
        enrollmentCount: course._count.enrollments,
        publishedAt: course.publishedAt?.toISOString() || null,
        // User's enrollment status
        isEnrolled: !!enrollment,
        enrollment: enrollment
          ? {
              id: enrollment.id,
              status: enrollment.status,
              progressPercentage: enrollment.progressPercentage,
              completedAt: enrollment.completedAt?.toISOString() || null,
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

export async function getCourseForLearner(courseId: string) {
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
          where: { userId: session.user.id },
          include: {
            lessonProgress: {
              include: {
                contentProgress: true,
              },
            },
          },
        },
      },
    })

    if (!course) {
      return { error: 'Course not found or not available' }
    }

    const enrollment = course.enrollments[0] || null

    // Build progress map for quick lookup
    const lessonProgressMap: Record<string, { status: string; completedAt: string | null }> = {}
    const contentProgressMap: Record<string, { status: string; progressValue: number | null }> = {}

    if (enrollment) {
      enrollment.lessonProgress.forEach((lp) => {
        lessonProgressMap[lp.lessonId] = {
          status: lp.status,
          completedAt: lp.completedAt?.toISOString() || null,
        }
        lp.contentProgress.forEach((cp) => {
          contentProgressMap[cp.contentBlockId] = {
            status: cp.status,
            progressValue: cp.progressValue,
          }
        })
      })
    }

    // Format the course data
    const formattedCourse = {
      id: course.id,
      title: course.title,
      description: course.description,
      thumbnail: course.thumbnail,
      estimatedDuration: course.estimatedDuration,
      modules: course.modules.map((module) => ({
        id: module.id,
        title: module.title,
        description: module.description,
        sortOrder: module.sortOrder,
        lessons: module.lessons.map((lesson) => ({
          id: lesson.id,
          title: lesson.title,
          description: lesson.description,
          estimatedDuration: lesson.estimatedDuration,
          sortOrder: lesson.sortOrder,
          contentBlockCount: lesson.contentBlocks.length,
          contentBlocks: lesson.contentBlocks,
          progress: lessonProgressMap[lesson.id] || { status: 'NOT_STARTED', completedAt: null },
        })),
      })),
      enrollment: enrollment
        ? {
            id: enrollment.id,
            status: enrollment.status,
            progressPercentage: enrollment.progressPercentage,
            completedAt: enrollment.completedAt?.toISOString() || null,
            lastAccessedAt: enrollment.lastAccessedAt?.toISOString() || null,
            totalTimeSpent: enrollment.totalTimeSpent,
          }
        : null,
      lessonProgressMap,
      contentProgressMap,
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
    // Check if course exists and user has access
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

    // Check prerequisites
    if (course.prerequisiteIds.length > 0) {
      const completedPrereqs = await prisma.lMSEnrollment.count({
        where: {
          userId: session.user.id,
          courseId: { in: course.prerequisiteIds },
          status: 'COMPLETED',
        },
      })

      if (completedPrereqs < course.prerequisiteIds.length) {
        return { error: 'You must complete prerequisite courses first' }
      }
    }

    // Check if already enrolled
    const existing = await prisma.lMSEnrollment.findUnique({
      where: {
        courseId_userId: {
          courseId,
          userId: session.user.id,
        },
      },
    })

    if (existing) {
      return { error: 'Already enrolled in this course' }
    }

    // Create enrollment
    const enrollment = await prisma.lMSEnrollment.create({
      data: {
        courseId,
        userId: session.user.id,
        status: 'NOT_STARTED',
        progressPercentage: 0,
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'ENROLL_LMS_COURSE',
        entityType: 'LMSEnrollment',
        entityId: enrollment.id,
        details: `Enrolled in course: ${course.title}`,
      },
    })

    revalidatePath('/coach/learning')
    revalidatePath(`/coach/learning/${courseId}`)
    return { success: true, enrollmentId: enrollment.id }
  } catch (error) {
    console.error('Error enrolling in course:', error)
    return { error: 'Failed to enroll in course' }
  }
}

export async function getLessonContent(lessonId: string) {
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
            course: {
              select: {
                id: true,
                title: true,
                status: true,
                allowedRoles: true,
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

    // Check access
    if (
      lesson.module.course.status !== 'PUBLISHED' ||
      !lesson.module.course.allowedRoles.includes(session.user.role)
    ) {
      return { error: 'Access denied' }
    }

    // Check enrollment
    const enrollment = await prisma.lMSEnrollment.findUnique({
      where: {
        courseId_userId: {
          courseId: lesson.module.course.id,
          userId: session.user.id,
        },
      },
      include: {
        lessonProgress: {
          where: { lessonId },
          include: { contentProgress: true },
        },
      },
    })

    if (!enrollment) {
      return { error: 'Not enrolled in this course' }
    }

    // Get or create lesson progress
    let lessonProgress = enrollment.lessonProgress[0]
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

      // Update enrollment status if first lesson
      if (enrollment.status === 'NOT_STARTED') {
        await prisma.lMSEnrollment.update({
          where: { id: enrollment.id },
          data: { status: 'IN_PROGRESS', lastAccessedAt: new Date() },
        })
      }
    } else {
      // Update last accessed
      await prisma.lMSEnrollment.update({
        where: { id: enrollment.id },
        data: { lastAccessedAt: new Date() },
      })
    }

    // Build content progress map
    const contentProgressMap: Record<string, { status: string; progressValue: number | null }> = {}
    lessonProgress.contentProgress.forEach((cp) => {
      contentProgressMap[cp.contentBlockId] = {
        status: cp.status,
        progressValue: cp.progressValue,
      }
    })

    // Get navigation info (prev/next lessons)
    const allLessons = await prisma.lMSLesson.findMany({
      where: { module: { courseId: lesson.module.course.id } },
      orderBy: [{ module: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
      select: { id: true, title: true, moduleId: true },
    })

    const currentIndex = allLessons.findIndex((l) => l.id === lessonId)
    const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null
    const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null

    return {
      lesson: {
        id: lesson.id,
        title: lesson.title,
        description: lesson.description,
        estimatedDuration: lesson.estimatedDuration,
        moduleTitle: lesson.module.title,
        courseId: lesson.module.course.id,
        courseTitle: lesson.module.course.title,
        contentBlocks: lesson.contentBlocks.map((block) => ({
          id: block.id,
          title: block.title,
          type: block.type,
          content: (block.content as Record<string, unknown>) || {},
          completionThreshold: block.completionThreshold,
          sortOrder: block.sortOrder,
          progress: contentProgressMap[block.id] || { status: 'NOT_STARTED', progressValue: null },
        })),
      },
      progress: {
        lessonStatus: lessonProgress.status,
        enrollmentId: enrollment.id,
        lessonProgressId: lessonProgress.id,
      },
      navigation: {
        prevLesson: prevLesson ? { id: prevLesson.id, title: prevLesson.title } : null,
        nextLesson: nextLesson ? { id: nextLesson.id, title: nextLesson.title } : null,
        currentIndex: currentIndex + 1,
        totalLessons: allLessons.length,
      },
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
    // Get the content block and verify access
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

    // Get enrollment
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

    // Get or create lesson progress
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

    // Determine completion status
    let isComplete = markComplete === true
    if (!isComplete && progressValue !== undefined && contentBlock.completionThreshold) {
      isComplete = progressValue >= contentBlock.completionThreshold
    }

    // Upsert content progress
    const contentProgress = await prisma.lMSContentProgress.upsert({
      where: {
        lessonProgressId_contentBlockId: {
          lessonProgressId: lessonProgress.id,
          contentBlockId,
        },
      },
      update: {
        progressValue: progressValue ?? undefined,
        status: isComplete ? 'COMPLETED' : 'IN_PROGRESS',
        completedAt: isComplete ? new Date() : undefined,
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

    // Check if all content blocks in lesson are complete
    const allContentBlocks = await prisma.lMSContentBlock.findMany({
      where: { lessonId: contentBlock.lessonId },
      select: { id: true },
    })

    const completedContent = await prisma.lMSContentProgress.count({
      where: {
        lessonProgressId: lessonProgress.id,
        status: 'COMPLETED',
      },
    })

    const lessonComplete = completedContent >= allContentBlocks.length

    if (lessonComplete && lessonProgress.status !== 'COMPLETED') {
      await prisma.lMSLessonProgress.update({
        where: { id: lessonProgress.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      })
    }

    // Update overall course progress
    await updateCourseProgress(enrollment.id)

    revalidatePath(`/coach/learning/${course.id}`)
    return { success: true, isComplete, lessonComplete }
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

    // Create or update lesson progress
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

    // Mark all content blocks as complete
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

    // Update overall course progress
    await updateCourseProgress(enrollment.id)

    revalidatePath(`/coach/learning/${course.id}`)
    return { success: true }
  } catch (error) {
    console.error('Error marking lesson complete:', error)
    return { error: 'Failed to mark lesson complete' }
  }
}

async function updateCourseProgress(enrollmentId: string) {
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
      },
    },
  })

  if (!enrollment) return

  const totalLessons = enrollment.course.modules.reduce(
    (acc, m) => acc + m.lessons.length,
    0
  )
  const completedLessons = enrollment.lessonProgress.length

  const progressPercentage = totalLessons > 0
    ? Math.round((completedLessons / totalLessons) * 100)
    : 0

  const isComplete = completedLessons >= totalLessons && totalLessons > 0

  await prisma.lMSEnrollment.update({
    where: { id: enrollmentId },
    data: {
      progressPercentage,
      status: isComplete ? 'COMPLETED' : 'IN_PROGRESS',
      completedAt: isComplete ? new Date() : null,
    },
  })
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
            modules: {
              select: {
                _count: { select: { lessons: true } },
              },
            },
          },
        },
      },
      orderBy: { lastAccessedAt: 'desc' },
    })

    const formattedEnrollments = enrollments.map((e) => ({
      id: e.id,
      courseId: e.course.id,
      courseTitle: e.course.title,
      courseThumbnail: e.course.thumbnail,
      estimatedDuration: e.course.estimatedDuration,
      lessonCount: e.course.modules.reduce((acc, m) => acc + m._count.lessons, 0),
      status: e.status,
      progressPercentage: e.progressPercentage,
      completedAt: e.completedAt?.toISOString() || null,
      lastAccessedAt: e.lastAccessedAt?.toISOString() || null,
      enrolledAt: e.enrolledAt.toISOString(),
    }))

    return { enrollments: formattedEnrollments }
  } catch (error) {
    console.error('Error fetching enrollments:', error)
    return { error: 'Failed to fetch enrollments' }
  }
}
