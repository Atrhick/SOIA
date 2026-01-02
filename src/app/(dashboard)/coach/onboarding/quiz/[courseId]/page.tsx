import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { QuizForm } from './quiz-form'

async function getCourseWithQuestions(courseId: string) {
  return prisma.course.findUnique({
    where: { id: courseId },
    include: {
      questions: {
        orderBy: { sortOrder: 'asc' },
        include: {
          options: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
    },
  })
}

export default async function QuizPage({
  params,
}: {
  params: { courseId: string }
}) {
  const session = await auth()

  if (!session || session.user.role !== 'COACH') {
    redirect('/login')
  }

  const course = await getCourseWithQuestions(params.courseId)

  if (!course || course.questions.length === 0) {
    notFound()
  }

  // Remove isCorrect from options before sending to client
  const questionsForClient = course.questions.map((q) => ({
    id: q.id,
    questionText: q.questionText,
    options: q.options.map((o) => ({
      id: o.id,
      optionText: o.optionText,
    })),
  }))

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/coach/onboarding/course/${params.courseId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{course.name} - Assessment</h1>
          <p className="text-gray-600">
            Answer all questions below. You need at least 80% to pass.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assessment Questions</CardTitle>
          <CardDescription>
            {course.questions.length} questions total
          </CardDescription>
        </CardHeader>
        <CardContent>
          <QuizForm courseId={course.id} questions={questionsForClient} />
        </CardContent>
      </Card>
    </div>
  )
}
