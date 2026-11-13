/**
 * One-A-Day v2 follow-ups: where "Copy and open" takes the member, by the channel they first used.
 * PURE (no database), so the follow-ups client can use it in the browser; tested in follow-up-links.test.ts.
 */

export type OpenApp = 'MESSAGES' | 'WHATSAPP' | 'EMAIL'

export interface OpenTarget {
  href: string
  app: OpenApp
}

/** "+1 (702) 555-0123" -> "+17025550123". Empty when there are fewer than 7 digits. */
export function phoneForLink(raw: string | null | undefined): string {
  const s = (raw ?? '').trim()
  const digits = s.replace(/\D/g, '')
  if (digits.length < 7) return ''
  return s.startsWith('+') ? `+${digits}` : digits
}

/**
 * The link that opens the right app with the message filled in, or null when there's nothing to open
 * (a DM: the member pastes it themselves). Texts only open on a phone (`mobile`); on a computer the
 * message is just copied.
 */
export function followUpTarget(
  channel: string,
  to: { phone?: string | null; email?: string | null },
  msg: { subject: string; body: string },
  mobile: boolean,
): OpenTarget | null {
  const phone = phoneForLink(to.phone)
  const email = (to.email ?? '').trim()
  const mail = (): OpenTarget => ({ href: `mailto:${encodeURIComponent(email).replace(/%40/g, '@')}?subject=${encodeURIComponent(msg.subject)}&body=${encodeURIComponent(msg.body)}`, app: 'EMAIL' })
  const sms = (): OpenTarget | null => (mobile ? { href: `sms:${phone}?&body=${encodeURIComponent(msg.body)}`, app: 'MESSAGES' } : null)
  switch (channel) {
    case 'EMAIL': return mail()
    case 'WHATSAPP': return { href: `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg.body)}`, app: 'WHATSAPP' }
    case 'TEXT':
    case 'PARENT':
      if (mobile) return sms()
      return email ? mail() : null
    default:
      // DM or a post: we only know how to reach them if they gave us a number or an address.
      if (phone && mobile) return sms()
      if (email) return mail()
      return null
  }
}

export const APP_WORDS: Record<OpenApp, { button: string; toast: string }> = {
  MESSAGES: { button: 'Copy and open Messages', toast: 'Copied. Paste it into your messages.' },
  WHATSAPP: { button: 'Copy and open WhatsApp', toast: 'Copied. Paste it into WhatsApp if it isn’t there already.' },
  EMAIL: { button: 'Copy and open email', toast: 'Copied. Your email is open with the message filled in.' },
}
