import { notFound, redirect } from 'next/navigation'
import { offerLinkForProgram, offlineFallbackForProgram } from '@/lib/get-involved/program-welcome-server'
import type { Metadata } from 'next'
import { getProgramPreview, getPublicProgram } from '@/lib/actions/program-pages'
import { ProgramLandingClient } from './program-landing-client'

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const result = await getPublicProgram(params.slug)
  if ('error' in result) return { title: 'Program not found' }
  return {
    title: `${result.program.pageTitle || result.program.name} | NowTransformed`,
    description: result.program.headline ?? result.program.organization,
  }
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft — not submitted yet',
  PENDING_REVIEW: 'Awaiting admin review',
  PUBLISHED: 'Published — this matches the live page unless there are unsaved edits',
  REJECTED: 'Sent back for changes',
}

/** "?a=1&b=2" from the page's search params (repeated keys kept), or "" when there are none. */
function queryString(searchParams: Record<string, string | string[] | undefined>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(searchParams ?? {})) {
    for (const one of Array.isArray(v) ? v : v === undefined ? [] : [v]) q.append(k, one)
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

export default async function PublicProgramPage({
  params,
  searchParams,
}: {
  params: { slug: string }
  searchParams: Record<string, string | string[] | undefined>
}) {
  // ?preview=1 renders the current draft for the owning coach or an admin.
  // It is authenticated inside getProgramPreview - the public never sees it.
  if (searchParams.preview === '1') {
    const result = await getProgramPreview(params.slug)
    if ('error' in result) {
      notFound()
    }
    return (
      <div>
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
          <p className="font-medium text-amber-900">Preview — not visible to the public</p>
          <p className="text-sm text-amber-800 mt-0.5">
            {STATUS_LABELS[result.status] ?? result.status}. Continue to click through the
            videos and questions — nothing is saved.
          </p>
        </div>
        <ProgramLandingClient
          slug={params.slug}
          program={result.program}
          previewJourney={result.journey}
        />
      </div>
    )
  }

  // Programs with a landing page send old links there (sign-up then follows the One-A-Day steps).
  // The query string (?via=..., ?utm_...) goes along; redirect() from a page render is a 307.
  const landing = await offerLinkForProgram(params.slug).catch(() => null)
  if (landing) redirect(landing + queryString(searchParams))

  const result = await getPublicProgram(params.slug)
  if ('error' in result) {
    // An offline page sends people to the owner's main sign-up link, as its /join link does.
    const fallback = await offlineFallbackForProgram(params.slug).catch(() => null)
    if (fallback) redirect(fallback + queryString(searchParams))
    notFound()
  }

  return <ProgramLandingClient slug={params.slug} program={result.program} />
}
