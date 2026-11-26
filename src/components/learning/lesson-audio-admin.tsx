'use client'

import { useCallback, useEffect, useState } from 'react'
import { Headphones, Loader2 } from 'lucide-react'
import { getLessonAudioStatuses, makeLessonAudio, type LessonAudioStatus } from '@/lib/actions/lms/lesson-audio'

/** Admin strip on a lesson: audio status plus Make / Remake audio. */
export function LessonAudioAdmin({ lessonId }: { lessonId: string }) {
  const [audio, setAudio] = useState<LessonAudioStatus | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const r = await getLessonAudioStatuses([lessonId])
    if ('audio' in r && r.audio) setAudio(r.audio[0] ?? null)
    setLoaded(true)
  }, [lessonId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // While audio is being made in the background (after a save), check again every few seconds.
  useEffect(() => {
    if (audio?.status !== 'PENDING' || working) return
    const t = setTimeout(() => void refresh(), 5000)
    return () => clearTimeout(t)
  }, [audio, working, refresh])

  const make = async () => {
    setWorking(true)
    setError(null)
    try {
      const r = await makeLessonAudio(lessonId)
      if ('error' in r && r.error) setError(r.error)
      else if ('audio' in r) setAudio(r.audio ?? null)
    } catch {
      setError("Couldn't reach the server. Try again.")
    } finally {
      setWorking(false)
    }
  }

  const status = working || audio?.status === 'PENDING'
    ? 'Being made...'
    : audio?.status === 'READY'
      ? audio.followAlong
        ? 'Ready'
        : 'Ready (made before follow-along: remake to add sections and highlighting)'
      : audio?.status === 'FAILED'
        ? `Couldn't make it: ${audio.error || 'unknown reason'}`
        : loaded
          ? 'Not made yet'
          : 'Checking...'

  return (
    <div className="flex flex-wrap items-center gap-2 rounded border border-dashed bg-gray-50 p-2 text-sm">
      <Headphones className="h-4 w-4 text-gray-500" aria-hidden="true" />
      <span className="font-medium text-gray-700">Audio:</span>
      <span
        className={`min-w-0 break-words ${audio?.status === 'FAILED' && !working ? 'text-red-700' : audio?.status === 'READY' ? 'text-green-700' : 'text-gray-600'}`}
        role="status"
      >
        {status}
      </span>
      {audio?.status === 'READY' && audio.url && !working && (
        <audio controls preload="none" src={audio.url} className="h-8 max-w-full" aria-label="Preview the lesson audio" />
      )}
      <button
        type="button"
        onClick={make}
        disabled={working}
        className="ml-auto inline-flex items-center gap-1 rounded bg-primary-600 px-2 py-1 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
      >
        {working && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
        {audio?.status === 'READY' || audio?.status === 'FAILED' ? 'Remake audio' : 'Make audio'}
      </button>
      {error && (
        <p className="w-full rounded bg-red-50 px-2 py-1 text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
