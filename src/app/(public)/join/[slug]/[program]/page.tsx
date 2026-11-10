import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { inviterBySlug, userDisplayName } from '@/lib/get-involved/server'
import { inviterProgramBySlug } from '@/lib/get-involved/program-welcome-server'
import { JoinForm } from '../join-form'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Get Involved | NowTransformed', robots: { index: false } }

/** A program page's share link: the inviter's form, with the welcome email about that program. */
export default async function JoinProgramPage({ params }: { params: { slug: string; program: string } }) {
  const inviter = await inviterBySlug(params.slug)
  if (!inviter) redirect(`/join/${encodeURIComponent(params.slug)}`)
  const program = await inviterProgramBySlug(inviter.id, params.program)
  // A program that was unpublished or reassigned falls back to the inviter's main link.
  if (!program) redirect(`/join/${encodeURIComponent(params.slug)}`)
  const name = await userDisplayName(inviter.id)
  return (
    <JoinForm
      slug={params.slug}
      inviterName={name?.full ?? 'A NowTransformed member'}
      inviterFirst={name?.first ?? 'They'}
      program={{ slug: program.slug, name: program.name }}
    />
  )
}
