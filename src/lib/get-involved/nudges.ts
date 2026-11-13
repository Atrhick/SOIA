/**
 * Outreach round 1 automatic emails, run by the cron (src/app/api/cron/discovery-reminders/route.ts).
 * Server only, not 'use server'.
 *
 * Schedule (all skip prospects with emailOptOutAt):
 * - Welcome (E9): adults (not UNDER_18) with a journeyToken, FORM_SUBMITTED, no discovery calls at all,
 *   created >= 20 minutes ago and after WELCOME_CUTOFF (older prospects got the old welcome at sign-up).
 * - Nudge 1 (E11): day 2 to day 7 after the form; nudge 2: day 7 to day 14 (the last). Only while
 *   FORM_SUBMITTED with no BOOKED call, no "Maybe later" pending, adults, created after WELCOME_CUTOFF.
 *   A nudge that is overdue past its window is skipped, never sent late.
 * - Check-in: once, on checkInAt ("Maybe later"), while still FORM_SUBMITTED with no booked call.
 * - 3-day call reminder (E10): 26h to 72h before the call, only for calls booked at least 72h ahead.
 *
 * Every send is claimed first with a conditional updateMany (the same conditions as the query), so
 * two cron runs at once never send twice. The who-is-due rules are pure functions, tested in nudges.test.ts.
 */
import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { BUSINESS_TZ } from './core'
import { appUrl } from './emails'
import { emailActionPath } from './email-links'
import { journeyUrl, newToken, userDisplayName } from './server'
import { getInviteProfile, getSignupOffer } from './offer'
import { primeEmailFooter } from './emails/footer-settings'
import { welcomeCallEmail } from './emails/welcome'
import { checkInEmail, nudge1Email, nudge2Email } from './emails/nudges'
import { threeDayReminderEmail } from './emails/reminders'

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

/** Only prospects created after this deploy get the cron welcome and the nudges. */
// OUTREACH_EMAILS_SINCE (ISO date) overrides it, e.g. for local end-to-end tests that back-date sign-ups.
const cutoffEnv = process.env.OUTREACH_EMAILS_SINCE ? new Date(process.env.OUTREACH_EMAILS_SINCE) : null
export const WELCOME_CUTOFF = cutoffEnv && !Number.isNaN(cutoffEnv.getTime()) ? cutoffEnv : new Date('2026-11-12T13:00:00Z')
export const WELCOME_DELAY_MS = 20 * MIN
export const NUDGE1_AFTER_MS = 2 * DAY
export const NUDGE2_AFTER_MS = 7 * DAY
/** Nudges are not sent after this (the original link window). */
export const NUDGE_STOP_MS = 14 * DAY
export const CHECK_IN_AFTER_DAYS = 30
export const THREE_DAY_MS = 72 * HOUR
/** The 3-day email is not sent closer than this, so it never lands next to the day-before one. */
export const THREE_DAY_MIN_LEFT_MS = 26 * HOUR

const ADULT_RANGES = ['AGE_18_24', 'AGE_25_55', 'AGE_56_PLUS'] as const

// ---------- pure rules ----------

export interface OutreachFacts {
  createdAt: Date
  ageRange: string | null
  status: string
  journeyToken: string | null
  emailOptOutAt: Date | null
  welcomeEmailSentAt: Date | null
  nudge1SentAt: Date | null
  nudge2SentAt: Date | null
  checkInAt: Date | null
  checkInSentAt: Date | null
  /** Any discovery call row at all (booked, cancelled, kept...). */
  callCount: number
  /** Calls with status BOOKED. */
  bookedCallCount: number
}

const base = (p: OutreachFacts) => !!p.journeyToken && !p.emailOptOutAt && p.status === 'FORM_SUBMITTED'
const adult = (p: OutreachFacts) => p.ageRange !== 'UNDER_18'

