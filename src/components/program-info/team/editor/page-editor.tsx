'use client'

/**
 * The team's page editor (/admin/program-pages/[id]/edit): write the whole program page part by part, see
 * it as visitors will (phone preview), and save it as the DRAFT version with the existing saveDraft action.
 * Sending to the owner and publishing stay on the page's team screen; who approves does not change.
 *
 * Computer: parts list | fields of the chosen part | phone preview. Phone: a parts menu, the fields, and a
 * Preview button. Problems come from pageWarnings (src/lib/program-info/page-checks.ts): red ones stop the save.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { saveDraft } from '@/lib/actions/program-info'
import { pageWarnings, type OtherPageText, type PageWarning } from '@/lib/program-info/page-checks'
import { questionById } from '@/lib/program-info/questions'
import { teamPagePath } from '@/lib/program-info/paths'
import type { Answers } from '@/lib/program-info/progress'
import type { SignupPageProps } from '@/components/get-involved/signup/signup-page'
import { kit } from '@/components/ui/kit/styles'
import { useToast } from '@/components/ui/kit/toast'
import { VERSION_STATUS, answerToText, when } from '../format'
import { EditorContext, fieldId, smallBtn, type EditorApi } from './fields'
import { OPTIONAL_PARTS, PARTS, PartFields, partOfPath } from './parts'
import { cleanPage, getAt, pathKey, previewPage, setAt, type Obj, type Path } from './model'
import { LivePreview } from './live-preview'

export interface PageEditorProps {
  programId: string
  title: string
  ownerFirst: string | null
  ownerName: string | null
  business: string
  initialPage: Obj
  /** Where the page came from: a version, the live page, or an empty starter page. */
  source: 'version' | 'live' | 'starter'
  working: { number: number; status: string; updatedAt: string } | null
  draftNumber: number | null
  answers: Answers
  signup: SignupPageProps
  otherPages: OtherPageText[]
}

const box = 'rounded-2xl border border-gray-300 bg-white p-4 shadow-sm sm:p-5'

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

