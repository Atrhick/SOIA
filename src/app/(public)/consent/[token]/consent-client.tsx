'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { declineParentConsent, giveParentConsent } from '@/lib/actions/get-involved'

const focusRing = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2'
const input = 'w-full h-12 rounded-[10px] border border-gray-400 px-3.5 text-base bg-white focus:outline-none focus:ring-2 focus:ring-primary-500'
const btn = `w-full h-[52px] rounded-xl bg-primary-700 hover:bg-primary-800 text-white font-bold text-base flex items-center justify-center gap-2 disabled:opacity-60 ${focusRing}`

/** Screen 8B: the parent's page, from the consent email. */
export function ConsentClient(props: {
  token: string
  childFirst: string
  parentName: string
  relationship: 'Parent' | 'Legal guardian'
  inviter: { name: string; photoUrl: string | null; initials: string; line: string } | null
  programName: string | null
  /** The program offers sponsored seats this month (no prices before the call). */
  offer: boolean
  alreadyGiven: boolean
  bookPath: string | null
}) {
  const { token, childFirst, parentName, inviter, programName, offer } = props
  const router = useRouter()
  // Giving consent issues a new booking link, so use the one the action returns.
  const [bookPath, setBookPath] = useState<string | null>(props.bookPath)
  const [state, setState] = useState<'form' | 'given' | 'declined'>(props.alreadyGiven ? 'given' : 'form')
  const [busy, setBusy] = useState<'yes' | 'no' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmDecline, setConfirmDecline] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy('yes'); setError(null)
    const r = await giveParentConsent(token, new FormData(e.currentTarget))
    if ('error' in r) { setBusy(null); setError(r.error); return }
    const next = r.bookPath !== undefined ? r.bookPath : bookPath
    setBookPath(next)
    // "I agree: pick a call time" goes straight to the booking page.
    if (next) { router.push(next); return }
    setBusy(null)
    setState('given')
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
      <div className="max-w-xl mx-auto bg-white border border-gray-200 rounded-2xl p-6 md:p-8 space-y-4" role="status">
        <CheckCircle2 className="h-10 w-10 text-green-600" aria-hidden />
        <h1 className="text-2xl font-bold text-gray-900">Thank you. Consent received.</h1>
        <p className="text-gray-700">Next, pick a time for {childFirst}&apos;s call. <strong>You need to be on the call too</strong>, so choose a time that works for you both. We&apos;ve also emailed {childFirst} the link.</p>
        {bookPath && <Link href={bookPath} className={`${btn} sm:w-auto sm:px-6 inline-flex`}>Pick a call time</Link>}
      </div>
    )
  }
  if (state === 'declined') {
    return (
      <div className="max-w-xl mx-auto bg-white border border-gray-200 rounded-2xl p-6 md:p-8 space-y-3" role="status">
        <h1 className="text-2xl font-bold text-gray-900">Understood</h1>
        <p className="text-gray-700">We&apos;ve deleted {childFirst}&apos;s details. Thank you for letting us know.</p>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto bg-white border border-gray-200 rounded-2xl p-5 md:p-8 space-y-4">
      <h1 className="text-[22px] md:text-2xl leading-snug font-extrabold text-gray-900">{childFirst} would like to join {programName ?? 'NowTransformed'}</h1>
      {parentName && <p className="text-gray-700">Hi {parentName.split(' ')[0]}. Before anything else, we need your okay.</p>}
      {inviter && (
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3">
          {inviter.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={inviter.photoUrl} alt={`Photo of ${inviter.name}`} className="w-12 h-12 rounded-full object-cover flex-none" />
          ) : (
            <div role="img" aria-label={`Initials of ${inviter.name}`} className="w-12 h-12 rounded-full bg-sky-100 flex items-center justify-center font-bold text-sky-800 flex-none">{inviter.initials}</div>
          )}
          <p className="text-sm leading-snug text-gray-700">{childFirst} was invited by <strong className="text-gray-900">{inviter.name}</strong>, {inviter.line}.</p>
        </div>
      )}
      <ul className="list-disc pl-5 text-sm leading-7 text-gray-700">
        <li>First step: a free 30-minute video call. You join it with {childFirst}.</li>
        {offer && <li>Families who are a good fit may qualify for a NowTransformed sponsored seat. The team will talk about it on the free call.</li>}
        <li>We use {childFirst}&apos;s details only for this. You can ask us to delete them any time.</li>
      </ul>

      <form onSubmit={onSubmit} className="space-y-4 border-t border-gray-100 pt-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="rel" className="block text-sm font-semibold text-gray-900 mb-1.5">Your relationship to {childFirst}</label>
            <select id="rel" name="relationship" className={input} defaultValue={props.relationship}><option>Parent</option><option>Legal guardian</option></select>
          </div>
          <div>
            <label htmlFor="sig" className="block text-sm font-semibold text-gray-900 mb-1.5">Type your full name to sign</label>
            <input id="sig" name="signature" required maxLength={120} defaultValue={parentName} autoComplete="name" className={input} aria-describedby={error ? 'consent-err' : undefined} />
          </div>
        </div>
        <label className="flex gap-2.5 items-start text-sm leading-snug text-gray-800">
          <input type="checkbox" name="confirm" required className="mt-0.5 h-5 w-5 flex-none accent-primary-700" aria-describedby={error ? 'consent-err' : undefined} />
          I&apos;m {childFirst}&apos;s parent or guardian, I agree, and I&apos;ll be on the call.
        </label>
        <p className="text-[13px] text-gray-600">You&apos;ll get the confirmation and every reminder too.</p>
        {error && <p id="consent-err" role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        <button type="submit" disabled={busy !== null} className={btn}>
          {busy === 'yes' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}I agree: pick a call time
        </button>
        {!confirmDecline ? (
          <button type="button" onClick={() => setConfirmDecline(true)} className={`w-full min-h-[44px] text-sm font-semibold text-primary-700 underline rounded ${focusRing}`}>No thanks (we&apos;ll delete {childFirst}&apos;s details)</button>
        ) : (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 space-y-2" role="group" aria-label="Confirm you don't consent">
            <p className="text-sm text-red-900">We&apos;ll delete {childFirst}&apos;s details and only tell the person who invited them that {childFirst} won&apos;t be continuing.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={onDecline} disabled={busy !== null} className={`h-11 px-4 rounded-xl border border-red-300 bg-white text-red-700 font-semibold hover:bg-red-50 inline-flex items-center gap-2 ${focusRing}`}>
                {busy === 'no' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Yes, delete {childFirst}&apos;s details
              </button>
              <button type="button" onClick={() => setConfirmDecline(false)} className={`h-11 px-4 rounded-xl border border-gray-300 bg-white text-gray-800 font-semibold ${focusRing}`}>Go back</button>
            </div>
          </div>
        )}
      </form>
    </div>
  )
}
