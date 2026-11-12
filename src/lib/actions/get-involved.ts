'use server'

import { blockedDaysByUser, hostsForSlots } from '@/lib/get-involved/discovery-slots'

/**
 * Get Involved journey: public form, parent consent, discovery-call booking,
 * reschedule and cancel. These are called by people without a login, so every
 * entry point validates input, is rate limited, and never reveals whether an
 * email is already in the system.
 */
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { sendEmail } from '@/lib/email'
import { primeEmailFooter } from '@/lib/get-involved/emails/footer-settings'
import {
  AgeRangeValue, CALL_MINUTES, ageRangeLabel, canProspectChange, generateSlots, journeyOpen, linkStillValid, pickHost,
} from '@/lib/get-involved/core'
import * as mail from '@/lib/get-involved/emails'
import {
  afterCancelEmails, busyBlocks, callsPathFor, clientIp, consentUrl, emailEquals, emailInviter, emailInviterNewLead, eligibleHosts, inviterBySlug,
  isStatusConflict, journeyUrl, journeyUsable, mustTransition, newToken, notifyAdmins, prospectByJourneyToken, rateLimited,
  transitionStatus, upcomingCounts, userDisplayName,
} from '@/lib/get-involved/server'
import { programForSignup } from '@/lib/get-involved/program-welcome-server'
import { sendFreshJourneyLink } from '@/lib/get-involved/journey'
import { getSignupOffer, smsEnabled } from '@/lib/get-involved/offer'
import { bookViewFor } from '@/app/(public)/discovery/[token]/book-view'
import type { BookView } from '@/components/get-involved/signup/booking'

/** `field` names the form field the error belongs to, so the page can mark that input. */
type Result = { success: true; message?: string } | { error: string; field?: string }

const AGE = z.enum(['UNDER_18', 'AGE_18_24', 'AGE_25_55', 'AGE_56_PLUS'])
const trimmed = (max: number) => z.string().trim().max(max)

/** Share-link channels (?via=), stored uppercased in Prospect.inviteChannel. Anything else is ignored. */
const CHANNELS = ['text', 'whatsapp', 'email', 'dm', 'post', 'parent'] as const
function channelFrom(v: unknown): string | null {
  const c = String(v ?? '').trim().toLowerCase()
  return (CHANNELS as readonly string[]).includes(c) ? c.toUpperCase() : null
}

/** The teen's answer to "They are my", mapped to the consent wording (the parent confirms it on the consent page). */
const TEEN_RELATIONSHIP: Record<string, string | null> = { Mother: 'Parent', Father: 'Parent', Guardian: 'Legal guardian', Other: null }

const phoneDigits = (v: string) => v.replace(/\D/g, '').length

const intakeSchema = z
  .object({
    firstName: trimmed(60).min(1, 'Please enter a first name'),
    lastName: trimmed(60).min(1, 'Please enter a last name'),
    email: z.string().trim().toLowerCase().email('Please enter a valid email').max(200),
    // "+1 (702) 555-0123" from PhoneInput (dial code + national number) and the ISO country of the dial code.
    phone: trimmed(40).optional().default(''),
    phoneCountryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).optional().catch(undefined),
    smsConsent: z.string().optional(),
    city: trimmed(100).optional().default(''),
    ageRange: AGE,
    consent: z.literal('on', { message: 'Please agree to be contacted so we can follow up' }),
    parentName: trimmed(120).optional().default(''),
    parentEmail: z.string().trim().toLowerCase().max(200).optional().default(''),
    parentPhone: trimmed(40).optional().default(''),
    parentRelationship: z.enum(['Mother', 'Father', 'Guardian', 'Other']).optional().catch(undefined),
    note: trimmed(1000).optional().default(''),
    via: z.string().optional(),
    waitlist: z.string().optional(),
  })
  .superRefine((d, ctx) => {
    // Adults must give a mobile number (hosts call or text before the call); 17 and under may leave it out.
    if (d.phone) {
      if (!/^[+\d\s().-]+$/.test(d.phone) || phoneDigits(d.phone) < 7 || phoneDigits(d.phone) > 16) ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Please check your mobile number' })
    } else if (d.ageRange !== 'UNDER_18') {
      ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Please enter a mobile number so your host can reach you' })
    }
    if (d.ageRange === 'UNDER_18') {
      if (!d.parentName) ctx.addIssue({ code: 'custom', path: ['parentName'], message: "Please enter a parent or guardian's name" })
      if (!z.string().email().safeParse(d.parentEmail).success) ctx.addIssue({ code: 'custom', path: ['parentEmail'], message: "Please enter a parent or guardian's email" })
      else if (d.parentEmail === d.email) ctx.addIssue({ code: 'custom', path: ['parentEmail'], message: "The parent's email must be different from yours" })
    }
  })

