'use client'

/**
 * The Get Involved sign-up page (screens 5, 5b, 6, 7, 8A). Step 1 is the short form; a new adult then
 * picks a call time on the same screen (step 2) and sees "You're booked". 17 and under switch to the
 * parent path. Existing emails get the same non-revealing "check your email" answer.
 */
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, Loader2, MailCheck } from 'lucide-react'
import { signupBookingView, submitGetInvolved } from '@/lib/actions/get-involved'
import { suggestEmail } from '@/lib/get-involved/email-typo'
import { Book, BookView, btn, focusRing } from './booking'
import { PhoneField } from './phone-field'
import { SPONSOR_LINE } from '@/lib/get-involved/scripts'

export interface SignupPageProps {
  slug: string
  /** Validated ?via= channel (lowercase) or null. */
  via: string | null
  /** ?inv= token from an "Email them for me" invitation (shape-checked only; posted with the form). */
  inv: string | null
  inviter: { name: string; first: string; roleLabel: string; photoUrl: string | null; initials: string; why: string | null }
  /** `slug` is set only on a program share link (it is posted with the form). */
  program: { slug: string | null; label: string; headline: string | null; bullets: string[] } | null
  /** The program has sponsored seats. No prices or counts reach the browser: the team offers seats on the call. */
  offer: { reason: string | null; seatsOpen: boolean; reopens: string } | null
  smsOn: boolean
  mailingAddress: string
}

type Age = 'AGE_18_24' | 'AGE_25_55' | 'AGE_56_PLUS' | 'UNDER_18'
const AGES: { value: Age; label: string }[] = [
  { value: 'UNDER_18', label: '17 or under' },
  { value: 'AGE_18_24', label: '18 – 24' },
  { value: 'AGE_25_55', label: '25 – 55' },
  { value: 'AGE_56_PLUS', label: '56 or over' },
]

const inputCls = (bad: boolean) => `w-full h-12 rounded-[10px] border px-3.5 text-base text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 ${bad ? 'border-2 border-red-700' : 'border-gray-400'}`
const lbl = 'block text-base font-semibold text-gray-900 mb-1.5'
const cardCls = 'bg-white border border-gray-200 rounded-2xl p-5 md:p-6 space-y-5 min-w-0'

type Stage =
  | { kind: 'form' }
  | { kind: 'booking'; token: string; view: BookView }
  | { kind: 'waitlisted'; token: string | null; first: string }
  | { kind: 'parent'; first: string; parentFirst: string }
  | { kind: 'check-email'; first: string }

