'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Share, SquarePlus, X } from 'lucide-react'

// Chrome/Edge/Samsung fire this before showing their own install UI.
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

const DISMISS_KEY = 'nt-install-dismissed-at'
const DISMISS_DAYS = 30
export const OPEN_INSTALL_EVENT = 'nt-open-install'

let deferred: InstallEvent | null = null
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as InstallEvent })
}

export function isInstalled(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function isIos(): boolean {
  const ua = navigator.userAgent
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
}

function dismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0)
    return at > 0 && Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000
  } catch { return false }
}

/** Registers the service worker once (production only). */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])
  return null
}

/**
 * "Add to home screen" card for the dashboard. Shows on phones and tablets until
 * installed or dismissed (hidden for 30 days); the user menu can reopen it.
 */
export function InstallPrompt() {
  const [mode, setMode] = useState<'native' | 'ios' | 'manual' | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (isInstalled()) return
    const pick = () => (deferred ? 'native' : isIos() ? 'ios' : 'manual')
    const small = window.matchMedia('(max-width: 1023px)').matches
    if (small && !dismissedRecently() && (deferred || isIos())) { setMode(pick()); setOpen(true) }

    const onReady = (e: Event) => {
      e.preventDefault(); deferred = e as InstallEvent
      if (small && !dismissedRecently()) { setMode('native'); setOpen(true) }
    }
    const onAsk = () => { setMode(pick()); setOpen(true) }
    const onInstalled = () => { deferred = null; setOpen(false) }
    window.addEventListener('beforeinstallprompt', onReady)
    window.addEventListener(OPEN_INSTALL_EVENT, onAsk)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onReady)
      window.removeEventListener(OPEN_INSTALL_EVENT, onAsk)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (!open || !mode) return null

  const close = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* private mode */ }
    setOpen(false)
  }
  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    deferred = null
    if (outcome === 'accepted') setOpen(false)
    else close()
  }

  return (
    <div role="dialog" aria-labelledby="nt-install-title"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-2xl border border-gray-200 bg-white p-4 shadow-xl sm:inset-x-auto sm:right-4">
      <div className="flex items-start gap-3">
        <Image src="/brand/app-icon-192.png" alt="" width={48} height={48} className="h-12 w-12 rounded-xl border border-gray-100" />
        <div className="min-w-0 flex-1">
          <p id="nt-install-title" className="font-semibold text-gray-900">Add NowTransformed to your home screen</p>
          <p className="mt-0.5 text-sm text-gray-600">Open the back office in one tap, like an app, and get notifications on your phone.</p>
        </div>
        <button type="button" onClick={close} aria-label="Not now" className="-m-1 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
          <X className="h-5 w-5" />
        </button>
      </div>

      {mode === 'native' && (
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={close} className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Not now</button>
          <button type="button" onClick={install} className="rounded-lg bg-primary-700 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-800">Add to home screen</button>
        </div>
      )}
      {mode === 'ios' && (
        <ol className="mt-3 space-y-2 rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
          <li><span className="font-semibold">1.</span> Tap <Share className="mx-0.5 inline h-4 w-4 align-[-3px] text-primary-700" aria-hidden="true" /> <span className="font-medium">Share</span> in the browser bar.</li>
          <li><span className="font-semibold">2.</span> Choose <SquarePlus className="mx-0.5 inline h-4 w-4 align-[-3px] text-gray-700" aria-hidden="true" /> <span className="font-medium">Add to Home Screen</span>.</li>
          <li><span className="font-semibold">3.</span> Tap <span className="font-medium">Add</span>.</li>
        </ol>
      )}
      {mode === 'manual' && (
        <p className="mt-3 rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
          Open your browser menu (<span className="font-medium">⋮</span> or <span className="font-medium">⋯</span>) and choose <span className="font-medium">Install app</span> or <span className="font-medium">Add to Home screen</span>.
        </p>
      )}
    </div>
  )
}