function formObject(fd: FormData) {
  const o: Record<string, string> = {}
  fd.forEach((v, k) => { if (typeof v === 'string') o[k] = v })
  // The public form asks for "First and last name" in one box.
  if (o.fullName !== undefined && o.firstName === undefined) {
    const parts = o.fullName.trim().split(/\s+/).filter(Boolean)
    o.firstName = parts[0] ?? ''
    o.lastName = parts.slice(1).join(' ')
  }
  return o
}

/** First zod issue as { error, field }; name errors from the one-box name field point at it. */
function firstIssue(e: z.ZodError, fd: FormData): { error: string; field?: string } {
  const i = e.issues[0]
  const path0 = typeof i?.path[0] === 'string' ? i.path[0] : undefined
  const oneBox = fd.get('fullName') !== null && (path0 === 'firstName' || path0 === 'lastName')
  if (oneBox) return { error: 'Please enter your first and last name', field: 'fullName' }
  return { error: i?.message ?? 'Please check the form', field: path0 }
}

type IntakeOutcome = { kind: 'created'; prospectId: string; journeyToken: string } | { kind: 'exists-mine' } | { kind: 'exists' } | { kind: 'limited' }

/**
 * Shared by the public form and an inviter's "Add someone I talked to".
 * Returns 'created', 'exists-mine' (already invited by this inviter), 'exists' (anyone else's, or not
 * a Get Involved prospect) or 'limited' (too many emails to that address). Emails are sent after the
 * database write.
 */
