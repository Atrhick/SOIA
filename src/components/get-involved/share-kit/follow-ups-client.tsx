'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { markClosed, markFormFollowUpDone, markNudged, recordShare, setShareOutcome } from '@/lib/actions/outreach-share'
import type { ShareChannel } from '@/lib/get-involved/outreach-templates'

export interface FollowUpRow {
  id: string
  type: 'NUDGE' | 'CLOSE' | 'FORM'
  name: string
  channel: ShareChannel
  day: number
  detail: string
  message: string
  /** The "After a yes" message with their link (nudge/close rows). */
  afterYes: string | null
  programId: string | null
}

const PILL: Record<FollowUpRow['type'], string> = { NUDGE: 'bg-sky-100 text-sky-900', FORM: 'bg-amber-100 text-amber-900', CLOSE: 'bg-gray-200 text-gray-800' }
const btn = 'h-11 px-3.5 rounded-lg border border-gray-300 bg-white text-gray-900 font-semibold text-sm inline-flex items-center gap-2 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2'

export function FollowUpsClient({ rows }: { rows: FollowUpRow[] }) {
  const [gone, setGone] = useState<Set<string>>(new Set())
  const visible = rows.filter((r) => !gone.has(r.id))
  if (visible.length === 0) {
    return <p className="bg-white border border-gray-200 rounded-xl p-5 text-gray-700">Nothing due today. When you log &quot;I sent it&quot; on Today&apos;s invite, the person shows up here on day 3.</p>
  }
  return (
    <ul className="space-y-3">
      {visible.map((r) => <Row key={r.id} row={r} onGone={() => setGone((g) => new Set(g).add(r.id))} />)}
    </ul>
  )
}

function Row({ row, onGone }: { row: FollowUpRow; onGone: () => void }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [yes, setYes] = useState(false)
  const [linkSent, setLinkSent] = useState(false)

  async function copyText(text: string): Promise<boolean> {
    try { await navigator.clipboard.writeText(text); return true } catch {
      setError('Your browser blocked copying. Select the message and copy it by hand.')
      return false
    }
  }
  async function run(label: string, fn: () => Promise<{ ok: true } | { ok: false; error: string }>, after: () => void) {
    setBusy(label); setError(null)
    const r = await fn()
    setBusy(null)
    if (!r.ok) { setError(r.error); return }
    after()
  }
  const done = () => { onGone(); router.refresh() }

  const pill = row.type === 'NUDGE' ? `Nudge · day ${row.day}` : row.type === 'CLOSE' ? `Close · day ${row.day}` : 'Filled the form, no call yet'

  return (
    <li className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 flex flex-wrap gap-3 items-center">
      <div className="flex-1 min-w-[200px]">
        <p className="font-bold text-gray-900 flex flex-wrap items-center gap-2">{row.name} <span className={`text-xs font-bold rounded-full px-2.5 py-0.5 ${PILL[row.type]}`}>{pill}</span></p>
        <p className="text-sm text-gray-600 mt-0.5">{row.detail}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {row.type === 'NUDGE' && !yes && (
          <>
            <button type="button" className={`${btn} border-primary-600 text-primary-800`} disabled={!!busy}
              onClick={async () => { if (await copyText(row.message)) run('copy', () => markNudged({ id: row.id }), () => setNote('Copied. Marked as nudged.')) }}>
              {busy === 'copy' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Copy nudge
            </button>
            <button type="button" className={btn} disabled={!!busy} onClick={() => run('yes', () => setShareOutcome({ id: row.id, outcome: 'YES' }), () => setYes(true))}>
              {busy === 'yes' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Replied yes
            </button>
            <button type="button" className={btn} disabled={!!busy} onClick={() => run('no', () => setShareOutcome({ id: row.id, outcome: 'NO' }), done)}>
              {busy === 'no' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Said no
            </button>
          </>
        )}
        {row.type === 'CLOSE' && !yes && (
          <>
            <button type="button" className={`${btn} border-primary-600 text-primary-800`} disabled={!!busy}
              onClick={async () => { if (await copyText(row.message)) run('copy', () => markClosed({ id: row.id }), () => setNote('Copied. Marked as closed.')) }}>
              {busy === 'copy' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Copy close
            </button>
            <button type="button" className={btn} disabled={!!busy} onClick={() => run('yes', () => setShareOutcome({ id: row.id, outcome: 'YES' }), () => setYes(true))}>Replied yes</button>
            <button type="button" className={btn} disabled={!!busy} onClick={() => run('done', () => setShareOutcome({ id: row.id, outcome: 'DONE' }), done)}>
              {busy === 'done' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Done
            </button>
          </>
        )}
        {row.type === 'FORM' && (
          <>
            <button type="button" className={`${btn} border-primary-600 text-primary-800`} disabled={!!busy}
              onClick={async () => { if (await copyText(row.message)) setNote('Copied.') }}>Copy note</button>
            <button type="button" className={btn} disabled={!!busy} onClick={() => run('done', () => markFormFollowUpDone({ id: row.id }), done)}>
              {busy === 'done' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Done
            </button>
          </>
        )}
      </div>
      {!yes && <p className="basis-full m-0 rounded-lg bg-slate-50 px-3 py-2.5 text-sm leading-relaxed text-gray-700 whitespace-pre-line">{row.message}</p>}
      {yes && row.afterYes && (
        <div className="basis-full rounded-lg border border-green-200 bg-green-50 p-3 space-y-2">
          <p className="text-sm font-semibold text-green-900">{row.name} said yes. Send the link now:</p>
          <p className="text-sm leading-relaxed text-gray-800 whitespace-pre-line">{row.afterYes}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn} onClick={async () => { if (await copyText(row.afterYes!)) setNote('Copied the link message.') }}>Copy message</button>
            <button type="button" className={`${btn} border-green-700 text-green-800`} disabled={!!busy || linkSent}
              onClick={() => run('sent', () => recordShare({ kind: 'AFTER_YES', channel: row.channel, firstName: row.name, programId: row.programId }), () => { setLinkSent(true); setNote('Logged. It counts as a yes in My results.') })}>
              {busy === 'sent' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{linkSent ? 'Logged' : 'I sent the link'}
            </button>
            <button type="button" className={btn} onClick={done}>Close</button>
          </div>
        </div>
      )}
      {note && <p role="status" className="basis-full text-sm text-green-800">{note}</p>}
      {error && <p role="alert" className="basis-full text-sm rounded-lg px-3 py-2 bg-red-50 text-red-700 border border-red-200">{error}</p>}
    </li>
  )
}