export function welcomeDue(p: OutreachFacts, now: Date): boolean {
  return base(p) && adult(p) && !p.welcomeEmailSentAt && p.callCount === 0
    && p.createdAt > WELCOME_CUTOFF && now.getTime() - p.createdAt.getTime() >= WELCOME_DELAY_MS
}

/** Which nudge is due now: 1, 2 or null. */
export function nudgeDue(p: OutreachFacts, now: Date): 1 | 2 | null {
  if (!base(p) || !adult(p) || p.bookedCallCount > 0 || p.checkInAt || p.createdAt <= WELCOME_CUTOFF) return null
  const age = now.getTime() - p.createdAt.getTime()
  if (age >= NUDGE2_AFTER_MS && age < NUDGE_STOP_MS) return p.nudge2SentAt ? null : 2
  if (age >= NUDGE1_AFTER_MS && age < NUDGE2_AFTER_MS) return p.nudge1SentAt ? null : 1
  return null
}

export function checkInDue(p: OutreachFacts, now: Date): boolean {
  return base(p) && p.bookedCallCount === 0 && !!p.checkInAt && p.checkInAt <= now && !p.checkInSentAt
}

/** When "Maybe later" asks us to check in. */
export const checkInDate = (now: Date) => new Date(now.getTime() + CHECK_IN_AFTER_DAYS * DAY)

export function threeDayReminderDue(
  c: { status: string; startsAt: Date; createdAt: Date; reminder3dSentAt: Date | null },
  p: { status: string; emailOptOutAt: Date | null },
  now: Date,
): boolean {
  if (c.status !== 'BOOKED' || p.status !== 'DISCOVERY_BOOKED' || p.emailOptOutAt || c.reminder3dSentAt) return false
  const left = c.startsAt.getTime() - now.getTime()
  if (left > THREE_DAY_MS || left <= THREE_DAY_MIN_LEFT_MS) return false
  // Booked less than 3 days ahead: the booking confirmation is recent enough, skip it.
  return c.startsAt.getTime() - c.createdAt.getTime() >= THREE_DAY_MS
}

// ---------- senders ----------

const factsSelect = {
  id: true, firstName: true, email: true, createdAt: true, ageRange: true, status: true, journeyToken: true, emailOptOutAt: true,
  welcomeEmailSentAt: true, nudge1SentAt: true, nudge2SentAt: true, checkInAt: true, checkInSentAt: true, invitedById: true, programId: true,
  discoveryCalls: { select: { status: true } },
} as const

type Row = { discoveryCalls: { status: string }[] } & Omit<OutreachFacts, 'callCount' | 'bookedCallCount'>
const facts = (r: Row): OutreachFacts => ({ ...r, callCount: r.discoveryCalls.length, bookedCallCount: r.discoveryCalls.filter((c) => c.status === 'BOOKED').length })

const adultWhere = { OR: [{ ageRange: null }, { ageRange: { in: [...ADULT_RANGES] } }] }
const link = (action: Parameters<typeof emailActionPath>[0], id: string) => { const p = emailActionPath(action, id); return p ? appUrl(p) : null }

async function inviterFor(userId: string | null) {
  if (!userId) return null
  const [name, profile] = await Promise.all([userDisplayName(userId), getInviteProfile(userId).catch(() => null)])
  if (!name) return null
  const roleLabel = name.role === 'COACH' ? 'NowTransformed coach' : name.role === 'AMBASSADOR' ? 'NowTransformed ambassador' : 'NowTransformed'
  return { name: name.full, roleLabel, photoUrl: profile?.photoUrl ? appUrl(profile.photoUrl) : null }
}

async function programFor(programId: string | null) {
  if (!programId) return null
  const p = await prisma.coachProgram.findUnique({ where: { id: programId }, select: { name: true, organization: true, welcomeNote: true, welcomeNoteApprovedAt: true } })
  if (!p) return null
  // Same rule as program-welcome-server.ts: the paragraph only while approved.
  return { name: p.name, company: p.organization, note: p.welcomeNoteApprovedAt && p.welcomeNote ? p.welcomeNote : null }
}

