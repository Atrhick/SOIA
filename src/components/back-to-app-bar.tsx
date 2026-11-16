'use client'

import { ArrowLeft } from 'lucide-react'
import { useSession } from 'next-auth/react'

/**
 * A "back to my dashboard" bar on public pages (program pages, sign-up, booking, previews),
 * shown only to people signed in to the back office. The home-screen app has no browser
 * back button, and iPhones open the app's own pages inside the app even from a new-tab
 * link, so without this a member viewing their live page had no way back.
 * Prospects (not signed in) never see it.
 */
export function BackToAppBar() {
  const { status } = useSession()
  if (status !== 'authenticated') return null

  const goBack = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Came here from inside the app (e.g. "View live page"): return to that exact page.
    try {
      if (document.referrer && new URL(document.referrer).origin === window.location.origin && window.history.length > 1) {
        e.preventDefault()
        window.history.back()
      }
    } catch {
      // fall through to the link: the start page sends each person to their own dashboard
    }
  }

  return (
    <div className="sticky top-0 z-40 border-b border-primary-800 bg-primary-700 text-white">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-1.5 sm:px-6 lg:px-8">
        <a
          href="/"
          onClick={goBack}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-1 text-base font-semibold hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          Back to my dashboard
        </a>
        <span className="text-sm text-primary-100">Only you see this bar (you&apos;re signed in).</span>
      </div>
    </div>
  )
}
