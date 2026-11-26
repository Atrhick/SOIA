'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  Headphones,
  ListOrdered,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react'
import { saveListenPosition } from '@/lib/actions/lms/lesson-audio'
import {
  nextJump,
  previousJump,
  sectionsOf,
  segmentIndexAt,
  totalDuration,
  type AudioSegment,
} from '@/lib/lessons/audio-segments'

export interface LessonAudioInfo {
  url: string
  durationSec: number | null
  /** Paragraph timings; null/missing for audio made before follow-along existed. */
  segments?: AudioSegment[] | null
  /** Lock-screen title (the lesson) and album (the course). */
  title?: string
  album?: string
  /** Who is listening: the speed choice is remembered per person on this device. */
  listenerId?: string
}

interface Props {
  lessonId: string
  audio: LessonAudioInfo | null
  startAt?: number
  alreadyCompleted?: boolean
  /** Called once when the listener reaches 95% for the first time. */
  onCompleted?: () => void | Promise<void>
}

export const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2]
const BACK = 15
const FORWARD = 30
const ARTWORK = [
  { src: '/brand/app-icon-192.png', sizes: '192x192', type: 'image/png' },
  { src: '/brand/app-icon-512.png', sizes: '512x512', type: 'image/png' },
]

const fmt = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  const mm = h ? m.toString().padStart(2, '0') : String(m)
  return `${h ? `${h}:` : ''}${mm}:${sec.toString().padStart(2, '0')}`
}
const spoken = (s: number) => {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return m ? `${m} minute${m === 1 ? '' : 's'} ${sec} second${sec === 1 ? '' : 's'}` : `${sec} second${sec === 1 ? '' : 's'}`
}

const speedKey = (id?: string) => `soia.lessonAudio.speed${id ? `.${id}` : ''}`
function readSpeed(id?: string): number {
  try {
    const v = Number(window.localStorage.getItem(speedKey(id)))
    return SPEEDS.includes(v) ? v : 1
  } catch {
    return 1
  }
}
function writeSpeed(id: string | undefined, v: number) {
  try {
    window.localStorage.setItem(speedKey(id), String(v))
  } catch {
    // Private mode or storage blocked: the choice just isn't remembered.
  }
}

