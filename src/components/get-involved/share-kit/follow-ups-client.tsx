'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check, Copy, Loader2, Send } from 'lucide-react'
import { markClosed, markFormFollowUpDone, markNudged, setShareOutcome } from '@/lib/actions/outreach-share'
import { undoFormFollowUpDone, undoShareOutcome } from '@/lib/actions/follow-up-undo'
import { APP_WORDS, followUpTarget } from '@/lib/get-involved/follow-up-links'
import { useToast } from '@/components/ui/kit/toast'
import { HelpTip } from '@/components/ui/kit/help-tip'
import { kit } from '@/components/ui/kit/styles'

export interface FollowUpCard {
  /** OutreachShare id (SHARE) or prospect id (FORM). */
  id: string
  kind: 'SHARE' | 'FORM'
  scenario: 'FOLLOW_UP' | 'LAST' | 'NO_CALL'
  name: string
  channel: string
  /** One line: "You invited Maria by text 4 days ago." */
  context: string
  message: { subject: string; body: string }
  /** The "They said yes" message with their sign-up link (SHARE cards only). */
  yes: { subject: string; body: string } | null
  phone: string | null
  email: string | null
}

const GROUPS: { key: FollowUpCard['scenario']; title: string; help: string }[] = [
  { key: 'FOLLOW_UP', title: 'Haven’t replied (day 3–4)', help: 'A friendly check-in 3 or 4 days after your first message. It adds something new and never pushes the link.' },
  { key: 'NO_CALL', title: 'Signed up but didn’t book a call', help: 'They filled in your form but haven’t picked a time for the free call. The message has their own link to book.' },
  { key: 'LAST', title: 'Last check-in (day 10–14)', help: 'One kind last note, then we stop suggesting them. The door stays open if they reply later.' },
]
const PER_GROUP = 5

type CardState = 'open' | 'sent' | 'yes' | 'gone'

export function FollowUpsClient({ cards, inviteHref }: { cards: FollowUpCard[]; inviteHref: string }) {
  const [state, setState] = useState<Record<string, CardState>>({})
  const [showAll, setShowAll] = useState<Record<string, boolean>>({})
  // Every action refreshes the page data, and a card someone just handled (yes, followed up) is no longer
  // "due" on the server. Keep the cards from this visit on screen so the member can finish with them.
  const [list, setList] = useState(cards)
  useEffect(() => setList((prev) => [...prev, ...cards.filter((c) => !prev.some((p) => p.id === c.id))]), [cards])
  const set = (id: string, s: CardState) => setState((m) => ({ ...m, [id]: s }))
  const visible = list.filter((c) => state[c.id] !== 'gone')

  if (visible.length === 0) {
    return (
      <div className={`${kit.card} space-y-3 text-center`}>
        <p className="text-lg font-semibold text-gray-900">No follow-ups today.</p>
        <p className="text-base text-gray-700">People you invite show up here 3 days later if they haven&apos;t replied.</p>
        <Link href={inviteHref} className={kit.primary}>Invite someone new <ArrowRight className="h-5 w-5" aria-hidden /></Link>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {GROUPS.map((g) => {
        const list = visible.filter((c) => c.scenario === g.key)
        if (list.length === 0) return null
        const shown = showAll[g.key] ? list : list.slice(0, PER_GROUP)
        return (
          <section key={g.key} aria-labelledby={`fu-${g.key}`} className="space-y-3">
            <h2 id={`fu-${g.key}`} className="flex items-center gap-1 text-lg font-bold text-gray-900">
              {g.title} <span className="ml-1 rounded-full bg-gray-200 px-2.5 text-base font-semibold text-gray-800">{list.length}</span>
              <HelpTip label={g.title}><p>{g.help}</p></HelpTip>
            </h2>
            <ul className="space-y-3">
              {shown.map((c) => <Card key={c.id} card={c} state={state[c.id] ?? 'open'} setState={(s) => set(c.id, s)} />)}
            </ul>
            {list.length > PER_GROUP && !showAll[g.key] && (
              <button type="button" className={kit.secondary} onClick={() => setShowAll((m) => ({ ...m, [g.key]: true }))}>Show all {list.length}</button>
            )}
          </section>
        )
      })}
      <p className="text-sm text-gray-600">Send texts between 8 AM and 8 PM their time. For anyone under 18, only the parent is listed.</p>
    </div>
  )
}

async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true } catch { return false }
}

function isPhone(): boolean {
  try { return window.matchMedia('(pointer: coarse)').matches } catch { return false }
}

