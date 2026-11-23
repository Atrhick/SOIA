'use client'

import { useState } from 'react'
import { Eye } from 'lucide-react'
import { getImpersonationData } from '@/lib/actions/impersonation'
import { updateSession } from '@/lib/session-update'
import { kit } from '@/components/ui/kit/styles'

/**
 * "View as <first name>": the same impersonation the header menu uses (getImpersonationData re-checks
 * the role on the server, and the session re-checks it again). Then a full load of `/`.
 */
export function ViewAsButton({ userId, role, firstName, showRole }: { userId: string; role: 'COACH' | 'AMBASSADOR'; firstName: string; showRole: boolean }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const go = async () => {
    setBusy(true)
    setError(null)
    const result = await getImpersonationData(userId, role)
    if (!('impersonateData' in result) || !result.impersonateData) {
      setError(('error' in result && result.error) || 'We couldn’t open that account.')
      setBusy(false)
      return
    }
    const s = await updateSession({ impersonate: result.impersonateData })
    if (!s?.user?.isImpersonating) {
      setError('We couldn’t open that account. Please try again.')
      setBusy(false)
      return
    }
    window.location.assign('/')
  }

  return (
    <span className="inline-flex flex-col">
      <button type="button" onClick={go} disabled={busy} className={kit.primary}>
        <Eye className="h-4 w-4" aria-hidden />
        {busy ? 'Opening…' : `View as ${firstName}${showRole ? ` (${role === 'COACH' ? 'coach' : 'ambassador'})` : ''}`}
      </button>
      {error && <span role="alert" className="mt-1 text-sm text-red-700">{error}</span>}
    </span>
  )
}
