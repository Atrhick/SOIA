'use client'

/**
 * Review actions: "Looks good, put it live" (A9: only the latest SENT version) and "Something to change?"
 * (A8: the version being checked, or the live APPROVED one). Errors show inline (e.g. "This version is out
 * of date. Reload the page.").
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { approveVersion, requestChanges } from '@/lib/actions/program-info'
import { coachPagePath, programsHome, type OwnerRole } from '@/lib/program-info/paths'
import { useToast } from '@/components/ui/kit/toast'
import { ui } from './ui'

export function ApproveBox({ role, programId, versionId, readOnly }: { role: OwnerRole; programId: string; versionId: string; readOnly: boolean }) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const approve = async () => {
    setError(null)
    setBusy(true)
    try {
      const r = await approveVersion(versionId)
      if (!r.ok) { setError(r.error); return }
      toast.success('Your page is live.')
      router.push(coachPagePath(role, programId, '/live'))
      router.refresh()
    } catch {
      setError("That didn't go through. Check your connection and try again.")
    } finally {
      setBusy(false)
    }
  }
  return (
    <section aria-labelledby="ok-h" className="flex flex-col gap-2.5 rounded-2xl border-2 border-violet-700 bg-white p-[18px]">
      <h2 id="ok-h" className="m-0 text-lg font-extrabold">All 3 parts look right?</h2>
      <button type="button" className={`${ui.primary} w-full`} onClick={approve} disabled={busy || readOnly}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Looks good, put it live
      </button>
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-900">{error}</div>}
      {readOnly && <p className="m-0 text-center text-[13px] leading-snug text-amber-900">Only the owner can press this. To put it live for them, use the team page.</p>}
      <p className="m-0 text-center text-[13px] leading-snug text-gray-600">We keep a record of exactly what you approved, and when.</p>
    </section>
  )
}

export function ChangeBox({ role, versionId, onLive, changeRound }: { role: OwnerRole; versionId: string; readOnly?: boolean; onLive: boolean; changeRound: number }) {
  const router = useRouter()
  const toast = useToast()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const r = await requestChanges(versionId, text)
      if (!r.ok) { setError(r.error); return }
      toast.success("Thanks. We'll fix it and send it back to you to check.")
      router.push(programsHome(role))
      router.refresh()
    } catch {
      setError("That didn't send. Check your connection and try again.")
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={send} aria-labelledby="chg-h" className={`${ui.card} flex flex-col gap-2.5 p-[18px]`}>
      <h2 id="chg-h" className="m-0 text-lg font-extrabold">Something to change?</h2>
      <label htmlFor="chg" className="text-[15px] leading-relaxed text-gray-700">
        {onLive
          ? "Tell us what's wrong or missing, and in which part. We'll fix it and send it back to you to check. Your live page stays as it is until then."
          : "Tell us what's wrong or missing, and in which part. We'll fix it and send it back to you."}
      </label>
      <p id="chg-ex" className={ui.hint}>Example: &quot;Page: the Wednesday session is at 7 p.m. now. Welcome email: please mention Medicare plans.&quot;</p>
      <textarea id="chg" rows={4} className={ui.box} value={text} maxLength={4000} aria-describedby="chg-ex" disabled={busy} onChange={(e) => setText(e.target.value)} />
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-900">{error}</div>}
      <button type="submit" className={`${ui.outline} w-full`} disabled={busy || !text.trim()}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Ask for these changes
      </button>
      {!onLive && (
        <p className="m-0 text-[13px] leading-snug text-gray-600">
          Your page row then says &quot;Changes asked for, being fixed&quot;.
          {changeRound >= 2 ? ' If it still isn’t right after this, the team will offer a quick call instead.' : ''}
        </p>
      )}
    </form>
  )
}
