import type { Metadata } from 'next'
import { GetBookingLink } from '../discovery/[token]/discovery-client'

export const metadata: Metadata = { title: 'Book your free call | NowTransformed', robots: { index: false } }

/**
 * Linked from members' "signed up but didn't book" follow-ups. The member never sees the person's
 * private booking link: the person enters their email and the link is emailed to them
 * (requestNewLink: same answer whether or not the email exists, rate limited).
 */
export default function BookCallPage() {
  return (
    <main className="px-4 py-10">
      <GetBookingLink card="max-w-2xl mx-auto min-w-0 bg-white border border-gray-200 rounded-2xl p-6 md:p-8 space-y-5" />
    </main>
  )
}
