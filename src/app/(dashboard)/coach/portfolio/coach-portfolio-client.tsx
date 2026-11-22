'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { replyToPortfolio } from '@/lib/actions/portfolio'
import { PieceFile, STATUS_LABEL } from '../../ambassador/portfolio/portfolio-client'

export type CoachPiece = {
  id: string
  ambassadorName: string
  groupName: string | null
  weekNo: number
  title: string
  body: string | null
  fileUrl: string | null
  fileType: string | null
  status: string
  submittedAt: string
  feedback: string | null
}

const COACH_LABEL: Record<string, string> = { SUBMITTED: 'New', REVIEWED: 'Looks good', REDO: 'Asked to redo' }

function PieceRow({ p, readOnly }: { p: CoachPiece; readOnly: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const s = STATUS_LABEL[p.status] ?? STATUS_LABEL.SUBMITTED

  const send = async (decision: 'REVIEWED' | 'REDO') => {
    setError(null)
    setBusy(true)
    const res = await replyToPortfolio({ id: p.id, feedback, decision })
    setBusy(false)
    if ('error' in res && res.error) setError(res.error)
    else router.refresh()
  }

  return (
    <div className="rounded-xl border bg-white">
      <button onClick={() => setOpen(!open)} className="flex min-h-[56px] w-full items-center justify-between gap-3 p-4 text-left">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 font-semibold text-primary-700">
            {(p.ambassadorName?.[0] || '?').toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-gray-900">{p.title}</p>
            <p className="truncate text-sm text-gray-600">
              {p.ambassadorName} · Week {p.weekNo}{p.groupName ? ` · ${p.groupName}` : ''} · {new Date(p.submittedAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`hidden rounded-full border px-3 py-1 text-xs font-medium sm:inline ${s.cls}`}>{COACH_LABEL[p.status] ?? p.status}</span>
          {open ? <ChevronUp className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-500" />}
        </div>
      </button>
      {open && (
        <div className="space-y-4 border-t p-4">
          <span className={`inline-block rounded-full border px-3 py-1 text-xs font-medium sm:hidden ${s.cls}`}>{COACH_LABEL[p.status] ?? p.status}</span>
          {p.body ? <p className="whitespace-pre-wrap break-words text-gray-800">{p.body}</p> : <p className="text-sm text-gray-500">No writing, just a file.</p>}
          {p.fileUrl && <PieceFile url={p.fileUrl} type={p.fileType} />}
          {p.status === 'SUBMITTED' ? (
            readOnly ? (
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">You&apos;re viewing as someone else, so replying is turned off.</p>
            ) : (
              <div className="space-y-3">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Your reply to {p.ambassadorName.split(' ')[0] || 'them'}</span>
                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    rows={5}
                    maxLength={5000}
                    placeholder="What did they do well? What could make it stronger?"
                    className="mt-1 block w-full rounded-lg border border-gray-300 p-3"
                  />
                </label>
                {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
                <div className="flex flex-wrap gap-3">
                  <button disabled={busy} onClick={() => send('REVIEWED')}
                    className="min-h-[44px] rounded-lg bg-green-600 px-5 font-medium text-white hover:bg-green-700 disabled:opacity-60">
                    Looks good
                  </button>
                  <button disabled={busy} onClick={() => send('REDO')}
                    className="min-h-[44px] rounded-lg bg-amber-600 px-5 font-medium text-white hover:bg-amber-700 disabled:opacity-60">
                    Please redo
                  </button>
                </div>
              </div>
            )
          ) : (
            p.feedback && (
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-sm font-medium text-gray-900">Your reply:</p>
                <p className="whitespace-pre-wrap break-words text-gray-700">{p.feedback}</p>
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}

export function CoachPortfolioClient({ pieces, readOnly }: { pieces: CoachPiece[]; readOnly: boolean }) {
  if (pieces.length === 0) {
    return <p className="rounded-xl border bg-white p-6 text-gray-600">No pieces handed in here yet.</p>
  }
  return (
    <div className="space-y-3">
      {pieces.map((p) => <PieceRow key={p.id} p={p} readOnly={readOnly} />)}
    </div>
  )
}
