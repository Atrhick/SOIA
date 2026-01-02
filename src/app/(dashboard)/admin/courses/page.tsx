import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { AdminCoursesClient } from './admin-courses-client'

async function getData() {
  const [courses, stats] = await Promise.all([
    prisma.course.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        questions: {
          orderBy: { sortOrder: 'asc' },
          include: {
            options: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
        results: {
          select: {
            id: true,
            passed: true,
          },
        },
      },
    }),
    Promise.all([
      prisma.course.count(),
      prisma.quizResult.count(),
      prisma.quizResult.count({ where: { passed: true } }),
    ]),
  ])

  return { courses, stats }
}

export default async function AdminCoursesPage() {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  const { courses, stats } = await getData()
  const [totalCourses, totalAttempts, passedAttempts] = stats

  // Serialize courses
  const serializedCourses = courses.map((course) => ({
    id: course.id,
    name: course.name,
    description: course.description,
    videoUrl: course.videoUrl,
    embedCode: course.embedCode,
    isRequired: course.isRequired,
    sortOrder: course.sortOrder,
    isActive: course.isActive,
    createdAt: course.createdAt.toISOString(),
    questions: course.questions.map((q) => ({
      id: q.id,
      questionText: q.questionText,
      sortOrder: q.sortOrder,
      options: q.options.map((o) => ({
        id: o.id,
        optionText: o.optionText,
        isCorrect: o.isCorrect,
        sortOrder: o.sortOrder,
      })),
    })),
    stats: {
      totalAttempts: course.results.length,
      passedAttempts: course.results.filter((r) => r.passed).length,
    },
  }))

  const courseStats = {
    totalCourses,
    totalAttempts,
    passedAttempts,
    passRate: totalAttempts > 0 ? Math.round((passedAttempts / totalAttempts) * 100) : 0,
  }

  return <AdminCoursesClient courses={serializedCourses} stats={courseStats} />
}
