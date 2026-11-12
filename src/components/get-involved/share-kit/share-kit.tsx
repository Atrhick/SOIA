'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, ExternalLink, Loader2, Lock } from 'lucide-react'
import { recordShare } from '@/lib/actions/outreach-share'
import {
  FIRST_KEYS, PERSONAL_MARKER, disclosureLine, joinMessage, needsPersonalLine, renderTemplate, shareLinkFor, splitAtPersonalLine, viaParam,
  type ShareChannel, type TemplateKey, type TemplateText,
} from '@/lib/get-involved/outreach-templates'
import type { ShareKitProgram } from './data'

export type KitTab = ShareChannel | 'AFTER_YES'
const TABS: { key: KitTab; label: string; short: string }[] = [
  { key: 'TEXT', label: 'Text', short: 'Text' },
  { key: 'WHATSAPP', label: 'WhatsApp', short: 'WhatsApp' },
  { key: 'EMAIL', label: 'Email', short: 'Email' },
  { key: 'DM', label: 'DM', short: 'DM' },
  { key: 'POST', label: 'Social post', short: 'Post' },
  { key: 'PARENT', label: 'To a parent', short: 'To a parent' },
  { key: 'AFTER_YES', label: 'After a yes', short: 'After a yes' },
]
const CHANNEL_NAME: Record<ShareChannel, string> = { TEXT: 'Text', WHATSAPP: 'WhatsApp', EMAIL: 'Email', DM: 'DM', POST: 'Social post', PARENT: 'Text to a parent' }

function tipFor(tab: KitTab, who: string): string {
  const n = who || 'they'
  switch (tab) {
    case 'TEXT': return `Send the link only after ${n} says yes. Copy the "After a yes" message then.`
    case 'WHATSAPP': return 'Only to people who have your number saved and know you.'
    case 'EMAIL': return 'Keep it under about 120 words. One question, no link yet.'
    case 'DM': return 'Shorter is better in DMs. Under 400 characters.'
    case 'POST': return 'Posts can include the link. The seat number is the real one left this month.'
    case 'PARENT': return 'For anyone under 18, message the parent, never the teen.'
    case 'AFTER_YES': return 'Send within a few hours of the yes. The link carries the channel of your first message.'
  }
}

function openHref(channel: ShareChannel, text: string, subject: string | null): { href: string; label: string } | null {
  const t = encodeURIComponent(text)
  switch (channel) {
    case 'TEXT':
    case 'PARENT': return { href: `sms:?&body=${t}`, label: 'Open in Messages' }
    case 'WHATSAPP': return { href: `https://wa.me/?text=${t}`, label: 'Open WhatsApp' }
    case 'EMAIL': return { href: `mailto:?subject=${encodeURIComponent(subject ?? '')}&body=${t}`, label: 'Open in my email' }
    default: return null // DM and posts: copy and paste into the app
  }
}

const focusRing = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2'

export interface ShareKitProps {
  role: 'COACH' | 'AMBASSADOR'
  programs: ShareKitProgram[]
  defaultProgram: number
  templates: Record<TemplateKey, TemplateText>
}