async function createIntake(data: z.infer<typeof intakeSchema>, inviterId: string | null, source: 'INVITE_LINK' | 'INVITER_ADDED', programSlug: string | null = null): Promise<IntakeOutcome> {
  // Cap emails per address, whatever the source, so neither path can be used to flood an inbox.
  const flood = rateLimited(`gi-to:${data.email}`, 3, 60 * 60_000) || (data.parentEmail ? rateLimited(`gi-to:${data.parentEmail}`, 3, 60 * 60_000) : false)
  if (flood) return { kind: 'limited' }
  // Case-insensitive: older paths stored emails as typed, and the unique index is case-sensitive.
  const existing = await prisma.prospect.findFirst({ where: { email: emailEquals(data.email) }, select: { id: true, invitedById: true } })
  if (existing) {
    // Don't reveal it. On the public form, send the person a fresh link to their current step, but
    // only while their journey is open (never after Not a fit, a pause or once they have a login).
    if (source === 'INVITE_LINK') await sendFreshJourneyLink(data.email)
    return { kind: inviterId && existing.invitedById === inviterId ? 'exists-mine' : 'exists' }
  }

  const minor = data.ageRange === 'UNDER_18'
  const now = new Date()
  // The inviter's program page this came through (its link, or their latest with an approved note).
  const program = await programForSignup(inviterId, programSlug).catch(() => null)
  const journeyToken = newToken()
  const parentConsentToken = minor ? newToken() : null
  let prospectId: string
  try {
    prospectId = await prisma.$transaction(async (tx) => {
      const p = await tx.prospect.create({
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone || null,
          phoneCountryCode: data.phone && data.phoneCountryCode ? data.phoneCountryCode : undefined,
          // Text reminders only when the feature is on, a number was given and the box was ticked.
          smsConsentAt: smsEnabled() && data.phone && data.smsConsent === 'on' ? now : null,
          city: data.city || null,
          inviteChannel: channelFrom(data.via),
          ageRange: data.ageRange,
          contactConsentAt: now,
          invitedById: inviterId,
          programId: program?.id ?? null,
          inviteSource: source,
          inviterNote: data.note || null,
          journeyToken,
          journeyTokenIssuedAt: minor ? null : now,
          parentName: minor ? data.parentName : null,
          parentEmail: minor ? data.parentEmail : null,
          parentPhone: minor ? data.parentPhone || null : null,
          parentRelationship: minor && data.parentRelationship ? TEEN_RELATIONSHIP[data.parentRelationship] : null,
          parentConsentToken,
          parentConsentRequestedAt: minor ? now : null,
          status: minor ? 'AWAITING_PARENT_CONSENT' : 'FORM_SUBMITTED',
        },
        select: { id: true },
      })
      await tx.prospectStatusHistory.create({ data: { prospectId: p.id, toStatus: minor ? 'AWAITING_PARENT_CONSENT' : 'FORM_SUBMITTED', changedBy: inviterId, notes: source === 'INVITE_LINK' ? 'Get Involved form' : 'Added by inviter' } })
      return p.id
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return { kind: 'exists' }
    throw e
  }

  const inviter = inviterId ? await userDisplayName(inviterId) : null
  const programMail = program?.note ? { name: program.name, company: program.company, note: program.note } : null
  // Adults: no welcome email now. They usually book on the sign-up page; the reminders cron sends the
  // welcome (with the booking link) ~20 minutes later only if no call was booked (welcomeEmailSentAt
  // stays null until then). Parents of 17 and under are asked for consent at once.
  if (minor) {
    await primeEmailFooter()
    await sendEmail({ to: data.parentEmail, ...mail.parentConsentEmail({ parentName: data.parentName, childFirst: data.firstName, inviterName: inviter?.full ?? null, consentUrl: consentUrl(parentConsentToken!), program: programMail, prospectId }) })
  }
  if (inviterId && source === 'INVITE_LINK') await emailInviterNewLead(inviterId, { name: `${data.firstName} ${data.lastName}`, ageRange: data.ageRange, city: data.city || null })
  await notifyAdmins('New Get Involved form', `${data.firstName} ${data.lastName} (${ageRangeLabel(data.ageRange)})${inviter ? ` was invited by ${inviter.full}` : ''}.`, prospectId).catch(() => {})
  // "Join the waiting list" (sponsored seats full): only when this program really has an offer.
  if (source === 'INVITE_LINK' && data.waitlist === 'on' && program) {
    await addToSeatWaitlist(prospectId, `${data.firstName} ${data.lastName}`, program.id, program.name).catch((e) => console.error('[GET-INVOLVED] waitlist failed', e))
  }
  return { kind: 'created', prospectId, journeyToken }
}

/** Sponsored seats are full: record a SEAT_WAITLIST request (once) and tell the admins. */
async function addToSeatWaitlist(prospectId: string, name: string, programId: string, programName: string) {
  const offer = await getSignupOffer(programId)
  if (!offer) return
  const open = await prisma.discoverySlotRequest.findFirst({ where: { prospectId, kind: 'SEAT_WAITLIST', handledAt: null }, select: { id: true } })
  if (open) return
  await prisma.discoverySlotRequest.create({ data: { prospectId, kind: 'SEAT_WAITLIST' } })
  await notifyAdmins('Sponsored seat waiting list', `${name} joined the waiting list for a sponsored seat in ${programName}.`, prospectId)
}

/**
 * What the sign-up page shows next:
 * - 'book': a NEW adult sign-up; `token` is their own journey token so they can book on the same screen.
 * - 'parent': a new 17-and-under sign-up; the parent was emailed.
 * - 'check-email': anything else (email already signed up, rate limited, honeypot). Never shows
 *   details about an existing person; an open journey gets a fresh link by email.
 */
export type SignupResult =
  | { success: true; next: 'book'; token: string; firstName: string }
  | { success: true; next: 'parent'; firstName: string; parentFirst: string }
  | { success: true; next: 'check-email'; firstName: string }
  | { error: string; field?: string }

/** Public form at /join/[slug]. */
export async function submitGetInvolved(slug: string, formData: FormData): Promise<SignupResult> {
  // Honeypot: real people never fill the hidden "website" field.
  if (String(formData.get('website') ?? '').trim()) return { success: true, next: 'check-email', firstName: '' }
  if (rateLimited(`gi:${await clientIp()}`, 8, 10 * 60_000)) return { error: 'Too many attempts. Please wait a few minutes and try again.' }

  const inviter = await inviterBySlug(String(slug ?? ''))
  if (!inviter) return { error: 'This invite link is not active.' }

  // The page says how details are used right under the button ("We use your details only to set up
  // your call..."), so sending the form is the contact consent.
  const obj = formObject(formData)
  obj.consent = 'on'
  const parsed = intakeSchema.safeParse(obj)
  if (!parsed.success) return firstIssue(parsed.error, formData)

  try {
    const programSlug = String(formData.get('program') ?? '').trim().slice(0, 120) || null
    const r = await createIntake({ ...parsed.data, note: '' }, inviter.id, 'INVITE_LINK', programSlug)
    const firstName = parsed.data.firstName
    if (r.kind === 'created') {
      if (parsed.data.ageRange === 'UNDER_18') return { success: true, next: 'parent', firstName, parentFirst: parsed.data.parentName.split(' ')[0] || 'your parent' }
      return { success: true, next: 'book', token: r.journeyToken, firstName }
    }
    return { success: true, next: 'check-email', firstName }
  } catch (e) {
    console.error('[GET-INVOLVED] submit failed', e)
    return { error: 'Something went wrong. Please try again.' }
  }
}

const ADD_PER_DAY = 20

/** A coach or ambassador adds someone they talked to. */
export async function addPersonAsInviter(formData: FormData): Promise<Result> {
  const session = await auth()
  if (!session || !['COACH', 'AMBASSADOR'].includes(session.user.role)) return { error: 'Unauthorized' }
  if (session.user.isImpersonating) return { error: 'Switch back to your own account to add people.' }

  const parsed = intakeSchema.safeParse(formObject(formData))
  if (!parsed.success) return firstIssue(parsed.error, formData)
  // Per inviter: keeps the leaderboard honest and stops this from emailing arbitrary addresses at volume.
  if (rateLimited(`gi-add:${session.user.id}`, ADD_PER_DAY, 24 * 60 * 60_000)) {
    return { error: `You can add up to ${ADD_PER_DAY} people a day here. Please try again tomorrow, or share your invite link.` }
  }

  try {
    const r = await createIntake({ ...parsed.data, waitlist: undefined }, session.user.id, 'INVITER_ADDED')
    if (r.kind === 'exists-mine') return { error: `${parsed.data.firstName} is already on your list. No duplicate was created.` }
    revalidatePath('/coach/one-a-day')
    revalidatePath('/ambassador/one-a-day')
    // Same answer whether the person was new or already known to someone else, so this can't be used
    // to look up who is in the system.
    return { success: true, message: parsed.data.ageRange === 'UNDER_18' ? 'Thanks. Our team will follow up with their parent first.' : 'Thanks. Our team will follow up with them.' }
  } catch (e) {
    console.error('[GET-INVOLVED] add person failed', e)
    return { error: 'Something went wrong. Please try again.' }
  }
}

// ---------- parent consent ----------

const consentSchema = z.object({
  signature: trimmed(120).min(2, 'Please type your full name to sign'),
  relationship: z.enum(['Parent', 'Legal guardian']),
  confirm: z.literal('on', { message: 'Please confirm you are the parent or legal guardian' }),
})

/** On success, bookPath is the booking page for the CURRENT journey token (consent issues a new one). */
export async function giveParentConsent(token: string, formData: FormData): Promise<Result & { bookPath?: string | null }> {
  if (rateLimited(`consent:${await clientIp()}`, 20, 10 * 60_000)) return { error: 'Too many attempts. Please wait a few minutes.' }
  const parsed = consentSchema.safeParse(formObject(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form' }

  const INVALID = 'This consent link is no longer valid.'
  const p = await prisma.prospect.findUnique({ where: { parentConsentToken: String(token ?? '') } })
  if (!p || p.parentConsentDeclinedAt) return { error: INVALID }
  if (p.parentConsentAt) return { success: true, bookPath: p.journeyToken ? `/discovery/${p.journeyToken}` : null }
  // Only while the young person is still waiting for consent: never reopens someone staff closed.
  if (p.status !== 'AWAITING_PARENT_CONSENT') return { error: INVALID }
  const now = new Date()
  if (!linkStillValid(p.parentConsentRequestedAt, now)) return { error: 'This consent link has expired. Please ask for a new invite.' }
  // Guarded write: a Not a fit, a decline or a second click committed meanwhile makes this a no-op.
  // A fresh journey token is issued with the booking email below.
  const journeyToken = newToken()
  const given = await prisma.$transaction((tx) => transitionStatus(tx, p.id, 'AWAITING_PARENT_CONSENT', 'FORM_SUBMITTED', null, `Consent given by ${parsed.data.signature} (${parsed.data.relationship})`, {
    where: { parentConsentAt: null, parentConsentDeclinedAt: null, parentConsentToken: p.parentConsentToken },
    data: { parentConsentAt: now, parentConsentSignature: parsed.data.signature, parentRelationship: parsed.data.relationship, journeyToken, journeyTokenIssuedAt: now },
  }))
  if (!given) {
    const again = await prisma.prospect.findUnique({ where: { id: p.id }, select: { parentConsentAt: true, journeyToken: true } })
    return again?.parentConsentAt ? { success: true, bookPath: again.journeyToken ? `/discovery/${again.journeyToken}` : null } : { error: INVALID }
  }
  const url = journeyUrl(journeyToken)
  await primeEmailFooter()
  await sendEmail({ to: p.email, ...mail.thanksAfterConsentEmail({ firstName: p.firstName, bookUrl: url, prospectId: p.id }) })
  await emailInviter(p.invitedById, `${p.firstName} ${p.lastName}`, "has their parent's consent and can now book a call")
  return { success: true, bookPath: `/discovery/${journeyToken}` }
}

export async function declineParentConsent(token: string): Promise<Result> {
  const p = await prisma.prospect.findUnique({ where: { parentConsentToken: String(token ?? '') }, select: { id: true, firstName: true, invitedById: true, parentConsentAt: true } })
  if (!p) return { success: true }
  if (p.parentConsentAt) return { error: 'Consent was already given. Reply to any of our emails to withdraw it.' }
  // As promised on the consent page: delete the young person's details.
  await prisma.prospect.delete({ where: { id: p.id } })
  await emailInviter(p.invitedById, p.firstName, "won't be continuing for now")
  return { success: true }
}

// ---------- booking ----------

const tzSchema = z.string().max(64).refine((tz) => { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true } catch { return false } }, 'Unknown time zone')

const bookSchema = z.object({
  startsAt: z.string().datetime(),
  timezone: tzSchema,
  parentWillAttend: z.boolean(),
})

async function lockBooking(tx: Prisma.TransactionClient) {
  // One booking at a time across all instances, so two people can't take the same slot.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(4210911)`
}

/**
 * Book, or move an existing booking to, a new time. The host is chosen on the
 * server from the hosts free at that time.
 */
export type BookedCall = { startsAt: string; endsAt: string; timezone: string; hostName: string; meetingUrl: string | null }

export async function bookDiscoveryCall(token: string, input: { startsAt: string; timezone: string; parentWillAttend: boolean }): Promise<{ success: true; call: BookedCall } | { error: string }> {
  if (rateLimited(`book:${await clientIp()}`, 20, 10 * 60_000)) return { error: 'Too many attempts. Please wait a few minutes.' }
  const parsed = bookSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please pick a time' }

  const p = await prospectByJourneyToken(String(token ?? ''))
  const now = new Date()
  if (!p || !journeyUsable(p, now)) return { error: 'This link has expired. Request a new one below.' }
  const minor = p.ageRange === 'UNDER_18'
  if (minor && !p.parentConsentAt) return { error: 'We need your parent or guardian to give consent first.' }
  if (minor && !parsed.data.parentWillAttend) return { error: 'Please confirm your parent or guardian will be on the call.' }
  if (!journeyOpen(p.status)) return { error: 'Please contact the person who invited you to book a new call.' }

  const existing = p.discoveryCalls[0] ?? null
  if (existing && !canProspectChange(existing.startsAt, now)) return { error: 'Your call is less than 2 hours away, so it can no longer be changed here. Please reply to your confirmation email.' }

  const startsAt = new Date(parsed.data.startsAt)
  const hosts = await eligibleHosts(p.ageRange as AgeRangeValue | null)
  if (hosts.length === 0) return { error: 'No one is available to host calls right now. Please try again soon.' }

  let call: { id: string; hostId: string | null; startsAt: Date; meetingUrl: string | null }
  try {
    call = await prisma.$transaction(async (tx) => {
      await lockBooking(tx)
      // Re-read under the lock: a double-click or second tab may have booked already.
      const current = await tx.discoveryCall.findFirst({ where: { prospectId: p.id, status: 'BOOKED' }, select: { id: true } })
      if ((current?.id ?? null) !== (existing?.id ?? null)) throw new Error('CHANGED')
      const busy = await busyBlocks(hosts.map((h) => h.userId), now, existing?.id, tx)
      const blocked = await blockedDaysByUser(hosts, now, tx)
      const slots = generateSlots(hostsForSlots(hosts, blocked), busy, now)
      const slot = slots.find((s) => s.startsAt.getTime() === startsAt.getTime())
      if (!slot) throw new Error('SLOT_TAKEN')
      // Keep the same host when moving a call, if they're free at the new time.
      const hostId = existing?.hostId && slot.hostIds.includes(existing.hostId) ? existing.hostId : pickHost(slot.hostIds, await upcomingCounts(slot.hostIds, now))
      const host = hosts.find((h) => h.userId === hostId)!
      const data = { hostId, startsAt, endsAt: new Date(startsAt.getTime() + CALL_MINUTES * 60_000), timezone: parsed.data.timezone, meetingUrl: host.meetingUrl, parentWillAttend: minor ? true : parsed.data.parentWillAttend, reminder24hSentAt: null, reminder1hSentAt: null, reminder3dSentAt: null, attendanceConfirmedAt: null }
      const c = existing
        ? await tx.discoveryCall.update({ where: { id: existing.id }, data: { ...data, rescheduleCount: { increment: 1 } } })
        : await tx.discoveryCall.create({ data: { ...data, prospectId: p.id } })
      // Guarded on the status read before the lock: a Not a fit or pause recorded meanwhile wins.
      if (!existing) await mustTransition(tx, p.id, p.status, 'DISCOVERY_BOOKED', null, 'Discovery call booked')
      return c
    })
  } catch (e) {
    if (isStatusConflict(e)) return { error: 'Your booking just changed. Please reload this page.' }
    if (e instanceof Error && e.message === 'SLOT_TAKEN') return { error: 'Sorry, that time was just taken. Please pick another.' }
    if (e instanceof Error && e.message === 'CHANGED') return { error: 'Your booking just changed. Please reload this page.' }
    console.error('[GET-INVOLVED] booking failed', e)
    return { error: 'Something went wrong. Please try again.' }
  }

  await sendCallEmails(p, call, existing ? existing.startsAt : null, existing?.hostId ?? null)
  revalidatePath('/admin/discovery-calls')
  const hostRow = call.hostId ? await prisma.discoveryHost.findUnique({ where: { userId: call.hostId }, select: { displayName: true } }).catch(() => null) : null
  return {
    success: true,
    call: {
      startsAt: call.startsAt.toISOString(),
      endsAt: new Date(call.startsAt.getTime() + CALL_MINUTES * 60_000).toISOString(),
      timezone: parsed.data.timezone,
      hostName: hostRow?.displayName ?? 'our team',
      meetingUrl: call.meetingUrl,
    },
  }
}

async function sendCallEmails(
  p: NonNullable<Awaited<ReturnType<typeof prospectByJourneyToken>>>,
  call: { id: string; hostId: string | null; startsAt: Date; meetingUrl: string | null },
  oldStartsAt: Date | null,
  oldHostId: string | null,
) {
  const c = await prisma.discoveryCall.findUnique({ where: { id: call.id }, select: { timezone: true } })
  const tz = c?.timezone ?? 'America/Chicago'
  const host = call.hostId ? await userDisplayName(call.hostId) : null
  const hostName = host?.full ?? 'our team'
  const manageUrl = journeyUrl(p.journeyToken!)
  const minor = p.ageRange === 'UNDER_18'
  const base = { firstName: p.firstName, startsAt: call.startsAt, tz, hostName, meetingUrl: call.meetingUrl, manageUrl, prospectId: p.id }
  await primeEmailFooter()
  const m = oldStartsAt ? mail.rescheduledEmail({ ...base, oldStartsAt }) : mail.bookedEmail(base)
  await sendEmail({ to: p.email, ...m })
  if (minor && p.parentEmail) {
    const parentFirst = (p.parentName ?? '').split(' ')[0] || 'Hi'
    const pm = oldStartsAt ? mail.rescheduledEmail({ ...base, oldStartsAt, parent: { first: parentFirst } }) : mail.bookedEmail({ ...base, parent: { first: parentFirst } })
    await sendEmail({ to: p.parentEmail, ...pm })
  }
  const inviter = p.invitedById ? await userDisplayName(p.invitedById) : null
  const hostMail = (kind: 'new' | 'moved' | 'cancelled', to: { full: string; first: string; email: string; role: string; tz: string | null }, old?: Date) =>
    sendEmail({
      to: to.email,
      ...mail.hostCallEmail({ kind, hostName: to.first, prospectName: `${p.firstName} ${p.lastName}`, startsAt: kind === 'cancelled' && old ? old : call.startsAt, oldStartsAt: kind === 'moved' ? old : undefined, ageLabel: ageRangeLabel(p.ageRange), inviterName: inviter?.full ?? null, phone: p.phone, parent: minor && p.parentName && p.parentEmail ? { name: p.parentName, email: p.parentEmail, phone: p.parentPhone } : null, callsUrl: mail.appUrl(callsPathFor(to.role)), tz: to.tz }),
    })
  if (host) {
    if (!oldStartsAt) await hostMail('new', host)
    else if (oldHostId === call.hostId) await hostMail('moved', host, oldStartsAt)
    else {
      await hostMail('new', host)
      const oldHost = oldHostId ? await userDisplayName(oldHostId) : null
      if (oldHost) await hostMail('cancelled', oldHost, oldStartsAt)
    }
  }
  // The prospect's own zone: the inviter usually lives in the same region.
  const when = mail.esc(new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: tz, timeZoneName: 'short' }).format(call.startsAt))
  await emailInviter(p.invitedById, `${p.firstName} ${p.lastName}`, oldStartsAt ? `moved their discovery call to ${when}` : `booked a discovery call for ${when}`)
}