function Card({ card, state, setState }: { card: FollowUpCard; state: CardState; setState: (s: CardState) => void }) {
  const toast = useToast()
  const router = useRouter()
  const [busy, setBusy] = useState<'send' | 'yes' | 'stop' | null>(null)
  // Known only in the browser (after the first render, so server and client HTML match).
  const [mobile, setMobile] = useState<boolean | null>(null)
  useEffect(() => setMobile(isPhone()), [])
  const target = mobile === null ? null : followUpTarget(card.channel, card, card.message, mobile)
  const words = target ? APP_WORDS[target.app] : null

  /** Copy, open the app with the message filled in, and log the follow-up. */
  async function send() {
    const copying = copyText(card.message.body)
    // Open straight away, inside the tap, so phones don't block it.
    const t = followUpTarget(card.channel, card, card.message, isPhone())
    if (t) {
      if (t.app === 'WHATSAPP') window.open(t.href, '_blank', 'noopener')
      else window.location.href = t.href
    }
    const copied = await copying
    if (!copied && !t) { toast.error('Your phone blocked copying. Press and hold the message to copy it, then send it.'); return }
    setBusy('send')
    const r = card.kind === 'FORM' ? await markFormFollowUpDone({ id: card.id })
      : card.scenario === 'FOLLOW_UP' ? await markNudged({ id: card.id }) : await markClosed({ id: card.id })
    setBusy(null)
    if (!r.ok) { toast.error(`${copied ? 'Copied, but we' : 'We'} couldn't save that you followed up. ${r.error}`); return }
    setState('sent')
    toast.success(t ? APP_WORDS[t.app].toast : 'Copied. Paste it into your messages.')
  }

  async function saidYes() {
    if (card.kind !== 'SHARE') return
    setBusy('yes')
    const r = await setShareOutcome({ id: card.id, outcome: 'YES' })
    setBusy(null)
    if (!r.ok) { toast.error(r.error); return }
    setState('yes')
    toast.success(`Great news! Send ${card.name} the link below.`, {
      action: { label: 'Undo', onClick: async () => { const u = await undoShareOutcome({ id: card.id }); if (u.ok) setState('open'); else toast.error(u.error) } },
    })
  }

  async function stop() {
    setBusy('stop')
    const r = card.kind === 'FORM' ? await markFormFollowUpDone({ id: card.id }) : await setShareOutcome({ id: card.id, outcome: 'NO' })
    setBusy(null)
    if (!r.ok) { toast.error(r.error); return }
    setState('gone')
    toast.success(`Stopped following up with ${card.name}.`, {
      action: {
        label: 'Undo',
        onClick: async () => {
          const u = card.kind === 'FORM' ? await undoFormFollowUpDone({ id: card.id }) : await undoShareOutcome({ id: card.id })
          if (u.ok) { setState('open'); router.refresh() } else toast.error(u.error)
        },
      },
    })
  }

  async function copyYes() {
    if (!card.yes) return
    const t = followUpTarget(card.channel, card, card.yes, isPhone())
    const copying = copyText(card.yes.body)
    if (t) {
      if (t.app === 'WHATSAPP') window.open(t.href, '_blank', 'noopener')
      else window.location.href = t.href
    }
    if (await copying) toast.success(t ? APP_WORDS[t.app].toast : 'Copied. Paste it into your messages.')
    else if (!t) toast.error('Your phone blocked copying. Press and hold the message to copy it.')
  }

  return (
    <li className={`${kit.card} space-y-3`}>
      <div>
        <p className="flex flex-wrap items-center gap-2 text-lg font-bold text-gray-900">
          {card.name}
          {state === 'sent' && <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 text-sm font-semibold text-green-800"><Check className="h-4 w-4" aria-hidden />Followed up</span>}
        </p>
        <p className="text-base text-gray-700">{card.context}</p>
      </div>

      {state === 'yes' && card.yes ? (
        <div className="space-y-3 rounded-xl border border-green-200 bg-green-50 p-3">
          <p className="text-base font-semibold text-green-900">{card.name} said yes. Send them the link:</p>
          <p className="whitespace-pre-line break-words text-base leading-relaxed text-gray-900">{card.yes.body}</p>
          <button type="button" className={kit.primaryBlock} onClick={copyYes}><Copy className="h-5 w-5" aria-hidden />Copy the link message</button>
        </div>
      ) : (
        <>
          <p className="whitespace-pre-line break-words rounded-xl bg-slate-50 px-3.5 py-3 text-base leading-relaxed text-gray-900">{card.message.body}</p>
          {state === 'sent' ? (
            <button type="button" className={kit.secondary} onClick={async () => { if (await copyText(card.message.body)) toast.success('Copied again.'); else toast.error('Your phone blocked copying. Press and hold the message to copy it.') }}>
              <Copy className="h-5 w-5" aria-hidden />Copy again
            </button>
          ) : (
            <button type="button" className={kit.primaryBlock} onClick={send} disabled={busy === 'send'}>
              {busy === 'send' ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : words ? <Send className="h-5 w-5" aria-hidden /> : <Copy className="h-5 w-5" aria-hidden />}
              {words ? words.button : 'Copy message'}
            </button>
          )}
          {!(card.kind === 'FORM' && state === 'sent') && (
            <div className="flex flex-col gap-2 sm:flex-row">
              {card.kind === 'SHARE' && (
                <button type="button" className={`${kit.secondary} sm:flex-1`} onClick={saidYes} disabled={!!busy}>
                  {busy === 'yes' && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}They said yes
                </button>
              )}
              <button type="button" className={`${kit.secondary} text-gray-700 sm:flex-1`} onClick={stop} disabled={!!busy}>
                {busy === 'stop' && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}Stop following up
              </button>
            </div>
          )}
        </>
      )}
    </li>
  )
}