export function ShareKit({ role, programs, defaultProgram, templates }: ShareKitProps) {
  const router = useRouter()
  const [who, setWho] = useState('')
  const [pIdx, setPIdx] = useState(defaultProgram)
  const [tab, setTab] = useState<KitTab>('TEXT')
  const [firstChannel, setFirstChannel] = useState<ShareChannel>('TEXT')
  const [personal, setPersonal] = useState('')
  const [custom, setCustom] = useState<{ subject: string; before: string; after: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const program = programs[pIdx] ?? programs[programs.length - 1]
  const linkChannel: ShareChannel = tab === 'AFTER_YES' ? firstChannel : tab
  const link = shareLinkFor(program.url, linkChannel)
  const tpl = templates[tab]
  const fill = { firstName: who.trim() || (tab === 'PARENT' ? '[parent name]' : '[name]'), personalLine: PERSONAL_MARKER, program: program.name, description: program.description, link, seatsLeft: program.seats?.left ?? null }

  const generated = {
    parts: splitAtPersonalLine(renderTemplate(tpl.body, tab, fill)),
    subject: tpl.subject ? renderTemplate(tpl.subject, tab, { ...fill, personalLine: '' }) : '',
  }

  // Switching channel or program starts from the template again.
  useEffect(() => { setCustom(null) }, [tab, pIdx])

  const parts = custom ? { ...generated.parts, before: custom.before, after: custom.after } : generated.parts
  const subject = custom ? custom.subject : generated.subject
  const disclosure = tab === 'AFTER_YES' ? null : disclosureLine(role, program.owns)
  const finalText = joinMessage(parts, personal, disclosure)
  const personalRequired = needsPersonalLine(tab)
  const nameRequired = tab !== 'POST'
  const blocker = nameRequired && !who.trim() ? 'Add their first name first.' : personalRequired && !personal.trim() ? 'Add your personal line first.' : null
  const open = openHref(linkChannel, finalText, tab === 'EMAIL' ? subject : linkChannel === 'EMAIL' ? `${who.trim() ? `${who.trim()}, here` : 'Here'} is the link` : null)

  function edit(field: 'before' | 'after' | 'subject', value: string) {
    setCustom({ subject, before: parts.before, after: parts.after, [field]: value })
  }

  async function copy(): Promise<boolean> {
    if (blocker) { setMsg({ ok: false, text: blocker }); return false }
    try {
      await navigator.clipboard.writeText(finalText)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
      return true
    } catch {
      setMsg({ ok: false, text: 'Your browser blocked copying. Select the message and copy it by hand.' })
      return false
    }
  }
  async function copyAndOpen() {
    if (!(await copy())) return
    if (open) window.location.href = open.href
  }
  async function markSent() {
    if (blocker) { setMsg({ ok: false, text: blocker }); return }
    setBusy(true); setMsg(null)
    const channel: ShareChannel = tab === 'AFTER_YES' ? firstChannel : tab
    const r = await recordShare({ kind: tab === 'AFTER_YES' ? 'AFTER_YES' : 'FIRST', channel, firstName: tab === 'POST' ? null : who.trim(), programId: program.id })
    setBusy(false)
    if (!r.ok) { setMsg({ ok: false, text: r.error }); return }
    const name = who.trim()
    setMsg({
      ok: true,
      text: tab === 'POST' ? 'Logged your post. It keeps your streak.' : tab === 'AFTER_YES' ? `Logged. ${name} counts as a yes in My results.` : `Logged. ${name} is on your follow-up list for day 3.`,
    })
    if (tab !== 'AFTER_YES') setFirstChannel(channel)
    setWho(''); setPersonal(''); setCustom(null)
    router.refresh()
  }

  function onTabKey(e: React.KeyboardEvent, i: number) {
    let n = -1
    if (e.key === 'ArrowRight') n = (i + 1) % TABS.length
    else if (e.key === 'ArrowLeft') n = (i - 1 + TABS.length) % TABS.length
    else if (e.key === 'Home') n = 0
    else if (e.key === 'End') n = TABS.length - 1
    if (n < 0) return
    e.preventDefault()
    setTab(TABS[n].key)
    tabRefs.current[n]?.focus()
  }

  const doneLabel = tab === 'POST' ? 'I posted it' : tab === 'AFTER_YES' ? 'I sent the link' : 'I sent it'
  const doneNote = tab === 'POST' ? 'Keeps your streak. Posts are counted by their link, not by person.'
    : tab === 'AFTER_YES' ? `Counts ${who.trim() || 'them'} as a yes in My results.`
    : `"I sent it" keeps your streak and puts ${who.trim() || 'them'} on your follow-up list for day 3.`
  const seatsText = program.seats ? `${program.seats.left} of ${program.seats.total} left` : null

  return (
    <div className="flex flex-col lg:flex-row gap-5 items-start pb-36 md:pb-0">
      <section aria-label="Today's invite" className="flex-[2] min-w-0 w-full bg-white border border-gray-200 rounded-xl p-5 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="sk-who" className="text-sm font-semibold text-gray-900">1. Who are you inviting? <span className="font-normal text-gray-600">({tab === 'PARENT' ? "the parent's first name" : 'first name'})</span></label>
            <input id="sk-who" value={who} onChange={(e) => setWho(e.target.value)} maxLength={60} autoComplete="off" className="w-full h-11 rounded-lg border border-gray-400 px-3 text-base" disabled={tab === 'POST'} placeholder={tab === 'POST' ? 'Not needed for a post' : ''} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="sk-program" className="text-sm font-semibold text-gray-900">Program</label>
            <select id="sk-program" value={pIdx} onChange={(e) => setPIdx(Number(e.target.value))} className="w-full h-11 rounded-lg border border-gray-400 px-3 text-base bg-white">
              {programs.map((p, i) => <option key={p.id ?? 'main'} value={i}>{p.label}</option>)}
            </select>
            {seatsText && <p className="text-xs text-gray-600 lg:hidden">{seatsText} sponsored seats this month</p>}
          </div>
        </div>

        <div className="space-y-2">
          <p id="sk-how" className="text-sm font-semibold text-gray-900">2. How will you send it?</p>
          <div role="tablist" aria-labelledby="sk-how" className="flex gap-2 overflow-x-auto md:flex-wrap -mx-1 px-1 pb-1">
            {TABS.map((t, i) => (
              <button key={t.key} ref={(el) => { tabRefs.current[i] = el }} type="button" role="tab" id={`sk-tab-${t.key}`} aria-selected={tab === t.key} aria-controls="sk-panel" tabIndex={tab === t.key ? 0 : -1}
                onClick={() => setTab(t.key)} onKeyDown={(e) => onTabKey(e, i)}
                className={`flex-none h-11 px-4 rounded-full md:rounded-lg text-sm font-semibold border ${focusRing} ${tab === t.key ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-gray-300 text-gray-900 hover:bg-gray-50'}`}>
                <span className="md:hidden">{t.short}</span><span className="hidden md:inline">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div id="sk-panel" role="tabpanel" aria-labelledby={`sk-tab-${tab}`} className="space-y-2">
          <p className="text-sm font-semibold text-gray-900">3. Your message <span className="font-normal text-gray-600">(edit anything)</span></p>
          {tab === 'AFTER_YES' && (
            <label className="flex flex-wrap items-center gap-2 text-sm text-gray-800">
              Your first message went by
              <select value={firstChannel} onChange={(e) => setFirstChannel(e.target.value as ShareChannel)} className="h-11 rounded-lg border border-gray-400 px-2 bg-white">
                {FIRST_KEYS.filter((k) => k !== 'POST').map((k) => <option key={k} value={k}>{CHANNEL_NAME[k]}</option>)}
              </select>
            </label>
          )}
          {tab === 'EMAIL' && (
            <label className="flex items-center gap-2 text-sm">
              <span className="text-gray-600 flex-none">Subject:</span>
              <input value={subject} onChange={(e) => edit('subject', e.target.value)} maxLength={150} className="flex-1 min-w-0 h-11 rounded-lg border border-gray-300 px-3 font-semibold" />
            </label>
          )}
          <div className="border border-slate-300 rounded-xl p-3 sm:p-4 bg-sky-50/30 space-y-2 text-[15px] leading-relaxed">
            {parts.before && (
              <textarea aria-label="Message opening" value={parts.before} onChange={(e) => edit('before', e.target.value)} rows={Math.max(1, parts.before.split('\n').length)}
                className="w-full resize-y bg-transparent rounded-md border border-transparent hover:border-gray-300 focus:border-primary-600 focus:outline-none px-1.5 py-1" />
            )}
            {(generated.parts.hasSlot || personalRequired) && (
              <label className="block rounded-lg border border-dashed border-amber-600 bg-amber-50 px-3 py-2">
                <span className="block text-xs font-bold text-amber-900">YOUR PERSONAL LINE {personalRequired ? '(required)' : '(optional)'}</span>
                <input value={personal} onChange={(e) => setPersonal(e.target.value)} maxLength={200} required={personalRequired}
                  placeholder="e.g. Saw your post about the new job, congrats!" className="mt-1 w-full h-11 rounded-md border border-amber-300 bg-white px-3 text-base" />
              </label>
            )}
            <textarea aria-label="Message" value={parts.after} onChange={(e) => edit('after', e.target.value)} rows={Math.max(3, Math.ceil(parts.after.length / 70) + parts.after.split('\n').length - 1)}
              className="w-full resize-y bg-transparent rounded-md border border-transparent hover:border-gray-300 focus:border-primary-600 focus:outline-none px-1.5 py-1" />
            {tab !== 'AFTER_YES' && (
              <p className="text-sm text-gray-700 flex gap-2 items-start px-1.5">
                <Lock className="h-4 w-4 mt-0.5 flex-none" aria-hidden />
                {disclosure ? <span>Added for you: &quot;{disclosure}&quot;</span> : <span>Your own program, so nothing extra is added. If you share a program that isn&apos;t yours, one line is added for you.</span>}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <p className="text-sm text-gray-600">{tipFor(tab, who.trim())}</p>
            {custom && <button type="button" onClick={() => setCustom(null)} className={`text-sm font-semibold text-primary-700 underline min-h-[44px] ${focusRing}`}>Start over from the template</button>}
          </div>
        </div>

        {msg && <p role={msg.ok ? 'status' : 'alert'} className={`text-sm rounded-lg px-3 py-2 ${msg.ok ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg.text}</p>}
        {blocker && <p className="text-sm text-amber-800" aria-live="polite">{blocker}</p>}

        {/* Desktop actions */}
        <div className="hidden md:flex flex-wrap gap-2.5">
          <button type="button" onClick={copy} disabled={!!blocker} className={`h-11 px-4 rounded-lg bg-primary-700 hover:bg-primary-800 text-white font-semibold text-sm inline-flex items-center gap-2 disabled:opacity-50 ${focusRing}`}>
            {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}{copied ? 'Copied' : 'Copy message'}
          </button>
          {open && (
            <button type="button" onClick={copyAndOpen} disabled={!!blocker} className={`h-11 px-4 rounded-lg border border-gray-300 bg-white text-gray-900 font-semibold text-sm inline-flex items-center gap-2 disabled:opacity-50 ${focusRing}`}>
              <ExternalLink className="h-4 w-4" aria-hidden />{open.label}
            </button>
          )}
          <button type="button" onClick={markSent} disabled={busy || !!blocker} className={`ml-auto h-11 px-4 rounded-lg border border-green-700 bg-white text-green-800 font-semibold text-sm inline-flex items-center gap-2 disabled:opacity-50 ${focusRing}`}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{doneLabel}
          </button>
        </div>
        <p className="hidden md:block -mt-2 text-xs text-gray-600">{doneNote}</p>
      </section>

      <aside className="flex-1 min-w-0 w-full space-y-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-2.5">
          <p className="font-bold text-gray-900">Your link for this message</p>
          <p className="font-mono text-[13px] bg-slate-100 rounded-lg p-2.5 break-all">{link}</p>
          <p className="text-sm text-gray-600">The end of the link (?via={viaParam(linkChannel)}) changes with the channel, so My results can show what works for you.</p>
        </div>
        {program.seats && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-1.5">
            <p className="font-bold text-gray-900">Sponsored seats</p>
            <p className="text-2xl font-extrabold text-gray-900">{seatsText}</p>
            <p className="text-sm text-gray-600">This month, for {program.name}. Messages only say &quot;a few seats&quot;, so they stay true.</p>
          </div>
        )}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-2">
          <p className="font-bold text-gray-900">What works best</p>
          <ul className="list-disc pl-5 text-sm leading-relaxed text-gray-700">
            <li>Ask first, send the link after a yes.</li>
            <li>Short and personal beats long and polished.</li>
            <li>People you know, not strangers.</li>
            <li>Under 18? Message the parent.</li>
          </ul>
        </div>
      </aside>

      {/* Phone: sticky bottom bar */}
      <div className="md:hidden fixed inset-x-0 bottom-0 z-30 bg-white border-t border-gray-200 p-3 space-y-2 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
        <button type="button" onClick={open ? copyAndOpen : copy} disabled={!!blocker} className={`w-full h-12 rounded-lg bg-primary-700 text-white font-semibold disabled:opacity-50 ${focusRing}`}>
          {copied ? 'Copied' : open ? `Copy and ${open.label.replace(/^Open/, 'open')}` : 'Copy message'}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setTab('AFTER_YES')} className={`h-11 rounded-lg border border-gray-300 font-semibold text-sm ${focusRing}`}>After a yes</button>
          <button type="button" onClick={markSent} disabled={busy || !!blocker} className={`h-11 rounded-lg border border-green-700 text-green-800 font-semibold text-sm disabled:opacity-50 ${focusRing}`}>{busy ? 'Saving…' : doneLabel}</button>
        </div>
      </div>
    </div>
  )
}