export function SignupPage(props: SignupPageProps) {
  const { inviter, program, offer, smsOn, mailingAddress } = props
  const seatsFull = !!offer && !offer.seatsOpen
  // Seats full (5b A): the person chooses the waiting list or a full-price call before the form shows.
  const [seatChoice, setSeatChoice] = useState<null | 'waitlist' | 'full'>(null)
  const [stage, setStage] = useState<Stage>({ kind: 'form' })
  const [age, setAge] = useState<Age | ''>('')
  const [busy, setBusy] = useState(false)
  const [loadingBook, setLoadingBook] = useState(false)
  const [error, setError] = useState<{ text: string; field?: string } | null>(null)
  const [email, setEmail] = useState('')
  const [suggestion, setSuggestion] = useState<string | null>(null)
  const minor = age === 'UNDER_18'
  const topRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (stage.kind === 'form') return
    window.scrollTo({ top: 0 })
    topRef.current?.querySelector<HTMLElement>('h1, h2')?.focus()
  }, [stage])

  const fieldErr = (f: string) => (error?.field === f ? error.text : null)
  const errProps = (f: string, extra?: string) => {
    const bad = error?.field === f
    const ids = [bad ? `${f}-err` : null, extra].filter(Boolean).join(' ')
    return { 'aria-invalid': bad || undefined, 'aria-describedby': ids || undefined }
  }

  async function loadBooking(token: string, first: string) {
    setLoadingBook(true)
    const v = await signupBookingView(token)
    setLoadingBook(false)
    if ('error' in v) setStage({ kind: 'check-email', first })
    else setStage({ kind: 'booking', token, view: v.view })
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!age) { setError({ text: 'Please choose your age.', field: 'ageRange' }); return }
    setBusy(true); setError(null)
    const fd = new FormData(e.currentTarget)
    const r = await submitGetInvolved(props.slug, fd)
    setBusy(false)
    if ('error' in r) {
      setError({ text: r.error, field: r.field })
      // Move to the field with the problem; everything else typed stays filled in.
      if (r.field) document.getElementById(`f-${r.field}`)?.focus()
      return
    }
    if (r.next === 'parent') setStage({ kind: 'parent', first: r.firstName, parentFirst: r.parentFirst })
    else if (r.next === 'check-email') setStage({ kind: 'check-email', first: r.firstName })
    else if (seatChoice === 'waitlist') setStage({ kind: 'waitlisted', token: r.token, first: r.firstName })
    else await loadBooking(r.token, r.firstName)
  }

  const footer = (
    <footer className="pt-2 pb-4 text-sm leading-relaxed text-gray-600">
      {program ? `${program.label} is run by ${inviter.name} through NowTransformed, a youth leadership development program.` : 'NowTransformed is a youth leadership development program.'}
      {mailingAddress && <> {mailingAddress}</>}
    </footer>
  )

  if (stage.kind === 'booking') {
    return (
      <div ref={topRef} className="max-w-xl mx-auto space-y-4">
        <Book token={stage.token} v={stage.view} card={cardCls} variant="signup" />
        {footer}
      </div>
    )
  }
  if (stage.kind !== 'form') {
    return (
      <div ref={topRef} className="max-w-xl mx-auto space-y-4">
        <div className={cardCls}>
          <MailCheck className="h-10 w-10 text-green-700" aria-hidden />
          {stage.kind === 'parent' && (
            <>
              <h1 tabIndex={-1} className={`text-2xl font-bold text-gray-900 rounded ${focusRing}`}>We&apos;ve emailed {stage.parentFirst}</h1>
              <p className="text-gray-700">We&apos;ll let you know when they say yes. Then you both pick a call time, and {stage.parentFirst} joins the call too.</p>
              <p className="text-sm text-gray-600">Ask them to check their spam folder if they don&apos;t see it.</p>
            </>
          )}
          {stage.kind === 'check-email' && (
            <>
              <h1 tabIndex={-1} className={`text-2xl font-bold text-gray-900 rounded ${focusRing}`}>Thanks{stage.first ? `, ${stage.first}` : ''}. Please check your email.</h1>
              <p className="text-gray-700">If you&apos;ve signed up before, we&apos;ve emailed you a link to your call or your next step.</p>
              <p className="text-sm text-gray-600">Don&apos;t see it? Check your spam folder.</p>
            </>
          )}
          {stage.kind === 'waitlisted' && (
            <>
              <h1 tabIndex={-1} className={`text-2xl font-bold text-gray-900 rounded ${focusRing}`}>You&apos;re on the waiting list, {stage.first}</h1>
              <p className="text-gray-700">Sponsored seats open again on {offer?.reopens}. You&apos;ll be among the first to hear.</p>
              {stage.token && (
                <>
                  <p className="text-gray-700">Want to talk sooner? You can book your free call now.</p>
                  <button type="button" className={btn} disabled={loadingBook} onClick={() => loadBooking(stage.token!, stage.first)}>{loadingBook && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Book a call anyway</button>
                </>
              )}
            </>
          )}
        </div>
        {footer}
      </div>
    )
  }

  const formHeading = minor
    ? null
    : seatChoice === 'waitlist' ? 'Join the waiting list'
    : 'Book your free call'
  const toForm = () => setTimeout(() => document.getElementById('f-ageRange')?.focus(), 0)

  return (
    <div className="max-w-xl mx-auto space-y-5">
      {/* Who invited you, in their own words */}
      <section className="space-y-4">
        <div className="flex items-center gap-3.5">
          {inviter.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={inviter.photoUrl} alt={`Photo of ${inviter.name}`} className="w-[72px] h-[72px] rounded-full object-cover border-[3px] border-white ring-1 ring-sky-200 flex-none" />
          ) : (
            <div role="img" aria-label={`Initials of ${inviter.name}`} className="w-[72px] h-[72px] rounded-full bg-sky-100 border-[3px] border-white ring-1 ring-sky-200 flex items-center justify-center text-[22px] font-bold text-sky-800 flex-none">{inviter.initials}</div>
          )}
          <div className="min-w-0">
            <p className="text-sm text-gray-600">Invited by</p>
            <p className="text-lg font-bold text-gray-900">{inviter.name}</p>
            <p className="text-sm text-gray-600">{inviter.roleLabel}</p>
          </div>
        </div>
        {inviter.why && (
          <figure className="rounded-xl border border-gray-200 bg-white px-4 py-3.5">
            <blockquote className="text-base leading-relaxed text-gray-700">&ldquo;{inviter.why}&rdquo;</blockquote>
            <figcaption className="mt-1.5 text-sm text-gray-600">{inviter.first}&apos;s own words</figcaption>
          </figure>
        )}
      </section>

      {/* The program */}
      <section className="space-y-3">
        {program ? (
          <>
            <p className="text-sm font-bold uppercase tracking-wider text-primary-800">{program.label}</p>
            <h1 className="text-[28px] leading-tight font-extrabold text-gray-900">{program.headline ?? program.label}</h1>
            {program.bullets.length > 0 && (
              <ul className="list-disc pl-5 text-base leading-relaxed text-gray-700">
                {program.bullets.map((b) => <li key={b}>{b}</li>)}
              </ul>
            )}
          </>
        ) : (
          <>
            <h1 className="text-[28px] leading-tight font-extrabold text-gray-900">Get Involved</h1>
            <p className="text-base text-gray-700">NowTransformed helps young people and adults grow, lead and build community.</p>
          </>
        )}
      </section>

      {/* Sponsorship (5) or all seats offered (5b A). No seats = no box. Never prices or counts before the call. */}
      {offer && !minor && !seatsFull && (
        <section className="rounded-2xl border-2 border-primary-700 bg-white p-4 space-y-2.5" aria-labelledby="seat-h">
          <h2 id="seat-h" className="text-sm font-bold uppercase tracking-wide text-primary-800">Sponsored seats</h2>
          <p className="text-base leading-relaxed text-gray-900">{SPONSOR_LINE} We&apos;ll talk about it on your free call.</p>
          {offer.reason && <p className="text-base leading-relaxed text-gray-700">{offer.reason}</p>}
        </section>
      )}
      {offer && !minor && seatsFull && (
        <section className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2.5" aria-labelledby="full-h">
          <p className="text-sm font-bold uppercase tracking-wide text-primary-800">Sponsored seats</p>
          <h2 id="full-h" className="text-lg font-bold text-gray-900">Sponsored seats for this month have all been offered</h2>
          <p className="text-base leading-relaxed text-gray-700">
            New ones open on {offer.reopens}. Join the waiting list and you&apos;ll be among the first to hear, or book your free call now.
          </p>
          <div className="grid gap-1">
            <button type="button" aria-pressed={seatChoice === 'waitlist'} className={`${btn} w-full`} onClick={() => { setSeatChoice('waitlist'); toForm() }}>Join the waiting list</button>
            <button type="button" aria-pressed={seatChoice === 'full'} className={`min-h-[44px] font-semibold text-base text-primary-700 underline rounded ${focusRing}`} onClick={() => { setSeatChoice('full'); toForm() }}>Book a free call now</button>
          </div>
        </section>
      )}

      {!minor && (
        <p className="flex items-center gap-2 text-base text-gray-700"><Check className="h-[18px] w-[18px] text-green-700 flex-none" strokeWidth={2.4} aria-hidden />Free 30-minute call first. No obligation.</p>
      )}

      {(
        <form onSubmit={onSubmit} noValidate className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4" aria-labelledby="form-h">
          {/* Honeypot: hidden from people, bots fill it in. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
            <label>Website<input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
          </div>
          {program?.slug && <input type="hidden" name="program" value={program.slug} />}
          {props.via && <input type="hidden" name="via" value={props.via} />}
          {props.inv && <input type="hidden" name="inv" value={props.inv} />}
          {seatChoice === 'waitlist' && !minor && <input type="hidden" name="waitlist" value="on" />}

          {minor ? (
            <div className="space-y-2">
              <h2 id="form-h" className="text-[22px] leading-snug font-extrabold text-gray-900">You&apos;re 17 or under, so a parent or guardian says yes first</h2>
              <p className="text-base leading-relaxed text-gray-700">We&apos;ll email them. Once they agree, you both pick a call time. A parent joins the call too.</p>
            </div>
          ) : (
            <div>
              <h2 id="form-h" className="text-xl font-bold text-gray-900">{formHeading}</h2>
              <p className="mt-1 text-sm text-gray-600">Step 1 of 2 · about 1 minute. Next you pick a call time.</p>
            </div>
          )}

          <fieldset className="min-w-0" {...errProps('ageRange')}>
            <legend className={lbl}>Your age</legend>
            <div className="grid grid-cols-2 gap-2">
              {AGES.map((a) => (
                <label key={a.value} className={`h-12 rounded-[10px] flex items-center gap-2 px-3 text-base cursor-pointer focus-within:ring-2 focus-within:ring-primary-600 focus-within:ring-offset-2 ${age === a.value ? 'border-2 border-primary-700 bg-primary-50 font-semibold' : 'border border-gray-400 bg-white'}`}>
                  <input id={a.value === AGES[0].value ? 'f-ageRange' : undefined} type="radio" name="ageRange" value={a.value} checked={age === a.value} onChange={() => { setAge(a.value); setError(null) }} className="h-5 w-5 accent-primary-700" />
                  {a.label}
                </label>
              ))}
            </div>
            {fieldErr('ageRange') ? <p id="ageRange-err" className="mt-2 text-sm text-red-800">{fieldErr('ageRange')}</p>
              : !minor && <p className="mt-2 text-sm text-gray-600">17 or under: a parent says yes first and joins the call.</p>}
          </fieldset>

          <div>
            <label className={lbl} htmlFor="f-fullName">{minor ? 'Your first and last name' : 'First and last name'}</label>
            <input id="f-fullName" name="fullName" required maxLength={121} autoComplete="name" className={inputCls(!!fieldErr('fullName'))} {...errProps('fullName')} />
            {fieldErr('fullName') && <p id="fullName-err" className="mt-1.5 text-sm text-red-800">{fieldErr('fullName')}</p>}
          </div>

          <div>
            <label className={lbl} htmlFor="f-email">{minor ? 'Your email' : 'Email'}</label>
            <input
              id="f-email" name="email" type="email" required maxLength={200} autoComplete="email" placeholder="name@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setSuggestion(null) }}
              onBlur={() => setSuggestion(suggestEmail(email))}
              className={inputCls(!!fieldErr('email'))}
              {...errProps('email', suggestion ? 'email-hint' : undefined)}
            />
            {fieldErr('email') && <p id="email-err" className="mt-1.5 text-sm text-red-800">{fieldErr('email')}</p>}
            {suggestion && (
              <p id="email-hint" className="mt-1.5 text-sm text-red-800">
                Did you mean {suggestion}?{' '}
                <button type="button" className={`font-bold underline min-h-[44px] rounded ${focusRing}`} onClick={() => { setEmail(suggestion); setSuggestion(null); if (error?.field === 'email') setError(null); document.getElementById('f-email')?.focus() }}>Use this</button>
              </p>
            )}
          </div>

          <div>
            <label className={lbl} htmlFor="f-phone">
              {minor ? 'Your mobile number' : 'Mobile number'}{minor && <span className="font-normal text-gray-600"> (optional)</span>}
            </label>
            <PhoneField id="f-phone" className="h-12 text-base [&_input]:h-12 [&>button]:h-12" />
            {fieldErr('phone') && <p id="phone-err" className="mt-1.5 text-sm text-red-800">{fieldErr('phone')}</p>}
            {smsOn && !minor && (
              <label className="mt-2 flex gap-2.5 items-start text-sm leading-snug text-gray-700">
                <input type="checkbox" name="smsConsent" className="mt-0.5 h-5 w-5 flex-none accent-primary-700" />
                Text me reminders about my call. Reply STOP any time.
              </label>
            )}
          </div>

          {minor && (
            <div className="space-y-4 border-t border-gray-100 pt-4">
              <div>
                <label className={lbl} htmlFor="f-parentName">Parent or guardian&apos;s name</label>
                <input id="f-parentName" name="parentName" required maxLength={120} className={inputCls(!!fieldErr('parentName'))} {...errProps('parentName')} />
                {fieldErr('parentName') && <p id="parentName-err" className="mt-1.5 text-sm text-red-800">{fieldErr('parentName')}</p>}
              </div>
              <div>
                <label className={lbl} htmlFor="f-parentEmail">Their email</label>
                <input id="f-parentEmail" name="parentEmail" type="email" required maxLength={200} placeholder="name@example.com" className={inputCls(!!fieldErr('parentEmail'))} {...errProps('parentEmail')} />
                {fieldErr('parentEmail') && <p id="parentEmail-err" className="mt-1.5 text-sm text-red-800">{fieldErr('parentEmail')}</p>}
              </div>
              <div>
                <label className={lbl} htmlFor="f-parentRelationship">They are my</label>
                <select id="f-parentRelationship" name="parentRelationship" defaultValue="Mother" className={inputCls(false)}>
                  <option>Mother</option><option>Father</option><option>Guardian</option><option>Other</option>
                </select>
              </div>
            </div>
          )}

          {error && !error.field && <p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-[10px] px-3 py-2">{error.text}</p>}
          {error?.field && <p role="alert" className="sr-only">{error.text}</p>}

          <button type="submit" disabled={busy || loadingBook} className={`${btn} w-full h-[52px] text-base`}>
            {(busy || loadingBook) && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {minor ? 'Send to my parent' : seatChoice === 'waitlist' ? 'Join the waiting list' : 'Next: pick a call time'}
          </button>
          {minor ? (
            <p className="text-sm text-gray-600">Under 13? Please ask your parent to fill this in for you.</p>
          ) : (
            <div className="text-sm leading-relaxed text-gray-600">
              <p>We use your details only to set up your call and send reminders about it.</p>
              <Link href="/privacy" className={`-mx-1 -mb-2 inline-flex min-h-[44px] items-center px-1 font-semibold text-primary-700 underline rounded ${focusRing}`}>Read our privacy policy</Link>
            </div>
          )}
        </form>
      )}

      {footer}
    </div>
  )
}
