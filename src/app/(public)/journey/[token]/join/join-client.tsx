'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, CreditCard, Eye, EyeOff, Loader2, Mail } from 'lucide-react'
import { acceptTermsAndJoin, createMyLogin, startJourneyCheckout } from '@/lib/actions/journey-join'
import { journeyBtn, journeyCard } from '@/components/get-involved/join-shell'

interface Base { firstName: string; inviterName: string | null; roleLabel: string; email: string }

export type JoinView =
  | (Base & {
      kind: 'terms'
      paid: boolean
      minor: boolean
      parentConsent: boolean
      terms: { version: number; body: string; title: string }
      price: { amount: string; billing: string; label: string; online: boolean } | null
    })
  | (Base & { kind: 'payment'; amount: string; billing: string; termsVersion: number | null; acceptedAt: string | null; online: boolean; failed: boolean; notice: 'paid' | 'cancelled' | null })
  | (Base & { kind: 'login'; paymentReceived: boolean })
  | (Base & { kind: 'coach'; passwordSaved: boolean; paymentReceived: boolean })

const asA = (label: string) => `${/^[aeiou]/i.test(label) ? 'an' : 'a'} ${label}`
const PW_HINT = 'At least 8 characters, with an upper-case letter, a lower-case letter and a number.'

export function JoinClient({ token, view }: { token: string; view: JoinView }) {
  if (view.kind === 'payment') return <Payment token={token} v={view} />
  if (view.kind === 'login') return <Login token={token} v={view} />
  if (view.kind === 'coach') return <CoachMatch v={view} />
  return <Terms token={token} v={view} />
}

/** Terms accepted, login waiting for an admin to place an ambassador with a coach. */
function CoachMatch({ v }: { v: Extract<JoinView, { kind: 'coach' }> }) {
  return (
    <div className={journeyCard}>
      <InvitedBy name={v.inviterName} />
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900">We&apos;re matching you with a coach</h1>
      {v.paymentReceived && (
        <p className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
          <Check className="h-4 w-4 flex-none" aria-hidden /> Payment received. Thank you!
        </p>
      )}
      <p role="status" className="flex items-start gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
        <Check className="h-4 w-4 mt-0.5 flex-none" aria-hidden />
        <span>Thanks, {v.firstName}. You&apos;ve accepted the {v.roleLabel} terms{v.passwordSaved ? ' and your password is saved' : ''}.</span>
      </p>
      <div className="flex gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sky-900">
        <Mail className="h-5 w-5 flex-none mt-0.5" aria-hidden />
        <div className="min-w-0">
          <p className="font-semibold">One more thing on our side</p>
          <p className="text-sm mt-1 break-words">
            Every ambassador is placed with a coach. Our team is choosing yours now and will email <strong className="break-all">{v.email}</strong> as soon as your login is ready
            {v.passwordSaved ? ', so you can sign in with the password you just chose.' : ', with a link to set your password.'}
          </p>
        </div>
      </div>
      <p className="text-sm text-gray-600">There&apos;s nothing else to do for now. You can come back to this link at any time to see where things stand.</p>
    </div>
  )
}

function InvitedBy({ name }: { name: string | null }) {
  if (!name) return null
  return <p className="text-sm text-gray-600">Invited by <strong className="text-gray-900">{name}</strong></p>
}

