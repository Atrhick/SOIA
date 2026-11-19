'use client'

/**
 * One page's answers. Phone (below lg): the hub (/[id]: progress, the 5 sections, flyer, Send) and one
 * section per screen (/[id]/section/[s]). Computer (lg and up, Desk-Answers): the section list on the left
 * and the chosen section's questions on the right, on both routes; no separate hub.
 * The same DOM serves both: CSS hides the half a phone doesn't show, so nothing is rendered twice.
 */
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Loader2, Mic } from 'lucide-react'
import { sendAnswers } from '@/lib/actions/program-info'
import { INFO_SECTIONS, type SectionId } from '@/lib/program-info/questions'
import { missingRequired, sectionProgress, type MissingAnswer } from '@/lib/program-info/progress'
import { coachPagePath, coachQuestionPath, coachSectionPath, groupName, programsHome, type OwnerRole } from '@/lib/program-info/paths'
import type { PageDetail } from '@/lib/program-info/server'
import { AutosaveProvider, SaveStatus, useAutosave } from './autosave'
import { AutoQuestion, FlyerField } from './question-fields'
import { BackLink, CheckIcon, Crumbs, ViewingAsBanner, pageCrumbItems, ui } from './ui'

const URL_KEYS = ['zoomUrl', 'photosLink', 'flyerLink']
const READY_BANNER = 'Your page is ready to check. To change something, use Ask for these changes.'

type Props = { detail: PageDetail; role: OwnerRole; readOnly: boolean; sectionId: SectionId | null }

export function AnswersScreen(props: Props) {
  return (
    <AutosaveProvider programId={props.detail.id} initialAnswers={props.detail.answers} readOnly={props.readOnly || props.detail.stage === 'READY_TO_CHECK'} urlKeys={URL_KEYS}>
      <Answers {...props} />
    </AutosaveProvider>
  )
}

function sharedLabel(sharedWith: string[], short: boolean): string {
  if (sharedWith.length === 0) return ''
  if (short) return `shared with ${sharedWith.join(' and ')}`
  return sharedWith.length === 1 ? `shared with your ${sharedWith[0]} page` : `shared with your ${sharedWith.join(' and ')} pages`
}

