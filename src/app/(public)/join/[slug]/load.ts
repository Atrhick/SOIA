/**
 * Data for the sign-up page (/join/[slug] and /join/[slug]/[program]). Server only.
 * Everything returned is plain JSON (dates formatted here) for the client component.
 */
import { userDisplayName } from '@/lib/get-involved/server'
import { programDisplay, programForSignup } from '@/lib/get-involved/program-welcome-server'
import { getInviteProfile, getOutreachSettings, getSignupOffer, nextMonthStart, smsEnabled } from '@/lib/get-involved/offer'
import type { SignupPageProps } from '@/components/get-involved/signup/signup-page'

const CHANNELS = ['text', 'whatsapp', 'email', 'dm', 'post', 'parent']

/** ?via= share channel: only the known values, lowercased; anything else is dropped. */
export function viaParam(v: string | string[] | undefined): string | null {
  const s = (Array.isArray(v) ? v[0] : v ?? '').trim().toLowerCase()
  return CHANNELS.includes(s) ? s : null
}

export async function loadSignupPage(inviter: { id: string; role: string }, slug: string, programSlug: string | null, via: string | null): Promise<SignupPageProps> {
  const [name, profile, settings] = await Promise.all([userDisplayName(inviter.id), getInviteProfile(inviter.id), getOutreachSettings()])
  // With a program link that program; otherwise the inviter's chosen program, then their latest with an approved note.
  const program = await programForSignup(inviter.id, programSlug).catch(() => null)
  const [display, offer] = program
    ? await Promise.all([programDisplay(program.id).catch(() => null), getSignupOffer(program.id).catch(() => null)])
    : [null, null]
  const full = name?.full ?? 'A NowTransformed member'
  const initials = full.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => (w?.[0] || '?').toUpperCase()).join('') || '?'
  return {
    slug,
    via,
    inviter: {
      name: full,
      first: name?.first ?? full,
      roleLabel: inviter.role === 'COACH' ? 'NowTransformed coach' : 'NowTransformed ambassador',
      photoUrl: profile?.photoUrl ?? null,
      initials,
      why: profile?.why?.trim() || null,
    },
    program: program
      ? { slug: programSlug ? program.slug : null, label: display?.label ?? program.name, headline: display?.headline ?? null, bullets: display?.bullets ?? [] }
      : null,
    offer: offer
      ? {
          fullPrice: offer.fullPrice,
          sponsoredPrice: offer.sponsoredPrice,
          reason: offer.reason,
          seatsLeft: offer.seatsLeft,
          seatsPerMonth: offer.seatsPerMonth,
          reopens: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(nextMonthStart()),
        }
      : null,
    smsOn: smsEnabled(),
    mailingAddress: settings.mailingAddress.trim(),
  }
}
