'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { submitGetInvolved } from '@/lib/actions/get-involved'
import { IntakeFields } from '@/components/get-involved/intake-fields'

export function JoinForm({ slug, inviterName, inviterFirst }: { slug: string; inviterName: string; inviterFirst: string }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ minor: boolean; first: string } | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    const result = await submitGetInvolved(slug, fd)
    setSubmitting(false)
    if ('error' in result) setError(result.error)
    else setDone({ minor: fd.get('ageRange') === 'UNDER_18', first: String(fd.get('firstName') ?? '') })
  }

  if (done) {
    return (
      <div className="max-w-xl mx-auto bg-white border border-gray-200 rounded-2xl p-8 space-y-4" role="status">
        <CheckCircle2 className="h-10 w-10 text-green-600" aria-hidden />
        <h1 className="text-2xl font-bold text-gray-900">Thanks{done.first ? `, ${done.first}` : ''}. Check your email.</h1>
        {done.minor ? (
          <p className="text-gray-700">We&apos;ve emailed your parent or guardian. Once they say yes, you&apos;ll get a link to book your discovery call. Your parent will need to be on the call with you.</p>
        ) : (
          <p className="text-gray-700">We just sent you more about the ways people get involved with NowTransformed, and a link to book a free 30-minute discovery call. {inviterFirst} will be glad you signed up.</p>
        )}
        <p className="text-sm text-gray-500">Don&apos;t see it? Check your spam folder.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_1.3fr] items-start">
      <div className="space-y-4">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Get Involved</h1>
        <p className="text-lg text-gray-700"><strong>{inviterName}</strong> invited you to learn how NowTransformed helps young people and adults grow, lead and build community.</p>
        <div className="space-y-3 pt-2">
          <p className="text-xs font-bold uppercase tracking-wide text-primary-700">What happens next</p>
          {['We email you more about the program.', 'You book a free 30-minute discovery call.', "Together we find the way you'd like to get involved."].map((t, i) => (
            <div key={t} className="flex gap-3 text-gray-700">
              <span className="flex-none w-7 h-7 rounded-full bg-primary-50 text-primary-700 text-sm font-bold flex items-center justify-center">{i + 1}</span>
              {t}
            </div>
          ))}
        </div>
      </div>
      <form onSubmit={onSubmit} className="bg-white border border-gray-200 rounded-2xl p-6 md:p-7 space-y-5" noValidate>
        <IntakeFields />
        {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        <button type="submit" disabled={submitting} className="w-full h-12 rounded-xl bg-primary-700 hover:bg-primary-800 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
          {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Send my info
        </button>
      </form>
    </div>
  )
}