/** Typing in a field, or a control that uses these keys itself. */
function keyBelongsToTarget(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null
  if (!el) return false
  if (el.isContentEditable) return true
  const tag = el.tagName
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (tag === 'INPUT') {
    const type = (el as HTMLInputElement).type
    // The scrubber handles its own arrow keys.
    return type !== 'checkbox' && type !== 'radio' && type !== 'button'
  }
  if ((e.key === ' ' || e.key === 'Enter') && (tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY')) return true
  return false
}

const reducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/** Room taken by the fixed header (top) and the mini player (bottom). */
const TOP_ROOM = 96
const BOTTOM_ROOM = 112

function isInView(el: Element): boolean {
  const r = el.getBoundingClientRect()
  return r.bottom > TOP_ROOM && r.top < window.innerHeight - BOTTOM_ROOM
}
function isComfortablyInView(el: Element): boolean {
  const r = el.getBoundingClientRect()
  const room = window.innerHeight - TOP_ROOM - BOTTOM_ROOM
  if (r.height > room) return r.top >= TOP_ROOM - 8 && r.top < window.innerHeight - BOTTOM_ROOM
  return r.top >= TOP_ROOM - 8 && r.bottom <= window.innerHeight - BOTTOM_ROOM + 8
}
const findParagraph = (key: string) =>
  typeof document === 'undefined' ? null : document.querySelector(`[data-audio-key="${CSS.escape(key)}"]`)

const btn =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-700 hover:bg-gray-100 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2'

export function LessonAudioPlayer({ lessonId, audio, startAt = 0, alreadyCompleted = false, onCompleted }: Props) {
  const ref = useRef<HTMLAudioElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(startAt)
  const segments = useMemo(() => (audio?.segments?.length ? audio.segments : null), [audio?.segments])
  const [duration, setDuration] = useState(audio?.durationSec ?? (segments ? totalDuration(segments) : 0))
  const [speed, setSpeed] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [started, setStarted] = useState(false)
  const [cardVisible, setCardVisible] = useState(true)
  const [miniClosed, setMiniClosed] = useState(false)
  const [showSections, setShowSections] = useState(false)
  const lastSaved = useRef(startAt)
  const completed = useRef(alreadyCompleted)
  const forceScroll = useRef(false)
  const activeKey = useRef<string | null>(null)
  const listenerId = audio?.listenerId

  const sections = useMemo(() => (segments ? sectionsOf(segments) : []), [segments])
  const segIdx = segments ? segmentIndexAt(segments, time) : -1
  const currentSeg = segIdx >= 0 && segments ? segments[segIdx] : null
  const currentSection = useMemo(() => {
    let s: (typeof sections)[number] | null = null
    for (const x of sections) if (x.start <= time + 0.05) s = x
    return s
  }, [sections, time])

  const save = useCallback(
    async (pos: number, done = false) => {
      lastSaved.current = pos
      try {
        const r = await saveListenPosition(lessonId, pos, done)
        if (r && 'error' in r && r.error) setError(r.error)
      } catch {
        // A dropped connection shouldn't stop the audio; the next save catches up.
      }
    },
    [lessonId]
  )

  // Remembered speed (per person, this device).
  useEffect(() => {
    setSpeed(readSpeed(listenerId))
  }, [listenerId])
  useEffect(() => {
    if (ref.current) ref.current.playbackRate = speed
  }, [speed])

  const changeSpeed = (v: number) => {
    setSpeed(v)
    writeSpeed(listenerId, v)
  }

  const play = useCallback(async () => {
    const el = ref.current
    if (!el) return
    setError(null)
    try {
      await el.play()
    } catch {
      setError("The audio couldn't start. Check your connection and try again.")
    }
  }, [])

  const toggle = useCallback(() => {
    const el = ref.current
    if (!el) return
    if (el.paused) void play()
    else el.pause()
  }, [play])

  const seek = useCallback(
    (v: number) => {
      const el = ref.current
      const max = Number.isFinite(el?.duration) && el!.duration > 0 ? el!.duration : duration
      const t = Math.max(0, Math.min(v, max > 0 ? max - 0.25 : v))
      if (el) el.currentTime = t
      setTime(t)
    },
    [duration]
  )
  const skip = useCallback((d: number) => seek((ref.current?.currentTime ?? 0) + d), [seek])

  const jumpTo = useCallback(
    (t: number, andPlay = true) => {
      forceScroll.current = true
      seek(t)
      if (andPlay && ref.current?.paused) void play()
    },
    [seek, play]
  )
  const prevSection = useCallback(() => {
    if (segments) jumpTo(previousJump(segments, ref.current?.currentTime ?? 0), false)
    else seek(0)
  }, [segments, jumpTo, seek])
  const nextSection = useCallback(() => {
    if (!segments) return
    const t = nextJump(segments, ref.current?.currentTime ?? 0)
    if (t !== null) jumpTo(t, false)
  }, [segments, jumpTo])
  const hasNext = segments ? nextJump(segments, time) !== null : false

  // Highlight the paragraph being spoken and keep it in view, but only if the reader was following along.
  useEffect(() => {
    const key = started && currentSeg && currentSeg.kind !== 'title' ? currentSeg.key : null
    const prevKey = activeKey.current
    if (key === prevKey && !forceScroll.current) return
    const prevEl = prevKey ? findParagraph(prevKey) : null
    // Following = the paragraph read last is still on screen (they haven't scrolled away).
    const wasFollowing = prevEl ? isInView(prevEl) : false
    prevEl?.removeAttribute('data-audio-active')
    activeKey.current = null
    const el = key ? findParagraph(key) : null
    if (!key || !el) {
      if (started) forceScroll.current = false
      return
    }
    el.setAttribute('data-audio-active', 'true')
    activeKey.current = key
    const shouldScroll = forceScroll.current || (playing && wasFollowing)
    forceScroll.current = false
    if (shouldScroll && !isComfortablyInView(el)) {
      el.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' })
    }
  }, [currentSeg, playing, started])

  // Clear the highlight and the "tap to listen" pointer when leaving the page.
  useEffect(() => {
    return () => {
      if (activeKey.current) findParagraph(activeKey.current)?.removeAttribute('data-audio-active')
      document.documentElement.removeAttribute('data-lesson-audio-live')
    }
  }, [])

  // Tap a paragraph to listen from there (once listening has started, so a stray tap while reading doesn't start audio).
  useEffect(() => {
    if (!segments || !started) return
    document.documentElement.setAttribute('data-lesson-audio-live', 'true')
    const byKey = new Map(segments.map((s) => [s.key, s]))
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target || target.closest('a,button,input,select,textarea,label,summary,audio,video')) return
      const p = target.closest('[data-audio-key]')
      if (!p) return
      if (window.getSelection()?.toString()) return // they were selecting text
      const seg = byKey.get(p.getAttribute('data-audio-key') || '')
      if (!seg) return
      jumpTo(seg.start, true)
    }
    document.addEventListener('click', onClick)
    return () => {
      document.removeEventListener('click', onClick)
      document.documentElement.removeAttribute('data-lesson-audio-live')
    }
  }, [segments, started, jumpTo])

  // Keyboard: space/k play-pause, left/j back 15, right/l forward 30.
  useEffect(() => {
    if (!audio) return
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || keyBelongsToTarget(e)) return
      const k = e.key.toLowerCase()
      if (k === ' ' || k === 'k') {
        e.preventDefault()
        toggle()
      } else if (k === 'arrowleft' || k === 'j') {
        e.preventDefault()
        skip(-BACK)
      } else if (k === 'arrowright' || k === 'l') {
        e.preventDefault()
        skip(FORWARD)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [audio, toggle, skip])

  // Lock screen, headphones and car controls.
  useEffect(() => {
    if (!audio || typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
    const ms = navigator.mediaSession
    try {
      ms.metadata = new MediaMetadata({
        title: audio.title || 'Lesson',
        artist: 'NowTRANSFORMED',
        album: audio.album || 'Learning',
        artwork: ARTWORK,
      })
    } catch {
      // MediaMetadata missing on older browsers.
    }
    const set = (action: MediaSessionAction, fn: MediaSessionActionHandler | null) => {
      try {
        ms.setActionHandler(action, fn)
      } catch {
        // Action not supported here.
      }
    }
    set('play', () => void play())
    set('pause', () => ref.current?.pause())
    set('seekbackward', (d) => skip(-(d.seekOffset || BACK)))
    set('seekforward', (d) => skip(d.seekOffset || FORWARD))
    set('seekto', (d) => {
      if (typeof d.seekTime === 'number') seek(d.seekTime)
    })
    set('previoustrack', segments ? () => prevSection() : null)
    set('nexttrack', segments ? () => nextSection() : null)
    return () => {
      for (const a of ['play', 'pause', 'seekbackward', 'seekforward', 'seekto', 'previoustrack', 'nexttrack'] as const) set(a, null)
    }
  }, [audio, segments, play, skip, seek, prevSection, nextSection])

  const updatePositionState = useCallback(() => {
    const el = ref.current
    if (!el || typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
    const d = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : duration
    if (!(d > 0)) return
    try {
      navigator.mediaSession.setPositionState({ duration: d, playbackRate: el.playbackRate || 1, position: Math.min(el.currentTime, d) })
    } catch {
      // Not supported.
    }
  }, [duration])

  // Mini player: shown once listening has started and the main player has scrolled out of view.
  useEffect(() => {
    const el = cardRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => {
      setCardVisible(entry.isIntersecting)
      if (entry.isIntersecting) setMiniClosed(false)
    })
    io.observe(el)
    return () => io.disconnect()
  }, [audio])
  const showMini = Boolean(audio) && started && !cardVisible && !miniClosed

  // Leave room at the bottom of the page so the mini player never covers the last lines.
  useEffect(() => {
    if (!showMini) return
    const prev = document.body.style.paddingBottom
    document.body.style.paddingBottom = 'calc(5.5rem + env(safe-area-inset-bottom))'
    return () => {
      document.body.style.paddingBottom = prev
    }
  }, [showMini])

  if (!audio) {
    return (
      <p className="mb-4 flex items-center gap-2 text-sm text-gray-500">
        <Headphones className="h-4 w-4" aria-hidden="true" /> Audio coming soon
      </p>
    )
  }

  const onLoaded = () => {
    const el = ref.current
    if (!el) return
    if (Number.isFinite(el.duration) && el.duration > 0) setDuration(el.duration)
    if (startAt > 0 && startAt < (el.duration || Infinity) - 2) el.currentTime = startAt
    el.playbackRate = speed
    updatePositionState()
  }

  const onTime = () => {
    const el = ref.current
    if (!el) return
    const t = el.currentTime
    setTime(t)
    const d = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : duration
    if (!completed.current && d > 0 && t / d >= 0.95) {
      completed.current = true
      void save(t, true)
      void onCompleted?.()
      return
    }
    if (Math.abs(t - lastSaved.current) >= 10) void save(t)
  }

  const max = duration > 0 ? duration : 1
  const remaining = Math.max(0, (duration - time) / (speed || 1))
  const nowLabel = currentSection?.label || audio.title || 'Lesson audio'
  const PlayIcon = playing ? Pause : Play

  return (
    <>
      <div
        ref={cardRef}
        className="mb-6 rounded-lg border bg-white p-3 sm:p-4"
        role="region"
        aria-label="Listen to this lesson"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-gray-900">
            <Headphones className="h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
            <span className="truncate">Listen to this lesson</span>
          </div>
          <label className="flex items-center gap-1 text-sm text-gray-600">
            <span>Speed</span>
            <select
              value={speed}
              onChange={(e) => changeSpeed(Number(e.target.value))}
              className="h-11 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              aria-label="Playback speed"
            >
              {SPEEDS.map((s) => (
                <option key={s} value={s}>
                  {s}×
                </option>
              ))}
            </select>
          </label>
        </div>

        {currentSection && started && (
          <p className="mt-2 truncate text-sm text-gray-600" aria-live="polite">
            Now: <span className="font-medium text-gray-900">{currentSection.label}</span>
          </p>
        )}

        <audio
          ref={ref}
          src={audio.url}
          preload="metadata"
          onLoadedMetadata={onLoaded}
          onDurationChange={() => {
            const el = ref.current
            if (el && Number.isFinite(el.duration) && el.duration > 0) setDuration(el.duration)
          }}
          onTimeUpdate={onTime}
          onPlay={() => {
            setPlaying(true)
            setStarted(true)
            updatePositionState()
          }}
          onPause={() => {
            setPlaying(false)
            updatePositionState()
            if (ref.current) void save(ref.current.currentTime)
          }}
          onSeeked={updatePositionState}
          onRateChange={updatePositionState}
          onEnded={() => setPlaying(false)}
          onError={() => setError("The audio couldn't load. Try again in a moment.")}
        />

        {/* Scrubber with a tick at each section */}
        <div className="mt-3">
          <div className="relative">
            <input
              type="range"
              min={0}
              max={max}
              step={1}
              value={Math.min(time, max)}
              onChange={(e) => seek(Number(e.target.value))}
              aria-label="Position in the lesson audio"
              aria-valuetext={`${fmt(time)} of ${fmt(duration)}${currentSection ? `, ${currentSection.label}` : ''}`}
              className="h-6 w-full cursor-pointer accent-primary-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            />
            {duration > 0 && sections.length > 1 && (
              <div className="pointer-events-none absolute inset-x-0 -bottom-1 h-1.5" aria-hidden="true">
                {sections
                  .filter((s) => s.start > 0.5)
                  .map((s) => (
                    <span
                      key={s.key}
                      className="absolute top-0 h-1.5 w-0.5 -translate-x-1/2 rounded bg-gray-400"
                      style={{ left: `${Math.min(100, (s.start / duration) * 100)}%` }}
                    />
                  ))}
              </div>
            )}
          </div>
          <div className="mt-1 flex justify-between text-xs tabular-nums text-gray-500">
            <span>{fmt(time)}</span>
            <span aria-label={`${spoken(remaining)} left`}>-{fmt(remaining)} left</span>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-2 flex items-center justify-center gap-1 sm:gap-3">
          <button type="button" onClick={prevSection} aria-label={segments ? 'Previous section' : 'Back to the start'} className={btn}>
            <SkipBack className="h-5 w-5" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => skip(-BACK)} aria-label={`Go back ${BACK} seconds`} className={`${btn} relative`}>
            <RotateCcw className="h-6 w-6" aria-hidden="true" />
            <span className="absolute text-[9px] font-semibold" aria-hidden="true">
              {BACK}
            </span>
          </button>
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? 'Pause' : time > 1 ? 'Resume' : 'Play'}
            className="mx-1 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white shadow hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
          >
            <PlayIcon className="h-6 w-6" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => skip(FORWARD)} aria-label={`Go forward ${FORWARD} seconds`} className={`${btn} relative`}>
            <RotateCw className="h-6 w-6" aria-hidden="true" />
            <span className="absolute text-[9px] font-semibold" aria-hidden="true">
              {FORWARD}
            </span>
          </button>
          <button type="button" onClick={nextSection} disabled={!hasNext} aria-label="Next section" className={btn}>
            <SkipForward className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {sections.length > 1 && (
          <div className="mt-3 border-t pt-2">
            <button
              type="button"
              onClick={() => setShowSections((v) => !v)}
              aria-expanded={showSections}
              aria-controls={`audio-sections-${lessonId}`}
              className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-1 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <span className="flex items-center gap-2">
                <ListOrdered className="h-4 w-4" aria-hidden="true" /> Sections ({sections.length})
              </span>
              {showSections ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
            </button>
            {showSections && (
              <ol id={`audio-sections-${lessonId}`} className="mt-1 max-h-72 overflow-y-auto">
                {sections.map((s) => {
                  const current = currentSection?.key === s.key
                  return (
                    <li key={s.key}>
                      <button
                        type="button"
                        onClick={() => jumpTo(s.start, true)}
                        aria-current={current ? 'true' : undefined}
                        className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-2 text-left text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                          current ? 'bg-primary-50 font-medium text-primary-800' : 'text-gray-700 hover:bg-gray-50'
                        }`}
                        style={{ paddingLeft: `${0.5 + Math.max(0, s.level - 1) * 0.75}rem` }}
                      >
                        <span className="min-w-0 break-words">{s.label}</span>
                        <span className="shrink-0 text-xs tabular-nums text-gray-500">{fmt(s.start)}</span>
                      </button>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        )}

        {segments && (
          <p className="mt-2 text-xs text-gray-500">
            {started ? 'Tap any paragraph to listen from there.' : 'Once it’s playing, the paragraph being read is highlighted. Tap any paragraph to jump there.'}
          </p>
        )}

        {error && (
          <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
      </div>

      {showMini && (
        <div
          role="region"
          aria-label="Lesson audio controls"
          className="fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 shadow-[0_-2px_8px_rgba(0,0,0,0.08)] backdrop-blur lg:left-64"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="h-1 w-full bg-gray-100" aria-hidden="true">
            <div className="h-1 bg-primary-600" style={{ width: `${Math.min(100, (time / max) * 100)}%` }} />
          </div>
          <div className="mx-auto flex max-w-5xl items-center gap-1 px-2 py-1.5 sm:gap-2 sm:px-4">
            <button
              type="button"
              onClick={toggle}
              aria-label={playing ? 'Pause' : 'Play'}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
            >
              <PlayIcon className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => cardRef.current?.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' })}
              className="min-h-11 min-w-0 flex-1 rounded-md px-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              aria-label={`Now playing: ${nowLabel}. Show the full player`}
            >
              <span className="block truncate text-sm font-medium text-gray-900">{nowLabel}</span>
              <span className="block text-xs tabular-nums text-gray-500">-{fmt(remaining)} left</span>
            </button>
            <button type="button" onClick={() => skip(-BACK)} aria-label={`Go back ${BACK} seconds`} className={`${btn} relative`}>
              <RotateCcw className="h-5 w-5" aria-hidden="true" />
              <span className="absolute text-[8px] font-semibold" aria-hidden="true">
                {BACK}
              </span>
            </button>
            <button type="button" onClick={() => skip(FORWARD)} aria-label={`Go forward ${FORWARD} seconds`} className={`${btn} relative`}>
              <RotateCw className="h-5 w-5" aria-hidden="true" />
              <span className="absolute text-[8px] font-semibold" aria-hidden="true">
                {FORWARD}
              </span>
            </button>
            <button type="button" onClick={() => setMiniClosed(true)} aria-label="Hide the mini player (the audio keeps playing)" className={btn}>
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