function ago(ms: number, now: number): string {
  const min = Math.floor((now - ms) / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`
  return when(new Date(ms).toISOString())
}

function AnswersPanel({ partId, first, answers }: { partId: string; first: string; answers: Answers }) {
  const part = PARTS.find((p) => p.id === partId)
  if (!part) return null
  const keys = [...part.answers, 'mustNotSay']
  return (
    <details className={box}>
      <summary className="flex min-h-[44px] cursor-pointer items-center text-base font-bold text-gray-900">{first}&apos;s answers for this part</summary>
      <dl className="m-0 mt-2 flex flex-col gap-3">
        {keys.map((k) => {
          const label = k === 'flyerLink' ? 'A flyer or website we can read' : questionById(k)?.label ?? k
          const text = answerToText(k, answers[k])
          return (
            <div key={k} className="min-w-0">
              <dt className="text-sm font-semibold text-gray-900">{label}</dt>
              <dd className="m-0 whitespace-pre-line break-words text-base text-gray-800">{text || <span className="text-gray-500">Not answered</span>}</dd>
            </div>
          )
        })}
      </dl>
    </details>
  )
}

export function PageEditor(props: PageEditorProps) {
  const { programId, title, ownerFirst, business, signup, otherPages, answers } = props
  const router = useRouter()
  const toast = useToast()
  const first = ownerFirst ?? 'the owner'
  const [page, setPage] = useState<Obj>(props.initialPage)
  const [partId, setPartId] = useState('top')
  const [showPreview, setShowPreview] = useState(false)
  const [saving, startSave] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(cleanPage(props.initialPage)))
  const [savedAt, setSavedAt] = useState<number | null>(props.source === 'version' && props.working?.status === 'DRAFT' ? new Date(props.working.updatedAt).getTime() : null)
  const [draftNumber, setDraftNumber] = useState<number | null>(props.draftNumber)
  const [now, setNow] = useState(() => Date.now())
  const fieldsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])

  const cleaned = useMemo(() => cleanPage(page), [page])
  const json = useMemo(() => JSON.stringify(cleaned), [cleaned])
  const dirty = json !== savedJson
  const warnings = useMemo(() => pageWarnings(cleaned, { otherPages }), [cleaned, otherPages])
  const blocking = warnings.filter((w) => w.blocking)
  const notes = warnings.filter((w) => !w.blocking)
  const byPath = useMemo(() => {
    const m = new Map<string, PageWarning[]>()
    for (const w of warnings) m.set(w.path, [...(m.get(w.path) ?? []), w])
    return m
  }, [warnings])
  const problemsInPart = useMemo(() => {
    const m = new Map<string, number>()
    for (const w of blocking) m.set(partOfPath(w.path), (m.get(partOfPath(w.path)) ?? 0) + 1)
    return m
  }, [blocking])

  const debounced = useDebounced(page, 300)
  const preview = useMemo(() => previewPage(debounced), [debounced])

  const set = useCallback((p: Path, value: unknown) => setPage((cur) => setAt(cur, p, value)), [])
  const api: EditorApi = useMemo(() => ({ page, set, warn: (p: Path) => byPath.get(pathKey(p)) ?? [], programId }), [page, set, byPath, programId])

  // ---------- saving ----------
  const save = useCallback(() => {
    if (saving || blocking.length > 0 || !dirty) return
    setError(null)
    const sending = json
    startSave(async () => {
      const r = await saveDraft(programId, { offerPage: JSON.parse(sending) })
      if (!r.ok) {
        setError(r.error)
        return
      }
      setSavedJson(sending)
      setSavedAt(Date.now())
      setNow(Date.now())
      setDraftNumber(r.number)
      toast.success(`Saved as the draft (version ${r.number}).`)
      router.refresh()
    })
  }, [saving, blocking.length, dirty, json, programId, router, toast])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [save])

  // ---------- leaving with unsaved changes ----------
  useEffect(() => {
    if (!dirty) return
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.('a')
      if (!a || !a.href || a.target === '_blank' || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
      const url = new URL(a.href, window.location.href)
      if (url.origin !== window.location.origin || (url.pathname === window.location.pathname && url.hash)) return
      if (!window.confirm('You have unsaved changes on this page. Leave without saving?')) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', onUnload)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('beforeunload', onUnload)
      document.removeEventListener('click', onClick, true)
    }
  }, [dirty])

  const goTo = (w: PageWarning) => {
    setPartId(partOfPath(w.path))
    setShowPreview(false)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const parts = w.path.split('.')
      for (let n = parts.length; n > 0; n--) {
        const el = document.getElementById(fieldId(parts.slice(0, n))) ?? document.getElementById(`${fieldId(parts.slice(0, n))}-problems`)
        if (el) {
          el.scrollIntoView({ block: 'center' })
          if ('focus' in el) (el as HTMLElement).focus({ preventScroll: true })
          return
        }
      }
      fieldsRef.current?.scrollIntoView({ block: 'start' })
    }))
  }

  const part = PARTS.find((p) => p.id === partId) ?? PARTS[0]
  const starting =
    draftNumber !== null
      ? `Editing the draft, version ${draftNumber}. Not live.`
      : props.source === 'version' && props.working
        ? `Starting from version ${props.working.number} (${(VERSION_STATUS[props.working.status] ?? props.working.status).toLowerCase()}). Saving makes a new draft; version ${props.working.number} stays as it is.`
        : props.source === 'live'
          ? 'Starting from the live page. Saving makes a draft; the live page stays as it is.'
          : 'A new page. Fill in every part marked in red, then save it as the draft.'
  const status = dirty
    ? { text: 'Unsaved changes', cls: 'bg-amber-100 text-amber-900' }
    : savedAt
      ? { text: `Saved ${ago(savedAt, now)}`, cls: 'bg-green-100 text-green-900' }
      : { text: 'No changes yet', cls: 'bg-gray-100 text-gray-800' }
  const back = teamPagePath(programId)

  return (
    <EditorContext.Provider value={api}>
      <div className="flex min-w-0 flex-col gap-4">
        <Link href={back} className="inline-flex min-h-[44px] items-center gap-1.5 self-start rounded-lg px-1 text-base font-semibold text-primary-700 hover:underline">
          <ArrowLeft className="h-5 w-5" aria-hidden /> Back to {first}&apos;s page
        </Link>

        {/* Title, state, save */}
        <div className={`${box} flex flex-col gap-3`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="m-0 text-xl font-extrabold text-gray-900 sm:text-2xl">Write the page · {title}</h1>
              <p className="m-0 mt-1 text-sm text-gray-700">{starting}</p>
            </div>
            <span role="status" aria-live="polite" className={`rounded-full px-3 py-1 text-sm font-bold ${status.cls}`}>{status.text}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button type="button" className={kit.primary} disabled={saving || blocking.length > 0 || !dirty} aria-describedby="save-why" onClick={save}>
              {saving ? 'Saving…' : 'Save draft'}
            </button>
            {draftNumber !== null && <Link href={`${back}/version/${draftNumber}`} className={smallBtn}>Preview full size</Link>}
            {draftNumber !== null && !dirty && <Link href={back} className={smallBtn}>Back to {first}&apos;s page to send it</Link>}
          </div>
          <p id="save-why" className={`m-0 text-sm ${blocking.length > 0 ? 'font-semibold text-red-800' : 'text-gray-700'}`}>
            {blocking.length > 0
              ? `Save is off until the ${blocking.length === 1 ? 'problem' : `${blocking.length} problems`} marked in red ${blocking.length === 1 ? 'is' : 'are'} fixed.`
              : !dirty
                ? `Nothing to save. Ctrl+S (Cmd+S on a Mac) also saves. The live page doesn't change until ${first} says "Looks good".`
                : `Ctrl+S (Cmd+S on a Mac) also saves. The live page doesn't change until ${first} says "Looks good".`}
          </p>
          {error && <p role="alert" className="m-0 rounded-xl border border-red-300 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-800">{error}</p>}
        </div>

        {/* Problems */}
        {warnings.length > 0 && (
          <section aria-label="Checks" className={`${box} flex flex-col gap-3`}>
            {blocking.length > 0 && (
              <div>
                <h2 className="m-0 text-base font-bold text-red-900">Fix before saving ({blocking.length})</h2>
                <ul className="m-0 mt-1.5 flex list-none flex-col gap-1 p-0">
                  {blocking.map((w, i) => (
                    <li key={i}>
                      <button type="button" onClick={() => goTo(w)} className={`w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-left text-sm text-red-900 hover:bg-red-100 ${kit.ring}`}>{w.message}</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {notes.length > 0 && (
              <details open={blocking.length === 0}>
                <summary className="flex min-h-[44px] cursor-pointer items-center text-base font-bold text-amber-900">Worth a look ({notes.length}), doesn&apos;t stop the save</summary>
                <ul className="m-0 mt-1.5 flex list-none flex-col gap-1 p-0">
                  {notes.map((w, i) => (
                    <li key={i}>
                      <button type="button" onClick={() => goTo(w)} className={`w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-left text-sm text-amber-900 hover:bg-amber-100 ${kit.ring}`}>{w.message}</button>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        )}

        {/* Phones and narrower screens: parts menu + preview button */}
        <div className="flex flex-wrap items-end gap-2.5 lg:hidden">
          <div className="min-w-0 flex-1 basis-56">
            <label htmlFor="part-pick" className={kit.label}>Part of the page</label>
            <select id="part-pick" value={partId} onChange={(e) => { setPartId(e.target.value); setShowPreview(false) }} className={kit.input}>
              {PARTS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}{OPTIONAL_PARTS.has(p.id) && getAt(page, [p.keys[0]]) === undefined ? ' (off)' : ''}{problemsInPart.get(p.id) ? ` · ${problemsInPart.get(p.id)} to fix` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="xl:hidden">
          <button type="button" className={smallBtn} aria-pressed={showPreview} onClick={() => setShowPreview((x) => !x)}>
            {showPreview ? 'Back to writing' : 'Preview'}
          </button>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[190px_minmax(0,1fr)_minmax(0,400px)]">
          {/* Parts list (computer) */}
          <nav aria-label="Parts of the page" className="hidden lg:block">
            <ul className="sticky top-20 m-0 flex list-none flex-col gap-1 p-0">
              {PARTS.map((p) => {
                const n = problemsInPart.get(p.id) ?? 0
                const off = OPTIONAL_PARTS.has(p.id) && getAt(page, [p.keys[0]]) === undefined
                const cur = p.id === partId
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      aria-current={cur ? 'true' : undefined}
                      onClick={() => { setPartId(p.id); setShowPreview(false) }}
                      className={`flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm font-semibold ${cur ? 'border-primary-700 bg-primary-50 text-primary-900' : 'border-gray-200 bg-white text-gray-900 hover:bg-gray-50'} ${kit.ring}`}
                    >
                      <span className="min-w-0">{p.label}{off && <span className="font-normal text-gray-600"> (off)</span>}</span>
                      {n > 0 && <span className="flex-none rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">{n}<span className="sr-only"> to fix</span></span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* Fields */}
          <div ref={fieldsRef} className={`min-w-0 flex-col gap-4 ${showPreview ? 'hidden xl:flex' : 'flex'}`}>
            <section aria-labelledby="part-h" className={`${box} flex min-w-0 flex-col gap-4`}>
              <h2 id="part-h" className="m-0 text-lg font-bold text-gray-900">{part.label}</h2>
              <PartFields id={part.id} />
            </section>
            <AnswersPanel partId={part.id} first={first} answers={answers} />
          </div>

          {/* Preview */}
          <div className={`min-w-0 ${showPreview ? 'block' : 'hidden xl:block'}`}>
            <div className="xl:sticky xl:top-20">
              <p className="m-0 mb-2 text-sm text-gray-700">Preview at phone width. Updates as you type; the sign-up form is switched off.</p>
              <LivePreview page={preview} signup={signup} business={business} />
            </div>
          </div>
        </div>
      </div>
    </EditorContext.Provider>
  )
}
