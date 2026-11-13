/**
 * Server-only loaders for the One-A-Day Invite page (v2) and the sub-nav. Not 'use server': nothing here
 * is a public endpoint; pages and actions check the session first.
 *
 * - loadInvitePage(): everything the Invite page needs (programs with their messages resolved, the
 *   viewer's age flag, mailing address, today's numbers).
 * - invitesUsedToday(): the "Email them for me" daily count (also used by the send action).
 * - loadShareKit(): the older shape, kept so anything still importing it keeps working.
 */
import prisma from '@/lib/prisma'
import { appUrl } from '@/lib/get-involved/emails'
import { getOutreachStreak } from '@/lib/get-involved/outreach-streak'
import { ensureInviteSlug, userDisplayName } from '@/lib/get-involved/server'
import { getInviteProfile, getOutreachSettings, getRegularPrices, getSignupOffer } from '@/lib/get-involved/offer'
import { invitePrograms, programDisplay } from '@/lib/get-involved/program-welcome-server'
import { getOutreachTemplates } from '@/lib/get-involved/outreach-templates-server'
import { MAIN_LINK_PROGRAM, descriptionFromHeadline, type TemplateKey, type TemplateText } from '@/lib/get-involved/outreach-templates'
import { followUpsDueCount } from '@/lib/get-involved/follow-ups'
import { getGeneralScripts, loadProgramPitches } from '@/lib/get-involved/scripts-server'
import type { GeneralScripts, LineIdeas } from '@/lib/get-involved/scripts'
import { SCENARIOS, resolveScript, type ScenarioKey, type ScriptText, type ScriptVariant } from '@/lib/get-involved/scripts'
import { INVITES_PER_DAY } from '@/lib/get-involved/outreach-invites'

// ---------- v2 Invite page ----------

export type ScriptMap = Partial<Record<`${ScenarioKey}:${ScriptVariant}`, ScriptText>>

export interface InviteProgramOption {
  /** null = the main link ("Any program"). */
  id: string | null
  label: string
  /** The sharer owns it: no "I get credit" line, and organization messages are shown. */
  owns: boolean
  /** Sign-up link without ?via (add it per channel). */
  url: string
  business: string
  program: string
  programLine: string
  /** Sponsored seats left this month: {sponsor line} renders. */
  sponsorship: boolean
  /** The owner's regular price for {regular price} (empty = a blank to fill). */
  regularPrice?: string
  /** Every message for this program, resolved (owner > program default > general). */
  scripts: ScriptMap
  /** Ideas for the "why you thought of them" line (null = use the general ones). */
  lineIdeas: LineIdeas | null
}

export interface InvitePageData {
  role: 'COACH' | 'AMBASSADOR'
  myFirstName: string
  myFullName: string
  programs: InviteProgramOption[]
  defaultProgram: number
  /** Under 18: no messages to people they haven't met. */
  minor: boolean
  mailingAddress: string
  photoUrl: string | null
  followUpsDue: number
  /** Days in a row with at least one invitation (free misses keep it going). */
  daysInARow: number
  doneToday: boolean
  /** "Email them for me" people used / allowed in the last 24 hours. */
  emailUsedToday: number
  emailLimit: number
}

const DAY_MS = 24 * 60 * 60_000

/** People this member emailed with "Email them for me" or added by hand in the last 24 hours. */
export async function invitesUsedToday(userId: string, now = new Date()): Promise<number> {
  const since = new Date(now.getTime() - DAY_MS)
  const [sent, added] = await Promise.all([
    prisma.outreachInvite.count({ where: { userId, status: 'SENT', sentAt: { gte: since } } }),
    prisma.prospect.count({ where: { invitedById: userId, inviteSource: 'INVITER_ADDED', createdAt: { gte: since } } }),
  ])
  return sent + added
}

