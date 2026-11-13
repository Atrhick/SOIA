'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Copy, Pencil } from 'lucide-react'
import { kit } from '@/components/ui/kit/styles'
import { useToast } from '@/components/ui/kit/toast'
import {
  GROUP_LABELS, VARIANT_LABELS, lineLabelFor, lineSlotFor, splitOnSlot, emailFooter, fillPrice, hasBlank, renderScript, withoutLineSlot,
  type LineIdeas, type PlaybookGuide, type PlaybookSection, type ScenarioKey, type ScriptGroup, type ScriptText, type ScriptVariant,
} from '@/lib/get-involved/scripts'
import { resetProgramGuide, resetProgramScript, saveProgramGuide, saveProgramScript } from '@/lib/actions/program-scripts'
import { ScriptEditor } from './script-editor'
import { GuideEditor } from './guide-editor'
import { linkFor, sourceLabel } from './helpers'
import { ideasFor } from '@/lib/get-involved/line-ideas'
import { LineIdeasPicker } from '@/components/get-involved/invite/line-ideas-picker'

export interface PlaybookMessage {
  key: ScenarioKey
  group: ScriptGroup
  label: string
  hint: string
  variants: { variant: ScriptVariant; subject: string | null; body: string; source: 'OWNER' | 'PROGRAM' | 'GENERAL'; defaultText: ScriptText | null }[]
}

export interface PlaybookData {
  role: 'COACH' | 'AMBASSADOR'
  /** Programs the member can share ("general" = the main link). Empty = only the main link. */
  programs: { id: string; name: string }[]
  current: string
  owns: boolean
  program: { id: string; name: string; guide: PlaybookGuide | null; guideSource: 'OWNER' | 'PROGRAM' | null; hasDefaultGuide: boolean; lineIdeas: LineIdeas | null } | null
  tips: PlaybookSection[]
  values: { myName: string; business: string; program: string; programLine: string; sponsorship: boolean; regularPrice: string }
  link: string
  mailingAddress: string | null
  messages: PlaybookMessage[]
}

const COPIED: Record<ScriptVariant, string> = {
  SHORT: 'Copied. Paste it into your text, WhatsApp or DM.',
  EMAIL: 'Copied. Paste it into your email.',
  POST: 'Copied. Paste it into your post.',
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}

