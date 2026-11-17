import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { inviterBySlug } from '@/lib/get-involved/server'
import { inviterProgramBySlug } from '@/lib/get-involved/program-welcome-server'
import { SignupPage } from '@/components/get-involved/signup/signup-page'
import { OfferLanding } from '@/components/get-involved/offer-landing/offer-landing'
import { PublicShell } from '@/components/public-shell'
import { invParam, loadOfferLanding, loadSignupPage, viaParam } from '../load'

export const dynamic = 'force-dynamic'

type Props = { params: { slug: string; program: string }; searchParams: { via?: string | string[]; inv?: string | string[] } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const inviter = await inviterBySlug(params.slug)
  const program = inviter ? await inviterProgramBySlug(inviter.id, params.program) : null
  return { title: program ? `${program.name} | NowTRANSFORMED` : 'Get Involved | NowTRANSFORMED', robots: { index: false } }
}

/**
 * A program's share link. With a landing page (CoachProgram.offerPage): the full page, with the sign-up
 * form in the hero. Without one: the inviter's plain sign-up page about that program.
 */
export default async function JoinProgramPage({ params, searchParams }: Props) {
  const via = viaParam(searchParams?.via)
  const inv = invParam(searchParams?.inv)
  const qs = new URLSearchParams({ ...(via ? { via } : {}), ...(inv ? { inv } : {}) }).toString()
  const main = `/join/${encodeURIComponent(params.slug)}${qs ? `?${qs}` : ''}`
  const inviter = await inviterBySlug(params.slug)
  if (!inviter) redirect(main)
  const program = await inviterProgramBySlug(inviter.id, params.program)
  // A program that was unpublished or reassigned falls back to the inviter's main link.
  if (!program) redirect(main)
  const [signup, landing] = await Promise.all([
    loadSignupPage(inviter, params.slug, program.slug, via, inv),
    loadOfferLanding(program.id, inviter.id, params.slug, qs).catch(() => null),
  ])
  if (landing) return <OfferLanding signup={{ ...signup, embedded: true }} {...landing} />
  return (
    <PublicShell>
      <SignupPage {...signup} />
    </PublicShell>
  )
}
