'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Play, Pause, RotateCcw, Headphones } from 'lucide-react'
import { saveListenPosition } from '@/lib/actions/lms/lesson-audio'

export interface LessonAudioInfo {
  url: string
  durationSec: number | null
}

interface Props {
  lessonId: string
  audio: LessonAudioInfo | null
  startAt?: number
  alreadyCompleted?: boolean
  /** Called once when the listener reaches 95% for the first time. */
  onCompleted?: () => void | Promise<void>
}

const SPEEDS = [0.75, 1, 1.25, 1.5]
const fmt = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export function LessonAudioPlayer({ lessonId, audio, startAt = 0, alreadyCompleted = false, onCompleted }: Props) {
  const ref = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(startAt)
  const [duration, setDuration] = useState(audio?.durationSec ?? 0)
  const [speed, setSpeed] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const lastSaved = useRef(startAt)
  const completed = useRef(alreadyCompleted)

  const save = useCallback(
    async (pos: number, done = false) => {
      lastSaved.current = pos
      const r = await saveListenPosition(lessonId, pos, done)
      if (r && 'error' in r && r.error) setError(r.error)
    },
    [lessonId]
  )

  useEffect(() => {
    if (ref.current) ref.current.playbackRate = speed
  }, [speed])

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
    if (Number.isFinite(el.duration)) setDuration(el.duration)
    if (startAt > 0 && startAt < (el.duration || Infinity) - 2) el.currentTime = startAt
    el.playbackRate = speed
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

  const toggle = async () => {
    const el = ref.current
    if (!el) return
    setError(null)
    if (el.paused) {
      try {
        await el.play()
      } catch {
        setError("The audio couldn't start. Check your connection and try again.")
      }
    } else {
      el.pause()
    }
  }

  const back15 = () => {
    const el = ref.current
    if (el) el.currentTime = Math.max(0, el.currentTime - 15)
  }

  const seek = (v: number) => {
    const el = ref.current
    if (el) el.currentTime = v
    setTime(v)
  }

  return (
    <div className="mb-6 rounded-lg border bg-white p-4" role="region" aria-label="Listen to this lesson">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-900">
        <Headphones className="h-4 w-4 text-primary-600" aria-hidden="true" /> Listen to this lesson
      </div>
      <audio
        ref={ref}
        src={audio.url}
        preload="metadata"
        onLoadedMetadata={onLoaded}
        onTimeUpdate={onTime}
        onPlay={() => setPlaying(true)}
        onPause={() => {
          setPlaying(false)
          if (ref.current) void save(ref.current.currentTime)
        }}
        onEnded={() => setPlaying(false)}
        onError={() => setError("The audio couldn't load. Try again in a moment.")}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? 'Pause' : 'Play'}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-600 text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        >
          {playing ? <Pause className="h-5 w-5" aria-hidden="true" /> : <Play className="h-5 w-5" aria-hidden="true" />}
        </button>
        <button
          type="button"
          onClick={back15}
          aria-label="Go back 15 seconds"
          className="flex items-center gap-1 rounded-md border px-2 py-2 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" /> 15s
        </button>
        <div className="flex gap-1" role="group" aria-label="Playback speed">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              aria-pressed={speed === s}
              aria-label={`Speed ${s} times`}
              className={`rounded-md px-2 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                speed === s ? 'bg-primary-600 text-white' : 'border text-gray-700 hover:bg-gray-50'
              }`}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="w-10 shrink-0 text-xs tabular-nums text-gray-500">{fmt(time)}</span>
        <input
          type="range"
          min={0}
          max={duration > 0 ? duration : 1}
          step={1}
          value={Math.min(time, duration > 0 ? duration : 1)}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="Position in the lesson audio"
          aria-valuetext={`${fmt(time)} of ${fmt(duration)}`}
          className="min-w-0 flex-1 accent-primary-600"
        />
        <span className="w-10 shrink-0 text-right text-xs tabular-nums text-gray-500">{fmt(duration)}</span>
      </div>
      {error && (
        <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
