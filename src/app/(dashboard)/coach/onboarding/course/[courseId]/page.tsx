import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Play, CheckCircle2, FileText } from 'lucide-react'
import { MarkAsWatchedButton } from './mark-watched-button'

// Helper function to extract YouTube video ID from various URL formats
function getYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([^#&?/\s]+)/,
    /^([a-zA-Z0-9_-]{11})$/, // Just the video ID
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }
  return null
}

// Helper function to extract Vimeo video ID
function getVimeoVideoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  return match ? match[1] : null
}

// Video embed component that supports YouTube and Vimeo
function VideoEmbed({ url, title }: { url: string; title: string }) {
  const youtubeId = getYouTubeVideoId(url)
  const vimeoId = getVimeoVideoId(url)

  if (youtubeId) {
    return (
      <iframe
        className="w-full h-full"
        src={`https://www.youtube.com/embed/${youtubeId}?rel=0`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    )
  }

  if (vimeoId) {
    return (
      <iframe
        className="w-full h-full"
        src={`https://player.vimeo.com/video/${vimeoId}`}
        title={title}
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />
    )
  }

  // Fallback for direct video URLs (mp4, webm, etc.)
  if (url.match(/\.(mp4|webm|ogg)(\?|$)/i)) {
    return (
      <video className="w-full h-full" controls>
        <source src={url} />
        Your browser does not support the video tag.
      </video>
    )
  }

  // Unknown video format - show error
  return (
    <div className="w-full h-full flex items-center justify-center text-white">
      <div className="text-center">
        <Play className="h-16 w-16 mx-auto mb-4 opacity-50" />
        <p className="text-lg">Unable to load video</p>
        <p className="text-sm text-gray-400 mt-2">
          Unsupported video URL format
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm"
        >
          Open video in new tab
        </a>
      </div>
    </div>
  )
}

async function getCourse(courseId: string) {
  return prisma.course.findUnique({
    where: { id: courseId },
    include: {
      questions: true,
    },
  })
}

async function getCoachProgress(userId: string, courseId: string) {
  const coachProfile = await prisma.coachProfile.findUnique({
    where: { userId },
    include: {
      quizResults: {
        where: { courseId },
        orderBy: { completedAt: 'desc' },
        take: 1,
      },
    },
  })
  return coachProfile
}

export default async function CoursePage({
  params,
}: {
  params: { courseId: string }
}) {
  const session = await auth()

  if (!session || session.user.role !== 'COACH') {
    redirect('/login')
  }

  const [course, coachData] = await Promise.all([
    getCourse(params.courseId),
    getCoachProgress(session.user.id, params.courseId),
  ])

  if (!course) {
    notFound()
  }

  const latestQuizResult = coachData?.quizResults[0]
  const hasQuiz = course.questions.length > 0

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/coach/onboarding">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{course.name}</h1>
          <p className="text-gray-600">{course.description}</p>
        </div>
        {course.isRequired && (
          <Badge variant="warning">Required</Badge>
        )}
      </div>

      {/* Video Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Training Video
          </CardTitle>
        </CardHeader>
        <CardContent>
          {course.videoUrl ? (
            <div className="space-y-4">
              {/* Video embed */}
              <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
                <VideoEmbed url={course.videoUrl} title={course.name} />
              </div>

              {/* Mark as Watched Button */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">Finished watching?</p>
                  <p className="text-sm text-gray-500">
                    Mark this video as complete to proceed
                  </p>
                </div>
                <MarkAsWatchedButton courseId={course.id} />
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No video available for this course</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quiz Section */}
      {hasQuiz && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Assessment
            </CardTitle>
            <CardDescription>
              Complete the assessment with at least 80% to pass
            </CardDescription>
          </CardHeader>
          <CardContent>
            {latestQuizResult ? (
              <div className="space-y-4">
                <div className={`p-4 rounded-lg ${
                  latestQuizResult.passed ? 'bg-green-50' : 'bg-yellow-50'
                }`}>
                  <div className="flex items-center gap-3">
                    {latestQuizResult.passed ? (
                      <CheckCircle2 className="h-6 w-6 text-green-500" />
                    ) : (
                      <FileText className="h-6 w-6 text-yellow-500" />
                    )}
                    <div>
                      <p className="font-medium">
                        {latestQuizResult.passed ? 'Assessment Passed!' : 'Assessment Not Passed'}
                      </p>
                      <p className="text-sm text-gray-600">
                        Your score: {Math.round(latestQuizResult.score)}%
                        {!latestQuizResult.passed && ' (80% required to pass)'}
                      </p>
                    </div>
                  </div>
                </div>
                {!latestQuizResult.passed && (
                  <Link href={`/coach/onboarding/quiz/${course.id}`}>
                    <Button className="w-full">Retake Assessment</Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-600 mb-4">
                  You have {course.questions.length} questions to answer
                </p>
                <Link href={`/coach/onboarding/quiz/${course.id}`}>
                  <Button>Start Assessment</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Back to Onboarding */}
      <div className="flex justify-center">
        <Link href="/coach/onboarding">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Onboarding
          </Button>
        </Link>
      </div>
    </div>
  )
}