function Answers({ detail, role, readOnly, sectionId }: Props) {
  const { answers } = useAutosave()
  const progress = useMemo(() => sectionProgress(answers), [answers])
  const done = progress.filter((s) => s.done).length
  const missing = useMemo(() => missingRequired(answers), [answers])
  const sharedWith = detail.sections.find((s) => s.shared)?.sharedWith ?? []
  const group = groupName(detail.audienceLabel, detail.programName)
  const isLiveEdit = detail.stage === 'DONE'
  const backToSections = isLiveEdit ? coachPagePath(role, detail.id, '/update') : coachPagePath(role, detail.id)
  const firstOpen = progress.find((s) => !s.done)?.id ?? 'short'
  const active: SectionId = sectionId ?? firstOpen
  const activeIdx = INFO_SECTIONS.findIndex((s) => s.id === active)
  const section = INFO_SECTIONS[activeIdx]
  const sp = progress[activeIdx]
  const prev = INFO_SECTIONS[activeIdx - 1]
  const next = INFO_SECTIONS[activeIdx + 1]
  const locked = detail.stage === 'READY_TO_CHECK'
  const onSection = sectionId !== null

  return (
    <div className="mx-auto flex max-w-[1180px] min-w-0 flex-col gap-4 lg:gap-5">
      {/* Top row: back link (phone) or breadcrumb (computer), and the one save status */}
      <div className="flex min-h-[44px] items-center justify-between gap-3">
        <div className="min-w-0 lg:hidden">
          {onSection
            ? <BackLink href={backToSections}>{isLiveEdit ? 'Change your answers' : 'All sections'}</BackLink>
            : <BackLink href={isLiveEdit ? coachPagePath(role, detail.id, '/live') : programsHome(role)}>{isLiveEdit ? detail.pageName : 'My programs'}</BackLink>}
        </div>
        <div className="hidden min-w-0 lg:block">
          <Crumbs items={pageCrumbItems(role, detail)} />
        </div>
        <SaveStatus savedText="Saved" />
      </div>

      {readOnly && <ViewingAsBanner />}

      {/* Page title. On a phone section screen it is for screen readers only (the section title shows). */}
      <div className={onSection ? 'sr-only lg:not-sr-only' : ''}>
        {detail.audienceLabel && <p className="m-0 text-sm text-gray-600 lg:hidden">{detail.programName}</p>}
        <h1 className="m-0 text-2xl font-extrabold leading-tight text-gray-900 lg:text-[28px]">
          <span className="lg:hidden">{detail.pageName}</span>
          <span className="hidden lg:inline">Your {group} answers</span>
        </h1>
        <p className="m-0 mt-2 text-base leading-relaxed text-gray-700 lg:hidden">Answer in your own words. We write the page from your answers and show it to you before it goes live.</p>
      </div>

      {locked && (
        <div role="status" className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-[15px] leading-relaxed text-blue-900">
          {READY_BANNER} <Link href={coachPagePath(role, detail.id, '/check')} className="font-bold text-blue-900 underline">Check my page</Link>
        </div>
      )}
      {isLiveEdit && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-[15px] leading-relaxed text-blue-900">
          Your live page stays exactly as it is while you edit. When you send your changes, we write a new version and you check it before it replaces the live one.
        </div>
      )}

      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
        {/* Left: progress + sections (the phone hub) */}
        <aside className={`${onSection ? 'hidden lg:flex' : 'flex'} min-w-0 flex-col gap-4 lg:w-[300px] lg:flex-none`} aria-label="Your sections">
          <div className={`${ui.card} p-4`}>
            <div className="flex justify-between gap-2 text-[15px] font-bold">
              <span>{done} of {INFO_SECTIONS.length} sections done</span>
              <span className="font-medium text-gray-600 lg:hidden">About 10 min in all</span>
            </div>
            <div role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={INFO_SECTIONS.length} aria-label="Sections done" className="mt-2 h-2 overflow-hidden rounded-full bg-violet-100">
              <div className="h-full bg-violet-700" style={{ width: `${(done / INFO_SECTIONS.length) * 100}%` }} />
            </div>
            <nav aria-label="Sections" className="mt-3">
              <ul className="m-0 list-none p-0">
                {progress.map((s, i) => {
                  const current = onSection ? s.id === active : s.id === firstOpen
                  const status = s.done ? 'Done' : s.started ? `${s.requiredAnswered} of ${s.requiredTotal} answered` : 'Not started'
                  const shared = s.shared ? sharedLabel(sharedWith, false) : ''
                  const sharedShort = s.shared ? sharedLabel(sharedWith, true) : ''
                  return (
                    <li key={s.id} className={i > 0 ? 'border-t border-gray-100' : ''}>
                      <Link
                        href={coachSectionPath(role, detail.id, s.id)}
                        aria-current={onSection && s.id === active ? 'step' : undefined}
                        className={`flex min-h-[64px] items-center gap-3.5 rounded-xl px-1 py-3 text-gray-900 no-underline lg:min-h-[48px] lg:px-2.5 lg:py-2 ${ui.ring} ${current ? 'bg-violet-50 px-2.5 lg:font-bold' : ''} ${onSection && s.id === active ? 'lg:bg-violet-50' : 'lg:bg-transparent lg:font-normal'}`}
                      >
                        <span aria-hidden className={`flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm font-bold lg:hidden ${s.done ? 'bg-green-700 text-white' : current ? 'border-2 border-violet-700 bg-white text-violet-800' : 'bg-gray-100 text-gray-700'}`}>
                          {s.done ? <CheckIcon /> : s.number}
                        </span>
                        <span className="min-w-0 flex-1 lg:flex lg:items-center lg:justify-between lg:gap-2">
                          <span className="block text-base font-bold lg:text-sm lg:font-[inherit]">{s.number}. {s.title}</span>
                          <span className={`mt-0.5 block text-sm lg:mt-0 lg:text-right lg:text-xs lg:font-semibold ${s.done ? 'text-gray-600 lg:text-green-700' : 'text-gray-600'}`}>
                            <span className="lg:hidden">{status}{!s.done && current && !onSection ? ' · next' : ''}{shared ? ` · ${shared}` : ''}</span>
                            <span className="hidden lg:inline">{s.done ? 'Done' : s.started ? `${s.requiredAnswered} of ${s.requiredTotal}` : 'Not started'}{sharedShort ? ` · ${sharedShort}` : ''}</span>
                          </span>
                        </span>
                        <ChevronRight className="h-4 w-4 flex-none text-gray-500 lg:hidden" aria-hidden />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </nav>
          </div>

          <SendCard detail={detail} role={role} readOnly={readOnly} missing={missing} group={group} />

          {!isLiveEdit && (
            <div className={`${ui.card} p-4`}>
              <FlyerField disabled={locked} />
            </div>
          )}

          <div className="flex items-start gap-2.5 rounded-xl bg-violet-50 p-3.5 lg:border lg:border-gray-200 lg:bg-gray-50">
            <Mic className="mt-0.5 h-5 w-5 flex-none text-violet-800" aria-hidden />
            <p className="m-0 text-sm leading-relaxed text-violet-950 lg:text-gray-700">
              <b>Rather talk than type?</b>{' '}
              <span className="lg:hidden">Tap the microphone on your keyboard and say your answer. We tidy up the wording.</span>
              <span className="hidden lg:inline">Windows: press the Windows key and H. Mac: press Fn twice. Then speak your answer.</span>
            </p>
          </div>
        </aside>

        {/* Right: the chosen section's questions (phone: the section screen) */}
        <section aria-labelledby="sec-h" className={`${onSection ? 'flex' : 'hidden lg:flex'} min-w-0 flex-1 flex-col gap-4`}>
          <div className={`${ui.card} flex flex-col gap-6 p-[18px] lg:gap-6 lg:px-[30px] lg:py-[26px]`}>
            <div>
              <p className="m-0 text-sm font-semibold text-violet-800">
                <span className="lg:hidden">{detail.pageName} · </span>Section {section.number} of {INFO_SECTIONS.length}
              </p>
              <h2 id="sec-h" className="m-0 mt-0.5 text-2xl font-extrabold leading-tight">{section.title}</h2>
              {section.shared && sharedWith.length > 0 && (
                <p className="m-0 mt-1.5 text-sm text-gray-600">You answer this once. It is {sharedLabel(sharedWith, false)}{isLiveEdit ? ': a change here updates both pages, and you check both' : ''}.</p>
              )}
            </div>
            <div className="flex flex-col gap-[26px]">
              {section.questions.filter((q) => !q.extraOf).map((q) => (
                <AutoQuestion key={q.id} q={q} extraOf={section.questions.filter((x) => x.extraOf === q.id)} disabled={locked} />
              ))}
            </div>
            {sp && !sp.done && sp.missing.length > 0 && sp.started && (
              <p className="m-0 text-sm font-semibold text-amber-800">Still needed here: {sp.missing.map((m) => m.label).join(' · ')}</p>
            )}
            {/* Computer: previous / next section */}
            <div className="hidden justify-between gap-3 border-t border-gray-200 pt-[18px] lg:flex">
              {prev ? <Link href={coachSectionPath(role, detail.id, prev.id)} className={ui.secondary}><ChevronLeft className="h-4 w-4" aria-hidden />{prev.title}</Link> : <span />}
              {next && <Link href={coachSectionPath(role, detail.id, next.id)} className={ui.primarySm}>Next: {next.title}<ChevronRight className="h-4 w-4" aria-hidden /></Link>}
            </div>
          </div>
          <div className="lg:hidden">
            <Link href={backToSections} className={`${ui.primary} w-full`}>Done, back to my sections</Link>
          </div>
        </section>
      </div>
    </div>
  )
}

/** The Send area, by stage. */
function SendCard({ detail, role, readOnly, missing, group }: { detail: PageDetail; role: OwnerRole; readOnly: boolean; missing: MissingAnswer[]; group: string }) {
  const router = useRouter()
  const { flush } = useAutosave()
  const [busy, setBusy] = useState(false)
  const [blocked, setBlocked] = useState<MissingAnswer[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (detail.stage === 'DONE') {
    return (
      <div className={`${ui.card} flex flex-col gap-2.5 p-4`}>
        <Link href={coachPagePath(role, detail.id, '/update')} className={`${ui.primary} w-full`}>See and send my changes</Link>
        <p className={`${ui.hint} text-[13px]`}>Your live page stays as it is until you approve the new version.</p>
      </div>
    )
  }
  if (detail.stage === 'READY_TO_CHECK') return null
  if (detail.stage !== 'ANSWERING') {
    const q = detail.openQuestions[0]
    return (
      <div className={`${ui.card} flex flex-col gap-2 p-4`}>
        <p className="m-0 text-[15px] font-bold">Answers sent</p>
        <p className={ui.hint}>The team is writing your page. You can still change an answer here; the team sees what changed.</p>
        {q && <Link href={coachQuestionPath(role, detail.id, q.id)} className={ui.link}>Answer the team&apos;s question ›</Link>}
      </div>
    )
  }

  const send = async () => {
    setError(null)
    setBlocked(null)
    flush()
    setBusy(true)
    try {
      // Give the last keystrokes a moment to reach the server before checking what is missing.
      await new Promise((r) => setTimeout(r, 400))
      const r = await sendAnswers(detail.id)
      if (r.ok) {
        router.push(coachPagePath(role, detail.id, '/sent'))
        return
      }
      if (r.missing?.length) setBlocked(r.missing)
      else setError(r.error)
    } catch {
      setError("That didn't send. Check your connection and try again.")
    } finally {
      setBusy(false)
    }
  }

  const shown = blocked ?? null
  const bySection = shown ? Array.from(new Set(shown.map((m) => m.sectionId))) : []
  return (
    <div className="flex flex-col gap-2.5 lg:rounded-2xl lg:border lg:border-gray-200 lg:bg-white lg:p-4">
      <button type="button" className={`${ui.primary} w-full lg:min-h-[48px] lg:text-base`} onClick={send} disabled={busy || readOnly}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        Send my {group} answers
      </button>
      {shown && shown.length > 0 && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm leading-relaxed text-red-900">
          <b>Almost there.</b> Still to do:{' '}
          {bySection.map((sid, i) => {
            const items = shown.filter((m) => m.sectionId === sid)
            const sec = INFO_SECTIONS.find((s) => s.id === sid)!
            const total = sec.questions.filter((q) => q.required).length
            return (
              <span key={sid}>
                {i > 0 && (i === bySection.length - 1 ? ' and ' : ', ')}
                <Link href={coachSectionPath(role, detail.id, sid)} className="font-bold text-red-900 underline">
                  {sec.title}{items.length < total ? ` (${items.length} answer${items.length === 1 ? '' : 's'})` : ''}
                </Link>
              </span>
            )
          })}
          .
        </div>
      )}
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-900">{error}</div>}
      {!shown && missing.length > 0 && (
        <p className={`${ui.hint} hidden text-[13px] lg:block`}>Still to do: {missingSummary(missing)}. We&apos;ll tell you what&apos;s missing if you send early.</p>
      )}
      {detail.groups.length > 1 && <p className={`${ui.hint} text-[13px]`}>Your other pages are separate and aren&apos;t held up by this one.</p>}
    </div>
  )
}

function missingSummary(missing: MissingAnswer[]): string {
  const ids = Array.from(new Set(missing.map((m) => m.sectionId)))
  const parts = ids.map((sid) => {
    const sec = INFO_SECTIONS.find((s) => s.id === sid)!
    const items = missing.filter((m) => m.sectionId === sid)
    const total = sec.questions.filter((q) => q.required).length
    return items.length < total ? `${sec.title} (${items.length} answer${items.length === 1 ? '' : 's'})` : sec.title
  })
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0] ?? ''
}
