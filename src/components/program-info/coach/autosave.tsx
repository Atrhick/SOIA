'use client'

/**
 * Autosave for one page's answers (A12). Each answer saves on its own, 800 ms after the last keystroke
 * (at once on leaving the field). One status for the screen in an aria-live spot: "Saving…", "Saved",
 * or, when the connection fails, "Not saved yet. Check your connection; we'll keep trying." with retries
 * (2 s, 4 s, 8 s … up to 30 s). A rejected answer (e.g. a bad link) is shown under its field and not
 * retried. Leaving the page with unsaved text asks first (beforeunload); moving inside the app flushes.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { saveAnswer } from '@/lib/actions/program-info'
import type { Answers } from '@/lib/program-info/progress'

type Status = 'idle' | 'saving' | 'saved' | 'retrying' | 'invalid'

interface AutosaveApi {
  answers: Answers
  readOnly: boolean
  status: Status
  errors: Record<string, string>
  setAnswer: (key: string, value: unknown, opts?: { immediate?: boolean }) => void
  flush: (key?: string) => void
}

const Ctx = createContext<AutosaveApi | null>(null)

/** Retried: the save failed on our side or the connection dropped. Anything else is about the answer itself. */
const RETRYABLE = new Set(['Could not save. Please try again.', 'Something went wrong. Please try again.'])

/** A link typed without https:// ("facebook.com/x") is saved with it. */
export function normalizeUrl(v: string): string {
  const s = v.trim()
  if (!s || /^https?:\/\//i.test(s)) return s
  return /^[^\s/]+\.[^\s]+/.test(s) ? `https://${s}` : s
}

export function AutosaveProvider({
  programId,
  initialAnswers,
  readOnly,
  urlKeys,
  children,
}: {
  programId: string
  initialAnswers: Answers
  readOnly: boolean
  /** Keys whose value is a link (normalized before saving). */
  urlKeys: string[]
  children: React.ReactNode
}) {
  const [answers, setAnswers] = useState<Answers>(initialAnswers)
  const [status, setStatus] = useState<Status>('idle')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const pending = useRef(new Map<string, unknown>())
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryDelay = useRef(2000)
  const running = useRef(false)
  const failedKeys = useRef(new Set<string>())
  const urlSet = useMemo(() => new Set(urlKeys), [urlKeys])

  const run = useCallback(async () => {
    if (running.current) return
    running.current = true
    try {
      while (pending.current.size > 0) {
        const [key, value] = pending.current.entries().next().value as [string, unknown]
        pending.current.delete(key)
        setStatus('saving')
        const wire = typeof value === 'string' && urlSet.has(key) ? normalizeUrl(value) : value
        let r: Awaited<ReturnType<typeof saveAnswer>>
        try {
          r = await saveAnswer(programId, key, wire)
        } catch {
          r = { ok: false, error: 'Could not save. Please try again.' }
        }
        if (r.ok) {
          failedKeys.current.delete(key)
          retryDelay.current = 2000
          setErrors((e) => {
            if (!(key in e)) return e
            const next = { ...e }
            delete next[key]
            return next
          })
        } else if (RETRYABLE.has(r.error)) {
          // Keep the newest value if the person typed again meanwhile.
          if (!pending.current.has(key)) pending.current.set(key, value)
          setStatus('retrying')
          if (retryTimer.current) clearTimeout(retryTimer.current)
          const wait = retryDelay.current
          retryDelay.current = Math.min(wait * 2, 30000)
          retryTimer.current = setTimeout(() => { retryTimer.current = null; void run() }, wait)
          return
        } else {
          failedKeys.current.add(key)
          setErrors((e) => ({ ...e, [key]: r.ok ? '' : r.error }))
        }
      }
      setStatus(failedKeys.current.size > 0 ? 'invalid' : 'saved')
    } finally {
      running.current = false
    }
  }, [programId, urlSet])

  const flush = useCallback((key?: string) => {
    const keys = key ? [key] : Array.from(timers.current.keys())
    for (const k of keys) {
      const t = timers.current.get(k)
      if (t) { clearTimeout(t); timers.current.delete(k) }
    }
    if (pending.current.size > 0 && !retryTimer.current) void run()
  }, [run])

  const setAnswer = useCallback((key: string, value: unknown, opts?: { immediate?: boolean }) => {
    if (readOnly) return
    setAnswers((a) => ({ ...a, [key]: value }))
    pending.current.set(key, value)
    const t = timers.current.get(key)
    if (t) clearTimeout(t)
    if (opts?.immediate) {
      timers.current.delete(key)
      if (!retryTimer.current) void run()
      return
    }
    timers.current.set(key, setTimeout(() => {
      timers.current.delete(key)
      if (!retryTimer.current) void run()
    }, 800))
  }, [readOnly, run])

  // Ask before closing the tab or reloading with unsaved text.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pending.current.size === 0 && !running.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  // Moving to another screen in the app: send what is waiting straight away.
  useEffect(() => {
    const timersMap = timers.current
    const pendingMap = pending.current
    return () => {
      Array.from(timersMap.values()).forEach((t) => clearTimeout(t))
      timersMap.clear()
      if (retryTimer.current) clearTimeout(retryTimer.current)
      retryTimer.current = null
      if (pendingMap.size > 0) void run()
    }
  }, [run])

  const api = useMemo(() => ({ answers, readOnly, status, errors, setAnswer, flush }), [answers, readOnly, status, errors, setAnswer, flush])
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function useAutosave(): AutosaveApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAutosave outside AutosaveProvider')
  return v
}

/** The one aria-live spot for the screen. */
export function SaveStatus({ savedText = 'Saved' }: { savedText?: string }) {
  const { status } = useAutosave()
  const text =
    status === 'saving' ? 'Saving…'
      : status === 'saved' ? savedText
        : status === 'retrying' ? "Not saved yet. Check your connection; we'll keep trying."
          : status === 'invalid' ? 'Not saved: check the answer marked in red.'
            : ''
  const color = status === 'retrying' || status === 'invalid' ? 'text-red-700' : status === 'saved' ? 'text-green-700' : 'text-gray-600'
  return (
    <span aria-live="polite" role="status" className={`min-h-[20px] text-right text-[13px] font-semibold lg:text-sm ${color}`}>
      {text}
    </span>
  )
}