async function offerFor(programId: string | null) {
  const o = await getSignupOffer(programId).catch(() => null)
  // Only whether seats are left: prospect emails never carry prices (the team offers the seat on the call).
  return o ? { seatsLeft: o.seatsLeft } : null
}

async function sendWelcomes(now: Date): Promise<number> {
  const rows = await prisma.prospect.findMany({
    where: {
      status: 'FORM_SUBMITTED', journeyToken: { not: null }, welcomeEmailSentAt: null, emailOptOutAt: null,
      createdAt: { gt: WELCOME_CUTOFF, lte: new Date(now.getTime() - WELCOME_DELAY_MS) },
      discoveryCalls: { none: {} }, ...adultWhere,
    },
    select: factsSelect,
    take: 100,
  })
  let sent = 0
  for (const r of rows) {
    if (!welcomeDue(facts(r), now)) continue
    // The link is extended (same token) because the person may still have the sign-up page open.
    const claim = await prisma.prospect.updateMany({
      where: { id: r.id, status: 'FORM_SUBMITTED', welcomeEmailSentAt: null, emailOptOutAt: null, discoveryCalls: { none: {} } },
      data: { welcomeEmailSentAt: now, journeyTokenIssuedAt: now },
    })
    if (claim.count === 0) continue
    const [inviter, program, offer] = await Promise.all([inviterFor(r.invitedById), programFor(r.programId), offerFor(r.programId)])
    await sendEmail({ to: r.email, ...welcomeCallEmail({ firstName: r.firstName, bookUrl: journeyUrl(r.journeyToken!), inviter, program, offer, prospectId: r.id }) })
    sent++
  }
  return sent
}

async function sendNudges(now: Date): Promise<{ nudge1: number; nudge2: number }> {
  const t = now.getTime()
  const rows = await prisma.prospect.findMany({
    where: {
      status: 'FORM_SUBMITTED', journeyToken: { not: null }, emailOptOutAt: null, checkInAt: null,
      createdAt: { gt: new Date(Math.max(WELCOME_CUTOFF.getTime(), t - NUDGE_STOP_MS)), lte: new Date(t - NUDGE1_AFTER_MS) },
      discoveryCalls: { none: { status: 'BOOKED' } },
      OR: [{ nudge1SentAt: null }, { nudge2SentAt: null }],
      AND: [adultWhere],
    },
    select: factsSelect,
    take: 200,
  })
  let nudge1 = 0, nudge2 = 0
  for (const r of rows) {
    const which = nudgeDue(facts(r), now)
    if (!which) continue
    const field = which === 1 ? 'nudge1SentAt' : 'nudge2SentAt'
    // Scheduled system email: extend the link (same token), as the other cron reminders do.
    const claim = await prisma.prospect.updateMany({
      where: { id: r.id, status: 'FORM_SUBMITTED', emailOptOutAt: null, checkInAt: null, [field]: null, discoveryCalls: { none: { status: 'BOOKED' } } },
      data: { [field]: now, journeyTokenIssuedAt: now },
    })
    if (claim.count === 0) continue
    const bookUrl = journeyUrl(r.journeyToken!)
    if (which === 1) {
      const program = await programFor(r.programId)
      await sendEmail({ to: r.email, ...nudge1Email({ firstName: r.firstName, programName: program?.name ?? null, formAt: r.createdAt, tz: BUSINESS_TZ, bookUrl, callMeUrl: link('callme', r.id), prospectId: r.id }) })
      nudge1++
    } else {
      const offer = await offerFor(r.programId)
      await sendEmail({ to: r.email, ...nudge2Email({ firstName: r.firstName, offer, bookUrl, laterUrl: link('later', r.id), stopUrl: link('stop', r.id), prospectId: r.id }) })
      nudge2++
    }
  }
  return { nudge1, nudge2 }
}