const cancelSchema = z.object({ reason: trimmed(200).optional().default('') })

export async function cancelDiscoveryCall(token: string, input: { reason?: string }): Promise<Result> {
  if (rateLimited(`cancel:${await clientIp()}`, 20, 10 * 60_000)) return { error: 'Too many attempts. Please wait a few minutes.' }
  const parsed = cancelSchema.safeParse(input)
  if (!parsed.success) return { error: 'Please check the form' }
  const p = await prospectByJourneyToken(String(token ?? ''))
  const now = new Date()
  const call = p?.discoveryCalls[0]
  if (!p || !call) return { error: 'There is no upcoming call to cancel.' }
  if (!journeyOpen(p.status)) return { error: 'Please reply to your confirmation email to change this call.' }
  if (!canProspectChange(call.startsAt, now)) return { error: 'Your call is less than 2 hours away, so it can no longer be cancelled here. Please reply to your confirmation email.' }

  let done: boolean
  try {
    done = await prisma.$transaction(async (tx) => {
      const r = await tx.discoveryCall.updateMany({ where: { id: call.id, status: 'BOOKED' }, data: { status: 'CANCELLED', cancelledAt: now, cancelledBy: 'PROSPECT', cancelReason: parsed.data.reason || null } })
      if (r.count === 0) return false
      // Same token: the person is on this page now and the rebooking email links back to it.
      await mustTransition(tx, p.id, p.status, 'FORM_SUBMITTED', null, `Prospect cancelled the call${parsed.data.reason ? `: ${parsed.data.reason}` : ''}`, { data: { journeyTokenIssuedAt: now } })
      return true
    })
  } catch (e) {
    if (isStatusConflict(e)) return { error: 'Your booking just changed. Please reload this page.' }
    throw e
  }
  if (!done) return { success: true }
  await primeEmailFooter()
  await afterCancelEmails(p, call, { byHost: false })
  revalidatePath('/admin/discovery-calls')
  return { success: true }
}

