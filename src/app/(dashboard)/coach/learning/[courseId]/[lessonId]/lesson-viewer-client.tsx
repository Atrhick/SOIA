'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Circle,
  Video,
  FileText,
  FileQuestion,
  File,
  ExternalLink,
  Download,
  Loader2,
  Clock,
  BookOpen,
} from 'lucide-react'
import { updateContentProgress, markLessonComplete } from '@/lib/actions/lms/enrollment'
import { LessonAudioPlayer, type LessonAudioInfo } from '@/components/learning/lesson-audio-player'
import { LessonText } from '@/components/learning/lesson-text'
// Course platform (curriculum, exercises, reading time). Kept apart from the audio code above.
import { usePathname } from 'next/navigation'
import { PenLine, Award, X } from 'lucide-react'
import { ExerciseBlock, type ExerciseState } from '@/components/learning/course/exercise-block'
import { CurriculumDrawer, CurriculumList, CourseProgressBar, type Curriculum } from '@/components/learning/course/curriculum-nav'
import { markdownWords, readingMinutes } from '@/lib/lms/markdown'
import type { ExerciseContent } from '@/lib/lms/exercise'

interface ContentBlock {
  id: string
  title: string | null
  type: 'VIDEO' | 'TEXT' | 'QUIZ' | 'DOCUMENT' | 'EXERCISE'
  content: {
    url?: string
    provider?: string
    duration?: number
    content?: string
    format?: string
    surveyId?: string
    fileName?: string
    fileSize?: number
    mimeType?: string
  }
  completionThreshold: number | null
  sortOrder: number
  progress: {
    status: string
    progressValue: number | null
  }
}

interface Lesson {
  id: string
  title: string
  description: string | null
  estimatedDuration: number | null
  moduleTitle: string
  courseId: string
  courseTitle: string
  contentBlocks: ContentBlock[]
}

interface Progress {
  lessonStatus: string
  enrollmentId: string
  lessonProgressId: string
}

interface Navigation {
  prevLesson: { id: string; title: string } | null
  nextLesson: { id: string; title: string; locked?: boolean } | null
  currentIndex: number
  totalLessons: number
}

interface LessonViewerClientProps {
  lesson: Lesson
  progress: Progress
  navigation: Navigation
  basePath?: string
  audio?: LessonAudioInfo | null
  listen?: { positionSec: number; completed: boolean }
  // Course platform
  curriculum?: Curriculum
  exercises?: Record<string, ExerciseState>
  readOnly?: boolean
  isPreview?: boolean
}

const contentTypeIcons = {
  VIDEO: Video,
  TEXT: FileText,
  QUIZ: FileQuestion,
  DOCUMENT: File,
  EXERCISE: PenLine,
}

