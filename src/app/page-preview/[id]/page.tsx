/**
 * The page alone (no dashboard frame), in preview mode: what the computer-width previews on the owner's
 * check screen and the team screen load in a scaled 1280px iframe (ScaledPreviewFrame). Look-only (inert).
 * The team can open any version; owners only their own pages and never the team's DRAFT (getMyPageDetail).
 */
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { loginPath } from '@/lib/safe-callback'
import { isFeatureEnabled } from '@/lib/actions/feature-config'
import { getMyPageDetail, getTeamPageDetail } from '@/lib/actions/program-info'
import { pageFramePath } from '@/lib/program-info/paths'
import type { PageDetail } from '@/lib/program-info/server'
import { OfferPreview } from '@/components/program-info/offer-preview'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Page preview', robots: { index: false, follow: false } }

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null

export default async function PagePreviewFrame({ params, searchParams }: { params: { id: string }; searchParams?: { version?: string | string[] } }) {
  const versionParam = first(searchParams?.version)
  const session = await auth()
  if (!session) redirect(loginPath(pageFramePath(params.id, Number(versionParam) || null)))
  const role = session.user.role

  let detail: PageDetail
  if (role === 'ADMIN') {
    const r = await getTeamPageDetail(params.id)
    if (!r.ok) notFound()
    detail = r.detail
  } else if (role === 'COACH' || role === 'AMBASSADOR') {
    if (!(await isFeatureEnabled('PROGRAM_PAGES', role, session.user.id))) notFound()
    const r = await getMyPageDetail(params.id)
    if (!r.ok || r.ownerRole !== role) notFound()
    detail = r.detail
  } else {
    notFound()
  }

  const n = Number(versionParam)
  const v = versionParam ? detail.versions.find((x) => x.number === n) : undefined
  if (versionParam && !v) notFound()
  // A version without a page of its own keeps the live one (team: always; owner: only the live version, as on the check screen).
  const keepsLive = !v || role === 'ADMIN' || v.id === detail.lastApproved?.versionId
  const offerPage = v?.offerPage ?? (keepsLive ? detail.current.offerPage : null)
  if (!offerPage) notFound()

  return (
    <div {...({ inert: '' } as object)}>
      <h1 className="sr-only">Preview of {detail.pageName}</h1>
      <OfferPreview offerPage={offerPage} page={detail} />
    </div>
  )
}
