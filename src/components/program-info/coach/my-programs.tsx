/**
 * "My programs": every page with where it stands and one next step. Phone: a card per program with a
 * row per page (Main mockup). Computer: a table per program with "How a page gets made" beside it
 * (Desk-Main). Server component.
 */
import Link from 'next/link'
import { coachPagePath, coachSetupPath, type OwnerRole } from '@/lib/program-info/paths'
import type { OwnerProgramGroup, ProgramPageSummary } from '@/lib/program-info/server'
import { AddProgramForm } from './add-program-form'
import { AskTeamForm } from './ask-team-form'
import { Pill, ViewingAsBanner, ui } from './ui'

const STRONG = new Set(['Set up my program', 'Check my page', 'Answer the question', 'Send my answers', 'Send my changes', 'Put it back online'])

function actionHref(role: OwnerRole, p: ProgramPageSummary): string | null {
  if (!p.nextAction) return null
  return coachPagePath(role, p.id, p.nextAction.hrefSuffix)
}

/**
 * The page's row name under the program heading: the group's page ("Families page") when the program has
 * groups; "Your page" when it has one page, since its name would only repeat the heading.
 */
function rowLabel(p: ProgramPageSummary, pageCount: number): string {
  return p.audienceLabel || pageCount > 1 ? p.pageName : 'Your page'
}

/** "Check my Families page" on a phone; the table column (and a one-page program) says "Check my page". */
function phoneActionLabel(p: ProgramPageSummary, pageCount: number): string {
  const label = p.nextAction?.label ?? ''
  if (label === 'Check my page' && (p.audienceLabel || pageCount > 1)) return `Check my ${p.pageName}`
  return label
}

/** Where a page's name links to: its live screen once it has been live, else its answers. */
function pageHref(role: OwnerRole, p: ProgramPageSummary, needsSetup: boolean): string {
  if (needsSetup) return coachSetupPath(role, p.rootId)
  if (p.isLive || p.offline) return coachPagePath(role, p.id, '/live')
  if (p.stage === 'READY_TO_CHECK') return coachPagePath(role, p.id, '/check')
  return coachPagePath(role, p.id)
}

export function MyPrograms({ role, groups, readOnly, askPrefill }: { role: OwnerRole; groups: OwnerProgramGroup[]; readOnly: boolean; askPrefill: string | null }) {
  return (
    <div className="mx-auto flex max-w-[1180px] min-w-0 flex-col gap-4 lg:gap-5">
      <div>
        <h1 className="m-0 text-[26px] font-extrabold text-gray-900 lg:text-[28px]">My programs</h1>
        <p className="m-0 mt-1.5 text-[15px] leading-relaxed text-gray-700">
          <span className="lg:hidden">Each page shows what&apos;s happening and what to do next.</span>
          <span className="hidden lg:inline">Each group you serve has its own page and link. Here is where each one stands, and what to do next.</span>
        </p>
      </div>
      {readOnly && <ViewingAsBanner />}

      {groups.length === 0 ? (
        <AddProgramForm role={role} first />
      ) : (
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
          <div className="flex min-w-0 flex-1 flex-col gap-4 lg:gap-6">
            {groups.map((g) => <ProgramCard key={g.rootId} role={role} group={g} viewingAs={readOnly} />)}
          </div>
          <aside aria-labelledby="how-h" className={`${ui.card} hidden w-[300px] flex-none flex-col gap-3 p-6 lg:flex`}>
            <h2 id="how-h" className="m-0 text-base font-bold">How a page gets made</h2>
            <ol className="m-0 list-decimal pl-5 text-sm leading-7 text-gray-700">
              <li>You answer 5 short sections, about 10 minutes.</li>
              <li>The NowTRANSFORMED team writes your page, welcome email and invitation line.</li>
              <li>You check all three.</li>
              <li>You press &quot;Looks good&quot; and it goes live.</li>
            </ol>
            <p className={ui.hint}>Nothing goes live until you say so.</p>
          </aside>
        </div>
      )}

      {groups.length > 0 && <AddProgramForm role={role} first={false} />}
      <AskTeamForm readOnly={readOnly} prefill={askPrefill} />
    </div>
  )
}