/** Expired-link page: send a fresh link. Same answer whether or not the email exists. */
export async function requestNewLink(formData: FormData): Promise<Result> {
  if (rateLimited(`relink:${await clientIp()}`, 5, 10 * 60_000)) return { error: 'Too many attempts. Please wait a few minutes.' }
  const email = z.string().trim().toLowerCase().email().safeParse(formData.get('email'))
  if (!email.success) return { error: 'Please enter a valid email' }
  if (rateLimited(`relink-to:${email.data}`, 3, 60 * 60_000)) return { success: true }
  try {
    // New token (old links stop working), link to the current step, only while the journey is open.
    await sendFreshJourneyLink(email.data)
  } catch (e) {
    console.error('[GET-INVOLVED] relink failed', e)
  }
  return { success: true }
}


// ---------- sign-up page: book on the same screen, "what would you like help with?" ----------

/** The booking step for a token the person was just given by submitGetInvolved. */
export async function signupBookingView(token: string): Promise<{ view: BookView } | { error: string }> {
  if (rateLimited(`signup-view:${await clientIp()}`, 30, 10 * 60_000)) return { error: 'Too many attempts. Please wait a few minutes.' }
  const t = z.string().min(16).max(200).safeParse(token)
  if (!t.success) return { error: 'Please use the link in your email to book.' }
  const p = await prospectByJourneyToken(t.data)
  const now = new Date()
  if (!p || !journeyUsable(p, now) || !journeyOpen(p.status) || p.ageRange === 'UNDER_18') return { error: 'Please use the link in your email to book.' }
  return { view: await bookViewFor(p, now) }
}

