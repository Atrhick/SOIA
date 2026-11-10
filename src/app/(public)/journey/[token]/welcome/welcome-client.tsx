'use client'

import { useState } from 'react'
import { Check, Copy, Share2 } from 'lucide-react'
import { journeyBtn } from '@/components/get-involved/join-shell'

const asA = (label: string) => `${/^[aeiou]/i.test(label) ? 'an' : 'a'} ${label}`
const panel = 'bg-white border border-gray-200 rounded-2xl p-6 md:p-7 space-y-4 min-w-0'

export function WelcomeClient(p: {
  firstName: string
  roleLabel: string
  inviterName: string | null
  inviteUrl: string | null
  paymentReceived: boolean
  businessRole: boolean
  signInPath: string
  /** Coaches and ambassadors invite people; other roles see a plain "sign in" welcome. */
  inviter: boolean
}) {
  const [copied, setCopied] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const shown = p.inviteUrl?.replace(/^https?:\/\//, '') ?? ''

  async function copy() {
    if (!p.inviteUrl) return
    try { await navigator.clipboard.writeText(p.inviteUrl); setCopied(true); setNote('Link copied.') }
    catch { setNote('Could not copy automatically. Select the link above and copy it.') }
  }
  async function share() {
    if (!p.inviteUrl) return
    if (typeof navigator.share === 'function') {
      try { await navigator.share({ title: 'Get involved with NowTransformed', url: p.inviteUrl }); return } catch { return }
    }
    await copy()
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-green-700">{p.paymentReceived ? 'Payment received · login created' : 'Login created'}</p>
        <h1 className="mt-1 text-3xl md:text-4xl font-bold text-gray-900">Welcome to the team, {p.firstName}</h1>
        <p className="mt-1 text-gray-700">
          {p.inviterName ? `You're on ${p.inviterName}'s team as ${asA(p.roleLabel)}. ` : `You're officially a NowTransformed ${p.roleLabel}. `}
          Now you build yours, one person a day.
        </p>
      </div>

      {!p.inviter ? (
        <section aria-labelledby="next-title" className={`${panel} max-w-2xl`}>
          <h2 id="next-title" className="text-[13px] font-bold uppercase tracking-wide text-primary-800">What&apos;s next</h2>
          <p className="text-gray-700">Sign in to your dashboard to get started. Our team will be in touch about your first steps.</p>
          <a href={p.signInPath} className={journeyBtn}>Sign in to my dashboard</a>
        </section>
      ) : (
      <div className="grid gap-4 md:gap-6 md:grid-cols-2 items-start">
        <section aria-labelledby="link-title" className={panel}>
          <h2 id="link-title" className="text-[13px] font-bold uppercase tracking-wide text-primary-800">Your Get Involved link</h2>
          {p.inviteUrl ? (
            <>
              <p className="rounded-lg border border-dashed border-sky-300 bg-sky-50 px-3 py-3 text-primary-800 break-all select-all">{shown}</p>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={copy} className={journeyBtn}>
                  {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}{copied ? 'Copied' : 'Copy link'}
                </button>
                <button type="button" onClick={share} className="h-12 px-5 rounded-xl border border-gray-300 bg-white font-semibold text-gray-900 hover:bg-gray-50 inline-flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2">
                  <Share2 className="h-4 w-4" aria-hidden />Share
                </button>
              </div>
              <p role="status" className="text-sm text-gray-600 empty:!mt-0">{note}</p>
            </>
          ) : (
            <p className="text-gray-700">Your link will be on your dashboard once you sign in.</p>
          )}
          <p className="italic text-gray-600">
            {p.businessRole
              ? '"You\'re doing this for yourself and your business: every person you invite builds your team."'
              : '"Every person you invite builds your team, and helps someone else get involved."'}
          </p>
        </section>

        <section aria-labelledby="oad-title" className={panel}>
          <h2 id="oad-title" className="text-[13px] font-bold uppercase tracking-wide text-primary-800">One-A-Day: your first 30 days</h2>
          <ol className="space-y-3">
            {['Reach out to one person each day.', 'Send them your link, or add them yourself from your dashboard.', 'Everyone accepted joins your team, and you appear on the leaderboard.'].map((t, i) => (
              <li key={t} className="flex gap-3 text-gray-700">
                <span aria-hidden className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-primary-800">{i + 1}</span>
                <span className="pt-0.5">{t}</span>
              </li>
            ))}
          </ol>
          <a href={p.signInPath} className={journeyBtn}>Sign in to my dashboard</a>
        </section>
      </div>
      )}
    </div>
  )
}
