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

interface ContentBlock {
  id: string
  title: string | null
  type: 'VIDEO' | 'TEXT' | 'QUIZ' | 'DOCUMENT'
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
  nextLesson: { id: string; title: string } | null
  currentIndex: number
  totalLessons: number
}

interface LessonViewerClientProps {
  lesson: Lesson
  progress: Progress
  navigation: Navigation
  basePath?: string
}

const contentTypeIcons = {
  VIDEO: Video,
  TEXT: FileText,
  QUIZ: FileQuestion,
  DOCUMENT: File,
}

export function LessonViewerClient({ lesson, progress, navigation, basePath = '/coach/learning' }: LessonViewerClientProps) {
  const router = useRouter()
  const [activeBlockIndex, setActiveBlockIndex] = useState(0)
  const [isUpdating, setIsUpdating] = useState(false)
  const [localProgress, setLocalProgress] = useState<Record<string, { status: string; progressValue: number | null }>>(
    lesson.contentBlocks.reduce((acc, block) => {
      acc[block.id] = block.progress
      return acc
    }, {} as Record<string, { status: string; progressValue: number | null }>)
  )

  const activeBlock = lesson.contentBlocks[activeBlockIndex]
  const isLessonComplete = progress.lessonStatus === 'COMPLETED'
  const allBlocksComplete = lesson.contentBlocks.every(
    (block) => localProgress[block.id]?.status === 'COMPLETED'
  )

  const handleMarkBlockComplete = async (blockId: string) => {
    setIsUpdating(true)
    try {
      const result = await updateContentProgress(blockId, undefined, true)
      if (result.success) {
        setLocalProgress((prev) => ({
          ...prev,
          [blockId]: { status: 'COMPLETED', progressValue: 100 },
        }))

        // Auto-advance to next block if available
        if (activeBlockIndex < lesson.contentBlocks.length - 1) {
          setActiveBlockIndex(activeBlockIndex + 1)
        }
      }
    } catch (error) {
      console.error('Error marking complete:', error)
    } finally {
      setIsUpdating(false)
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

  const handleMarkLessonComplete = async () => {
    setIsUpdating(true)
    try {
      await markLessonComplete(lesson.id)
      router.refresh()
    } catch (error) {
      console.error('Error marking lesson complete:', error)
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
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`${basePath}/${lesson.courseId}`}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back to Course</span>
              </Link>
              <div className="hidden md:block h-6 w-px bg-gray-200" />
              <div className="hidden md:block">
                <p className="text-sm text-gray-500">{lesson.courseTitle}</p>
                <p className="text-sm font-medium text-gray-900">{lesson.moduleTitle}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">
                Lesson {navigation.currentIndex} of {navigation.totalLessons}
              </span>
              {isLessonComplete && (
                <span className="flex items-center gap-1 text-green-600 font-medium">
                  <CheckCircle className="h-4 w-4" />
                  Complete
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="lg:flex lg:gap-6">
          {/* Main Content */}
          <div className="lg:flex-1">
            {/* Lesson Title */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{lesson.title}</h1>
              {lesson.description && (
                <p className="text-gray-600">{lesson.description}</p>
              )}
              {lesson.estimatedDuration && (
                <p className="text-sm text-gray-500 mt-2 flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Estimated: {lesson.estimatedDuration} minutes
                </p>
              )}
            </div>

            {/* Content Block Display */}
            {activeBlock && (
              <div className="bg-white rounded-lg border mb-6">
                <ContentBlockViewer
                  block={activeBlock}
                  isComplete={localProgress[activeBlock.id]?.status === 'COMPLETED'}
                  onMarkComplete={() => handleMarkBlockComplete(activeBlock.id)}
                  onVideoProgress={(pct) => handleVideoProgress(activeBlock.id, pct)}
                  isUpdating={isUpdating}
                />
              </div>
            )}

            {/* Block Navigation */}
            {lesson.contentBlocks.length > 1 && (
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={() => setActiveBlockIndex(Math.max(0, activeBlockIndex - 1))}
                  disabled={activeBlockIndex === 0}
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Previous
                </button>
                <span className="text-sm text-gray-500">
                  {activeBlockIndex + 1} / {lesson.contentBlocks.length}
                </span>
                <button
                  onClick={() => setActiveBlockIndex(Math.min(lesson.contentBlocks.length - 1, activeBlockIndex + 1))}
                  disabled={activeBlockIndex === lesson.contentBlocks.length - 1}
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Lesson Actions */}
            <div className="flex items-center justify-between border-t pt-6">
              <button
                onClick={goToPrevLesson}
                disabled={!navigation.prevLesson}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowLeft className="h-4 w-4" />
                {navigation.prevLesson ? (
                  <span className="hidden sm:inline">{navigation.prevLesson.title}</span>
                ) : (
                  <span>Previous</span>
                )}
              </button>

              {!isLessonComplete && allBlocksComplete && (
                <button
                  onClick={handleMarkLessonComplete}
                  disabled={isUpdating}
                  className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {isUpdating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  Complete Lesson
                </button>
              )}

              <button
                onClick={goToNextLesson}
                disabled={!navigation.nextLesson}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                  navigation.nextLesson
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'text-gray-400 cursor-not-allowed'
                }`}
              >
                {navigation.nextLesson ? (
                  <>
                    <span className="hidden sm:inline">{navigation.nextLesson.title}</span>
                    <span className="sm:hidden">Next</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                ) : (
                  <span>End of Course</span>
                )}
              </button>
            </div>
          </div>

          {/* Sidebar - Content List */}
          <div className="hidden lg:block lg:w-72">
            <div className="bg-white rounded-lg border sticky top-20">
              <div className="p-4 border-b">
                <h3 className="font-semibold text-gray-900">Lesson Content</h3>
              </div>
              <div className="divide-y max-h-[60vh] overflow-y-auto">
                {lesson.contentBlocks.map((block, index) => {
                  const Icon = contentTypeIcons[block.type]
                  const isActive = index === activeBlockIndex
                  const isComplete = localProgress[block.id]?.status === 'COMPLETED'

                  return (
                    <button
                      key={block.id}
                      onClick={() => setActiveBlockIndex(index)}
                      className={`w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 ${
                        isActive ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className={`flex-shrink-0 ${isComplete ? 'text-green-500' : 'text-gray-400'}`}>
                        {isComplete ? (
                          <CheckCircle className="h-5 w-5" />
                        ) : (
                          <Circle className="h-5 w-5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-gray-400" />
                          <span className={`text-sm truncate ${isActive ? 'font-medium text-blue-600' : 'text-gray-700'}`}>
                            {block.title || block.type}
                          </span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
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
          <TextContent content={block.content} />
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
function TextContent({ content }: { content: ContentBlock['content'] }) {
  if (!content.content) {
    return <p className="text-gray-500">No content provided</p>
  }

  // Simple markdown-like rendering (could be enhanced with a proper markdown library)
  return (
    <div className="prose prose-sm max-w-none">
      {content.content.split('\n').map((paragraph, index) => {
        if (paragraph.startsWith('# ')) {
          return <h1 key={index} className="text-2xl font-bold mt-4 mb-2">{paragraph.slice(2)}</h1>
        }
        if (paragraph.startsWith('## ')) {
          return <h2 key={index} className="text-xl font-bold mt-4 mb-2">{paragraph.slice(3)}</h2>
        }
        if (paragraph.startsWith('### ')) {
          return <h3 key={index} className="text-lg font-bold mt-3 mb-2">{paragraph.slice(4)}</h3>
        }
        if (paragraph.startsWith('- ')) {
          return <li key={index} className="ml-4">{paragraph.slice(2)}</li>
        }
        if (paragraph.trim() === '') {
          return <br key={index} />
        }
        return <p key={index} className="mb-3">{paragraph}</p>
      })}
    </div>
  )
}

// Quiz Content Component
function QuizContent({ content }: { content: ContentBlock['content'] }) {
  if (!content.surveyId) {
    return <p className="text-gray-500">No quiz linked</p>
  }

  return (
    <div className="text-center py-8">
      <FileQuestion className="h-12 w-12 text-blue-500 mx-auto mb-4" />
      <h3 className="font-semibold text-gray-900 mb-2">Quiz</h3>
      <p className="text-gray-600 mb-4">Complete this quiz to continue</p>
      <Link
        href={`/coach/surveys/${content.surveyId}`}
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