const helpSchema = z.object({ token: z.string().min(16).max(200), text: z.string().trim().max(1000, 'Please keep it under 1000 characters') })

/** Booked screen: "Optional: what would you most like help with?" Read by the host before the call. */
export async function saveHelpWith(token: string, text: string): Promise<Result> {
  if (rateLimited(`helpwith:${await clientIp()}`, 20, 10 * 60_000)) return { error: 'Too many attempts. Please wait a few minutes.' }
  const parsed = helpSchema.safeParse({ token, text })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check what you typed' }
  const p = await prospectByJourneyToken(parsed.data.token)
  if (!p || !journeyUsable(p, new Date()) || !journeyOpen(p.status)) return { error: 'This link has expired.' }
  await prisma.prospect.update({ where: { id: p.id }, data: { helpWith: parsed.data.text || null } })
  return { success: true, message: 'Saved. Your host will read this before the call.' }
}

/**
 * "None of these work? Ask us to contact you" on the pick-a-time step. Unlike requestSlotHelp (no
 * times open at all), this works while times are open. One open request per person; admins told once.
 */
export async function askToBeContacted(token: string): Promise<Result> {
  if (rateLimited(`contactme:${await clientIp()}`, 10, 10 * 60_000)) return { error: 'Too many attempts. Please wait a few minutes.' }
  const t = z.string().min(16).max(200).safeParse(token)
  if (!t.success) return { error: 'Please reload the page and try again.' }
  const p = await prospectByJourneyToken(t.data)
  if (!p || !journeyUsable(p, new Date()) || !journeyOpen(p.status)) return { error: 'This link has expired.' }
  if (p.ageRange === 'UNDER_18' && !p.parentConsentAt) return { error: 'We need your parent or guardian to give consent first.' }
  const open = await prisma.discoverySlotRequest.findFirst({ where: { prospectId: p.id, kind: 'REACH_OUT', handledAt: null }, select: { id: true } })
  if (!open) {
    await prisma.discoverySlotRequest.create({ data: { prospectId: p.id, kind: 'REACH_OUT' } })
    const name = `${p.firstName} ${p.lastName}`
    await notifyAdmins('Prospect asked us to reach out', `${name} (${ageRangeLabel(p.ageRange)}) couldn't find a call time that works and asked for someone to contact them. Email ${p.email}${p.phone ? `, phone ${p.phone}` : ''}.`, p.id)
    await emailInviter(p.invitedById, name, "couldn't find a call time that works and asked us to reach out. A quick message from you could help")
  }
  return { success: true, message: 'Done. Someone from our team will contact you.' }
}
