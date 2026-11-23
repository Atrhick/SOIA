import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { loginPath } from '@/lib/safe-callback'
import { getTeamPageDetail } from '@/lib/actions/program-info'
import { teamPagePath } from '@/lib/program-info/paths'
import { namesOf } from '@/lib/program-info/server'
import { longTextsOf, type OtherPageText } from '@/lib/program-info/page-checks'
import { previewSignup } from '@/components/program-info/offer-preview'
import { PageEditor } from '@/components/program-info/team/editor/page-editor'
import { starterPage, workingVersionForEditor } from '@/components/program-info/team/editor/model'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Write the page' }

/** Text on other programs' live pages (not this program's own group pages), for the "copied word for word" check. */
async function otherLivePages(rootId: string): Promise<OtherPageText[]> {
  const rows = await prisma.coachProgram.findMany({
    where: {
      status: 'PUBLISHED',
      publishedSnapshot: { not: Prisma.DbNull },
      offerPage: { not: Prisma.DbNull },
      NOT: [{ id: rootId }, { parentProgramId: rootId }],
    },
    select: { offerPage: true, name: true, pageTitle: true, organization: true, sharedAnswers: true, audienceLabel: true },
  })
  return rows.map((r) => {
    const { programName } = namesOf(r)
    return { name: r.audienceLabel ? `${programName} · ${r.audienceLabel}` : programName, texts: longTextsOf(r.offerPage) }
  }).filter((p) => p.texts.length > 0)
}

/** The team's page editor: write the whole page, see it as visitors will, save it as the draft. */
export default async function ProgramPageEditPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') redirect(loginPath(`${teamPagePath(params.id)}/edit`))
  const r = await getTeamPageDetail(params.id)
  if (!r.ok) {
    return (
      <div className="flex flex-col gap-4">
        <Link href={teamPagePath(params.id)} className="inline-flex min-h-[44px] items-center gap-1.5 self-start rounded-lg px-1 text-base font-semibold text-primary-700 hover:underline">
          <ArrowLeft className="h-5 w-5" aria-hidden /> Back to the page
        </Link>
        <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-800">{r.error}</p>
      </div>
    )
  }
  const d = r.detail
  const working = workingVersionForEditor(d.versions)
  const source = working?.offerPage != null ? 'version' : d.current.offerPage != null ? 'live' : 'starter'
  const initial = working?.offerPage ?? d.current.offerPage ?? starterPage()
  const [signup, otherPages] = await Promise.all([previewSignup(d), otherLivePages(d.rootId)])

  return (
    <PageEditor
      programId={d.id}
      title={`${d.programName}${d.audienceLabel ? ` · ${d.audienceLabel}` : ''}`}
      ownerFirst={d.ownerFirstName}
      ownerName={d.ownerName}
      business={d.companyName || 'NowTRANSFORMED'}
      initialPage={initial as Record<string, unknown>}
      source={source}
      working={working ? { number: working.number, status: working.status, updatedAt: working.updatedAt } : null}
      draftNumber={d.versions.find((v) => v.status === 'DRAFT')?.number ?? null}
      answers={d.answers}
      signup={signup}
      otherPages={otherPages}
    />
  )
}
