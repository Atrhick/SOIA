import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { appUrl } from '@/lib/get-involved/emails'
import { ensureInviteSlug, userDisplayName } from '@/lib/get-involved/server'
import { invitePrograms } from '@/lib/get-involved/program-welcome-server'
import { getSignupOffer } from '@/lib/get-involved/offer'
import { loadFollowUps, type FollowUp } from '@/lib/get-involved/follow-ups'
import { getGeneralScripts, loadProgramPitches } from '@/lib/get-involved/scripts-server'
import { lineSlotFor, renderScript, resolveScript, type ScenarioKey, type ScriptValues } from '@/lib/get-involved/scripts'
import { MAIN_LINK_PROGRAM, isShareChannel, shareLinkFor } from '@/lib/get-involved/outreach-templates'
import { TaskHeader } from '@/components/ui/kit/task-header'
import { OneADayNav } from './one-a-day-nav'
import { FollowUpsClient, type FollowUpCard } from './follow-ups-client'

/**
 * Follow-ups (One-A-Day v2). One job: send today's follow-up messages fast. Cards are grouped by
 * situation, each with its message already filled in from the program's own messages (owner's version >
 * NowTransformed's program default > general default) and one "Copy and open" button.
 */

/** Used only if neither the program nor the general messages have one (content still being written). */
const FALLBACK: Partial<Record<ScenarioKey, string>> = {
  FOLLOW_UP: 'Hi {first name}, just checking in on my last message about {program}. No pressure at all. Would a free 15-minute call be helpful?',
  LAST: "Hi {first name}, I won't keep messaging about this. If {program} ever sounds helpful, just reply and I'll send you the details. Wishing you all the best!",
  NO_CALL: "Hi {first name}, thanks for signing up for {program}! Here's your link to pick a time for the free 15-minute call: {link}",
  YES: "Great! Here's the link to book your free 15-minute call at a time that suits you: {link}",
}

const SUBJECT: Record<'FOLLOW_UP' | 'LAST' | 'NO_CALL' | 'YES', (name: string) => string> = {
  FOLLOW_UP: (n) => `Checking in, ${n}`,
  LAST: () => 'One last note from me',
  NO_CALL: () => 'Your link to book the free call',
  YES: () => 'Your link to book the free call',
}

const HOW: Record<string, string> = { TEXT: 'by text', WHATSAPP: 'on WhatsApp', EMAIL: 'by email', DM: 'by DM', PARENT: 'with a text to their parent' }
const ago = (d: number) => (d === 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`)

export async function FollowUpsPage({ role }: { role: 'COACH' | 'AMBASSADOR' }) {
  const session = await auth()
  if (!session || session.user.role !== role) redirect('/login')
  const userId = session.user.id
  const base = role === 'COACH' ? '/coach' : '/ambassador'
  const [items, slug, own, me] = await Promise.all([loadFollowUps(userId), ensureInviteSlug(userId), invitePrograms(userId), userDisplayName(userId)])

  const programIds = Array.from(new Set(items.map((i) => i.programId).filter((id): id is string => !!id)))
  const [pitches, others, offers] = await Promise.all([
    loadProgramPitches(programIds),
    prisma.coachProgram.findMany({ where: { id: { in: programIds.filter((id) => !own.some((p) => p.id === id)) } }, select: { id: true, name: true, coach: { select: { firstName: true } }, ambassador: { select: { firstName: true } } } }),
    Promise.all(programIds.map(async (id) => [id, await getSignupOffer(id).catch(() => null)] as const)),
  ])
  const sponsored = new Map(offers.map(([id, o]) => [id, !!o && o.seatsLeft > 0]))

  /** Words and links for one program (or the main link when the program is unknown). */
  const programFor = (id: string | null) => {
    const pitch = id ? pitches.get(id) : undefined
    const mine = own.find((p) => p.id === id)
    const other = others.find((p) => p.id === id)
    const name = pitch?.program ?? other?.name ?? MAIN_LINK_PROGRAM.program
    return {
      pitch,
      // {intro}: the main link opens with NowTransformed; someone else's program names its owner.
      mainLink: !pitch,
      owns: !!mine,
      ownerFirstName: other?.coach?.firstName ?? other?.ambassador?.firstName ?? undefined,
      name,
      business: pitch?.business ?? name,
      programLine: pitch?.programLine ?? MAIN_LINK_PROGRAM.description,
      url: appUrl(mine ? `/join/${slug}/${mine.slug}` : `/join/${slug}`),
      sponsorship: (id && sponsored.get(id)) || false,
    }
  }

  const general = await getGeneralScripts()
  const message = (scenario: 'FOLLOW_UP' | 'LAST' | 'NO_CALL' | 'YES', p: ReturnType<typeof programFor>, firstName: string, link: string) => {
    const text = resolveScript(p.pitch?.rows ?? [], general, scenario, 'SHORT')?.body ?? FALLBACK[scenario] ?? ''
    // The member's own line goes in later (in the browser); until then its spot shows as [label].
    const values: ScriptValues = { firstName, personalLine: lineSlotFor(scenario), myName: me?.first ?? '', business: p.business, program: p.name, programLine: p.programLine, link, sponsorship: p.sponsorship, owns: p.owns, mainLink: p.mainLink, ownerFirstName: p.ownerFirstName }
    return { subject: SUBJECT[scenario](firstName), body: renderScript(text, values) }
  }

  const cards: FollowUpCard[] = items.map((i: FollowUp) => {
    const p = programFor(i.programId)
    const about = p.pitch ? ` about ${p.name}` : ''
    if (i.type === 'FORM') {
      // Never the person's private /discovery/<token> link: it acts as a password for their booking.
      const link = appUrl('/book-call')
      return {
        id: i.prospectId, kind: 'FORM', scenario: 'NO_CALL', name: i.name, channel: i.channel,
        context: i.parent && i.teenName
          ? `${i.name}'s teen ${i.teenName} signed up ${ago(i.day)}${about}, but no call is booked yet. We've emailed them too.`
          : `${i.name} signed up ${ago(i.day)}${about} but hasn't booked the free call. We've emailed them too.`,
        message: message('NO_CALL', p, i.name, link),
        yes: null,
        phone: i.phone, email: i.email,
      }
    }
    const channel = isShareChannel(i.channel) ? i.channel : 'TEXT'
    const how = HOW[channel] ?? ''
    return {
      id: i.shareId, kind: 'SHARE', scenario: i.type === 'NUDGE' ? 'FOLLOW_UP' : 'LAST', name: i.name, channel,
      context: `${i.email && channel === 'EMAIL' ? `We emailed ${i.name} for you ${ago(i.day)}${about}` : `You invited ${i.name} ${how} ${ago(i.day)}${about}`}.${i.type === 'CLOSE' && i.nudgedAt ? ' You checked in once already.' : ''}`.replace(/\s+/g, ' '),
      message: message(i.type === 'NUDGE' ? 'FOLLOW_UP' : 'LAST', p, i.name, ''),
      yes: message('YES', p, i.name, shareLinkFor(p.url, channel)),
      phone: null, email: i.email,
    }
  })

  return (
    <div className="max-w-3xl space-y-6">
      <OneADayNav role={role} current="follow-ups" followUpsDue={cards.length} />
      <TaskHeader title="Follow up" doThis="A short check-in with people who haven't replied yet. Copy, send, done." />
      <FollowUpsClient cards={cards} inviteHref={`${base}/one-a-day`} />
    </div>
  )
}
