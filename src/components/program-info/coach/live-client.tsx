'use client'

/** Live screen pieces: the share link with Copy ("Copied" read out), take offline (confirm dialog), back online. */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, Loader2 } from 'lucide-react'
import { putBackOnline, takeOffline } from '@/lib/actions/program-info'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/kit/toast'
import { CheckIcon, ui } from './ui'

export function ShareLink({ path }: { path: string }) {
  const [origin, setOrigin] = useState('')
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => setOrigin(window.location.origin), [])
  const full = `${origin}${path}`
  const shown = full.replace(/^https?:\/\//, '')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(full)
      setCopied(true)
      setFailed(false)
      setTimeout(() => setCopied(false), 4000)
    } catch {
      setFailed(true)
    }
  }
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-stretch">
        <div className="min-w-0 break-all rounded-xl border border-gray-300 bg-gray-50 px-3.5 py-3 text-[15px] lg:flex-1 lg:truncate lg:break-normal" title={shown}>{shown || path}</div>
        <div className="grid grid-cols-2 gap-2.5 lg:flex">
          <button type="button" onClick={copy} className={`${copied ? 'bg-green-700 hover:bg-green-800' : 'bg-violet-700 hover:bg-violet-800'} inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-5 text-base font-bold text-white ${ui.ring}`}>
            {copied && <CheckIcon />}{copied ? 'Copied' : 'Copy link'}
          </button>
          <a href={path} target="_blank" rel="noreferrer" className={`${ui.secondary} min-h-[48px] text-base`}>View page</a>
        </div>
      </div>
      <p aria-live="polite" className="m-0 min-h-[18px] text-[13px] font-semibold text-green-700">
        {copied ? 'Copied. Paste it in a message, an email or a post.' : ''}
        {failed && <span className="text-red-700">Couldn&apos;t copy. Press and hold the link above to copy it.</span>}
      </p>
    </div>
  )
}

export function TakeOfflineRow({ programId, pageName, readOnly }: { programId: string; pageName: string; readOnly: boolean }) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const go = async () => {
    setError(null)
    setBusy(true)
    try {
      const r = await takeOffline(programId, true, reason || undefined)
      if (!r.ok) { setError(r.error); return }
      setOpen(false)
      toast.success('Your page is offline. You can put it back online any time.')
      router.refresh()
    } catch {
      setError("That didn't work. Check your connection and try again.")
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <button type="button" disabled={readOnly} onClick={() => setOpen(true)} className={`flex min-h-[52px] w-full items-center justify-between gap-3 border-t border-gray-100 bg-transparent px-0 text-left text-[15px] text-red-700 disabled:opacity-60 lg:min-h-[50px] lg:text-sm ${ui.ring}`}>
        Take this page offline <ChevronRight className="h-4 w-4 text-gray-500" aria-hidden />
      </button>
      <Dialog open={open} onOpenChange={(o) => { if (!busy) setOpen(o) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-lg">Take your {pageName} offline?</DialogTitle>
            <DialogDescription className="text-[15px] leading-relaxed text-gray-700">
              Visitors are then sent to your main link. Nothing is deleted, and you can put it back online any time.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="off-why" className="text-[15px] font-semibold">Why? <span className={ui.optional}>Optional</span></label>
            <textarea id="off-why" rows={2} className={ui.box} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-900">{error}</div>}
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <button type="button" className={ui.danger} onClick={go} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Yes, take it offline
            </button>
            <button type="button" className={`${ui.secondary} min-h-[48px]`} onClick={() => setOpen(false)} disabled={busy}>Keep it live</button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function BackOnlineButton({ programId, readOnly }: { programId: string; readOnly: boolean }) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const go = async () => {
    setError(null)
    setBusy(true)
    try {
      const r = await putBackOnline(programId)
      if (!r.ok) { setError(r.error); return }
      toast.success('Your page is back online.')
      router.refresh()
    } catch {
      setError("That didn't work. Check your connection and try again.")
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <button type="button" className={`${ui.primary} w-full lg:w-auto lg:self-start`} onClick={go} disabled={busy || readOnly}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Put it back online
      </button>
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-900">{error}</div>}
    </div>
  )
}
