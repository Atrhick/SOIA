/**
 * Program info workflow, owner screens: one server component per route. The coach and ambassador route
 * files are thin and pass their role. Every screen: sign-in + role (ownerGate), the Program Pages feature,
 * then ownership (getMyPageDetail, which refuses pages the person does not own).
 */
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ChevronRight, Megaphone, ShieldCheck } from 'lucide-react'
import { FeatureDisabled } from '@/components/ui/feature-disabled'
import { parseOfferPage } from '@/lib/get-involved/offer-page'
import { isSectionId, type SectionId } from '@/lib/program-info/questions'
import { coachPagePath, coachSetupPath, groupName, pageFramePath, programsHome, yourPageName, type OwnerRole } from '@/lib/program-info/paths'
import type { PageDetail, ProgramPageSummary, VersionItem } from '@/lib/program-info/server'
import { loadOwnerPage, loadOwnerPrograms, ownerGate } from './load'
import { MyPrograms } from './my-programs'
import { SetupScreen } from './setup-client'
import { AnswersScreen } from './answers-client'
import { QuestionForm } from './question-client'
import { ApproveBox, ChangeBox } from './check-actions'
import { OfferPreview, ResponsiveOfferPreview } from '@/components/program-info/offer-preview'
import { BackOnlineButton, ShareLink, TakeOfflineRow } from './live-client'
import { UpdateScreenClient } from './update-client'
import { LocalDate } from './local-date'
import { BackLink, CheckIcon, Crumbs, Pill, ViewingAsBanner, pageCrumbItems, ui } from './ui'

const disabled = () => <FeatureDisabled title="Program Pages" icon={Megaphone} />
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const oneADay = (role: OwnerRole) => (role === 'AMBASSADOR' ? '/ambassador/one-a-day' : '/coach/one-a-day')
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null

