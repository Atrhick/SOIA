'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, Loader2, Mail, Pencil, Sparkles } from 'lucide-react'
import { draftWelcomeNote, saveWelcomeNote, stopWelcomeNote, type WelcomePanelData } from '@/lib/actions/program-welcome'
import { SAMPLE_WELCOME_NOTE, WELCOME_NOTE_MAX, cleanWelcomeNote, companyFor, exampleWelcomeNote, welcomeCallParts } from '@/lib/get-involved/program-welcome'
import { EDIT_NAMES_EVENT } from './events'

const btn = 'h-10 px-4 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2'
const day = (iso: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso))

/**
 * "Welcome email" on a program page: the person sees the full email new sign-ups get, edits the one
 * paragraph about the program (or drafts it with AI), and clicks "Use this email" to turn it on.
 */
export function WelcomeEmailPanel({ data }: { data: WelcomePanelData }) {
  const router = useRouter()
  const [note, setNote] = useState(data.note)
  const [aiDraft, setAiDraft] = useState<string | undefined>(undefined)
  const [busy, setBusy] = useState<'ai' | 'save' | 'use' | 'stop' | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const approved = !!data.approvedAt
  const changed = cleanWelcomeNote(note) !== cleanWelcomeNote(data.note)
  const inUse = approved && !changed
  const ro = data.readOnly
  const company = companyFor(data.programName, data.companyName)
  const example = exampleWelcomeNote(data.programName, data.companyName)
  const [copied, setCopied] = useState(false)

  async function copyExample() {
    try { await navigator.clipboard.writeText(example); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* the text is on screen to select */ }
  }
  function startFromExample() {
    if (note.trim() && !window.confirm('Replace your paragraph with the example?')) return
    setNote(example)
    setMsg({ ok: true, text: 'Example added. Replace each part in [brackets] with your own words, then save.' })
  }

  const preview = useMemo(
    () => welcomeCallParts({ firstName: 'Jordan', inviterName: data.ownerName ?? 'Your name', programName: data.programName, companyName: data.companyName, note: note || '(Your paragraph about the program goes here.)' }),
    [note, data.ownerName, data.programName, data.companyName],
  )

  async function ai() {
    setBusy('ai'); setMsg(null)
    const r = await draftWelcomeNote(data.programId)
    setBusy(null)
    if ('error' in r) { setMsg({ ok: false, text: r.error }); return }
    setNote(r.note); setAiDraft(r.note)
    setMsg({ ok: true, text: 'Here is a draft from your program page. Read it, change anything you like, then save.' })
  }
  async function save(approve: boolean) {
    setBusy(approve ? 'use' : 'save'); setMsg(null)
    const r = await saveWelcomeNote(data.programId, { note, approve, aiDraft })
    setBusy(null)
    if ('error' in r) { setMsg({ ok: false, text: r.error }); return }
    setMsg({ ok: true, text: r.message }); router.refresh()
  }
  async function stop() {
    setBusy('stop'); setMsg(null)
    const r = await stopWelcomeNote(data.programId)
    setBusy(null)
    if ('error' in r) { setMsg({ ok: false, text: r.error }); return }
    setMsg({ ok: true, text: 'Stopped. New sign-ups get the standard welcome email.' }); router.refresh()
  }

  return (
    <section aria-labelledby="welcome-email-h" className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="welcome-email-h" className="font-bold text-gray-900 flex items-center gap-2"><Mail className="h-5 w-5 text-primary-700" aria-hidden />Welcome email</h2>
          <p className="text-sm text-gray-600 mt-1">What people get when they fill out the Get Involved form from your share link for this program. You write one paragraph about the program; the rest stays the same for everyone.</p>
        </div>
        <span className={`text-xs font-semibold rounded-full px-3 py-1.5 ${inUse ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
          {inUse ? `In use since ${day(data.approvedAt!)}` : approved ? 'Unsaved changes' : 'Not in use yet'}
        </span>
      </div>
      {!data.live && <p className="text-sm text-gray-700 rounded-lg bg-gray-50 border border-gray-200 p-3">This program page isn&apos;t live yet. You can prepare the email now; it is used once the page is published and you&apos;ve clicked &quot;Use this email&quot;.</p>}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
        <dl className="flex flex-wrap gap-x-8 gap-y-1 text-sm min-w-0">
          <div className="min-w-0"><dt className="text-xs text-gray-500">Program name</dt><dd className="font-semibold text-gray-900 break-words">{data.programName}</dd></div>
          <div className="min-w-0"><dt className="text-xs text-gray-500">Company</dt><dd className="font-semibold text-gray-900 break-words">{company ?? <span className="font-normal text-amber-800">Not set</span>}</dd></div>
        </dl>
        {!ro && (
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent(EDIT_NAMES_EVENT))} className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 hover:text-primary-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 rounded">
            <Pencil className="h-4 w-4" aria-hidden />Change names
          </button>
        )}
        <p className="basis-full text-xs text-gray-600">The email uses both names. Change them at the top of this page; new emails use them as soon as you save.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2 items-start">
        <div className="space-y-3 min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <label htmlFor={`wn-${data.programId}`} className="block text-sm font-semibold text-gray-800">Your paragraph about {data.programName}</label>
            <span className={`text-xs ${note.length > WELCOME_NOTE_MAX ? 'text-red-700 font-semibold' : 'text-gray-500'}`}>{note.length}/{WELCOME_NOTE_MAX}</span>
          </div>
          <textarea
            id={`wn-${data.programId}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            readOnly={ro}
            rows={7}
            maxLength={WELCOME_NOTE_MAX + 200}
            aria-describedby={`wn-help-${data.programId}`}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm leading-relaxed"
            placeholder="2–3 sentences on what people get from the program. For example: who it's for, what they'll learn or do, and how it helps them."
          />
          <p id={`wn-help-${data.programId}`} className="text-xs text-gray-600">
            Keep it to 2–3 sentences, in plain words, and only promise what the program really offers. No links: the email has the booking button.
            {data.source === 'AI' && !changed && ' This text was drafted by AI from your program page.'}
          </p>
          <div className="rounded-lg border border-dashed border-primary-300 bg-primary-50/40 p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary-800">Example to copy and change</p>
              {!ro && (
                <div className="flex gap-2">
                  <button type="button" onClick={copyExample} className="h-8 px-3 rounded-md border border-gray-300 bg-white text-xs font-semibold text-gray-800 inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600">
                    {copied ? <Check className="h-3.5 w-3.5 text-green-600" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}{copied ? 'Copied' : 'Copy'}
                  </button>
                  <button type="button" onClick={startFromExample} className="h-8 px-3 rounded-md bg-primary-700 hover:bg-primary-800 text-xs font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-1">Use this example</button>
                </div>
              )}
            </div>
            <p className="text-sm text-gray-800 leading-relaxed">{example}</p>
            <p className="text-xs text-gray-600">Replace each part in [brackets]. A finished one reads like this: <em>{SAMPLE_WELCOME_NOTE}</em></p>
          </div>
          {!ro && (
            <div className="flex flex-wrap gap-2">
              {data.aiAvailable && (
                <button type="button" onClick={ai} disabled={busy !== null} className={`${btn} border border-primary-300 text-primary-800 bg-white`}>
                  {busy === 'ai' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}{note ? 'Redraft with AI' : 'Draft with AI'}
                </button>
              )}
              <button type="button" onClick={() => save(false)} disabled={busy !== null || !note.trim()} className={`${btn} border border-gray-300 text-gray-800 bg-white`}>{busy === 'save' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Save draft</button>
              <button type="button" onClick={() => save(true)} disabled={busy !== null || !note.trim() || inUse} className={`${btn} bg-primary-700 hover:bg-primary-800 text-white`}>{busy === 'use' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Use this email</button>
              {approved && <button type="button" onClick={stop} disabled={busy !== null} className={`${btn} border border-red-300 text-red-700 bg-white`}>{busy === 'stop' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Stop using</button>}
            </div>
          )}
          {!data.aiAvailable && !ro && <p className="text-xs text-gray-500">AI drafting isn&apos;t switched on yet, so write the paragraph yourself for now.</p>}
          {msg && <p role={msg.ok ? 'status' : 'alert'} className={`text-sm rounded-lg px-3 py-2 ${msg.ok ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg.text}</p>}
        </div>

        <figure className="min-w-0 rounded-xl border border-gray-200 bg-gray-50 p-4" aria-label="Sample email">
          <figcaption className="text-xs font-semibold uppercase tracking-wide text-gray-500">Sample, as Jordan would get it</figcaption>
          <p className="mt-2 text-sm text-gray-600"><span className="font-semibold text-gray-800">Subject:</span> {preview.subject}</p>
          <div className="mt-3 rounded-lg bg-white border border-gray-200 p-4 space-y-3 text-sm text-gray-800 leading-relaxed">
            {preview.paragraphs.map((para, i) => (
              <p key={i} className={i === 1 ? 'rounded bg-primary-50 ring-1 ring-primary-200 px-2 py-1' : undefined}>
                {para.map((s, j) => (s.bold ? <strong key={j}>{s.text}</strong> : <span key={j}>{s.text}</span>))}
              </p>
            ))}
            <span className="inline-flex h-10 items-center rounded-lg bg-primary-700 px-4 text-sm font-semibold text-white" aria-hidden>{preview.cta}</span>
          </div>
          <p className="mt-2 text-xs text-gray-500">The highlighted paragraph is yours. For 17 and under, the parent&apos;s consent email includes it too.</p>
        </figure>
      </div>
    </section>
  )
}
