'use client'

/**
 * "Change your answers" on a live page (Update mockup; A6, A7). Each section shows "Changed" when an answer
 * differs from what the live page was written from (prices excluded: they save straight away). Optional note,
 * "Send N changes", "Undo my changes".
 */
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, Loader2 } from 'lucide-react'
import { sendAnswers, undoAnswerChanges } from '@/lib/actions/program-info'
import { INFO_SECTIONS } from '@/lib/program-info/questions'
import { coachPagePath, coachSectionPath, type OwnerRole } from '@/lib/program-info/paths'
import type { AnswerChange } from '@/lib/program-info/progress'
import { useToast } from '@/components/ui/kit/toast'
import { ui } from './ui'

const short = (v: unknown) => {
  const s = typeof v === 'string' ? v : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : ''
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > 40 ? `${t.slice(0, 40)}…` : t
}

function changeLine(c: AnswerChange): string {
  const before = short(c.before)
  const after = short(c.after)
  const what = c.label.replace(/\?$/, '')
  if (!before) return `${what}: added`
  if (!after) return `${what}: cleared`
  return `${what}: "${before}" changed to "${after}"`
}

export function UpdateScreenClient({
  role, programId, changes, sharedWith,
}: {
  role: OwnerRole
  programId: string
  changes: AnswerChange[]
  /** Other pages About you is shared with (A7: they are checked again too). */
  sharedWith: string[]
  readOnly: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<'send' | 'undo' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const n = changes.length

  const send = async () => {
    setError(null)
    setBusy('send')
    try {
      const r = await sendAnswers(programId, note.trim() || undefined)
      if (!r.ok) { setError(r.error); return }
      router.push(coachPagePath(role, programId, '/sent'))
      router.refresh()
    } catch {
      setError("That didn't send. Check your connection and try again.")
    } finally {
      setBusy(null)
    }
  }
  const undo = async () => {
    setError(null)
    setBusy('undo')
    try {
      const r = await undoAnswerChanges(programId)
      if (!r.ok) { setError(r.error); return }
      toast.success('Your answers are back to what your live page was written from.')
      router.refresh()
    } catch {
      setError("That didn't work. Check your connection and try again.")
    } finally {
      setBusy(null)
    }
  }

  const sendLabel = n === 0 ? 'Send my note' : n === 1 ? 'Send 1 change' : `Send ${n} changes`
  return (
    <>
      <div className={`${ui.card} px-4 py-2`}>
        <nav aria-label="Sections">
          <ul className="m-0 list-none p-0">
            {INFO_SECTIONS.map((s, i) => {
              const mine = changes.filter((c) => c.sectionId === s.id)
              const sub = mine.length === 1 ? changeLine(mine[0]) : mine.length > 1 ? `${mine.length} answers changed` : s.shared && sharedWith.length ? `Shared: a change here updates ${sharedWith.length === 1 ? 'both pages' : 'all your pages'}, and you check ${sharedWith.length === 1 ? 'both' : 'each one'}` : ''
              return (
                <li key={s.id} className={i > 0 ? 'border-t border-gray-100' : ''}>
                  <Link href={coachSectionPath(role, programId, s.id)} className={`flex min-h-[60px] items-center gap-3 px-1 py-2.5 text-gray-900 no-underline ${ui.ring}`}>
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-bold">{s.number}. {s.title}</span>
                      {sub && <span className="mt-0.5 block break-words text-sm text-gray-600">{sub}</span>}
                    </span>
                    {mine.length > 0 && <span className="whitespace-nowrap rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">Changed</span>}
                    <ChevronRight className="h-4 w-4 flex-none text-gray-500" aria-hidden />
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>

      <div className="flex flex-col gap-2.5">
        <label htmlFor="note" className="text-base font-bold">Anything else we should know? <span className={ui.optional}>Optional</span></label>
        <p id="note-ex" className={ui.hint}>Example: &quot;Please use the new photo from my Wednesday session.&quot;</p>
        <textarea id="note" rows={3} className={ui.box} maxLength={2000} value={note} aria-describedby="note-ex" disabled={false} onChange={(e) => setNote(e.target.value)} />
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-900">{error}</div>}
        <button type="button" className={`${ui.primary} w-full`} onClick={send} disabled={busy !== null || (n === 0 && !note.trim())}>
          {busy === 'send' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{sendLabel}
        </button>
        <p className="m-0 text-center text-[13px] leading-snug text-gray-600">
          {n === 0 ? 'Nothing has changed yet. Open a section to change an answer.' : 'Your page row then says "Live, new version being written".'}
        </p>
        {n > 0 && (
          <button type="button" className={`${ui.link} justify-center`} onClick={undo} disabled={busy !== null}>
            {busy === 'undo' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Undo my changes
          </button>
        )}
      </div>
    </>
  )
}
