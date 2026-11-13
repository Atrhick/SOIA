/**
 * Client-safe helpers for the Invite page: how each "send it yourself" option maps to a message length,
 * a tracked link and an app to open.
 */
import type { ShareChannel } from '@/lib/get-involved/outreach-templates'
import type { ScriptVariant } from '@/lib/get-involved/scripts'

export type HowKey = 'TEXT' | 'WHATSAPP' | 'EMAIL' | 'DM'

export const HOW: { key: HowKey; label: string; app: string }[] = [
  { key: 'TEXT', label: 'Text', app: 'Messages' },
  { key: 'WHATSAPP', label: 'WhatsApp', app: 'WhatsApp' },
  { key: 'EMAIL', label: 'Email', app: 'your email' },
  { key: 'DM', label: 'Social message', app: 'the app' },
]

export const variantFor = (how: HowKey): ScriptVariant => (how === 'EMAIL' ? 'EMAIL' : 'SHORT')

/** The channel logged and put in ?via=: a text to a parent is PARENT so the sign-up knows it's a family. */
export function channelFor(how: HowKey, scenario: string): ShareChannel {
  if (scenario === 'POST') return 'POST'
  if (scenario === 'PARENT' && how === 'TEXT') return 'PARENT'
  return how
}

/** Where "Copy and open" goes after copying. null = copy only (social messages and posts). */
export function openTarget(how: HowKey | 'POST', text: string, subject: string | null): { href: string; newTab: boolean; button: string } | null {
  const t = encodeURIComponent(text)
  switch (how) {
    case 'TEXT': return { href: `sms:?&body=${t}`, newTab: false, button: 'Copy and open Messages' }
    case 'WHATSAPP': return { href: `https://wa.me/?text=${t}`, newTab: true, button: 'Copy and open WhatsApp' }
    case 'EMAIL': return { href: `mailto:?subject=${encodeURIComponent(subject ?? '')}&body=${t}`, newTab: false, button: 'Copy and open my email' }
    default: return null
  }
}

export const pasteWhere = (how: HowKey | 'POST') =>
  how === 'TEXT' ? 'Paste it into your text.' : how === 'WHATSAPP' ? 'Paste it into WhatsApp.' : how === 'EMAIL' ? 'Paste it into your email.' : how === 'POST' ? 'Paste it into your post.' : 'Paste it into your message.'

/** Copies text; false when the browser refuses. */
export async function copyText(text: string): Promise<boolean> {
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
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}

export function openAfterCopy(target: { href: string; newTab: boolean } | null) {
  if (!target) return
  if (target.newTab) window.open(target.href, '_blank', 'noopener')
  else window.location.href = target.href
}

/** Example lines for "why you thought of them". */
export const PERSONAL_EXAMPLES: Record<string, string> = {
  KNOW: 'You mentioned wanting more direction this year, and I thought of you.',
  INTRO: 'Sam said you might be looking for something like this.',
  GROUP: 'I loved what you shared at group last week.',
  NEW: 'I saw your post about your son starting high school.',
  PARENT: 'You mentioned Jordan has a lot of change coming up this year.',
  ORG: 'Your team does so much for families in our area.',
  POST: 'Every young person deserves someone in their corner.',
}
