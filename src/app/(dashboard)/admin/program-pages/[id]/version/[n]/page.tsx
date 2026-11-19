import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { auth } from '@/lib/auth'
import { loginPath } from '@/lib/safe-callback'
import { getTeamPageDetail } from '@/lib/actions/program-info'
import { teamPagePath } from '@/lib/program-info/paths'
import { INFO_SECTIONS } from '@/lib/program-info/questions'
import { OfferPreview } from '@/components/program-info/offer-preview'
import { VERSION_STATUS, answerToText, when } from '@/components/program-info/team/format'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Program page version' }

const box = 'rounded-2xl border border-gray-200 bg-white p-4 sm:p-5'

/** Any version of a page exactly as written: the page (full size), welcome paragraph, invitation line, the answers it was written from. */
export default async function ProgramPageVersionPage({ params }: { params: { id: string; n: string } }) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') redirect(loginPath(`${teamPagePath(params.id)}/version/${encodeURIComponent(params.n)}`))
  const r = await getTeamPageDetail(params.id)
  const back = (
    <Link href={teamPagePath(params.id)} className="inline-flex min-h-[44px] items-center gap-1.5 self-start rounded-lg px-1 text-base font-semibold text-primary-700 hover:underline">
      <ArrowLeft className="h-5 w-5" aria-hidden /> Back to the page
    </Link>
  )
  if (!r.ok) return <div className="flex flex-col gap-4">{back}<p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-800">{r.error}</p></div>
  const d = r.detail
  const v = d.versions.find((x) => String(x.number) === params.n)
  if (!v) return <div className="flex flex-col gap-4">{back}<p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-800">That version does not exist.</p></div>
  const offerPage = v.offerPage ?? d.current.offerPage ?? null
  const title = `${d.programName}${d.audienceLabel ? ` · ${d.audienceLabel}` : ''}`

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-5">
      {back}
      <div>
        <h1 className="m-0 text-2xl font-extrabold text-gray-900">{title} · version {v.number}</h1>
        <p className="m-0 mt-1.5 text-base text-gray-700">
          {VERSION_STATUS[v.status] ?? v.status}
          {v.approvedAt ? ` ${when(v.approvedAt)}${v.approvedOnBehalf ? ' by the team for the owner' : ''}` : ''}
          {v.sentAt ? ` · sent ${when(v.sentAt)}` : ''} · saved {when(v.updatedAt)}
        </p>
      </div>

      {v.changeRequest && (
        <section aria-label="Changes asked for" className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <h2 className="m-0 text-base font-bold text-red-900">Changes asked for{v.changeRequestAt ? ` · ${when(v.changeRequestAt)}` : ''}</h2>
          <p className="m-0 mt-1.5 whitespace-pre-line text-base text-gray-900">{v.changeRequest}</p>
        </section>
      )}

      <section aria-labelledby="v-page" className="flex flex-col gap-2">
        <h2 id="v-page" className="m-0 text-lg font-bold text-gray-900">The page</h2>
        {!v.offerPage && <p className="m-0 text-sm text-gray-700">{offerPage ? 'This version has no page of its own; the page below is the live one, which it keeps.' : 'No page in this version yet.'}</p>}
        {offerPage && (
          <div className="overflow-hidden rounded-xl border border-gray-300">
            <p className="m-0 border-b border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-700">Preview. The sign-up form is switched off.</p>
            <OfferPreview offerPage={offerPage} page={d} />
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section aria-labelledby="v-welcome" className={box}>
          <h2 id="v-welcome" className="m-0 text-base font-bold text-gray-900">Welcome email paragraph</h2>
          <p className="m-0 mt-1.5 whitespace-pre-line text-base leading-relaxed text-gray-800">{v.welcomeNote || 'Not written.'}</p>
        </section>
        <section aria-labelledby="v-line" className={box}>
          <h2 id="v-line" className="m-0 text-base font-bold text-gray-900">Invitation line</h2>
          <p className="m-0 mt-1.5 text-base leading-relaxed text-gray-800">{v.messageLine || 'Not written.'}</p>
        </section>
      </div>

      <details className={box}>
        <summary className="flex min-h-[44px] cursor-pointer items-center text-base font-bold text-gray-900">The answers this version was written from</summary>
        <div className="mt-2 flex flex-col gap-4">
          {INFO_SECTIONS.map((s) => (
            <div key={s.id}>
              <h3 className="m-0 text-sm font-bold uppercase tracking-wide text-gray-700">{s.number}. {s.title}</h3>
              <dl className="m-0 mt-1.5 flex flex-col gap-2">
                {s.questions.map((q) => (
                  <div key={q.id}>
                    <dt className="text-sm font-semibold text-gray-900">{q.label}</dt>
                    <dd className="m-0 whitespace-pre-line text-base text-gray-800">{answerToText(q.id, v.answers[q.id]) || <span className="text-gray-500">Not answered</span>}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}
