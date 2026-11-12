/**
 * Server-only loader for the share kit ("Today's invite") and the One-A-Day sub-nav.
 * Not 'use server': nothing here is a public endpoint; pages check the session first.
 */
import prisma from '@/lib/prisma'
import { appUrl } from '@/lib/get-involved/emails'
import { getOutreachStreak } from '@/lib/get-involved/outreach-streak'
import { ensureInviteSlug, userDisplayName } from '@/lib/get-involved/server'
import { getSignupOffer } from '@/lib/get-involved/offer'
import { invitePrograms, programDisplay } from '@/lib/get-involved/program-welcome-server'
import { getOutreachTemplates } from '@/lib/get-involved/outreach-templates-server'
import { MAIN_LINK_PROGRAM, descriptionFromHeadline, type TemplateKey, type TemplateText } from '@/lib/get-involved/outreach-templates'
import { followUpsDueCount } from '@/lib/get-involved/follow-ups'

export interface ShareKitProgram {
  /** null = "Any program (main link)". */
  id: string | null
  label: string
  /** {program} fill-in. */
  name: string
  /** {one-line description} fill-in. */
  description: string
  url: string
  /** The sharer owns it: no disclosure line is added. */
  owns: boolean
  seats: { left: number; total: number } | null
}

export interface ShareKitData {
  role: 'COACH' | 'AMBASSADOR'
  sharerFirstName: string
  programs: ShareKitProgram[]
  defaultProgram: number
  templates: Record<TemplateKey, TemplateText>
  streak: number
  doneToday: boolean
  freeMissesLeft: number
  followUpsDue: number
}

export async function loadShareKit(userId: string, role: 'COACH' | 'AMBASSADOR', now = new Date()): Promise<ShareKitData> {
  const [slug, name, programs, templates, me, streakInfo, dueCount] = await Promise.all([
    ensureInviteSlug(userId),
    userDisplayName(userId),
    invitePrograms(userId),
    getOutreachTemplates(role),
    prisma.user.findUnique({ where: { id: userId }, select: { inviteProgramId: true } }),
    getOutreachStreak(userId, now),
    followUpsDueCount(userId, now),
  ])
  const list: ShareKitProgram[] = await Promise.all(programs.map(async (p) => {
    const [offer, display] = await Promise.all([getSignupOffer(p.id, now), programDisplay(p.id)])
    return {
      id: p.id,
      label: p.name,
      name: p.name,
      description: descriptionFromHeadline(display?.headline) ?? 'a NowTransformed program',
      url: appUrl(`/join/${slug}/${p.slug}`),
      owns: true, // invitePrograms only returns the user's own live programs
      seats: offer ? { left: offer.seatsLeft, total: offer.seatsPerMonth } : null,
    }
  }))
  list.push({ id: null, label: 'Any program (main link)', ...MAIN_LINK_PROGRAM, name: MAIN_LINK_PROGRAM.program, url: appUrl(`/join/${slug}`), owns: false, seats: null })
  const chosen = list.findIndex((p) => p.id && p.id === me?.inviteProgramId)

  // Streak with free misses (outreach-streak.ts): shares and invites both count.
  const { streak, doneToday, freeMissesLeft } = streakInfo

  return {
    role,
    sharerFirstName: name?.first ?? '',
    programs: list,
    defaultProgram: chosen >= 0 ? chosen : 0,
    templates: Object.fromEntries(Object.entries(templates).map(([k, t]) => [k, { subject: t.subject, body: t.body }])) as Record<TemplateKey, TemplateText>,
    streak,
    doneToday,
    freeMissesLeft,
    followUpsDue: dueCount,
  }
}
