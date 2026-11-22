'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Pencil, Upload } from 'lucide-react'

export type MyPiece = {
  id: string
  weekNo: number
  title: string
  body: string | null
  fileUrl: string | null
  fileType: string | null
  status: string
  submittedAt: string
  feedback: string | null
  feedbackAt: string | null
}

export const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  SUBMITTED: { text: 'Handed in', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  REVIEWED: { text: 'Coach replied', cls: 'bg-green-50 text-green-700 border-green-200' },
  REDO: { text: 'Please redo', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
}

export function PieceFile({ url, type }: { url: string; type: string | null }) {
  if (type?.startsWith('image/')) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="Uploaded work" className="max-h-80 w-auto max-w-full rounded-lg border" />
      </a>
    )
  }
  return (
    <a href={url} target="_blank" rel="noreferrer"
      className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border px-4 py-2 text-primary-700 hover:bg-gray-50">
      <FileText className="h-5 w-5" /> Open the PDF
    </a>
  )
}

type Draft = { id?: string; weekNo: number; title: string; body: string }

export function PortfolioClient({
  pieces, defaultWeek, totalWeeks, groupName, readOnly,
}: {
  pieces: MyPiece[]; defaultWeek: number; totalWeeks: number; groupName: string | null; readOnly: boolean
}) {
  const router = useRouter()
  const formRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const empty: Draft = { weekNo: defaultWeek, title: '', body: '' }
  const [draft, setDraft] = useState<Draft>(empty)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const weeks = Array.from(new Set(pieces.map((p) => p.weekNo))).sort((a, b) => a - b)

  const startEdit = (p: MyPiece, redo: boolean) => {
    setDraft({ id: p.id, weekNo: p.weekNo, title: p.title, body: p.body ?? '' })
    setError(null)
    setDone(redo ? 'Make your changes and hand it in again. Your coach will see the new version.' : null)
    formRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setDone(null)
    const file = fileRef.current?.files?.[0]
    if (file && file.size > 10 * 1024 * 1024) {
      setError('That file is bigger than 10 MB. Please pick a smaller one.')
      return
    }
    const fd = new FormData()
    if (draft.id) fd.set('id', draft.id)
    fd.set('weekNo', String(draft.weekNo))
    fd.set('title', draft.title)
    fd.set('body', draft.body)
    if (file) fd.set('file', file)
    setBusy(true)
    try {
      const res = await fetch('/api/portfolio', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({ error: 'Something went wrong. Please try again.' }))
      if (!res.ok || data.error) {
        setError(data.error || 'Something went wrong. Please try again.')
      } else {
        setDone('Handed in. Nice work! Your coach will reply here.')
        setDraft(empty)
        if (fileRef.current) fileRef.current.value = ''
        router.refresh()
      }
    } catch {
      setError("We couldn't reach the server. Please check your connection and try again.")
    }
    setBusy(false)
  }

  return (
    <div className="space-y-6">
      <div ref={formRef} className="rounded-xl border bg-white p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900">{draft.id ? 'Change your piece' : 'Hand in your work'}</h2>
        {groupName && <p className="text-sm text-gray-600">Your group: {groupName}</p>}
        {readOnly ? (
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            You&apos;re viewing as this ambassador, so handing in is turned off.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Week</span>
                <select
                  value={draft.weekNo}
                  onChange={(e) => setDraft({ ...draft, weekNo: Number(e.target.value) })}
                  className="mt-1 block min-h-[44px] w-full rounded-lg border border-gray-300 px-3"
                >
                  {Array.from({ length: totalWeeks }, (_, i) => i + 1).map((w) => (
                    <option key={w} value={w}>Week {w}</option>
                  ))}
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm font-medium text-gray-700">Title</span>
                <input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  maxLength={200}
                  placeholder="For example: My leadership profile"
                  className="mt-1 block min-h-[44px] w-full rounded-lg border border-gray-300 px-3"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Your writing</span>
              <textarea
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                rows={8}
                maxLength={20000}
                placeholder="Write your piece here. Take your time and say it in your own words."
                className="mt-1 block w-full rounded-lg border border-gray-300 p-3"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Add a photo or PDF (optional, up to 10 MB)</span>
              <input
                ref={fileRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                className="mt-1 block w-full min-w-0 text-sm"
              />
              {draft.id && <span className="text-xs text-gray-500">Leave this empty to keep the file you already added.</span>}
            </label>
            {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            {done && <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{done}</div>}
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={busy}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-primary-600 px-5 font-medium text-white hover:bg-primary-700 disabled:opacity-60"
              >
                <Upload className="h-4 w-4" /> {busy ? 'Saving...' : draft.id ? 'Save changes' : 'Hand it in'}
              </button>
              {draft.id && (
                <button type="button" onClick={() => { setDraft(empty); setDone(null); setError(null) }}
                  className="min-h-[44px] rounded-lg border px-5 text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}
      </div>

      {weeks.length === 0 ? (
        <p className="rounded-xl border bg-white p-6 text-gray-600">
          Nothing handed in yet. When you finish this week&apos;s piece, add it above.
        </p>
      ) : (
        weeks.map((w) => {
          const inWeek = pieces.filter((p) => p.weekNo === w)
          const latest = inWeek[0]
          return (
            <section key={w} className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-900">Week {w}</h2>
              {inWeek.map((p) => {
                const s = STATUS_LABEL[p.status] ?? STATUS_LABEL.SUBMITTED
                return (
                  <div key={p.id} className="space-y-3 rounded-xl border bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="break-words font-medium text-gray-900">{p.title}</h3>
                        <p className="text-xs text-gray-500">Handed in {new Date(p.submittedAt).toLocaleDateString()}</p>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-medium ${s.cls}`}>{s.text}</span>
                    </div>
                    {p.body && <p className="whitespace-pre-wrap break-words text-gray-700">{p.body}</p>}
                    {p.fileUrl && <PieceFile url={p.fileUrl} type={p.fileType} />}
                    {p.feedback && (
                      <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-sm font-medium text-gray-900">Your coach said:</p>
                        <p className="whitespace-pre-wrap break-words text-gray-700">{p.feedback}</p>
                      </div>
                    )}
                    {!readOnly && p.status === 'SUBMITTED' && (
                      <button onClick={() => startEdit(p, false)}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border px-4 text-gray-700 hover:bg-gray-50">
                        <Pencil className="h-4 w-4" /> Change it
                      </button>
                    )}
                    {!readOnly && p.status === 'REDO' && p.id === latest.id && (
                      <button onClick={() => startEdit(p, true)}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-amber-600 px-4 font-medium text-white hover:bg-amber-700">
                        <Pencil className="h-4 w-4" /> Hand it in again
                      </button>
                    )}
                  </div>
                )
              })}
            </section>
          )
        })
      )}
    </div>
  )
}