function TopRow({ role, detail, back, backLabel }: { role: OwnerRole; detail: PageDetail; back?: string; backLabel?: string }) {
  return (
    <div className="flex min-h-[44px] items-center">
      <div className="lg:hidden"><BackLink href={back ?? programsHome(role)}>{backLabel ?? 'My programs'}</BackLink></div>
      <div className="hidden lg:block">
        <Crumbs items={pageCrumbItems(role, detail)} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- My programs

export async function MyProgramsRoute({ role, searchParams }: { role: OwnerRole; searchParams?: { ask?: string | string[] } }) {
  const gate = await ownerGate(role, programsHome(role))
  if (gate.kind === 'disabled') return disabled()
  const { groups, readOnly, error } = await loadOwnerPrograms(role)
  if (error) return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>
  const ask = first(searchParams?.ask)
  return <MyPrograms role={role} groups={groups} readOnly={readOnly} askPrefill={ask ? ask.slice(0, 300) : null} />
}

// ---------------------------------------------------------------- Names and groups

export async function SetupRoute({ role, id }: { role: OwnerRole; id: string }) {
  const gate = await ownerGate(role, coachSetupPath(role, id))
  if (gate.kind === 'disabled') return disabled()
  const { detail, readOnly } = await loadOwnerPage(role, id)
  if (!detail.isRoot) redirect(coachSetupPath(role, detail.rootId))
  const groups = detail.groups.map((g) => ({ id: g.id, label: g.audienceLabel ?? '', isRoot: g.isRoot, canRemove: g.canRemove, isLive: g.isLive }))
  return (
    <SetupScreen
      role={role}
      rootId={detail.id}
      programName={detail.programName}
      companyName={detail.companyName}
      groups={groups}
      firstTime={!detail.groupsConfirmedAt}
      anyLive={detail.groups.some((g) => g.isLive)}
      readOnly={readOnly}
    />
  )
}

// ---------------------------------------------------------------- Answers (hub, section)

export async function AnswersRoute({ role, id, section }: { role: OwnerRole; id: string; section?: string }) {
  let sectionId: SectionId | null = null
  if (section !== undefined) {
    if (!isSectionId(section)) notFound()
    sectionId = section
  }
  const here = sectionId ? coachPagePath(role, id, `/section/${sectionId}`) : coachPagePath(role, id)
  const gate = await ownerGate(role, here)
  if (gate.kind === 'disabled') return disabled()
  const { detail, readOnly } = await loadOwnerPage(role, id)
  // A1: names and groups first.
  if (detail.needsSetup && !readOnly) redirect(coachSetupPath(role, detail.rootId))
  // A live page's answers are changed from the Update screen (its sections open here).
  if (detail.stage === 'DONE' && !sectionId) redirect(coachPagePath(role, detail.id, '/update'))
  return <AnswersScreen detail={detail} role={role} readOnly={readOnly} sectionId={sectionId} />
}

// ---------------------------------------------------------------- Sent

function Step({ n, state, title, text }: { n: number; state: 'done' | 'now' | 'later'; title: string; text: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3.5">
      <span aria-hidden className={`flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm font-bold ${state === 'done' ? 'bg-green-700 text-white' : state === 'now' ? 'border-2 border-amber-500 bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'}`}>
        {state === 'done' ? <CheckIcon /> : n}
      </span>
      <div>
        <p className="m-0 text-base font-bold">{title}<span className="sr-only">{state === 'done' ? ' (done)' : state === 'now' ? ' (now)' : ''}</span></p>
        <p className="m-0 mt-0.5 text-sm leading-relaxed text-gray-600">{text}</p>
      </div>
    </li>
  )
}

function OtherPages({ role, pages, title }: { role: OwnerRole; pages: ProgramPageSummary[]; title: string }) {
  if (pages.length === 0) return null
  return (
    <section aria-labelledby="pages-h" className={`${ui.card} px-[18px] pb-1 pt-[18px]`}>
      <h2 id="pages-h" className="m-0 mb-1.5 text-[17px] font-bold">{title}</h2>
      <ul className="m-0 list-none p-0">
        {pages.map((p, i) => (
          <li key={p.id} className={`flex flex-col gap-1.5 py-3.5 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <b className="text-[15px]">{groupName(p.audienceLabel, p.programName)}</b>
              <Pill label={p.coachStatusLabel} tone={p.coachTone} />
            </div>
            {p.nextAction
              ? <Link href={coachPagePath(role, p.id, p.nextAction.hrefSuffix)} className={ui.link}>{p.nextAction.label === 'Check my page' ? `Check my ${p.pageName}` : p.nextAction.label} ›</Link>
              : <p className="m-0 text-sm text-gray-600">Nothing to do for now.</p>}
          </li>
        ))}
      </ul>
    </section>
  )
}

export async function SentRoute({ role, id }: { role: OwnerRole; id: string }) {
  const gate = await ownerGate(role, coachPagePath(role, id, '/sent'))
  if (gate.kind === 'disabled') return disabled()
  const { detail } = await loadOwnerPage(role, id)
  if (!detail.answersSentAt) redirect(coachPagePath(role, detail.id))
  const { groups } = await loadOwnerPrograms(role)
  const pages = groups.find((g) => g.rootId === detail.rootId)?.pages ?? []
  const group = groupName(detail.audienceLabel, detail.programName)
  const s = detail.stage
  const written = s === 'READY_TO_CHECK' || s === 'DONE'
  const q = detail.openQuestions[0]
  return (
    <div className="mx-auto flex max-w-[640px] min-w-0 flex-col gap-4">
      <div className="flex min-h-[44px] items-center"><BackLink href={programsHome(role)}>My programs</BackLink></div>
      <section className={`${ui.card} flex flex-col gap-2.5 p-5`}>
        <div aria-hidden className="flex h-11 w-11 items-center justify-center rounded-full bg-green-100 text-green-700"><CheckIcon className="h-[22px] w-[22px]" /></div>
        <h1 className="m-0 text-[22px] font-extrabold leading-tight">{detail.isLive ? `Thanks, we have your ${group} changes` : `Thanks, we have your ${group} answers`}</h1>
        <p className="m-0 text-base leading-relaxed">
          {detail.isLive
            ? "The NowTRANSFORMED team is writing the new version now. We'll email you when it's ready to check. Your live page stays as it is until you say the new one looks good."
            : "The NowTRANSFORMED team is writing the page now. We'll email you when it's ready to check. Nothing goes live until you say it looks good."}
        </p>
      </section>
      <section aria-labelledby="next-h" className={`${ui.card} flex flex-col gap-[18px] p-5`}>
        <h2 id="next-h" className="m-0 text-[17px] font-bold">What happens next</h2>
        <ol className="m-0 flex list-none flex-col gap-[18px] p-0">
          <Step n={1} state="done" title="You send your answers" text={<>Done, <LocalDate iso={detail.answersSentAt} /></>} />
          <Step n={2} state={written ? 'done' : 'now'} title="We write your page" text={q ? <>We have a question for you. <Link href={coachPagePath(role, detail.id, `/question/${q.id}`)} className="font-semibold text-violet-800 underline">Answer the question</Link></> : "If anything is missing, we'll ask you here."} />
          <Step n={3} state={s === 'DONE' ? 'done' : s === 'READY_TO_CHECK' ? 'now' : 'later'} title="You check it" text="The page, the welcome email new sign-ups get, and your invitation line." />
          <Step n={4} state={s === 'DONE' && detail.isLive ? 'done' : 'later'} title="It goes live" text="You get the link to share." />
        </ol>
        <p className="m-0 border-t border-gray-100 pt-3.5 text-sm leading-relaxed text-gray-700">Want to change an answer? You still can. We&apos;ll see what changed.</p>
      </section>
      <OtherPages role={role} pages={pages} title={pages.length > 1 ? 'Your pages' : 'Your page'} />
    </div>
  )
}

// ---------------------------------------------------------------- Question

export async function QuestionRoute({ role, id, qid }: { role: OwnerRole; id: string; qid: string }) {
  const gate = await ownerGate(role, coachPagePath(role, id, `/question/${qid}`))
  if (gate.kind === 'disabled') return disabled()
  const { detail, readOnly } = await loadOwnerPage(role, id)
  if (!detail.questions.some((q) => q.id === qid)) notFound()
  const open = detail.openQuestions
  return (
    <div className="mx-auto flex max-w-[640px] min-w-0 flex-col gap-4">
      <div className="flex min-h-[44px] items-center"><BackLink href={programsHome(role)}>My programs</BackLink></div>
      {readOnly && <ViewingAsBanner />}
      <div className="flex flex-col gap-2">
        <span className="self-start rounded-full bg-blue-100 px-2.5 py-1 text-[13px] font-bold text-blue-800">{cap(`question${open.length > 1 ? 's' : ''} about ${yourPageName(detail)}`)}</span>
        <h1 className="m-0 text-2xl font-extrabold leading-tight">
          {open.length === 0 ? 'No questions waiting' : open.length === 1 ? 'One quick question before we finish your page' : `${open.length} quick questions before we finish your page`}
        </h1>
      </div>
      {open.length === 0 ? (
        <div className={`${ui.card} flex flex-col gap-2 p-5`}>
          <p className="m-0 text-base leading-relaxed">You&apos;ve answered everything the team asked. Thanks. Nothing to do for now.</p>
          <Link href={programsHome(role)} className={ui.link}>Back to My programs ›</Link>
        </div>
      ) : (
        <QuestionForm role={role} programId={detail.id} questions={open} currentAnswers={detail.answers} focusId={qid} readOnly={readOnly} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Check (Review) and the full-size preview

type CheckMode = 'check' | 'live' | 'past'

function pickVersion(detail: PageDetail, versionParam: string | null): { v: VersionItem; mode: CheckMode } | null {
  const visible = detail.versions.filter((x) => x.status !== 'DRAFT')
  let v: VersionItem | undefined
  if (versionParam) {
    const n = Number(versionParam)
    v = Number.isInteger(n) ? visible.find((x) => x.number === n) : undefined
    if (!v) return null
  } else {
    v = visible.find((x) => x.id === detail.readyVersionId) ?? visible.find((x) => x.id === detail.lastApproved?.versionId)
  }
  if (!v) return null
  const mode: CheckMode = v.id === detail.readyVersionId && v.status === 'SENT' ? 'check' : v.status === 'APPROVED' && v.id === detail.lastApproved?.versionId ? 'live' : 'past'
  return { v, mode }
}

function partsOf(detail: PageDetail, v: VersionItem, mode: CheckMode) {
  const live = mode === 'live'
  return {
    page: parseOfferPage(v.offerPage ?? (live ? detail.current.offerPage : null)),
    welcome: v.welcomeNote ?? (live ? detail.current.welcomeNote : null),
    line: v.messageLine ?? (live ? detail.current.messageLine : null),
  }
}

const STATUS_WORDS: Record<VersionItem['status'], string> = {
  DRAFT: 'Draft', SENT: 'Ready for you to check', APPROVED: 'Approved earlier', CHANGES_ASKED: 'Changes asked for', SUPERSEDED: 'Replaced by a newer version',
}

export async function CheckRoute({ role, id, version }: { role: OwnerRole; id: string; version?: string | null }) {
  const here = coachPagePath(role, id, `/check${version ? `?version=${encodeURIComponent(version)}` : ''}`)
  const gate = await ownerGate(role, here)
  if (gate.kind === 'disabled') return disabled()
  const { detail, readOnly } = await loadOwnerPage(role, id)
  const picked = pickVersion(detail, version ?? null)
  if (!picked) {
    if (version) notFound()
    return (
      <div className="mx-auto flex max-w-[640px] flex-col gap-4">
        <TopRow role={role} detail={detail} />
        <h1 className="m-0 text-2xl font-extrabold">Nothing to check yet</h1>
        <p className="m-0 text-base text-gray-700">The team is still writing {yourPageName(detail)}. We&apos;ll email you when it&apos;s ready to check.</p>
        <Link href={programsHome(role)} className={ui.link}>Back to My programs ›</Link>
      </div>
    )
  }
  const { v, mode } = picked
  const parts = partsOf(detail, v, mode)
  const pageTitle = cap(yourPageName(detail))
  const fullHref = coachPagePath(role, detail.id, `/check/preview?version=${v.number}`)
  const back = mode === 'check' ? programsHome(role) : coachPagePath(role, detail.id, '/live')
  const backLabel = mode === 'check' ? 'My programs' : detail.pageName

  return (
    <div className="mx-auto flex max-w-[1180px] min-w-0 flex-col gap-4 lg:gap-5">
      <TopRow role={role} detail={detail} back={back} backLabel={backLabel} />
      {readOnly && <ViewingAsBanner />}
      <div className="flex flex-col gap-2">
        {mode === 'check' && <span className="self-start"><Pill label="Ready for you to check" tone="action" /></span>}
        {mode === 'live' && <span className="self-start"><Pill label="Live" tone="live" /></span>}
        {mode === 'past' && <span className="self-start"><Pill label={STATUS_WORDS[v.status]} tone="neutral" /></span>}
        <h1 className="m-0 text-2xl font-extrabold leading-tight lg:text-[28px]">
          {mode === 'check' ? `${pageTitle} is ready to check` : mode === 'live' ? `What you approved for ${yourPageName(detail)}` : `Version ${v.number} of ${yourPageName(detail)}`}
        </h1>
        {mode === 'check' && (
          <>
            <p className="m-0 text-base leading-relaxed text-gray-700">
              <span className="lg:hidden">There are 3 parts. Read each one like a visitor would. Check names, times and anything about cost.</span>
              <span className="hidden lg:inline">There are 3 parts: your page on the left, the welcome email and invitation line on the right. Check names, times and anything about cost.</span>
            </p>
            <p className="m-0 text-sm leading-relaxed text-gray-600">Prices never show on your page. That&apos;s on purpose: the team talks about cost on the free call.</p>
          </>
        )}
        {mode === 'live' && v.approvedAt && (
          <p className="m-0 text-[15px] text-gray-700">{v.approvedOnBehalf ? 'The team put this version live on ' : 'You approved this version on '}<LocalDate iso={v.approvedAt} format="dayTime" />, and it is what is live now.</p>
        )}
        {mode === 'past' && <p className="m-0 text-[15px] text-gray-700">An earlier version, kept for your records. Nothing here can be changed.</p>}
      </div>

      <div className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-start lg:gap-6">
        <section aria-labelledby="p1" className="flex min-w-0 flex-1 flex-col gap-2">
          <p id="p1" className={ui.part}>Part 1 of 3 · Your page</p>
          {parts.page ? (
            <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white">
              <div className="flex items-center gap-1.5 border-b border-gray-200 bg-gray-100 px-3 py-2" aria-hidden>
                <span className="h-2.5 w-2.5 rounded-full bg-gray-300" /><span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
                <span className="ml-2 text-xs text-gray-600">{mode === 'check' ? 'Preview · not live yet' : mode === 'live' ? 'Preview · live now' : 'Preview · earlier version'}</span>
              </div>
              <ResponsiveOfferPreview offerPage={parts.page} page={detail} frameSrc={pageFramePath(detail.id, v.number)} title={`Preview of ${yourPageName(detail)} at computer width`} />
            </div>
          ) : (
            <p className={`${ui.card} m-0 p-4 text-[15px] text-gray-700`}>This version has no page. Visitors see the plain sign-up page.</p>
          )}
          {parts.page && (
            <a href={fullHref} target="_blank" rel="noreferrer" className={ui.link}>
              <span className="lg:hidden">See it full size, as visitors will ›</span>
              <span className="hidden lg:inline">Open it full size in a new tab ›</span>
            </a>
          )}
        </section>

        <aside className="flex min-w-0 flex-col gap-4 lg:w-[380px] lg:flex-none" aria-label="Welcome email, invitation line and your decision">
          <section id="welcome" aria-labelledby="p2" className={`${ui.card} flex scroll-mt-24 flex-col gap-2 p-4`}>
            <p id="p2" className={ui.part}>Part 2 of 3 · Welcome email</p>
            <p className={ui.hint}>Sent to everyone who signs up on this page{parts.welcome ? '. We wrote this paragraph:' : '.'}</p>
            {parts.welcome
              ? <p className="m-0 whitespace-pre-line rounded-[10px] bg-gray-50 p-3 text-[15px] leading-relaxed">{parts.welcome}</p>
              : <p className="m-0 text-[15px] text-gray-700">No paragraph in this version: new sign-ups get the standard welcome email.</p>}
          </section>
          <section id="line" aria-labelledby="p3" className={`${ui.card} flex scroll-mt-24 flex-col gap-2 p-4`}>
            <p id="p3" className={ui.part}>Part 3 of 3 · Your invitation line</p>
            <p className={ui.hint}>How the messages you and your team send describe this page:</p>
            {parts.line
              ? <p className="m-0 rounded-[10px] bg-gray-50 p-3 text-[15px] leading-relaxed">&ldquo;{parts.line}&rdquo;</p>
              : <p className="m-0 text-[15px] text-gray-700">No invitation line in this version: messages use the standard wording.</p>}
          </section>
          {mode === 'check' && <ApproveBox role={role} programId={detail.id} versionId={v.id} readOnly={readOnly} />}
          {(mode === 'check' || mode === 'live') && <ChangeBox role={role} versionId={v.id} readOnly={readOnly} onLive={mode === 'live'} changeRound={detail.changeRound} />}
          {mode !== 'check' && (
            <Link href={coachPagePath(role, detail.id, '/live')} className={ui.link}>Back to {yourPageName(detail)} ›</Link>
          )}
        </aside>
      </div>
    </div>
  )
}

export async function PreviewRoute({ role, id, version }: { role: OwnerRole; id: string; version?: string | null }) {
  const gate = await ownerGate(role, coachPagePath(role, id, `/check/preview${version ? `?version=${encodeURIComponent(version)}` : ''}`))
  if (gate.kind === 'disabled') return disabled()
  const { detail } = await loadOwnerPage(role, id)
  const picked = pickVersion(detail, version ?? null)
  if (!picked) notFound()
  const parts = partsOf(detail, picked.v, picked.mode)
  if (!parts.page) notFound()
  const checkHref = coachPagePath(role, detail.id, `/check${picked.mode === 'check' ? '' : `?version=${picked.v.number}`}`)
  return (
    <div className="-mx-4 flex min-w-0 flex-col sm:-mx-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-1 sm:px-6">
        <BackLink href={checkHref}>Back to checking</BackLink>
        <span className="text-sm font-semibold text-gray-700">Preview · {picked.mode === 'check' ? 'not live yet' : picked.mode === 'live' ? 'live now' : `version ${picked.v.number}`} · the sign-up form is switched off</span>
      </div>
      <h1 className="sr-only">Full-size preview of {yourPageName(detail)}</h1>
      <OfferPreview offerPage={parts.page} page={detail} />
    </div>
  )
}

// ---------------------------------------------------------------- Live

function SettingsRow({ href, label, value, external }: { href?: string; label: string; value?: string; external?: boolean }) {
  const inner = (
    <>
      <span>{label}</span>
      <span className="flex items-center gap-1 text-right text-gray-600">{value}{href && <ChevronRight className="h-4 w-4 flex-none" aria-hidden />}</span>
    </>
  )
  const cls = 'flex min-h-[52px] items-center justify-between gap-3 border-t border-gray-100 py-2 text-[15px] text-gray-900 no-underline lg:min-h-[50px] lg:text-sm'
  if (!href) return <div className={`${cls} flex-wrap`}>{inner}</div>
  return external ? <a href={href} className={`${cls} ${ui.ring}`}>{inner}</a> : <Link href={href} className={`${cls} ${ui.ring}`}>{inner}</Link>
}

export async function LiveRoute({ role, id }: { role: OwnerRole; id: string }) {
  const gate = await ownerGate(role, coachPagePath(role, id, '/live'))
  if (gate.kind === 'disabled') return disabled()
  const { detail, readOnly } = await loadOwnerPage(role, id)
  if (!detail.isLive && !detail.offline) redirect(detail.stage === 'READY_TO_CHECK' ? coachPagePath(role, detail.id, '/check') : coachPagePath(role, detail.id))
  const { groups } = await loadOwnerPrograms(role)
  const others = (groups.find((g) => g.rootId === detail.rootId)?.pages ?? []).filter((p) => p.id !== detail.id)
  const approvedN = detail.lastApproved?.number ?? null
  const versionHref = (hash = '') => (approvedN ? coachPagePath(role, detail.id, `/check?version=${approvedN}${hash}`) : coachPagePath(role, detail.id, '/check'))
  const title = cap(yourPageName(detail))
  const p = detail.prices
  const s = detail.stage
  const changing = s !== 'DONE' && s !== 'ANSWERING'

  return (
    <div className="mx-auto flex max-w-[1180px] min-w-0 flex-col gap-4 lg:gap-5">
      <TopRow role={role} detail={detail} />
      {readOnly && <ViewingAsBanner />}
      <div className="flex flex-col gap-1.5 lg:flex-row lg:items-center lg:gap-3">
        {detail.audienceLabel && <p className="m-0 text-sm text-gray-600 lg:hidden">{detail.programName}</p>}
        <h1 className="m-0 text-2xl font-extrabold leading-tight lg:text-[28px]">{detail.offline ? `${title} is offline` : `${title} is live`}</h1>
        <span className="self-start lg:self-center"><Pill label={detail.offline ? 'Offline' : 'Live'} tone={detail.offline ? 'offline' : 'live'} /></span>
      </div>

      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-4 lg:gap-5">
          <section aria-label="Your link" className={`${ui.card} flex flex-col gap-3 p-[18px] lg:p-6`}>
            {detail.offline ? (
              <>
                <p className="m-0 text-base leading-relaxed">
                  {detail.offlineInfo?.byTeam
                    ? <>The team took this page offline{detail.offlineInfo.reason ? `: ${detail.offlineInfo.reason}` : '.'} They&apos;ll be in touch. Visitors are sent to your main link meanwhile.</>
                    : <>You took this page offline{detail.offlineInfo?.at ? <> on <LocalDate iso={detail.offlineInfo.at} /></> : ''}. Visitors are sent to your main link. Put it back online any time: it comes back exactly as you approved it.</>}
                </p>
                {!detail.offlineInfo?.byTeam && <BackOnlineButton programId={detail.id} readOnly={readOnly} />}
              </>
            ) : (
              <>
                <p className="m-0 text-base leading-relaxed">Share this link. People who sign up get your welcome email and book a free call with the NowTRANSFORMED team.</p>
                {detail.liveUrl && <ShareLink path={detail.liveUrl} />}
                <Link href={oneADay(role)} className={ui.link}>Send it to people you know (One-A-Day) ›</Link>
              </>
            )}
            {detail.lastApproved?.approvedAt && (
              <div className="flex items-start gap-2.5 rounded-xl border border-gray-200 bg-gray-50 p-3">
                <ShieldCheck className="mt-0.5 h-[18px] w-[18px] flex-none text-green-700" aria-hidden />
                <p className="m-0 text-sm leading-relaxed text-gray-700">
                  {detail.lastApproved.approvedOnBehalf ? 'The team put this page live on ' : 'You approved this page on '}<LocalDate iso={detail.lastApproved.approvedAt} format="dayTime" />{' '}
                  <Link href={versionHref()} className="flex min-h-[44px] items-center font-semibold text-violet-800 underline">See what you approved</Link>
                </p>
              </div>
            )}
          </section>

          <section aria-labelledby="chg-h" className={`${ui.card} flex flex-col gap-3 p-[18px] lg:p-6`}>
            <h2 id="chg-h" className="m-0 text-[17px] font-bold">Something changed?</h2>
            {s === 'READY_TO_CHECK' ? (
              <>
                <p className="m-0 text-[15px] leading-relaxed text-gray-700">A new version of this page is ready for you to check. Your live page stays as it is until you say it looks good.</p>
                <Link href={coachPagePath(role, detail.id, '/check')} className={`${ui.primary} lg:self-start`}>Check the new version</Link>
              </>
            ) : s === 'QUESTION_OPEN' && detail.openQuestionId ? (
              <>
                <p className="m-0 text-[15px] leading-relaxed text-gray-700">The team is writing a new version and has a question for you.</p>
                <Link href={coachPagePath(role, detail.id, `/question/${detail.openQuestionId}`)} className={`${ui.outline} lg:self-start`}>Answer the question</Link>
              </>
            ) : changing ? (
              <p className="m-0 text-[15px] leading-relaxed text-gray-700">
                {s === 'CHANGES_ASKED' ? 'Changes asked for, being fixed.' : 'Live, new version being written.'} Nothing to do: your live page stays as it is until you approve the new version.
              </p>
            ) : (
              <>
                <p className="m-0 text-[15px] leading-relaxed text-gray-700">New times, a new service, a better photo: change your answers. Your live page stays as it is until you approve the new version.</p>
                <Link href={s === 'DONE' ? coachPagePath(role, detail.id, '/update') : coachPagePath(role, detail.id)} className={`${ui.outline} lg:self-start`}>
                  {s === 'DONE' ? (detail.hasUnsentChanges ? 'Send my changes' : 'Change my answers') : 'Continue my answers'}
                </Link>
              </>
            )}
          </section>
        </div>

        <aside className="flex min-w-0 flex-col gap-4 lg:w-[360px] lg:flex-none lg:gap-5">
          <section aria-labelledby="more-h" className={`${ui.card} flex flex-col px-[18px] pb-2 pt-[18px] lg:px-6`}>
            <h2 id="more-h" className="m-0 mb-1.5 text-[17px] font-bold">More settings for this page</h2>
            <SettingsRow href={coachPagePath(role, detail.id, '/section/offer')} label="Prices" value={`${p.fullPrice ?? 'Not set'} · edit in What you offer`} />
            {(p.sponsorshipsPerMonth ?? 0) > 0 && (
              <SettingsRow label="NowTRANSFORMED sponsorships left this month" value={`${p.sponsorshipsLeftThisMonth} of ${p.sponsorshipsPerMonth} · set by the team`} />
            )}
            <SettingsRow href={versionHref('#welcome')} label="Welcome email" />
            <SettingsRow href={versionHref('#line')} label="Invitation line" />
            <SettingsRow href={coachPagePath(role, detail.id, '/details')} label="Zoom and video settings" />
            {detail.isLive && <TakeOfflineRow programId={detail.id} pageName={detail.pageName} readOnly={readOnly} />}
            <p className="m-0 mb-2.5 mt-2 text-[13px] leading-relaxed text-gray-600">
              Changes to the welcome email or invitation line come back to you to check first. Taking the page offline asks you to confirm. Visitors are then sent to your main link, and you can put it back online any time.
            </p>
          </section>
          {others.length > 0 && (
            <section aria-labelledby="oth-h" className={`${ui.card} flex flex-col px-[18px] pb-2 pt-[18px] lg:px-6`}>
              <h2 id="oth-h" className="m-0 mb-1.5 text-[17px] font-bold">{others.length === 1 ? 'Your other page' : 'Your other pages'}</h2>
              {others.map((o) => (
                <Link key={o.id} href={o.nextAction ? coachPagePath(role, o.id, o.nextAction.hrefSuffix) : o.isLive ? coachPagePath(role, o.id, '/live') : coachPagePath(role, o.id)}
                  className={`flex min-h-[52px] flex-wrap items-center justify-between gap-x-3 border-t border-gray-100 py-2 text-[15px] text-gray-900 no-underline first-of-type:border-t-0 lg:text-sm ${ui.ring}`}>
                  <span>{groupName(o.audienceLabel, o.programName)}</span>
                  <span className={`font-semibold ${o.coachTone === 'waiting' ? 'text-amber-800' : o.coachTone === 'live' ? 'text-green-800' : 'text-violet-800'}`}>
                    {o.coachStatusLabel}{o.nextAction ? '' : ' · nothing to do'}
                  </span>
                </Link>
              ))}
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Update (changes after go-live)

export async function UpdateRoute({ role, id }: { role: OwnerRole; id: string }) {
  const gate = await ownerGate(role, coachPagePath(role, id, '/update'))
  if (gate.kind === 'disabled') return disabled()
  const { detail, readOnly } = await loadOwnerPage(role, id)
  if (detail.needsSetup && !detail.isLive && !readOnly) redirect(coachSetupPath(role, detail.rootId))
  if (detail.stage !== 'DONE') redirect(detail.isLive || detail.offline ? coachPagePath(role, detail.id, '/live') : coachPagePath(role, detail.id))
  const sharedWith = detail.sections.find((s) => s.shared)?.sharedWith ?? []
  return (
    <div className="mx-auto flex max-w-[640px] min-w-0 flex-col gap-4">
      <div className="flex min-h-[44px] items-center"><BackLink href={coachPagePath(role, detail.id, '/live')}>{detail.pageName}</BackLink></div>
      {readOnly && <ViewingAsBanner />}
      <div>
        <p className="m-0 text-sm text-gray-600">{detail.audienceLabel ? `${detail.programName} · ${detail.pageName}` : detail.pageName}</p>
        <h1 className="m-0 mt-0.5 text-2xl font-extrabold leading-tight">Change your answers</h1>
      </div>
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-[15px] leading-relaxed text-blue-900">
        Your live page stays exactly as it is while you edit. When you send your changes, we write a new version and you check it before it replaces the live one.
      </div>
      <UpdateScreenClient role={role} programId={detail.id} changes={detail.changedSinceLive} sharedWith={sharedWith} readOnly={readOnly} />
    </div>
  )
}
