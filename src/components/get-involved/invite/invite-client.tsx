'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail, MessageSquareText, ThumbsUp, Link2, UserRound } from 'lucide-react'
import { kit } from '@/components/ui/kit/styles'
import { useToast } from '@/components/ui/kit/toast'
import { shareLinkFor } from '@/lib/get-involved/outreach-templates'
import type { InvitePageData } from '@/components/get-involved/share-kit/data'
import { EmailForMe } from './email-for-me'
import { SendYourself } from './send-yourself'
import { HOW, channelFor, copyText } from './shared'

type Mode = 'email' | 'copy' | 'yes'

/** The Invite page body: program (if more than one), then the two daily jobs and the "said yes" shortcut. */
export function InviteClient({ data, profileHref }: { data: InvitePageData; profileHref: string }) {
  const toast = useToast()
  const [pIdx, setPIdx] = useState(data.defaultProgram)
  const [mode, setMode] = useState<Mode | null>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const program = data.programs[pIdx] ?? data.programs[data.programs.length - 1]

  const choose = (m: Mode) => {
    setMode((cur) => (cur === m ? null : m))
    setTimeout(() => document.getElementById('invite-panel')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 50)
  }

  async function copyLink(how: (typeof HOW)[number]) {
    const url = shareLinkFor(program.url, channelFor(how.key, ''))
    if (await copyText(url)) toast.success(`Link copied for ${how.label.toLowerCase()}. Paste it in your message.`)
    else toast.error('Your browser blocked copying. Press and hold to copy it: ' + url)
  }

  const choices: { key: Mode; title: string; line: string; icon: React.ReactNode }[] = [
    { key: 'email', title: 'Email them for me', line: 'We send a friendly invitation from you.', icon: <Mail className="h-7 w-7" aria-hidden /> },
    { key: 'copy', title: 'Copy a message or link', line: 'For a text, WhatsApp, social message or post.', icon: <MessageSquareText className="h-7 w-7" aria-hidden /> },
  ]

  return (
    <div className="space-y-5">
      {data.programs.length > 1 && (
        <div>
          <label htmlFor="inv-program" className={kit.label}>Which program?</label>
          <select id="inv-program" value={pIdx} onChange={(e) => setPIdx(Number(e.target.value))} className={`${kit.input} pr-8`}>
            {data.programs.map((p, i) => <option key={p.id ?? 'main'} value={i}>{p.label}</option>)}
          </select>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {choices.map((c) => (
          <button key={c.key} type="button" aria-pressed={mode === c.key} aria-controls="invite-panel" onClick={() => choose(c.key)} className={`${kit.choice} min-h-[88px]`}>
            <span className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-primary-100 text-primary-800">{c.icon}</span>
            <span className="min-w-0">
              <span className="block text-lg font-bold text-gray-900">{c.title}</span>
              <span className="block text-base text-gray-700">{c.line}</span>
            </span>
          </button>
        ))}
      </div>
      <button type="button" aria-pressed={mode === 'yes'} aria-controls="invite-panel" onClick={() => choose('yes')}
        className={`flex min-h-[56px] w-full items-center gap-3 rounded-2xl border-2 px-4 py-2 text-left ${kit.ring} ${mode === 'yes' ? 'border-primary-700 bg-primary-50' : 'border-dashed border-gray-300 bg-white hover:border-primary-600'}`}>
        <ThumbsUp className="h-6 w-6 flex-none text-primary-700" aria-hidden />
        <span className="text-base"><strong className="text-gray-900">They said yes:</strong> <span className="text-gray-700">send the link to book the free call</span></span>
      </button>

      {mode && (
        <section id="invite-panel" aria-label={mode === 'email' ? 'Email them for me' : mode === 'copy' ? 'Copy a message or link' : 'They said yes'} className={`${kit.card} scroll-mt-4`}>
          {mode === 'email' && (
            <EmailForMe key={program.id ?? 'main'} role={data.role} program={program} myFirstName={data.myFirstName} myFullName={data.myFullName} photoUrl={data.photoUrl} usedToday={data.emailUsedToday} limit={data.emailLimit} />
          )}
          {mode === 'copy' && <SendYourself key={`copy-${program.id ?? 'main'}`} mode="first" role={data.role} program={program} myFirstName={data.myFirstName} minor={data.minor} mailingAddress={data.mailingAddress} />}
          {mode === 'yes' && <SendYourself key={`yes-${program.id ?? 'main'}`} mode="yes" role={data.role} program={program} myFirstName={data.myFirstName} minor={data.minor} mailingAddress={data.mailingAddress} />}
        </section>
      )}

      <div className="space-y-1 border-t border-gray-200 pt-3">
        <button type="button" onClick={() => setLinkOpen((o) => !o)} aria-expanded={linkOpen} className={kit.quiet}><Link2 className="h-5 w-5" aria-hidden />Just copy my link</button>
        {linkOpen && (
          <div className="space-y-2 pb-2">
            <p className="text-sm text-gray-700">Where will you paste it? Each link shows in Results where people came from.</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {HOW.map((h) => <button key={h.key} type="button" onClick={() => copyLink(h)} className={kit.secondary}>{h.label}</button>)}
            </div>
          </div>
        )}
        <Link href={profileHref} className={kit.quiet}><UserRound className="h-5 w-5" aria-hidden />Your photo and why you do this</Link>
      </div>
    </div>
  )
}
