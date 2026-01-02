import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { BookOpen, CheckCircle, Play, Clock } from 'lucide-react'

async function getCoursesData(userId: string) {
  const coachProfile = await prisma.coachProfile.findUnique({
    where: { userId },
    include: {
      quizResults: {
        where: { passed: true },
      },
    },
  })

  const courses = await prisma.course.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    include: {
      questions: true,
    },
  })

  return { coachProfile, courses }
}

export default async function CoursesPage() {
  const session = await auth()

  if (!session || session.user.role !== 'COACH') {
    redirect('/login')
  }

  const { coachProfile, courses } = await getCoursesData(session.user.id)

  if (!coachProfile) {
    redirect('/login')
  }

  const passedCourseIds = new Set(coachProfile.quizResults.map((r) => r.courseId))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Training Courses</h1>
        <p className="text-gray-600">Complete required courses to finish your onboarding</p>
      </div>

      {/* Progress Summary */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">Course Progress</span>
          <span className="text-sm font-medium">
            {passedCourseIds.size} of {courses.length} completed
          </span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full"
            style={{ width: `${courses.length > 0 ? (passedCourseIds.size / courses.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Courses Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => {
          const isCompleted = passedCourseIds.has(course.id)
          const hasQuiz = course.questions.length > 0

          return (
            <div
              key={course.id}
              className={`bg-white rounded-lg border overflow-hidden ${
                isCompleted ? 'border-green-200' : ''
              }`}
            >
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${isCompleted ? 'bg-green-100' : 'bg-blue-100'}`}>
                      {isCompleted ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <BookOpen className="h-5 w-5 text-blue-600" />
                      )}
                    </div>
                    {course.isRequired && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                        Required
                      </span>
                    )}
                  </div>
                  {isCompleted && (
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                      Completed
                    </span>
                  )}
                </div>

                <h3 className="font-semibold text-gray-900">{course.name}</h3>
                {course.description && (
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{course.description}</p>
                )}

                <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                  {course.videoUrl && (
                    <span className="flex items-center gap-1">
                      <Play className="h-3 w-3" />
                      Video
                    </span>
                  )}
                  {hasQuiz && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {course.questions.length} questions
                    </span>
                  )}
                </div>
              </div>

              <div className="px-4 pb-4">
                {isCompleted ? (
                  <Link
                    href={`/coach/onboarding/course/${course.id}`}
                    className="block w-full text-center py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Review Course
                  </Link>
                ) : (
                  <Link
                    href={`/coach/onboarding/course/${course.id}`}
                    className="block w-full text-center py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                  >
                    Start Course
                  </Link>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {courses.length === 0 && (
        <div className="bg-white rounded-lg border p-8 text-center">
          <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-medium text-gray-900">No Courses Available</h3>
          <p className="text-sm text-gray-500 mt-1">
            Training courses will appear here when they are added by administrators.
          </p>
        </div>
      )}
    </div>
  )
}
