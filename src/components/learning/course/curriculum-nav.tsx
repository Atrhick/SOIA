'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
// @ts-expect-error -- the project has no @types/react-dom (react-dom itself ships with Next); typed below
import { createPortal as untypedCreatePortal } from 'react-dom'
import Link from 'next/link'
import { CheckCircle, Circle, Lock, ListOrdered, X, PlayCircle } from 'lucide-react'

const createPortal = untypedCreatePortal as (children: ReactNode, container: Element) => ReactNode

export interface CurriculumLesson {
  id: string
  title: string
  estimatedDuration: number | null
  completed: boolean
}

export interface CurriculumModule {
  id: string
  title: string
  isOpen: boolean
  opensAt: string | null
  lessons: CurriculumLesson[]
}

export interface Curriculum {
  modules: CurriculumModule[]
  completedLessons: number
  totalLessons: number
  progressPercentage: number
  courseCompleted?: boolean
}

interface Props {
  curriculum: Curriculum
  currentLessonId: string
  lessonHref: (lessonId: string) => string
}

export function CourseProgressBar({ curriculum, compact }: { curriculum: Curriculum; compact?: boolean }) {
  return (
    <div className={compact ? '' : 'space-y-1'}>
      {!compact && (
        <p className="flex justify-between text-sm text-gray-700">
          <span>Course progress</span>
          <span className="font-semibold text-gray-900">
            {curriculum.completedLessons}/{curriculum.totalLessons} lessons
          </span>
        </p>
      )}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-gray-200"
        role="progressbar"
        aria-label="Course progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={curriculum.progressPercentage}
      >
        <div
          className={`h-full rounded-full transition-all ${curriculum.courseCompleted ? 'bg-green-600' : 'bg-blue-600'}`}
          style={{ width: `${curriculum.progressPercentage}%` }}
        />
      </div>
    </div>
  )
}

export function CurriculumList({ curriculum, currentLessonId, lessonHref, onNavigate }: Props & { onNavigate?: () => void }) {
  return (
    <nav aria-label="Course contents">
      <ol className="space-y-4">
        {curriculum.modules.map((m, mi) => (
          <li key={m.id}>
            <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
              {m.title || `Module ${mi + 1}`}
            </p>
            {!m.isOpen && m.opensAt && (
              <p className="mb-1 flex items-center gap-1 px-2 text-xs text-gray-600">
                <Lock className="h-3 w-3" aria-hidden="true" />
                Opens {new Date(m.opensAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </p>
            )}
            <ol>
              {m.lessons.map((l) => {
                const current = l.id === currentLessonId
                const Icon = !m.isOpen ? Lock : l.completed ? CheckCircle : current ? PlayCircle : Circle
                const body = (
                  <>
                    <Icon
                      className={`mt-0.5 h-5 w-5 shrink-0 ${l.completed ? 'text-green-600' : current ? 'text-blue-700' : 'text-gray-400'}`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block">{l.title}</span>
                      {l.estimatedDuration ? <span className="text-xs text-gray-600">{l.estimatedDuration} min</span> : null}
                    </span>
                    <span className="sr-only">{l.completed ? '(completed)' : !m.isOpen ? '(locked)' : ''}</span>
                  </>
                )
                const cls = `flex min-h-[44px] items-start gap-2 rounded-lg px-2 py-2 text-sm ${
                  current ? 'bg-blue-50 font-semibold text-blue-900' : 'text-gray-800'
                }`
                return (
                  <li key={l.id}>
                    {m.isOpen ? (
                      <Link
                        href={lessonHref(l.id)}
                        onClick={onNavigate}
                        aria-current={current ? 'page' : undefined}
                        className={`${cls} hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600`}
                      >
                        {body}
                      </Link>
                    ) : (
                      <span className={`${cls} opacity-70`}>{body}</span>
                    )}
                  </li>
                )
              })}
            </ol>
          </li>
        ))}
      </ol>
    </nav>
  )
}

/** Phone and tablet: a button that opens the course contents as a drawer. */
export function CurriculumDrawer(props: Props) {
  const [open, setOpen] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const openRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  const close = () => {
    setOpen(false)
    openRef.current?.focus()
  }

  return (
    <>
      <button
        ref={openRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-900 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
      >
        <ListOrdered className="h-4 w-4" aria-hidden="true" />
        Contents
        <span className="text-gray-600">
          {props.curriculum.completedLessons}/{props.curriculum.totalLessons}
        </span>
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Course contents">
          <div className="absolute inset-0 bg-black/40" onClick={close} aria-hidden="true" />
          <div className="absolute inset-y-0 left-0 flex w-[88%] max-w-sm flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between gap-2 border-b p-3">
              <p className="font-semibold text-gray-900">Course contents</p>
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                aria-label="Close course contents"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="border-b p-3">
              <CourseProgressBar curriculum={props.curriculum} />
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              <CurriculumList {...props} onNavigate={() => setOpen(false)} />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
