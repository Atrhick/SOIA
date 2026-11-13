import type { Metadata } from 'next'
import { inviterBySlug } from '@/lib/get-involved/server'
import { SignupPage } from '@/components/get-involved/signup/signup-page'
import { invParam, loadSignupPage, viaParam } from './load'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Get Involved | NowTransformed', robots: { index: false } }

export default async function JoinPage({ params, searchParams }: { params: { slug: string }; searchParams: { via?: string | string[]; inv?: string | string[] } }) {
  const inviter = await inviterBySlug(params.slug)
  if (!inviter) {
    return (
      <div className="max-w-lg mx-auto bg-white border border-gray-200 rounded-2xl p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">This invite link isn&apos;t active</h1>
        <p className="mt-3 text-gray-600">Please ask the person who shared it for a new link.</p>
      </div>
    )
  }
  return <SignupPage {...await loadSignupPage(inviter, params.slug, null, viaParam(searchParams?.via), invParam(searchParams?.inv))} />
}
