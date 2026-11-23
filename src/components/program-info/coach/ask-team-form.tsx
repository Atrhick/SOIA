'use client'

/** A15 "Need another program? Ask the team": one box, sent to the team (with a receipt to the sender). */
import { useEffect, useRef, useState } from 'react'
import { ChevronRight, Loader2 } from 'lucide-react'
import { requestAnotherProgram } from '@/lib/actions/program-info'
import { ui } from './ui'

export function AskTeamForm({ prefill }: { readOnly?: boolean; prefill?: string | null }) {
  const [open, setOpen] = useState(Boolean(prefill))
  const [text, setText] = useState(prefill ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const boxRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (prefill) {
      document.getElementById('ask-team')?.scrollIntoView({ block: 'center' })
      boxRef.current?.focus({ preventScroll: true })
    }
  }, [prefill])

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const r = await requestAnotherProgram(text)
      if (!r.ok) { setError(r.error); return }
      setSent(true)
      setText('')
    } catch {
      setError("That didn't send. Check your connection and try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div id="ask-team" className="scroll-mt-24">
      {!open ? (
        <button type="button" className={`${ui.link} px-0`} aria-expanded={false} onClick={() => setOpen(true)}>
          Not sure what to add? Ask the team <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      ) : (
        <form onSubmit={send} className={`${ui.card} flex max-w-[640px] flex-col gap-2.5 p-4`}>
          <h2 className="m-0 text-[17px] font-bold">Ask the team</h2>
          <label htmlFor="ask-text" className="text-[15px] leading-relaxed text-gray-700">What would it be, and who is it for? A sentence or two is enough. The team will get back to you.</label>
          <p id="ask-ex" className={ui.hint}>Example: &quot;A Medicare help program for people turning 65, in English and Vietnamese.&quot;</p>
          <textarea id="ask-text" ref={boxRef} rows={3} className={ui.box} value={text} maxLength={2000} aria-describedby="ask-ex" disabled={busy} onChange={(e) => { setText(e.target.value); setSent(false) }} />
          {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-900">{error}</div>}
          <p aria-live="polite" className="m-0 min-h-[1px] text-sm font-semibold text-green-700">{sent ? 'Sent. The team will get back to you.' : ''}</p>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={ui.primarySm} disabled={busy || !text.trim()}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Send to the team
            </button>
            <button type="button" className={ui.secondary} onClick={() => { setOpen(false); setError(null) }}>Close</button>
          </div>
        </form>
      )}
    </div>
  )
}