function resolveAllScripts(rows: Parameters<typeof resolveScript>[0], general: GeneralScripts): ScriptMap {
  const out: ScriptMap = {}
  for (const s of SCENARIOS) {
    for (const v of s.variants as readonly ScriptVariant[]) {
      const r = resolveScript(rows, general, s.key, v)
      if (r) out[`${s.key}:${v}`] = { subject: r.subject, body: r.body }
    }
  }
  return out
}

function ageOn(dob: Date, now: Date): number {
  let age = now.getUTCFullYear() - dob.getUTCFullYear()
  const m = now.getUTCMonth() - dob.getUTCMonth()
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) age--
  return age
}

export async function loadInvitePage(userId: string, role: 'COACH' | 'AMBASSADOR', now = new Date()): Promise<InvitePageData> {
  const [slug, name, programs, me, streakInfo, dueCount, settings, profile, used, amb] = await Promise.all([
    ensureInviteSlug(userId),
    userDisplayName(userId),
    invitePrograms(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { inviteProgramId: true } }),
    getOutreachStreak(userId, now),
    followUpsDueCount(userId, now),
    getOutreachSettings(),
    getInviteProfile(userId),
    invitesUsedToday(userId, now),
    role === 'AMBASSADOR' ? prisma.ambassador.findUnique({ where: { userId }, select: { dateOfBirth: true } }) : Promise.resolve(null),
  ])
  // General messages include the admin's edits from Message templates.
  const [pitches, general] = await Promise.all([loadProgramPitches(programs.map((p) => p.id)), getGeneralScripts()])
  const prices = await getRegularPrices(programs.map((p) => p.id))
  const list: InviteProgramOption[] = await Promise.all(programs.map(async (p) => {
    const pitch = pitches.get(p.id)
    const offer = await getSignupOffer(p.id, now).catch(() => null)
    return {
      id: p.id,
      label: p.name,
      owns: true, // invitePrograms only returns the user's own live programs
      url: appUrl(`/join/${slug}/${p.slug}`),
      business: pitch?.business ?? p.company ?? p.name,
      program: pitch?.program ?? p.name,
      programLine: pitch?.programLine ?? 'a NowTransformed program',
      sponsorship: !!offer && offer.seatsLeft > 0,
      regularPrice: prices.get(p.id) ?? '',
      scripts: resolveAllScripts(pitch?.rows ?? [], general),
      lineIdeas: pitch?.lineIdeas ?? null,
    }
  }))
  list.push({
    id: null,
    label: list.length ? 'Any program (my main link)' : 'NowTransformed (my link)',
    owns: false,
    url: appUrl(`/join/${slug}`),
    business: 'NowTransformed',
    program: MAIN_LINK_PROGRAM.program,
    programLine: MAIN_LINK_PROGRAM.description,
    sponsorship: false,
    scripts: resolveAllScripts([], general),
    lineIdeas: null,
  })
  const chosen = list.findIndex((p) => p.id && p.id === me?.inviteProgramId)
  return {
    role,
    myFirstName: name?.first ?? '',
    myFullName: name?.full ?? name?.first ?? '',
    programs: list,
    defaultProgram: chosen >= 0 ? chosen : 0,
    minor: amb?.dateOfBirth ? ageOn(amb.dateOfBirth, now) < 18 : false,
    mailingAddress: settings.mailingAddress,
    photoUrl: profile?.photoUrl ?? null,
    followUpsDue: dueCount,
    daysInARow: streakInfo.streak,
    doneToday: streakInfo.doneToday,
    emailUsedToday: used,
    emailLimit: INVITES_PER_DAY,
  }
}

// ---------- older shape (kept for compatibility) ----------

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
      owns: true,
      seats: offer ? { left: offer.seatsLeft, total: offer.seatsPerMonth } : null,
    }
  }))
  list.push({ id: null, label: 'Any program (main link)', ...MAIN_LINK_PROGRAM, name: MAIN_LINK_PROGRAM.program, url: appUrl(`/join/${slug}`), owns: false, seats: null })
  const chosen = list.findIndex((p) => p.id && p.id === me?.inviteProgramId)
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