function Terms({ token, v }: { token: string; v: Extract<JoinView, { kind: 'terms' }> }) {
  const router = useRouter()
  const [accept, setAccept] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fe, setFe] = useState<{ accept?: string; password?: string }>({})

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const local: typeof fe = {}
    if (!accept) local.accept = `Please tick the box to accept the ${v.roleLabel} terms.`
    if (!password) local.password = 'Please create a password.'
    if (local.accept || local.password) { setFe(local); setError('Please fix the highlighted fields.'); return }
    setBusy(true); setError(null); setFe({})
    try {
      const r = await acceptTermsAndJoin(token, { accept, password, termsVersion: v.terms.version })
      if (!r.ok) { setError(r.error); setFe(r.fieldErrors ?? {}); setBusy(false); router.refresh(); return }
      if (r.next === 'welcome') router.push(`/journey/${token}/welcome`)
      else { router.refresh(); setBusy(false) }
    } catch {
      setError('Something went wrong. Please try again.')
      setBusy(false)
    }
  }

  return (
    <form className={journeyCard} onSubmit={submit} noValidate>
      <InvitedBy name={v.inviterName} />
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Join as {asA(v.roleLabel)}</h1>
      <p className="text-gray-700">
        {v.paid
          ? `Read and accept the ${v.terms.title.toLowerCase()} and choose a password. ${v.price?.online ? 'Then pay online and we\'ll create your login.' : 'Then we\'ll arrange payment and create your login.'}`
          : `There's no fee for this role. Read and accept the ${v.terms.title.toLowerCase()}, then we'll create your login.`}
      </p>
      {v.minor && v.parentConsent && (
        <p className="inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-3 py-1 text-sm font-semibold text-green-800">
          <Check className="h-4 w-4" aria-hidden /> Parent consent received
        </p>
      )}

      <section aria-labelledby="terms-title" className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h2 id="terms-title" className="font-bold text-gray-900">{v.terms.title}</h2>
          {v.terms.version > 0 && <span className="text-xs text-gray-500">Version {v.terms.version}</span>}
        </div>
        <div tabIndex={0} role="region" aria-labelledby="terms-title"
          className="max-h-72 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm leading-relaxed text-gray-700 whitespace-pre-line break-words focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600">
          {v.terms.body}
        </div>
      </section>

      <div>
        <label className="flex gap-2.5 items-start text-sm text-gray-800 cursor-pointer">
          <input type="checkbox" checked={accept} onChange={(e) => { setAccept(e.target.checked); setFe((f) => ({ ...f, accept: undefined })) }}
            aria-invalid={!!fe.accept} aria-describedby={fe.accept ? 'accept-error' : undefined}
            className="mt-0.5 h-[18px] w-[18px] flex-none accent-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600" />
          <span>I&apos;ve read and accept the {v.terms.title}.</span>
        </label>
        {fe.accept && <p id="accept-error" className="mt-1.5 text-sm text-red-700">{fe.accept}</p>}
      </div>

      {v.price && (
        <section aria-labelledby="pay-title" className="rounded-xl border border-gray-200 p-4 space-y-2">
          <h2 id="pay-title" className="font-bold text-gray-900">Payment</h2>
          <div className="flex items-baseline justify-between gap-3 border-b border-gray-100 pb-2">
            <span className="text-sm text-gray-700">{v.roleLabel} fee · {v.price.billing}</span>
            <span className="text-2xl font-bold text-gray-900">{v.price.amount}</span>
          </div>
          <p className="text-sm text-gray-600">
            {v.price.online
              ? 'After you accept, you can pay securely by card on the next screen. Your login is created as soon as the payment goes through.'
              : 'Online payment isn\'t available for this role yet. After you accept, our team will contact you about payment. Your login is created as soon as it\'s recorded.'}
          </p>
        </section>
      )}

      <input type="text" name="username" autoComplete="username" value={v.email} readOnly hidden />
      <PasswordField value={password} onChange={(s) => { setPassword(s); setFe((f) => ({ ...f, password: undefined })) }} error={fe.password} />

      {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
      <button type="submit" className={`${journeyBtn} w-full`} disabled={busy}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {v.paid ? 'Accept and continue' : 'Create my login'}
      </button>
    </form>
  )
}

function PasswordField({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label htmlFor="new-password" className="block text-sm font-semibold text-gray-700 mb-1.5">Create a password</label>
      <div className="relative">
        <input id="new-password" name="password" type={show ? 'text' : 'password'} autoComplete="new-password" required value={value}
          onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} aria-describedby={`pw-hint${error ? ' pw-error' : ''}`}
          className={`w-full h-12 rounded-lg border px-3 pr-12 focus:outline-none focus:ring-2 focus:ring-primary-600 ${error ? 'border-red-500' : 'border-gray-300'}`} />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}
          className="absolute right-1 top-1 h-10 w-10 inline-flex items-center justify-center rounded-md text-gray-500 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600">
          {show ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
        </button>
      </div>
      <p id="pw-hint" className="mt-1.5 text-xs text-gray-500">{PW_HINT}</p>
      {error && <p id="pw-error" className="mt-1 text-sm text-red-700">{error}</p>}
    </div>
  )
}

/** How long the "we're setting up your login" screen keeps checking before suggesting email instead. */
const PAID_POLL_MS = 4000
const PAID_POLL_MAX = 30

