'use client'

/**
 * "Names and groups" (Start mockup; A1, A3, A4). One column. Saving sends every group with its page id so a
 * rename keeps the page and its link. A group can be removed here only when its page was never live and
 * has no sign-ups; otherwise the row says to ask the team. "One group" only when every extra page can go.
 */
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus } from 'lucide-react'
import { saveNamesAndGroups } from '@/lib/actions/program-info'
import { coachPagePath, programsHome, type OwnerRole } from '@/lib/program-info/paths'
import { BackLink, ViewingAsBanner, ui } from './ui'

export interface SetupGroup { id: string; label: string; isRoot: boolean; canRemove: boolean; isLive: boolean }

let tmpSeq = 0
const tmpId = () => `new-${++tmpSeq}`

export function SetupScreen({
  role, rootId, programName, companyName, groups, firstTime, anyLive, readOnly,
}: {
  role: OwnerRole
  rootId: string
  programName: string
  companyName: string
  groups: SetupGroup[]
  firstTime: boolean
  anyLive: boolean
  readOnly: boolean
}) {
  const router = useRouter()
  const [name, setName] = useState(programName)
  const [company, setCompany] = useState(companyName)
  const [many, setMany] = useState(groups.length > 1)
  const [rows, setRows] = useState<SetupGroup[]>(() => {
    const base = groups.length ? groups : [{ id: rootId, label: '', isRoot: true, canRemove: false, isLive: false }]
    return base.length === 1 ? [...base, { id: tmpId(), label: '', isRoot: false, canRemove: true, isLive: false }] : base
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const extras = rows.filter((r) => !r.isRoot && !r.id.startsWith('new-'))
  const canGoSingle = extras.every((r) => r.canRemove)
  const namesChanged = name.trim() !== programName || company.trim() !== companyName

  const setLabel = (id: string, label: string) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, label } : r)))
  const remove = (id: string) => setRows((rs) => rs.filter((r) => r.id !== id))
  const add = () => setRows((rs) => [...rs, { id: tmpId(), label: '', isRoot: false, canRemove: true, isLive: false }])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) { setError('Please enter the program name.'); return }
    let payload: { id?: string; label: string }[] = []
    if (many) {
      const filled = rows.filter((r) => r.label.trim())
      if (filled.length < 2) { setError('Name at least two groups, or choose "One group".'); return }
      if (rows.some((r) => !r.label.trim() && !r.id.startsWith('new-'))) { setError('Give each group a name.'); return }
      payload = filled.map((r) => (r.id.startsWith('new-') ? { label: r.label.trim() } : { id: r.id, label: r.label.trim() }))
    }
    setBusy(true)
    try {
      const r = await saveNamesAndGroups(rootId, { programName: name.trim(), companyName: company.trim(), groups: payload })
      if (!r.ok) { setError(r.error); return }
      router.push(firstTime ? coachPagePath(role, rootId) : programsHome(role))
      router.refresh()
    } catch {
      setError("That didn't save. Check your connection and try again.")
    } finally {
      setBusy(false)
    }
  }

  const askHref = (label: string) => `${programsHome(role)}?ask=${encodeURIComponent(`Please remove my ${label} page.`)}#ask-team`

  return (
    <form onSubmit={save} className="mx-auto flex max-w-[640px] min-w-0 flex-col gap-4">
      <div className="flex min-h-[44px] items-center">
        <BackLink href={programsHome(role)}>My programs</BackLink>
      </div>
      {readOnly && <ViewingAsBanner />}
      <div>
        <h1 className="m-0 text-2xl font-extrabold leading-tight">{firstTime ? "Let's set up your program" : 'Names and groups'}</h1>
        <p className="m-0 mt-1.5 text-base leading-relaxed text-gray-700">{firstTime ? 'Two quick things before the questions.' : 'Change the names, or who the program is for.'}</p>
      </div>

      <fieldset disabled={readOnly || busy} className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
        <section aria-labelledby="names-h" className={`${ui.card} flex flex-col gap-3.5 p-[18px]`}>
          <h2 id="names-h" className="m-0 text-lg font-extrabold">1. Names</h2>
          <div className="flex flex-col gap-1">
            <label htmlFor="pn" className="text-base font-bold">Program name</label>
            <p id="pn-h" className={ui.hint}>What people call it. Example: Health &amp; Stress Management</p>
            <input id="pn" className={ui.box} value={name} maxLength={150} aria-describedby="pn-h" onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="co" className="text-base font-bold">Your company or organization</label>
            <p id="co-h" className={ui.hint}>Example: Life Changing Solutions. Leave empty if you don&apos;t have one.</p>
            <input id="co" className={ui.box} value={company} maxLength={150} aria-describedby="co-h" onChange={(e) => setCompany(e.target.value)} />
          </div>
          <p className="m-0 text-sm leading-relaxed text-gray-700">
            New names show on your pages after you check them. Until then, nothing live changes.
            {anyLive && namesChanged && !firstTime && ' Your live pages come back to you to check with the new names.'}
          </p>
        </section>

        <section aria-labelledby="who-h" className={`${ui.card} flex flex-col gap-3.5 p-[18px]`}>
          <h2 id="who-h" className="m-0 text-lg font-extrabold">2. Who is it for?</h2>
          <p className="m-0 text-[15px] leading-relaxed text-gray-700">Different groups worry about different things, so each group gets its own page and link. Not sure? Pick &quot;One group&quot;. You can add another group later.</p>
          <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
            <legend className="mb-2 p-0 text-[15px] font-bold">Choose one</legend>
            <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-[15px] leading-snug ${!many ? 'border-2 border-violet-700 bg-violet-50' : 'border-gray-300 bg-white'} ${!canGoSingle ? 'cursor-not-allowed opacity-70' : ''}`}>
              <input type="radio" name="groups" checked={!many} disabled={!canGoSingle} onChange={() => setMany(false)} className="mt-0.5 h-5 w-5 flex-none accent-violet-700" aria-describedby={!canGoSingle ? 'single-h' : undefined} />
              <span><b>One group</b><br /><span className="text-gray-600">Example: parents of teens.</span>
                {!canGoSingle && <span id="single-h" className="mt-1 block text-sm text-gray-700">Not available: one of your group pages has been live or has sign-ups. Ask the team to remove it first.</span>}
              </span>
            </label>
            <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-[15px] leading-snug ${many ? 'border-2 border-violet-700 bg-violet-50' : 'border-gray-300 bg-white'}`}>
              <input type="radio" name="groups" checked={many} onChange={() => setMany(true)} className="mt-0.5 h-5 w-5 flex-none accent-violet-700" />
              <span><b>More than one group</b><br /><span className="text-gray-600">Example: families, and small business owners.</span></span>
            </label>
          </fieldset>

          {many && (
            <div className="flex flex-col gap-2.5">
              {rows.map((r, i) => {
                const removable = !r.isRoot && (r.id.startsWith('new-') || r.canRemove)
                const fixed = !r.isRoot && !removable
                return (
                  <div key={r.id} className="flex flex-col gap-1">
                    <label htmlFor={`g-${r.id}`} className="text-[15px] font-semibold">Group {i + 1}</label>
                    <div className="flex items-center gap-2">
                      <input id={`g-${r.id}`} className={ui.box} value={r.label} maxLength={60} onChange={(e) => setLabel(r.id, e.target.value)} />
                      {removable && rows.length > 2 && (
                        <button type="button" className={ui.secondary} onClick={() => remove(r.id)} aria-label={`Remove ${r.label || `group ${i + 1}`}`}>Remove</button>
                      )}
                    </div>
                    {fixed && (
                      <p className="m-0 text-sm text-gray-600">
                        This page has been live or has sign-ups. <Link href={askHref(r.label)} className="font-semibold text-violet-800 underline">Ask the team to remove it</Link>
                      </p>
                    )}
                    {r.isRoot && i === 0 && groups.length > 0 && <p className="m-0 text-sm text-gray-600">Renaming a group keeps its page and link.</p>}
                  </div>
                )
              })}
              {rows.length < 6 && (
                <button type="button" onClick={add} className={`${ui.secondary} self-start text-violet-800`}>
                  <Plus className="h-4 w-4" aria-hidden />Add another group
                </button>
              )}
            </div>
          )}
          <p className="m-0 text-sm leading-relaxed text-gray-700">You answer most questions once for each group. One section, About you, you answer only once. All your pages use it.</p>
        </section>
      </fieldset>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[15px] text-red-900">{error}</div>}
      <button type="submit" className={`${ui.primary} w-full`} disabled={readOnly || busy}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {firstTime ? 'Continue to the questions' : 'Save names and groups'}
      </button>
    </form>
  )
}