export function PlaybookClient({ data }: { data: PlaybookData }) {
  const router = useRouter()
  const [open, setOpen] = useState<ScenarioKey | null>(null)
  const [firstName, setFirstName] = useState('')
  const [personalLine, setPersonalLine] = useState('')
  const programName = data.program?.name ?? null
  const groups = (Object.keys(GROUP_LABELS) as ScriptGroup[]).map((g) => ({ g, items: data.messages.filter((m) => m.group === g) })).filter((x) => x.items.length)

  return (
    <div className="space-y-8">
      {data.programs.length > 1 && (
        <div className="max-w-md">
          <label htmlFor="pb-program" className={kit.label}>Program</label>
          <select id="pb-program" value={data.current} onChange={(e) => router.push(`?program=${encodeURIComponent(e.target.value)}`)}
            className={`${kit.input} pr-10`}>
            {data.programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}

      <a href="#pb-messages" className={`${kit.quiet} -ml-2`}>Jump to the messages</a>

      <PitchSection data={data} />

      <section aria-labelledby="pb-messages" className="space-y-6">
        <div>
          <h2 id="pb-messages" className="scroll-mt-4 text-xl font-bold text-gray-900 sm:text-2xl">Messages for every situation</h2>
          <p className="mt-1 max-w-prose text-base text-gray-700">Open a situation, add their name, then copy the message.</p>
        </div>
        {groups.map(({ g, items }) => (
          <div key={g}>
            <h3 className="text-lg font-bold text-gray-900">{GROUP_LABELS[g]}</h3>
            <ul className="mt-2 divide-y divide-gray-200 overflow-hidden rounded-2xl border border-gray-200 bg-white">
              {items.map((m) => (
                <MessageRow key={m.key} m={m} data={data} programName={programName}
                  isOpen={open === m.key} onToggle={() => setOpen((o) => (o === m.key ? null : m.key))}
                  firstName={firstName} setFirstName={setFirstName} personalLine={personalLine} setPersonalLine={setPersonalLine} />
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  )
}

// ---------- "How to pitch" ----------

function GuideView({ guide, price }: { guide: PlaybookGuide; price: string }) {
  return (
    <div className="max-w-prose space-y-5">
      {guide.summary && <p className="text-lg leading-relaxed text-gray-900">{fillPrice(guide.summary, price)}</p>}
      {guide.sections.map((s, i) => <TipsBlock key={i} section={{ ...s, points: s.points.map((pt) => fillPrice(pt, price)) }} />)}
    </div>
  )
}

function TipsBlock({ section }: { section: PlaybookSection }) {
  return (
    <div>
      <h4 className="text-base font-bold text-gray-900">{section.title}</h4>
      <ul className="mt-1.5 list-disc space-y-1.5 pl-5 text-base leading-relaxed text-gray-800">
        {section.points.map((p, j) => <li key={j}>{p}</li>)}
      </ul>
    </div>
  )
}

function PitchSection({ data }: { data: PlaybookData }) {
  const router = useRouter()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const p = data.program
  // With a program guide, the general tips start folded so the messages stay close; without one they are the guide.
  const [tipsOpen, setTipsOpen] = useState(!p?.guide)

  async function save(guide: PlaybookGuide) {
    if (!p) return { ok: false as const, error: 'Choose a program first.' }
    const r = await saveProgramGuide({ programId: p.id, guide })
    if (r.ok) { setEditing(false); toast.success('Saved. Your guide is live now.'); router.refresh() }
    return r
  }
  async function reset() {
    if (!p) return { ok: false as const, error: 'Choose a program first.' }
    const before = p.guide
    const r = await resetProgramGuide({ programId: p.id })
    if (r.ok) {
      setEditing(false)
      router.refresh()
      toast.success(p.hasDefaultGuide ? 'Back to our guide.' : 'Your guide was removed.', before ? {
        action: { label: 'Undo', onClick: async () => {
          const u = await saveProgramGuide({ programId: p.id, guide: before })
          if (u.ok) { toast.success('Your guide is back.'); router.refresh() } else toast.error(u.error)
        } },
      } : undefined)
    }
    return r
  }

  return (
    <section aria-labelledby="pb-pitch" className={`${kit.card} space-y-5`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 id="pb-pitch" className="text-xl font-bold text-gray-900 sm:text-2xl">{p ? `How to pitch ${p.name}` : 'How to pitch'}</h2>
        {p && data.owns && !editing && (
          <button type="button" onClick={() => setEditing(true)} className={kit.secondary}>
            <Pencil className="h-5 w-5" aria-hidden />{p.guide ? 'Edit guide' : 'Write a guide'}
          </button>
        )}
      </div>

      {p && editing ? (
        <GuideEditor program={p.name} initial={p.guide} onSave={save} onCancel={() => setEditing(false)}
          onReset={p.guideSource === 'OWNER' ? reset : undefined} />
      ) : p?.guide ? (
        <>
          <p className="text-sm text-gray-600">{p.guideSource === 'OWNER' ? 'Written by you' : `Written for ${p.name}`}</p>
          <GuideView guide={p.guide} price={data.values.regularPrice} />
        </>
      ) : p ? (
        <p className="max-w-prose text-base text-gray-800">
          No guide has been written for {p.name} yet.{data.owns ? ' Tap "Write a guide" to add your own, or' : ''} {data.owns ? 'start' : 'Start'} with the tips for everyone below.
        </p>
      ) : (
        <p className="max-w-prose text-base text-gray-800">
          Your main link lets people choose any program, so there&apos;s no program guide for it. These tips work for every program.
        </p>
      )}

      {data.tips.length > 0 && (
        <div className="max-w-prose border-t border-gray-200 pt-4">
          <h3>
            <button type="button" onClick={() => setTipsOpen((o) => !o)} aria-expanded={tipsOpen} aria-controls="pb-tips"
              className={`-mx-2 flex min-h-[48px] w-[calc(100%+1rem)] items-center justify-between gap-2 rounded-lg px-2 text-left text-lg font-bold text-gray-900 hover:bg-gray-50 ${kit.ring}`}>
              <span>Tips for everyone <span className="text-base font-normal text-gray-600">({data.tips.length} topics)</span></span>
              <ChevronDown className={`h-6 w-6 flex-none text-gray-500 transition-transform ${tipsOpen ? 'rotate-180' : ''}`} aria-hidden />
            </button>
          </h3>
          {tipsOpen && <div id="pb-tips" className="mt-3 space-y-4">{data.tips.map((s, i) => <TipsBlock key={i} section={s} />)}</div>}
        </div>
      )}
    </section>
  )
}

// ---------- one situation ----------

function MessageRow({ m, data, programName, isOpen, onToggle, firstName, setFirstName, personalLine, setPersonalLine }: {
  m: PlaybookMessage
  data: PlaybookData
  programName: string | null
  isOpen: boolean
  onToggle: () => void
  firstName: string
  setFirstName: (v: string) => void
  personalLine: string
  setPersonalLine: (v: string) => void
}) {
  const router = useRouter()
  const toast = useToast()
  const [vi, setVi] = useState(0)
  const [editing, setEditing] = useState(false)
  const v = m.variants[Math.min(vi, m.variants.length - 1)]
  const id = `pb-${m.key}`
  const lineRef = useRef<HTMLTextAreaElement>(null)
  const program = data.program
  // An empty line shows as [its label], so it's clear where it goes; it's left out when copied.
  const slot = lineSlotFor(m.key)
  const values = { ...data.values, firstName, personalLine: personalLine.trim() || slot, link: linkFor(data.link, v.variant) }
  const text = `${v.subject ?? ''}\n${v.body}`
  const subject = v.subject ? renderScript(v.subject, values) : null
  const body = renderScript(v.body, values)
  const footer = v.variant === 'EMAIL' ? emailFooter(data.mailingAddress) : null

  async function copy(what: 'body' | 'subject') {
    const sendBody = withoutLineSlot(body)
    const out = what === 'subject' ? subject ?? '' : footer ? `${sendBody}\n\n${footer}` : sendBody
    if (what === 'body' && hasBlank(personalLine)) { toast.error('Change the part in [brackets] in your line to your own words first.'); lineRef.current?.focus(); return }
    if (await copyText(out)) toast.success(what === 'subject' ? 'Subject copied.' : COPIED[v.variant])
    else toast.error("Couldn't copy. Press and hold the message to select it, then copy.")
  }

  async function save(t: ScriptText) {
    if (!program) return { ok: false as const, error: 'Choose a program first.' }
    const r = await saveProgramScript({ programId: program.id, scenario: m.key, variant: v.variant, subject: t.subject, body: t.body })
    if (r.ok) { setEditing(false); toast.success('Saved. Your version is live now.'); router.refresh() }
    return r
  }
  async function reset() {
    if (!program) return { ok: false as const, error: 'Choose a program first.' }
    const before = { subject: v.subject, body: v.body }
    const r = await resetProgramScript({ programId: program.id, scenario: m.key, variant: v.variant })
    if (r.ok) {
      setEditing(false)
      router.refresh()
      toast.success('Back to our version.', {
        action: { label: 'Undo', onClick: async () => {
          const u = await saveProgramScript({ programId: program.id, scenario: m.key, variant: v.variant, ...before })
          if (u.ok) { toast.success('Your version is back.'); router.refresh() } else toast.error(u.error)
        } },
      })
    }
    return r
  }

  return (
    <li>
      <button type="button" onClick={onToggle} aria-expanded={isOpen} aria-controls={`${id}-panel`}
        className={`flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-gray-50 ${kit.ring} focus-visible:ring-offset-0`}>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-gray-900">{m.label}</span>
          <span className="mt-0.5 block text-sm text-gray-600">{m.hint}</span>
        </span>
        <ChevronDown className={`mt-0.5 h-6 w-6 flex-none text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden />
      </button>

      {isOpen && (
        <div id={`${id}-panel`} className="space-y-4 border-t border-gray-100 bg-gray-50/60 px-4 pb-5 pt-4">
          {m.variants.length > 1 && (
            <div role="tablist" aria-label="Kind of message" className="flex flex-wrap gap-2">
              {m.variants.map((x, i) => (
                <button key={x.variant} type="button" role="tab" aria-selected={i === vi} onClick={() => { setVi(i); setEditing(false) }}
                  className={`min-h-[44px] rounded-full border px-4 text-base font-semibold ${kit.ring} ${i === vi ? 'border-primary-700 bg-primary-700 text-white' : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-100'}`}>
                  {VARIANT_LABELS[x.variant]}
                </button>
              ))}
            </div>
          )}
          <p className="text-sm text-gray-600">{sourceLabel(v.source, programName)}</p>

          {editing && program ? (
            <ScriptEditor key={`${m.key}-${v.variant}`} idPrefix={`${id}-${v.variant}`} scenario={m.key} variant={v.variant}
              initial={{ subject: v.subject, body: v.body }} saveLabel="Save" onSave={save} onCancel={() => setEditing(false)}
              resetLabel={v.source === 'OWNER' ? 'Reset to our version' : undefined} onReset={v.source === 'OWNER' ? reset : undefined} />
          ) : (
            <>
              {(text.includes('{first name}') || text.includes('{personal line}')) && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {text.includes('{first name}') && (
                    <div>
                      <label htmlFor={`${id}-name`} className={kit.label}>Their first name</label>
                      <input id={`${id}-name`} value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={60} autoComplete="off" className={kit.input} placeholder="Maria" />
                    </div>
                  )}
                  {text.includes('{personal line}') && (
                    <div className="sm:col-span-2">
                      <label htmlFor={`${id}-line`} className={kit.label}>{lineLabelFor(m.key)} <span className="font-normal text-gray-600">(optional)</span></label>
                      <textarea id={`${id}-line`} ref={lineRef} value={personalLine} onChange={(e) => setPersonalLine(e.target.value)} rows={2} maxLength={300}
                        className={kit.textarea} placeholder="Write your own, or tap an idea below" />
                      <p className={kit.hint}>It goes into the message below, where it says <strong className="font-semibold text-gray-900">{slot}</strong>. People reply far more when it&apos;s there. Leave it empty and that spot is left out when you copy.</p>
                      <LineIdeasPicker id={`${id}-ideas`} ideas={ideasFor(m.key, program?.lineIdeas)} target={lineRef} onPick={(l) => setPersonalLine(l.slice(0, 300))} />
                    </div>
                  )}
                </div>
              )}

              <div className="max-w-prose rounded-xl border border-gray-200 bg-white p-4">
                {subject && <p className="mb-2 text-base"><span className="text-gray-600">Subject: </span><strong className="text-gray-900">{subject}</strong></p>}
                <p className="whitespace-pre-line text-base leading-relaxed text-gray-900">{splitOnSlot(body, slot).map((x, j) => x.slot ? <mark key={j} className="rounded bg-amber-100 px-1 font-semibold text-amber-900">{x.text}</mark> : x.text)}</p>
                {footer && <p className="mt-3 whitespace-pre-line border-t border-gray-100 pt-3 text-sm text-gray-600">{footer}</p>}
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => copy('body')} className={kit.primary}>
                  <Copy className="h-5 w-5" aria-hidden />{v.variant === 'EMAIL' ? 'Copy the email' : 'Copy'}
                </button>
                {subject && <button type="button" onClick={() => copy('subject')} className={kit.secondary}>Copy the subject</button>}
                {data.owns && program && (
                  <button type="button" onClick={() => setEditing(true)} className={kit.secondary}>
                    <Pencil className="h-5 w-5" aria-hidden />Edit
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </li>
  )
}
