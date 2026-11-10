'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { declineParentConsent, giveParentConsent } from '@/lib/actions/get-involved'

const input = 'w-full h-11 rounded-lg border border-gray-300 px-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-primary-500'

export function ConsentClient(props: { token: string; childFirst: string; parentName: string; inviterName: string | null; alreadyGiven: boolean; bookPath: string | null }) {
  const { token, childFirst, parentName, inviterName, bookPath } = props
  const [state, setState] = useState<'form' | 'given' | 'declined'>(props.alreadyGiven ? 'given' : 'form')
  const [busy, setBusy] = useState<'yes' | 'no' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmDecline, setConfirmDecline] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy('yes'); setError(null)
    const r = await giveParentConsent(token, new FormData(e.currentTarget))
    setBusy(null)
    if ('error' in r) setError(r.error)
    else setState('given')
  }

  async function onDecline() {
    setBusy('no'); setError(null)
    const r = await declineParentConsent(token)
    setBusy(null)
    if ('error' in r) setError(r.error)
    else setState('declined')
  }

  if (state === 'given') {
    return (
      <div className="max-w-xl mx-auto bg-white border border-gray-200 rounded-2xl p-8 space-y-4" role="status">
        <CheckCircle2 className="h-10 w-10 text-green-600" aria-hidden />
        <h1 className="text-2xl font-bold text-gray-900">Thank you. Consent received.</h1>
        <p className="text-gray-700">Next, book {childFirst}&apos;s discovery call. <strong>You need to be on the call too</strong>, so pick a time that works for you both. We&apos;ve also emailed {childFirst} the link.</p>
        {bookPath && <Link href={bookPath} className="inline-flex h-12 px-6 rounded-xl bg-primary-700 hover:bg-primary-800 text-white font-semibold items-center">Book the call now</Link>}
      </div>
    )
  }
  if (state === 'declined') {
    return (
      <div className="max-w-xl mx-auto bg-white border border-gray-200 rounded-2xl p-8 space-y-3" role="status">
        <h1 className="text-2xl font-bold text-gray-900">Understood</h1>
        <p className="text-gray-700">We&apos;ve deleted {childFirst}&apos;s details. Thank you for letting us know.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto bg-white border border-gray-200 rounded-2xl p-6 md:p-8 space-y-5">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{childFirst} wants to join NowTransformed</h1>
      <p className="text-gray-700">Hi {parentName || 'there'}. {childFirst} filled out our Get Involved form{inviterName ? ` after hearing about us from ${inviterName}` : ''}. Before anything else, we need your okay.</p>
      <section className="space-y-1.5">
        <h2 className="text-xs font-bold uppercase tracking-wide text-primary-800">What it is</h2>
        <p className="text-gray-700">NowTransformed&apos;s youth ambassador program helps young people grow as leaders and give back to their community. It&apos;s free.</p>
      </section>
      <section className="space-y-1.5">
        <h2 className="text-xs font-bold uppercase tracking-wide text-primary-800">If you say yes</h2>
        <ul className="list-disc pl-5 text-gray-700 space-y-1">
          <li>You and {childFirst} book a 30-minute video call with our team. <strong>A parent or guardian must be on the call</strong>; we won&apos;t hold it without you.</li>
          <li>We store {childFirst}&apos;s name, email and phone to contact them about the program, and copy you on our emails.</li>
          <li>You can withdraw consent at any time by replying to any of our emails.</li>
        </ul>
      </section>
      <form onSubmit={onSubmit} className="space-y-4 border-t border-gray-100 pt-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="rel" className="block text-sm font-semibold text-gray-700 mb-1.5">Your relationship to {childFirst}</label>
            <select id="rel" name="relationship" className={input} defaultValue="Parent"><option>Parent</option><option>Legal guardian</option></select>
          </div>
          <div>
            <label htmlFor="sig" className="block text-sm font-semibold text-gray-700 mb-1.5">Type your full name to sign</label>
            <input id="sig" name="signature" required maxLength={120} defaultValue={parentName} className={input} />
          </div>
        </div>
        <label className="flex gap-2.5 items-start text-sm text-gray-700">
          <input type="checkbox" name="confirm" required className="mt-0.5 h-[18px] w-[18px] accent-primary-700" />
          I am {childFirst}&apos;s parent or legal guardian and I agree to their taking part, including being on the discovery call.
        </label>
        {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="submit" disabled={busy !== null} className="h-12 rounded-xl bg-primary-700 hover:bg-primary-800 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
            {busy === 'yes' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}I give consent
          </button>
          {!confirmDecline ? (
            <button type="button" onClick={() => setConfirmDecline(true)} className="h-12 rounded-xl border border-gray-300 text-gray-800 font-semibold hover:bg-gray-50">I don&apos;t consent</button>
          ) : (
            <button type="button" onClick={onDecline} disabled={busy !== null} className="h-12 rounded-xl border border-red-300 text-red-700 font-semibold hover:bg-red-50 flex items-center justify-center gap-2">
              {busy === 'no' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Yes, delete {childFirst}&apos;s details
            </button>
          )}
        </div>
        <p className="text-sm text-gray-500">If you don&apos;t consent, we delete {childFirst}&apos;s details and only tell the person who invited them that {childFirst} won&apos;t be continuing.</p>
      </form>
    </div>
  )
}
