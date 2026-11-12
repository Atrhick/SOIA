'use client'

import { useEffect, useState } from 'react'
import { BellRing, X } from 'lucide-react'
import { pushState, turnOnPush } from './push-client'
import { isInstalled } from './install-prompt'

const DISMISS_KEY = 'nt-push-dismissed-at'
const DISMISS_DAYS = 30

/**
 * In the home-screen app, offer to turn on notifications once (hidden for 30 days if dismissed).
 * In a normal browser tab people use "Notifications on this device" in the user menu instead.
 */
export function NotificationsCard() {
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!isInstalled() || !('Notification' in window) || Notification.permission !== 'default') return
    try {
      const at = Number(localStorage.getItem(DISMISS_KEY) || 0)
      if (at && Date.now() - at < DISMISS_DAYS * 86400_000) return
    } catch { /* private mode */ }
    pushState().then((s) => { if (s === 'off') setShow(true) }).catch(() => {})
  }, [])

  if (!show) return null
  const close = () => { try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* ignore */ } setShow(false) }
  const turnOn = async () => {
    setBusy(true); setMsg(null)
    try {
      const s = await turnOnPush()
      if (s === 'on') { setMsg('Notifications are on.'); setTimeout(() => setShow(false), 2500) }
      else if (s === 'blocked') setMsg('Notifications are blocked. Turn them on for this app in your phone settings.')
      else close()
    } catch { setMsg("Couldn't turn them on. Try again from the menu.") }
    setBusy(false)
  }

  return (
    <div role="dialog" aria-labelledby="nt-push-title"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-2xl border border-gray-200 bg-white p-4 shadow-xl sm:inset-x-auto sm:right-4">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-primary-50 text-primary-700"><BellRing className="h-6 w-6" /></span>
        <div className="min-w-0 flex-1">
          <p id="nt-push-title" className="font-semibold text-gray-900">Turn on notifications?</p>
          <p className="mt-0.5 text-sm text-gray-600">Get a heads-up on this phone when someone fills out your form or a call changes.</p>
        </div>
        <button type="button" onClick={close} aria-label="Not now" className="-m-1 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X className="h-5 w-5" /></button>
      </div>
      {msg && <p className="mt-3 text-sm text-gray-700" role="status">{msg}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={close} className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Not now</button>
        <button type="button" onClick={turnOn} disabled={busy} className="rounded-lg bg-primary-700 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-800 disabled:opacity-60">{busy ? 'Turning on…' : 'Turn on'}</button>
      </div>
    </div>
  )
}
