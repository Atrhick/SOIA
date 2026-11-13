'use client'

import { useEffect, useRef, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'

const LOADED_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? ''
const CHECK_EVERY_MS = 10 * 60 * 1000
const MIN_GAP_MS = 30 * 1000

async function liveVersion(): Promise<string | null> {
  try {
    const res = await fetch('/api/version', { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as { version?: unknown }
    return typeof data.version === 'string' && data.version ? data.version : null
  } catch {
    return null
  }
}

/**
 * Home-screen apps are paused, not reloaded, when someone switches back to them, so they keep
 * showing the old version until fully closed. This checks the live version when the app comes
 * back and every 10 minutes. On coming back it reloads by itself, unless the person had typed
 * something on this page (a half-written invite); then, and during use, it offers a Refresh bar.
 */
export function AppUpdateWatcher() {
  const [ready, setReady] = useState(false)
  const [hidden, setHidden] = useState(false)
  const typed = useRef(false)
  const lastCheck = useRef(0)

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !LOADED_VERSION) return

    const check = async (comingBack: boolean) => {
      const now = Date.now()
      if (now - lastCheck.current < MIN_GAP_MS) return
      lastCheck.current = now
      const live = await liveVersion()
      if (!live || live === LOADED_VERSION) return
      if (comingBack && !typed.current) window.location.reload()
      else setReady(true)
    }

    const onInput = () => { typed.current = true }
    const onVisible = () => { if (document.visibilityState === 'visible') void check(true) }
    const onPageShow = (e: PageTransitionEvent) => { if (e.persisted) void check(true) }
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void check(false) }, CHECK_EVERY_MS)

    document.addEventListener('input', onInput, true)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      document.removeEventListener('input', onInput, true)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pageshow', onPageShow)
      window.clearInterval(timer)
    }
  }, [])

  if (!ready || hidden) return null
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <div className="flex w-full max-w-md items-center gap-3 rounded-xl bg-gray-900 px-4 py-3 text-white shadow-lg">
        <p className="flex-1 text-base">A new version of the app is ready.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex min-h-[48px] items-center gap-2 rounded-lg bg-white px-4 font-semibold text-gray-900 hover:bg-gray-100"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          Refresh
        </button>
        <button
          type="button"
          onClick={() => setHidden(true)}
          aria-label="Not now"
          className="inline-flex h-12 w-12 items-center justify-center rounded-lg text-gray-300 hover:bg-white/10"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
