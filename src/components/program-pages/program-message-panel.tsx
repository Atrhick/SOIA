'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, MessageSquareText } from 'lucide-react'
import { kit } from '@/components/ui/kit/styles'
import { useToast } from '@/components/ui/kit/toast'
import { saveProgramMessageInfo, type ProgramMessageInfo } from '@/lib/actions/program-message-info'
import { BUSINESS_NAME_MAX, MESSAGE_LINE_EXAMPLE, MESSAGE_LINE_MAX, messagePreview } from './message-preview'
import { SaveRule } from './save-rule'

/** "How your program appears in messages": business name + one line, used by One-A-Day messages at once. */
export function ProgramMessagePanel({ info }: { info: ProgramMessageInfo }) {
  const router = useRouter()
  const toast = useToast()
  const [businessName, setBusinessName] = useState(info.businessName)
  const [messageLine, setMessageLine] = useState(info.messageLine)
  const [busy, setBusy] = useState(false)
  const ro = info.readOnly
  const preview = messagePreview({ businessName, programName: info.programName, messageLine })

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const r = await saveProgramMessageInfo({ programId: info.programId, businessName, messageLine })
      if (!r.ok) { toast.error(r.error); return }
      toast.success('Saved. Your messages use it now.')
      router.refresh()
    } catch {
      toast.error('That didn’t save. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="msg-info-h" className={kit.card}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-primary-50 text-primary-700"><MessageSquareText className="h-5 w-5" aria-hidden /></span>
        <div className="min-w-0">
          <h2 id="msg-info-h" className="text-lg font-bold text-gray-900">How your program appears in messages</h2>
          <p className="text-base text-gray-700">The invitation messages you and your team send name your business, then this program.</p>
        </div>
      </div>

      <form onSubmit={save} className="mt-4 space-y-4">
        <div>
          <label htmlFor="mi-business" className={kit.label}>Business name</label>
          <input id="mi-business" className={kit.input} value={businessName} maxLength={BUSINESS_NAME_MAX} readOnly={ro}
            onChange={(e) => setBusinessName(e.target.value)} placeholder={info.organization || 'DreamIt LiveIt'} aria-describedby="mi-business-hint" />
          <p id="mi-business-hint" className={kit.hint}>Messages say &quot;I run [business], and one of our programs is [program]&quot;. Leave empty to use the program name.</p>
        </div>
        <div>
          <label htmlFor="mi-line" className={kit.label}>One line about the program</label>
          <textarea id="mi-line" rows={2} className={kit.textarea} value={messageLine} maxLength={MESSAGE_LINE_MAX} readOnly={ro}
            onChange={(e) => setMessageLine(e.target.value)} placeholder={MESSAGE_LINE_EXAMPLE} aria-describedby="mi-line-hint" />
          <p id="mi-line-hint" className={kit.hint}>
            Who it helps and what they get, starting with &quot;a&quot; or &quot;an&quot;. For example: &quot;{MESSAGE_LINE_EXAMPLE}&quot;. {MESSAGE_LINE_MAX - messageLine.length} characters left.
          </p>
        </div>
        <figure className="rounded-xl border border-sky-200 bg-sky-50 p-4">
          <figcaption className="text-sm font-semibold text-sky-900">How it reads in a message</figcaption>
          <p className="mt-1 text-base text-gray-900 break-words" aria-live="polite">&ldquo;{preview}&rdquo;</p>
        </figure>
        {!ro && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button type="submit" className={`${kit.primary} w-full sm:w-auto`} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Save
            </button>
            <SaveRule live />
          </div>
        )}
      </form>
    </section>
  )
}
