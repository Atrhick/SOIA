'use client'

/**
 * "Add a program": the owner names a new program and goes straight to names and groups, then the
 * questions. The team reviews the answers and writes the page; nothing goes live until the owner checks it.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus } from 'lucide-react'
import { addMyProgram } from '@/lib/actions/program-info'
import { coachSetupPath, type OwnerRole } from '@/lib/program-info/paths'
import { ui } from './ui'

export function AddProgramForm({ role, first }: { role: OwnerRole; first: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(first)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const r = await addMyProgram(name)
      if (!r.ok) { setError(r.error); setBusy(false); return }
      router.push(coachSetupPath(role, r.programId))
    } catch {
      setError("That didn't save. Check your connection and try again.")
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button type="button" className={`${ui.primary} min-h-[48px] self-start`} onClick={() => setOpen(true)}>
        <Plus className="h-5 w-5" aria-hidden />Add a program
      </button>
    )
  }

  return (
    <form onSubmit={submit} className={`${ui.card} flex max-w-[640px] flex-col gap-3 p-5`} aria-labelledby="add-h">
      <h2 id="add-h" className="m-0 text-lg font-bold">{first ? 'Add your first program' : 'Add a program'}</h2>
      <ol className="m-0 list-decimal pl-5 text-[15px] leading-relaxed text-gray-700">
        <li>Name your program.</li>
        <li>Tell us who it&apos;s for and answer a few short questions, about 10 minutes.</li>
        <li>The NowTRANSFORMED team reviews your answers and writes your page.</li>
        <li>You check it. Nothing goes live until you say so.</li>
      </ol>
      <label htmlFor="add-name" className="text-base font-bold">Program name</label>
      <p id="add-hint" className={ui.hint}>Example: &quot;Youth Business Lab&quot; or &quot;Money Basics for Teens&quot;. You can change it later.</p>
      <input id="add-name" className={ui.box} value={name} maxLength={120} aria-describedby="add-hint" disabled={busy} onChange={(e) => setName(e.target.value)} autoComplete="off" />
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-900">{error}</div>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={`${ui.primary} min-h-[48px]`} disabled={busy || name.trim().length < 2}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Start my program
        </button>
        {!first && <button type="button" className={ui.secondary} onClick={() => { setOpen(false); setError(null) }}>Cancel</button>}
      </div>
    </form>
  )
}