export function LessonViewerClient({ lesson, progress, navigation, basePath = '/coach/learning', audio = null, listen, curriculum, exercises = {}, readOnly = false, isPreview = false }: LessonViewerClientProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const lessonHref = (id: string) => `${basePath}/${lesson.courseId}/${id}`
  const readMinutes = readingMinutes(
    lesson.contentBlocks.reduce(
      (n, b) => n + (b.type === 'TEXT' ? markdownWords(b.content.content ?? '') : b.type === 'EXERCISE' ? markdownWords((b.content as ExerciseContent).intro ?? '') : 0),
      0
    )
  )
  const [isUpdating, setIsUpdating] = useState(false)
  const [localProgress, setLocalProgress] = useState<Record<string, { status: string; progressValue: number | null }>>(
    lesson.contentBlocks.reduce((acc, block) => {
      acc[block.id] = block.progress
      return acc
    }, {} as Record<string, { status: string; progressValue: number | null }>)
  )

  const isLessonComplete = progress.lessonStatus === 'COMPLETED'

  const handleMarkBlockComplete = async (blockId: string) => {
    if (readOnly) return
    setIsUpdating(true)
    setError(null)
    try {
      const result = await updateContentProgress(blockId, undefined, true)
      if (result.success) {
        setLocalProgress((prev) => ({
          ...prev,
          [blockId]: { status: 'COMPLETED', progressValue: 100 },
        }))
        if (result.lessonComplete) router.refresh()
      } else if (result.error) {
        setError(result.error)
      }
    } catch {
      setError('Could not save your progress. Check your connection and try again.')
    } finally {
      setIsUpdating(false)
    }
  }

  // Listening to the whole lesson counts as reading its text.
  const handleAudioCompleted = async () => {
    const textBlocks = lesson.contentBlocks.filter(
      (b) => b.type === 'TEXT' && localProgress[b.id]?.status !== 'COMPLETED'
    )
    for (const b of textBlocks) {
      try {
        const result = await updateContentProgress(b.id, undefined, true)
        if (result.success) {
          setLocalProgress((prev) => ({ ...prev, [b.id]: { status: 'COMPLETED', progressValue: 100 } }))
        }
      } catch (error) {
        console.error('Error marking text complete after listening:', error)
      }
    }
  }

  const handleVideoProgress = async (blockId: string, percentage: number) => {
    // Only update if significant progress (every 10%)
    const currentProgress = localProgress[blockId]?.progressValue || 0
    if (percentage > currentProgress && percentage - currentProgress >= 10) {
      setLocalProgress((prev) => ({
        ...prev,
        [blockId]: { ...prev[blockId], progressValue: percentage },
      }))

      await updateContentProgress(blockId, percentage)
    }
  }

  // "Mark complete and continue": finishes the lesson, then goes to the next one (or the certificate).
  const handleMarkLessonComplete = async () => {
    if (readOnly) return
    setIsUpdating(true)
    setError(null)
    try {
      const result = await markLessonComplete(lesson.id)
      if ('error' in result && result.error) {
        setError(result.error)
      } else if ('courseCompleted' in result && result.courseCompleted) {
        router.push(`${basePath}/${lesson.courseId}/certificate`)
      } else if (navigation.nextLesson && !navigation.nextLesson.locked) {
        router.push(lessonHref(navigation.nextLesson.id))
      } else {
        router.refresh()
      }
    } catch {
      setError('Could not save your progress. Check your connection and try again.')
    } finally {
      setIsUpdating(false)
    }
  }

  const goToNextLesson = () => {
    if (navigation.nextLesson) {
      router.push(`${basePath}/${lesson.courseId}/${navigation.nextLesson.id}`)
    }
  }

  const goToPrevLesson = () => {
    if (navigation.prevLesson) {
      router.push(`${basePath}/${lesson.courseId}/${navigation.prevLesson.id}`)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-16 z-10">
        <div className="max-w-5xl mx-auto px-4 py-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                href={isPreview ? `/admin/lms/${lesson.courseId}` : `${basePath}/${lesson.courseId}`}
                className="flex min-h-[44px] items-center gap-2 text-gray-700 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">{isPreview ? 'Back to editor' : 'Course'}</span>
                <span className="sr-only sm:hidden">Back to course</span>
              </Link>
              <div className="min-w-0">
                <p className="truncate text-xs text-gray-600">{lesson.courseTitle}</p>
                <p className="truncate text-sm font-medium text-gray-900">{lesson.moduleTitle}</p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 text-sm">
              {curriculum ? (
                <div className="lg:hidden">
                  <CurriculumDrawer curriculum={curriculum} currentLessonId={lesson.id} lessonHref={lessonHref} />
                </div>
              ) : null}
              <span className={`text-gray-600 ${curriculum ? 'hidden lg:inline' : ''}`}>
                Lesson {navigation.currentIndex} of {navigation.totalLessons}
              </span>
            </div>
          </div>
          {curriculum && (
            <div className="mt-2">
              <CourseProgressBar curriculum={curriculum} compact />
            </div>
          )}
        </div>
      </div>

      {isPreview && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-sm text-amber-900">
          Preview: this is what learners see. Nothing you do here is saved.
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="lg:flex lg:gap-6">
          {/* Main Content */}
          <div className="min-w-0 lg:flex-1">
            {/* Lesson Title */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{lesson.title}</h1>
              {lesson.description && (
                <p className="text-gray-700">{lesson.description}</p>
              )}
              <p className="text-sm text-gray-600 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                {(lesson.estimatedDuration || readMinutes > 0) && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {lesson.estimatedDuration ? `About ${lesson.estimatedDuration} min` : `${readMinutes} min read`}
                    {lesson.estimatedDuration && readMinutes > 0 ? ` (${readMinutes} min reading)` : ''}
                  </span>
                )}
                {isLessonComplete && (
                  <span className="flex items-center gap-1 font-medium text-green-700">
                    <CheckCircle className="h-4 w-4" />
                    Completed
                  </span>
                )}
              </p>
            </div>

            {error && (
              <div role="alert" className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
                <span>{error}</span>
                <button type="button" onClick={() => setError(null)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded hover:bg-red-100" aria-label="Dismiss">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {lesson.contentBlocks.some((b) => b.type === 'TEXT') && (
              <LessonAudioPlayer
                lessonId={lesson.id}
                audio={audio}
                startAt={listen?.positionSec ?? 0}
                alreadyCompleted={listen?.completed ?? false}
                onCompleted={handleAudioCompleted}
              />
            )}

            {/* Content blocks, all in order on one page (reading flow) */}
            {lesson.contentBlocks.map((block) =>
              block.type === 'TEXT' ? (
                <div key={block.id} className="bg-white rounded-lg border mb-6 p-4 sm:p-6">
                  <TextContent content={block.content} blockId={block.id} />
                </div>
              ) : block.type === 'EXERCISE' ? (
                <ExerciseBlock
                  key={block.id}
                  blockId={block.id}
                  title={block.title}
                  content={block.content as unknown as ExerciseContent}
                  initial={exercises[block.id]}
                  readOnly={readOnly}
                  readOnlyReason={isPreview ? 'Preview: answers are not saved.' : 'You are viewing as this person, so answers cannot be changed.'}
                  onCompleted={(lessonDone) => {
                    setLocalProgress((prev) => ({ ...prev, [block.id]: { status: 'COMPLETED', progressValue: 100 } }))
                    if (lessonDone) router.refresh()
                  }}
                />
              ) : (
                <div key={block.id} className="bg-white rounded-lg border mb-6">
                  <ContentBlockViewer
                    block={block}
                    isComplete={localProgress[block.id]?.status === 'COMPLETED'}
                    onMarkComplete={() => handleMarkBlockComplete(block.id)}
                    onVideoProgress={(pct) => handleVideoProgress(block.id, pct)}
                    isUpdating={isUpdating || readOnly}
                  />
                </div>
              )
            )}

            {/* Lesson Actions */}
            <div className="border-t pt-6 space-y-4">
              {!readOnly && !isLessonComplete && (
                <button
                  onClick={handleMarkLessonComplete}
                  disabled={isUpdating}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-green-700 px-6 py-3 font-semibold text-white hover:bg-green-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:ring-offset-2 disabled:opacity-60"
                >
                  {isUpdating ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
                  {navigation.nextLesson ? 'Mark complete and continue' : 'Mark complete and finish the course'}
                </button>
              )}
              {curriculum?.courseCompleted && !isPreview && (
                <Link
                  href={`${basePath}/${lesson.courseId}/certificate`}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg border-2 border-green-700 px-6 py-3 font-semibold text-green-800 hover:bg-green-50"
                >
                  <Award className="h-5 w-5" />
                  View your certificate
                </Link>
              )}

              <div className="flex items-stretch justify-between gap-3">
                <button
                  onClick={goToPrevLesson}
                  disabled={!navigation.prevLesson}
                  className="flex min-h-[44px] min-w-0 items-center gap-2 rounded-lg px-3 py-2 text-gray-700 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ArrowLeft className="h-4 w-4 shrink-0" />
                  <span className="truncate">{navigation.prevLesson ? <><span className="sm:hidden">Previous</span><span className="hidden sm:inline">{navigation.prevLesson.title}</span></> : 'Previous'}</span>
                </button>

                {navigation.nextLesson ? (
                  <button
                    onClick={goToNextLesson}
                    disabled={navigation.nextLesson.locked}
                    className="flex min-h-[44px] min-w-0 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="truncate">
                      <span className="sm:hidden">{navigation.nextLesson.locked ? 'Next week opens soon' : 'Next'}</span>
                      <span className="hidden sm:inline">{navigation.nextLesson.locked ? 'Next week opens soon' : navigation.nextLesson.title}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0" />
                  </button>
                ) : (
                  <Link
                    href={isPreview ? `/admin/lms/${lesson.courseId}` : `${basePath}/${lesson.courseId}`}
                    className="flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-2 text-gray-700 hover:bg-gray-100"
                  >
                    <BookOpen className="h-4 w-4" />
                    Course overview
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar - whole course curriculum (desktop; phones use the Contents drawer) */}
          {curriculum && (
            <div className="hidden lg:block lg:w-72 lg:shrink-0">
              <div className="bg-white rounded-lg border sticky top-40">
                <div className="p-4 border-b">
                  <h2 className="font-semibold text-gray-900 mb-2">Course contents</h2>
                  <CourseProgressBar curriculum={curriculum} />
                </div>
                <div className="max-h-[65vh] overflow-y-auto p-2">
                  <CurriculumList curriculum={curriculum} currentLessonId={lesson.id} lessonHref={lessonHref} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================
// CONTENT BLOCK VIEWER
// ============================================

interface ContentBlockViewerProps {
  block: ContentBlock
  isComplete: boolean
  onMarkComplete: () => void
  onVideoProgress: (percentage: number) => void
  isUpdating: boolean
}

function ContentBlockViewer({
  block,
  isComplete,
  onMarkComplete,
  onVideoProgress,
  isUpdating,
}: ContentBlockViewerProps) {
  const Icon = contentTypeIcons[block.type]

  return (
    <div>
      {/* Block Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isComplete ? 'bg-green-100' : 'bg-gray-100'}`}>
            <Icon className={`h-5 w-5 ${isComplete ? 'text-green-600' : 'text-gray-500'}`} />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">
              {block.title || block.type.charAt(0) + block.type.slice(1).toLowerCase()}
            </h3>
            <p className="text-sm text-gray-500">{block.type}</p>
          </div>
        </div>
        {isComplete ? (
          <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
            <CheckCircle className="h-4 w-4" />
            Completed
          </span>
        ) : (
          <button
            onClick={onMarkComplete}
            disabled={isUpdating}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {isUpdating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            Mark Complete
          </button>
        )}
      </div>

      {/* Block Content */}
      <div className="p-4">
        {block.type === 'VIDEO' && (
          <VideoContent
            content={block.content}
            onProgress={onVideoProgress}
          />
        )}
        {block.type === 'TEXT' && (
          <TextContent content={block.content} blockId={block.id} />
        )}
        {block.type === 'QUIZ' && (
          <QuizContent content={block.content} />
        )}
        {block.type === 'DOCUMENT' && (
          <DocumentContent content={block.content} />
        )}
      </div>
    </div>
  )
}

// Video Content Component
function VideoContent({
  content,
  onProgress,
}: {
  content: ContentBlock['content']
  onProgress: (percentage: number) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  // Extract YouTube/Vimeo embed URL
  const getEmbedUrl = (url: string, provider?: string) => {
    if (provider === 'youtube' || url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoId = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1]
      return videoId ? `https://www.youtube.com/embed/${videoId}` : url
    }
    if (provider === 'vimeo' || url.includes('vimeo.com')) {
      const videoId = url.match(/vimeo\.com\/(\d+)/)?.[1]
      return videoId ? `https://player.vimeo.com/video/${videoId}` : url
    }
    return url
  }

  const embedUrl = content.url ? getEmbedUrl(content.url, content.provider) : null

  if (!embedUrl) {
    return <p className="text-gray-500">No video URL provided</p>
  }

  // For YouTube/Vimeo, use iframe
  if (content.provider === 'youtube' || content.provider === 'vimeo' ||
      embedUrl.includes('youtube.com') || embedUrl.includes('vimeo.com')) {
    return (
      <div className="aspect-video bg-black rounded-lg overflow-hidden">
        <iframe
          src={embedUrl}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  }

  // For custom videos, use video element
  return (
    <div className="aspect-video bg-black rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        src={content.url}
        controls
        className="w-full h-full"
        onTimeUpdate={() => {
          if (videoRef.current) {
            const percentage = Math.round(
              (videoRef.current.currentTime / videoRef.current.duration) * 100
            )
            onProgress(percentage)
          }
        }}
      />
    </div>
  )
}

// Text Content Component
function TextContent({ content, blockId }: { content: ContentBlock['content']; blockId: string }) {
  if (!content.content) {
    return <p className="text-gray-500">No content provided</p>
  }

  // Paragraphs carry data-audio-key so the lesson audio can highlight and jump to them.
  if (content.format === 'html') {
    return <div className="whitespace-pre-line text-gray-800">{content.content.replace(/<[^>]+>/g, '')}</div>
  }
  return <LessonText blockId={blockId} markdown={content.content} />
}

// Quiz Content Component
function QuizContent({ content }: { content: ContentBlock['content'] }) {
  const surveysBase = usePathname()?.startsWith('/ambassador') ? '/ambassador/surveys' : '/coach/surveys'
  if (!content.surveyId) {
    return <p className="text-gray-500">No quiz linked</p>
  }

  return (
    <div className="text-center py-8">
      <FileQuestion className="h-12 w-12 text-blue-500 mx-auto mb-4" />
      <h3 className="font-semibold text-gray-900 mb-2">Quiz</h3>
      <p className="text-gray-600 mb-4">Complete this quiz to continue</p>
      <Link
        href={`${surveysBase}/${content.surveyId}`}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Start Quiz
        <ExternalLink className="h-4 w-4" />
      </Link>
    </div>
  )
}

// Document Content Component
function DocumentContent({ content }: { content: ContentBlock['content'] }) {
  if (!content.url) {
    return <p className="text-gray-500">No document provided</p>
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-white border rounded-lg">
          <File className="h-6 w-6 text-gray-500" />
        </div>
        <div>
          <p className="font-medium text-gray-900">{content.fileName || 'Document'}</p>
          {content.fileSize && (
            <p className="text-sm text-gray-500">{formatFileSize(content.fileSize)}</p>
          )}
        </div>
      </div>
      <a
        href={content.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        <Download className="h-4 w-4" />
        Download
      </a>
    </div>
  )
}
