import type { Metadata } from 'next'
import { inviterBySlug, userDisplayName } from '@/lib/get-involved/server'
import { JoinForm } from './join-form'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Get Involved | NowTransformed', robots: { index: false } }

export default async function JoinPage({ params }: { params: { slug: string } }) {
  const inviter = await inviterBySlug(params.slug)
  if (!inviter) {
    return (
      <div className="max-w-lg mx-auto bg-white border border-gray-200 rounded-2xl p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">This invite link isn&apos;t active</h1>
        <p className="mt-3 text-gray-600">Please ask the person who shared it for a new link.</p>
      </div>
    )
  }
  const name = await userDisplayName(inviter.id)
  return <JoinForm slug={params.slug} inviterName={name?.full ?? 'A NowTransformed member'} inviterFirst={name?.first ?? 'They'} />
}