function ProgramCard({ role, group, viewingAs }: { role: OwnerRole; group: OwnerProgramGroup; viewingAs: boolean }) {
  // An admin viewing as the owner goes straight to any page; the owner confirms names and groups first.
  const needsSetup = !group.groupsConfirmedAt && !viewingAs
  const pages = group.pages
  const sub = [group.companyName, `${pages.length} page${pages.length === 1 ? '' : 's'}`].filter(Boolean).join(' · ')
  const hid = `prog-${group.rootId}`
  return (
    <section aria-labelledby={hid} className={`${ui.card} min-w-0 overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-[18px] pt-[18px] lg:border-b lg:border-gray-200 lg:px-6 lg:py-[18px]">
        <div className="min-w-0">
          <h2 id={hid} className="m-0 break-words text-[19px] font-extrabold">{group.programName}</h2>
          <p className="m-0 mt-0.5 text-sm text-gray-600">{sub}</p>
        </div>
        {!needsSetup && <Link href={coachSetupPath(role, group.rootId)} className={`${ui.secondary} hidden lg:inline-flex`}>Names and groups</Link>}
      </div>

      {/* Phone: a row per page */}
      <ul className="m-0 mt-3 list-none px-[18px] pb-1 lg:hidden">
        {pages.map((p) => {
          const href = actionHref(role, p)
          const strong = p.nextAction && STRONG.has(p.nextAction.label)
          return (
            <li key={p.id} className="flex flex-col gap-2 border-t border-gray-200 py-4">
              <div className="flex items-start justify-between gap-2.5">
                <Link href={pageHref(role, p, needsSetup)} className="min-w-0 break-words text-base font-bold text-gray-900 no-underline hover:underline">{rowLabel(p, pages.length)}</Link>
                <Pill label={p.coachStatusLabel} tone={p.coachTone} />
              </div>
              {(p.coachStatusDetail || !p.nextAction) && <p className="m-0 text-sm leading-snug text-gray-700">{p.coachStatusDetail ?? 'Nothing to do for now.'}</p>}
              {href && (
                <Link href={href} className={`${strong ? ui.primary : ui.outline} min-h-[48px] text-base`}>{phoneActionLabel(p, pages.length)}</Link>
              )}
            </li>
          )
        })}
        {!needsSetup && (
          <li className="border-t border-gray-200">
            <Link href={coachSetupPath(role, group.rootId)} className={`${ui.link} min-h-[48px] w-full`}>Names and groups ›</Link>
          </li>
        )}
      </ul>

      {/* Computer: a table */}
      <div className="relative hidden lg:block">
        <table className="w-full border-collapse text-[15px]">
          <thead>
            <tr className="text-left text-[13px] text-gray-600">
              <th scope="col" className="px-6 py-3 font-semibold">Page</th>
              <th scope="col" className="px-2 py-3 font-semibold">Where it stands</th>
              <th scope="col" className="px-6 py-3 text-right font-semibold">Next step</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((p) => {
              const href = actionHref(role, p)
              const strong = p.nextAction && STRONG.has(p.nextAction.label)
              return (
                <tr key={p.id} className="border-t border-gray-100 align-middle">
                  <td className="px-6 py-4 font-bold"><Link href={pageHref(role, p, needsSetup)} className="text-gray-900 no-underline hover:underline">{p.audienceLabel || rowLabel(p, pages.length)}</Link></td>
                  <td className="px-2 py-4">
                    {p.coachTone === 'action' && !['Ready for you to check', 'Question from the team', 'Not started'].includes(p.coachStatusLabel)
                      ? <span className="text-gray-700">{p.coachStatusLabel}</span>
                      : <Pill label={p.coachStatusLabel} tone={p.coachTone} />}
                    {p.coachStatusDetail && p.coachStatusDetail !== 'Nothing to do' && <span className="mt-1 block text-[13px] text-gray-600">{p.coachStatusDetail}</span>}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {href ? <Link href={href} className={`${strong ? ui.primarySm : ui.secondary} whitespace-nowrap`}>{p.nextAction!.label}</Link> : <span className="text-gray-600">Nothing to do</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