function Payment({ token, v }: { token: string; v: Extract<JoinView, { kind: 'payment' }> }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [polls, setPolls] = useState(0)
  const waiting = v.notice === 'paid'
  const when = v.acceptedAt ? new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(v.acceptedAt)) : null

  // Back from the payment page: the webhook does the work; refresh until the login exists
  // (the server page then shows "Payment received" with the welcome link).
  useEffect(() => {
    if (!waiting || polls >= PAID_POLL_MAX) return
    const id = setTimeout(() => { setPolls((n) => n + 1); router.refresh() }, PAID_POLL_MS)
    return () => clearTimeout(id)
  }, [waiting, polls, router])

  async function pay() {
    setBusy(true); setError(null)
    try {
      const r = await startJourneyCheckout(token)
      if (r.ok) { window.location.assign(r.url); return }
      setError(r.error)
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setBusy(false)
  }

  if (waiting) {
    return (
      <div className={journeyCard}>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Payment received</h1>
        <p role="status" aria-live="polite" className="flex items-start gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
          {polls < PAID_POLL_MAX
            ? <><Loader2 className="h-4 w-4 mt-0.5 flex-none animate-spin" aria-hidden /><span>Thank you, {v.firstName}. We&apos;re setting up your login. This page updates by itself.</span></>
            : <><Check className="h-4 w-4 mt-0.5 flex-none" aria-hidden /><span>Thank you, {v.firstName}. This is taking longer than usual. We&apos;ll email <strong className="break-all">{v.email}</strong> as soon as your login is ready.</span></>}
        </p>
        <p className="text-sm text-gray-600">You can close this page. Your Join link will show where things stand.</p>
      </div>
    )
  }

  return (
    <div className={journeyCard}>
      <InvitedBy name={v.inviterName} />
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Thanks, {v.firstName}</h1>
      <p role="status" className="flex items-start gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
        <Check className="h-4 w-4 mt-0.5 flex-none" aria-hidden />
        <span>You accepted the {v.roleLabel} agreement{v.termsVersion ? ` (version ${v.termsVersion})` : ''}{when ? ` on ${when}` : ''}.</span>
      </p>
      {v.notice === 'cancelled' && v.online && (
        <p className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-700">Payment was cancelled, and nothing was charged. You can try again whenever you&apos;re ready.</p>
      )}
      <section aria-labelledby="pay-title" className="rounded-xl border border-gray-200 p-4 space-y-3">
        <h2 id="pay-title" className="font-bold text-gray-900">Payment</h2>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-gray-700">{v.roleLabel} fee · {v.billing}</span>
          <span className="text-2xl font-bold text-gray-900">{v.amount}</span>
        </div>
        {v.failed && <p role="alert" className="text-sm text-red-700">Your last payment didn&apos;t go through. Our team will be in touch.</p>}
        {v.online ? (
          <div className="space-y-2">
            {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            <button type="button" onClick={pay} disabled={busy} className={`${journeyBtn} w-full`}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CreditCard className="h-4 w-4" aria-hidden />}
              Pay {v.amount} and create my login
            </button>
            <p className="text-xs text-gray-500">You&apos;ll pay by card on our payment partner&apos;s secure page, then come back here.</p>
          </div>
        ) : (
          <div className="flex gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sky-900">
            <Mail className="h-5 w-5 flex-none mt-0.5" aria-hidden />
            <div className="min-w-0">
              <p className="font-semibold">We&apos;ll contact you about payment</p>
              <p className="text-sm mt-1 break-words">Someone from our team will reach out to <strong>{v.email}</strong> within 2 business days. As soon as your payment is recorded, we&apos;ll create your login with the password you chose and email you how to sign in.</p>
            </div>
          </div>
        )}
      </section>
      {!v.online && <p className="text-sm text-gray-600">There&apos;s nothing else to do for now. You can come back to this link at any time to see where things stand.</p>}
    </div>
  )
}

function Login({ token, v }: { token: string; v: Extract<JoinView, { kind: 'login' }> }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pwError, setPwError] = useState<string | undefined>()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!password) { setPwError('Please create a password.'); setError('Please fix the highlighted field.'); return }
    setBusy(true); setError(null); setPwError(undefined)
    try {
      const r = await createMyLogin(token, { password })
      if (!r.ok) { setError(r.error); setPwError(r.fieldErrors?.password); setBusy(false); return }
      if (r.next === 'coach') { router.refresh(); setBusy(false); return }
      router.push(`/journey/${token}/welcome`)
    } catch {
      setError('Something went wrong. Please try again.')
      setBusy(false)
    }
  }

  return (
    <form className={journeyCard} onSubmit={submit} noValidate>
      <InvitedBy name={v.inviterName} />
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Create your login</h1>
      {v.paymentReceived && (
        <p role="status" className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
          <Check className="h-4 w-4 flex-none" aria-hidden /> Payment received. Thank you!
        </p>
      )}
      <p className="text-gray-700">You&apos;ve accepted the {v.roleLabel} terms. Choose a password to finish. You&apos;ll sign in with <strong className="break-all">{v.email}</strong>.</p>
      <input type="text" name="username" autoComplete="username" value={v.email} readOnly hidden />
      <PasswordField value={password} onChange={(s) => { setPassword(s); setPwError(undefined) }} error={pwError} />
      {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
      <button type="submit" className={`${journeyBtn} w-full`} disabled={busy}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Create my login
      </button>
    </form>
  )
}
