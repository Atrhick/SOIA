import { notFound } from 'next/navigation'
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

export default async function PublicProgramPage({
  params,
  searchParams,
}: {
  params: { slug: string }
  searchParams: { preview?: string }
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
            {STATUS_LABELS[result.status] ?? result.status}. The signup form is disabled here.
          </p>
        </div>
        <ProgramLandingClient
          slug={params.slug}
          program={result.program}
          previewMode
        />
      </div>
    )
  }

  const result = await getPublicProgram(params.slug)
  if ('error' in result) {
    notFound()
  }

  return <ProgramLandingClient slug={params.slug} program={result.program} />
}
