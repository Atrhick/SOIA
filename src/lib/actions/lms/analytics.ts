'use server'

import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'

// ============================================
// ANALYTICS DATA TYPES
// ============================================

interface CourseAnalytics {
  id: string
  title: string
  status: string
  totalEnrollments: number
  completedEnrollments: number
  inProgressEnrollments: number
  notStartedEnrollments: number
  completionRate: number
  avgProgressPercentage: number
  totalTimeSpent: number // minutes
  moduleCount: number
  lessonCount: number
  publishedAt: string | null
}

interface EnrollmentDetail {
  id: string
  courseId: string
  courseTitle: string
  userId: string
  userEmail: string
  userName: string | null
  userRole: string
  status: string
  progressPercentage: number
  completedAt: string | null
  enrolledAt: string
  lastAccessedAt: string | null
  totalTimeSpent: number
}

interface OverviewStats {
  totalCourses: number
  publishedCourses: number
  totalEnrollments: number
  completedEnrollments: number
  overallCompletionRate: number
  activeLearnersThisWeek: number
  avgCompletionTime: number // minutes
}

// ============================================
// ANALYTICS FUNCTIONS
// ============================================

export async function getLMSOverviewStats(): Promise<{ stats?: OverviewStats; error?: string }> {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  try {
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    const [
      totalCourses,
      publishedCourses,
      totalEnrollments,
      completedEnrollments,
      activeLearnersThisWeek,
      completedWithTime,
    ] = await Promise.all([
      prisma.lMSCourse.count(),
      prisma.lMSCourse.count({ where: { status: 'PUBLISHED' } }),
      prisma.lMSEnrollment.count(),
      prisma.lMSEnrollment.count({ where: { status: 'COMPLETED' } }),
      prisma.lMSEnrollment.count({
        where: {
          lastAccessedAt: { gte: oneWeekAgo },
        },
      }),
      prisma.lMSEnrollment.findMany({
        where: {
          status: 'COMPLETED',
          totalTimeSpent: { gt: 0 },
        },
        select: { totalTimeSpent: true },
      }),
    ])

    const avgCompletionTime =
      completedWithTime.length > 0
        ? Math.round(
            completedWithTime.reduce((acc, e) => acc + e.totalTimeSpent, 0) /
              completedWithTime.length
          )
        : 0

    const overallCompletionRate =
      totalEnrollments > 0 ? Math.round((completedEnrollments / totalEnrollments) * 100) : 0

    return {
      stats: {
        totalCourses,
        publishedCourses,
        totalEnrollments,
        completedEnrollments,
        overallCompletionRate,
        activeLearnersThisWeek,
        avgCompletionTime,
      },
    }
  } catch (error) {
    console.error('Error fetching LMS overview stats:', error)
    return { error: 'Failed to fetch analytics' }
  }
}

export async function getCourseAnalytics(): Promise<{ courses?: CourseAnalytics[]; error?: string }> {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  try {
    const courses = await prisma.lMSCourse.findMany({
      orderBy: [{ status: 'asc' }, { sortOrder: 'asc' }],
      include: {
        modules: {
          include: {
            lessons: {
              select: { id: true },
            },
          },
        },
        enrollments: {
          select: {
            status: true,
            progressPercentage: true,
            totalTimeSpent: true,
          },
        },
      },
    })

    const analyticsData: CourseAnalytics[] = courses.map((course) => {
      const totalEnrollments = course.enrollments.length
      const completedEnrollments = course.enrollments.filter(
        (e) => e.status === 'COMPLETED'
      ).length
      const inProgressEnrollments = course.enrollments.filter(
        (e) => e.status === 'IN_PROGRESS'
      ).length
      const notStartedEnrollments = course.enrollments.filter(
        (e) => e.status === 'NOT_STARTED'
      ).length

      const avgProgressPercentage =
        totalEnrollments > 0
          ? Math.round(
              course.enrollments.reduce((acc, e) => acc + e.progressPercentage, 0) /
                totalEnrollments
            )
          : 0

      const totalTimeSpent = course.enrollments.reduce(
        (acc, e) => acc + e.totalTimeSpent,
        0
      )

      const lessonCount = course.modules.reduce(
        (acc, m) => acc + m.lessons.length,
        0
      )

      return {
        id: course.id,
        title: course.title,
        status: course.status,
        totalEnrollments,
        completedEnrollments,
        inProgressEnrollments,
        notStartedEnrollments,
        completionRate:
          totalEnrollments > 0
            ? Math.round((completedEnrollments / totalEnrollments) * 100)
            : 0,
        avgProgressPercentage,
        totalTimeSpent,
        moduleCount: course.modules.length,
        lessonCount,
        publishedAt: course.publishedAt?.toISOString() || null,
      }
    })

    return { courses: analyticsData }
  } catch (error) {
    console.error('Error fetching course analytics:', error)
    return { error: 'Failed to fetch course analytics' }
  }
}

