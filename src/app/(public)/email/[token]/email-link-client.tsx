'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { runEmailLink } from '@/lib/actions/email-links'

export function EmailLinkClient(props: {
  token: string
  title: string
  lines: string[]
  button: string
  danger?: boolean
  secondary?: { label: string; href: string } | null
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function go() {
    setBusy(true); setError(null)
    const r = await runEmailLink(props.token)
    setBusy(false)
    if ('error' in r) setError(r.error)
    else setDone(r.message)
  }

  if (done) {
    return (
      <div className="max-w-lg mx-auto bg-white border border-gray-200 rounded-2xl p-8 text-center">
        <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto" aria-hidden />
        <h1 className="mt-3 text-2xl font-bold text-gray-900">Done</h1>
        <p className="mt-3 text-gray-600" role="status">{done}</p>
      </div>
    )
  }

  const primary = props.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-primary-700 hover:bg-primary-800'
  return (
    <div className="max-w-lg mx-auto bg-white border border-gray-200 rounded-2xl p-8 text-center">
      <h1 className="text-2xl font-bold text-gray-900">{props.title}</h1>
      <div className="mt-3 space-y-3 text-gray-600">
        {props.lines.map((l) => <p key={l}>{l}</p>)}
      </div>
      {error && <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
        <button type="button" onClick={go} disabled={busy} className={`inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg text-white font-semibold disabled:opacity-60 ${primary}`}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{props.button}
        </button>
        {props.secondary && (
          <Link href={props.secondary.href} className="inline-flex items-center justify-center h-11 px-5 rounded-lg border border-gray-300 text-gray-900 font-semibold hover:bg-gray-50">
            {props.secondary.label}
          </Link>
        )}
      </div>
    </div>
  )
}
