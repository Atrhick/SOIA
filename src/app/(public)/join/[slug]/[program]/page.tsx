import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { inviterBySlug } from '@/lib/get-involved/server'
import { inviterProgramBySlug } from '@/lib/get-involved/program-welcome-server'
import { SignupPage } from '@/components/get-involved/signup/signup-page'
import { loadSignupPage, viaParam } from '../load'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Get Involved | NowTransformed', robots: { index: false } }

/** A program page's share link: the inviter's sign-up page about that program. */
export default async function JoinProgramPage({ params, searchParams }: { params: { slug: string; program: string }; searchParams: { via?: string | string[] } }) {
  const via = viaParam(searchParams?.via)
  const main = `/join/${encodeURIComponent(params.slug)}${via ? `?via=${via}` : ''}`
  const inviter = await inviterBySlug(params.slug)
  if (!inviter) redirect(main)
  const program = await inviterProgramBySlug(inviter.id, params.program)
  // A program that was unpublished or reassigned falls back to the inviter's main link.
  if (!program) redirect(main)
  return <SignupPage {...await loadSignupPage(inviter, params.slug, program.slug, via)} />
}