export async function getCourseEnrollments(
  courseId: string
): Promise<{ enrollments?: EnrollmentDetail[]; error?: string }> {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  try {
    const enrollments = await prisma.lMSEnrollment.findMany({
      where: { courseId },
      orderBy: { enrolledAt: 'desc' },
      include: {
        course: {
          select: { title: true },
        },
      },
    })

    // Get user details separately
    const userIds = enrollments.map((e) => e.userId)
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        email: true,
        role: true,
        coachProfile: {
          select: { firstName: true, lastName: true },
        },
      },
    })

    const userMap = new Map(users.map((u) => [u.id, u]))

    const enrollmentDetails: EnrollmentDetail[] = enrollments.map((e) => {
      const user = userMap.get(e.userId)
      const userName = user?.coachProfile
        ? `${user.coachProfile.firstName} ${user.coachProfile.lastName}`
        : null

      return {
        id: e.id,
        courseId: e.courseId,
        courseTitle: e.course.title,
        userId: e.userId,
        userEmail: user?.email || 'Unknown',
        userName,
        userRole: user?.role || 'Unknown',
        status: e.status,
        progressPercentage: e.progressPercentage,
        completedAt: e.completedAt?.toISOString() || null,
        enrolledAt: e.enrolledAt.toISOString(),
        lastAccessedAt: e.lastAccessedAt?.toISOString() || null,
        totalTimeSpent: e.totalTimeSpent,
      }
    })

    return { enrollments: enrollmentDetails }
  } catch (error) {
    console.error('Error fetching course enrollments:', error)
    return { error: 'Failed to fetch enrollments' }
  }
}

export async function getAllEnrollments(options?: {
  status?: string
  limit?: number
}): Promise<{ enrollments?: EnrollmentDetail[]; error?: string }> {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  try {
    const enrollments = await prisma.lMSEnrollment.findMany({
      where: options?.status ? { status: options.status as any } : undefined,
      orderBy: { lastAccessedAt: 'desc' },
      take: options?.limit || 100,
      include: {
        course: {
          select: { title: true },
        },
      },
    })

    // Get user details
    const userIds = enrollments.map((e) => e.userId)
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        email: true,
        role: true,
        coachProfile: {
          select: { firstName: true, lastName: true },
        },
      },
    })

    const userMap = new Map(users.map((u) => [u.id, u]))

    const enrollmentDetails: EnrollmentDetail[] = enrollments.map((e) => {
      const user = userMap.get(e.userId)
      const userName = user?.coachProfile
        ? `${user.coachProfile.firstName} ${user.coachProfile.lastName}`
        : null

      return {
        id: e.id,
        courseId: e.courseId,
        courseTitle: e.course.title,
        userId: e.userId,
        userEmail: user?.email || 'Unknown',
        userName,
        userRole: user?.role || 'Unknown',
        status: e.status,
        progressPercentage: e.progressPercentage,
        completedAt: e.completedAt?.toISOString() || null,
        enrolledAt: e.enrolledAt.toISOString(),
        lastAccessedAt: e.lastAccessedAt?.toISOString() || null,
        totalTimeSpent: e.totalTimeSpent,
      }
    })

    return { enrollments: enrollmentDetails }
  } catch (error) {
    console.error('Error fetching all enrollments:', error)
    return { error: 'Failed to fetch enrollments' }
  }
}

export async function getRecentActivity(
  limit: number = 20
): Promise<{
  activities?: Array<{
    type: string
    userId: string
    userEmail: string
    userName: string | null
    courseTitle: string
    lessonTitle?: string
    timestamp: string
    details?: string
  }>
  error?: string
}> {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized - Admin only' }
  }

  try {
    // Get recent lesson completions
    const recentLessonProgress = await prisma.lMSLessonProgress.findMany({
      where: {
        status: 'COMPLETED',
        completedAt: { not: null },
      },
      orderBy: { completedAt: 'desc' },
      take: limit,
      include: {
        lesson: {
          select: {
            title: true,
            module: {
              select: {
                course: { select: { title: true } },
              },
            },
          },
        },
        enrollment: {
          select: { userId: true },
        },
      },
    })

    // Get recent course completions
    const recentCourseCompletions = await prisma.lMSEnrollment.findMany({
      where: {
        status: 'COMPLETED',
        completedAt: { not: null },
      },
      orderBy: { completedAt: 'desc' },
      take: limit,
      include: {
        course: { select: { title: true } },
      },
    })

    // Get user details
    const userIds = [
      ...recentLessonProgress.map((p) => p.enrollment.userId),
      ...recentCourseCompletions.map((e) => e.userId),
    ]
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        email: true,
        coachProfile: {
          select: { firstName: true, lastName: true },
        },
      },
    })
    const userMap = new Map(users.map((u) => [u.id, u]))

    // Combine and sort activities
    const activities = [
      ...recentLessonProgress.map((p) => {
        const user = userMap.get(p.enrollment.userId)
        return {
          type: 'LESSON_COMPLETED',
          userId: p.enrollment.userId,
          userEmail: user?.email || 'Unknown',
          userName: user?.coachProfile
            ? `${user.coachProfile.firstName} ${user.coachProfile.lastName}`
            : null,
          courseTitle: p.lesson.module.course.title,
          lessonTitle: p.lesson.title,
          timestamp: p.completedAt!.toISOString(),
        }
      }),
      ...recentCourseCompletions.map((e) => {
        const user = userMap.get(e.userId)
        return {
          type: 'COURSE_COMPLETED',
          userId: e.userId,
          userEmail: user?.email || 'Unknown',
          userName: user?.coachProfile
            ? `${user.coachProfile.firstName} ${user.coachProfile.lastName}`
            : null,
          courseTitle: e.course.title,
          timestamp: e.completedAt!.toISOString(),
        }
      }),
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)

    return { activities }
  } catch (error) {
    console.error('Error fetching recent activity:', error)
    return { error: 'Failed to fetch recent activity' }
  }
}
