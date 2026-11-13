'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { kit } from '@/components/ui/kit/styles'
import { useToast } from '@/components/ui/kit/toast'
import { unpublishProgram } from '@/lib/actions/program-pages'

/** Last thing on the program editor: take the live page offline, with a confirm step. */
export function TakeOfflineCard({ programId, programName }: { programId: string; programName: string }) {
  const router = useRouter()
  const toast = useToast()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  async function goOffline() {
    setBusy(true)
    try {
      const r = await unpublishProgram(programId)
      if ('error' in r) { toast.error(r.error ?? 'Something went wrong. Please try again.'); return }
      toast.success('Your page is offline. Submit it for review to bring it back.')
      setConfirming(false)
      router.refresh()
    } catch {
      toast.error('That didn’t work. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="offline-h" className="rounded-2xl border border-red-200 bg-white p-4 sm:p-5 space-y-3">
      <h2 id="offline-h" className="text-lg font-bold text-gray-900">Take my page offline</h2>
      <p className="text-base text-gray-700">Your page stops showing to visitors, and this program&apos;s invite link sends people to your main invite page instead. Your content stays here, so you can submit it again later.</p>
      {confirming ? (
        <div role="group" aria-label="Confirm taking the page offline" className="rounded-xl bg-red-50 p-3 space-y-3">
          <p className="text-base font-semibold text-red-900">Take {programName} offline now?</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" className={`${kit.danger} w-full sm:w-auto border-red-700 bg-red-700 text-white hover:bg-red-800`} disabled={busy} onClick={goOffline}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Yes, take it offline
            </button>
            <button type="button" className={`${kit.secondary} w-full sm:w-auto`} onClick={() => setConfirming(false)}>Keep it live</button>
          </div>
        </div>
      ) : (
        <button type="button" className={`${kit.danger} w-full sm:w-auto`} onClick={() => setConfirming(true)}>Take my page offline</button>
      )}
    </section>
  )
}