async function sendCheckIns(now: Date): Promise<number> {
  const rows = await prisma.prospect.findMany({
    where: { status: 'FORM_SUBMITTED', journeyToken: { not: null }, emailOptOutAt: null, checkInAt: { lte: now }, checkInSentAt: null, discoveryCalls: { none: { status: 'BOOKED' } } },
    select: factsSelect,
    take: 100,
  })
  let sent = 0
  for (const r of rows) {
    if (!checkInDue(facts(r), now)) continue
    // A month later the old link has expired: issue a NEW token (refreshJourneyToken rule) in the claim itself.
    const token = newToken()
    const claim = await prisma.prospect.updateMany({
      where: { id: r.id, status: 'FORM_SUBMITTED', emailOptOutAt: null, checkInSentAt: null, checkInAt: { lte: now } },
      data: { checkInSentAt: now, journeyToken: token, journeyTokenIssuedAt: now },
    })
    if (claim.count === 0) continue
    await sendEmail({ to: r.email, ...checkInEmail({ firstName: r.firstName, bookUrl: journeyUrl(token), stopUrl: link('stop', r.id), prospectId: r.id }) })
    sent++
  }
  return sent
}

async function sendThreeDayReminders(now: Date): Promise<number> {
  const t = now.getTime()
  const calls = await prisma.discoveryCall.findMany({
    where: {
      status: 'BOOKED', reminder3dSentAt: null,
      startsAt: { gt: new Date(t + THREE_DAY_MIN_LEFT_MS), lte: new Date(t + THREE_DAY_MS) },
      prospect: { status: 'DISCOVERY_BOOKED', emailOptOutAt: null, journeyToken: { not: null } },
    },
    include: { prospect: true },
    take: 200,
  })
  let sent = 0
  for (const c of calls) {
    const p = c.prospect
    if (!threeDayReminderDue(c, p, now)) continue
    const claim = await prisma.discoveryCall.updateMany({ where: { id: c.id, status: 'BOOKED', reminder3dSentAt: null, startsAt: c.startsAt }, data: { reminder3dSentAt: now } })
    if (claim.count === 0) continue
    const host = c.hostId ? await userDisplayName(c.hostId) : null
    const token = p.journeyToken!
    const base = {
      firstName: p.firstName, startsAt: c.startsAt, endsAt: c.endsAt, tz: c.timezone, hostFirst: host?.first ?? null, meetingUrl: c.meetingUrl,
      manageUrl: journeyUrl(token), confirmUrl: link('confirm', c.id), calendarUrl: appUrl(`/discovery/${token}/calendar`), prospectId: p.id,
    }
    await sendEmail({ to: p.email, ...threeDayReminderEmail(base) })
    if (p.ageRange === 'UNDER_18' && p.parentEmail) {
      await sendEmail({ to: p.parentEmail, ...threeDayReminderEmail({ ...base, parent: { first: (p.parentName ?? '').split(' ')[0] || 'Hi' } }) })
    }
    // Hosts get no 3-day email (they keep their day-before and 1-hour reminders).
    sent++
  }
  return sent
}

export interface OutreachResult { welcome: number; nudge1: number; nudge2: number; checkIn: number; threeDay: number }

/** All outreach emails; an error in one kind does not stop the others. */
export async function runOutreachEmails(now = new Date()): Promise<OutreachResult> {
  await primeEmailFooter()
  const out: OutreachResult = { welcome: 0, nudge1: 0, nudge2: 0, checkIn: 0, threeDay: 0 }
  try { out.welcome = await sendWelcomes(now) } catch (e) { console.error('[CRON] welcome emails failed', e) }
  try { Object.assign(out, await sendNudges(now)) } catch (e) { console.error('[CRON] nudges failed', e) }
  try { out.checkIn = await sendCheckIns(now) } catch (e) { console.error('[CRON] check-ins failed', e) }
  try { out.threeDay = await sendThreeDayReminders(now) } catch (e) { console.error('[CRON] 3-day reminders failed', e) }
  return out
}
