/**
 * Phase 2/3 journey helpers: token lookups, journey links, Not a fit. Server only, not 'use server'.
 * Every step after the discovery call lives under /journey/[token]/... using Prospect.journeyToken;
 * /discovery/[token] (booking) keeps working unchanged.
 */
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import {
  GetInvolvedRoleValue, JourneyFacts, JourneyStage, RoleConfig, canChooseRole, canMarkNotAFit, canResendLink, isPaidRole, journeyPosition,
  linkStillValid, roleConfigSnapshot, rolesForAge, stagePath, statusAfterRoleChosen,
} from './core'
import * as mail from './emails'
import { StatusConflictError, emailInviter, newToken, transitionStatus } from './server'
import { getRoleConfig, prospectRoleConfig } from './roles'

type Db = Prisma.TransactionClient | typeof prisma

/** Sub-pages under /journey/[token]. '' is the index, which redirects to the current step. */
export type JourneyPage = '' | 'assessment' | 'orientation' | 'join' | 'give' | 'welcome'

/** Absolute URL for emails, e.g. journeyLink(token, 'assessment'). */
export function journeyLink(token: string, page: JourneyPage = ''): string {
  return mail.appUrl(`/journey/${token}${page ? `/${page}` : ''}`)
}

/** Absolute URL of the page for a stage (booking stages go to /discovery/[token]). null = no page. */
export function journeyStageUrl(token: string, stage: JourneyStage): string | null {
  const path = stagePath(stage, token)
  return path ? mail.appUrl(path) : null
}

/**
 * Issue a NEW journey token and restart the 14-day clock. Use it whenever a link is (re-)sent by
 * email: every older link stops working, so a leaked old link can't be revived by asking for a new
 * one. Always put the RETURNED token in the email. The /discovery/[token] page is keyed on the same
 * token, so a booked call's manage link is the new /discovery link (journeyUrl(token)).
 */
export async function refreshJourneyToken(db: Db, prospectId: string): Promise<string> {
  const token = newToken()
  await db.prospect.update({ where: { id: prospectId }, data: { journeyToken: token, journeyTokenIssuedAt: new Date() } })
  return token
}

/**
 * Restart the 14-day clock WITHOUT changing the token. Only for actions taken through the current
 * link (the person has just proved they hold it and is still on that page), e.g. cancelling a call
 * or accepting the terms. Returns the current token (creating one if an old prospect has none).
 */
export async function extendJourneyLink(db: Db, prospectId: string): Promise<string> {
  const p = await db.prospect.findUnique({ where: { id: prospectId }, select: { journeyToken: true } })
  const token = p?.journeyToken ?? newToken()
  await db.prospect.update({ where: { id: prospectId }, data: { journeyToken: token, journeyTokenIssuedAt: new Date() } })
  return token
}

/**
 * "Email me a new link" (expired-link pages, or the public form filled in again with a known email):
 * only for a Get Involved prospect whose journey is still open (booking, or a later step to do). Issues
 * a new token (old links die) and emails the link to the current step, e.g. /discovery/[new] for a
 * booked call, /journey/[new]/join for the terms. Never re-arms NOT_A_FIT, PAUSED, ACCOUNT_CREATED,
 * DONATION_HANDOFF or a minor still waiting for consent. Returns whether an email went out.
 * The caller rate limits and gives the same answer either way.
 */
export async function sendFreshJourneyLink(email: string): Promise<boolean> {
  const p = await prisma.prospect.findFirst({ where: { email: { equals: email.trim(), mode: 'insensitive' } }, include: { payment: true } })
  if (!p?.journeyToken || !canResendLink(p.status)) return false
  const cfg = await prospectRoleConfig(p)
  const stage = journeyPosition(journeyFactsFor(p, cfg)).stage
  if (!journeyStageUrl('x', stage)) return false
  // Guarded on the status we just read, so a Not a fit at the same moment isn't re-armed.
  const token = newToken()
  const r = await prisma.prospect.updateMany({ where: { id: p.id, status: p.status }, data: { journeyToken: token, journeyTokenIssuedAt: new Date() } })
  if (r.count === 0) return false
  await sendEmail({ to: p.email, ...mail.continueLinkEmail({ firstName: p.firstName, url: journeyStageUrl(token, stage)! }) })
  return true
}

/** A prospect by journey token with what the later steps need. null for unknown or malformed tokens. */
export async function prospectForJourney(token: string, db: Db = prisma) {
  if (!token || token.length < 16 || token.length > 100) return null
  return db.prospect.findUnique({
    where: { journeyToken: token },
    include: {
      payment: true,
      acceptedTerms: true,
      invitedBy: { select: { id: true, role: true } },
    },
  })
}
export type JourneyProspect = NonNullable<Awaited<ReturnType<typeof prospectForJourney>>>

/** Later-step links work for 14 days from the last email (journeyTokenIssuedAt). */
export function journeyLinkUsable(p: { journeyTokenIssuedAt: Date | null }, now = new Date()): boolean {
  return linkStillValid(p.journeyTokenIssuedAt, now)
}

/** The facts core.journeyPosition() needs, from a prospect row and its role config. */
export function journeyFactsFor(
  p: { status: string; journeyRole: string | null; assessmentSubmittedAt: Date | null; orientationWatchedAt: Date | null; roleTermsAcceptedAt: Date | null; userId: string | null; payment?: { status: string } | null },
  cfg: RoleConfig | null,
): JourneyFacts {
  return {
    status: p.status,
    journeyRole: p.journeyRole,
    assessmentSubmittedAt: p.assessmentSubmittedAt,
    orientationWatchedAt: p.orientationWatchedAt,
    roleTermsAcceptedAt: p.roleTermsAcceptedAt,
    userId: p.userId,
    paymentStatus: p.payment?.status ?? null,
    paid: cfg ? isPaidRole(cfg) : false,
  }
}

/** Convenience: role config + facts for one prospect row (loads the live config only if there is no snapshot). */
export async function journeyStateFor(p: Parameters<typeof journeyFactsFor>[0] & { roleConfigSnapshot: Prisma.JsonValue | null }, db: Db = prisma) {
  const config = await prospectRoleConfig(p, db)
  return { config, facts: journeyFactsFor(p, config) }
}

// ---------- not a fit ----------

/**
 * Close a prospect as Not a fit, inside the caller's transaction: cancels any booked call, marks a
 * pending payment FAILED, clears a stored password hash, sets NOT_A_FIT + notAFitAt and writes history.
 * Returns false (and changes nothing) if the status doesn't allow it (canMarkNotAFit).
 * After the transaction, call afterNotAFitEmails().
 */
export async function markNotAFit(tx: Prisma.TransactionClient, prospectId: string, byUserId: string | null, note?: string | null): Promise<boolean> {
  const p = await tx.prospect.findUnique({ where: { id: prospectId }, select: { status: true } })
  if (!p || !canMarkNotAFit(p.status)) return false
  const now = new Date()
  // Guarded move first: if a payment, consent or booking changed the status meanwhile, nothing is written.
  // The consent link is voided so a parent can't reopen a closed prospect.
  const moved = await transitionStatus(tx, prospectId, p.status, 'NOT_A_FIT', byUserId, note?.trim() ? `Not a fit: ${note.trim()}` : 'Not a fit', {
    data: { notAFitAt: now, pendingPasswordHash: null, parentConsentToken: null },
  })
  if (!moved) return false
  await tx.discoveryCall.updateMany({
    where: { prospectId, status: 'BOOKED' },
    data: { status: 'CANCELLED', cancelledAt: now, cancelledBy: 'ADMIN', cancelReason: 'Not a fit' },
  })
  await tx.prospectPayment.updateMany({
    where: { prospectId, status: { in: ['PENDING', 'PROCESSING'] } },
    data: { status: 'FAILED', failedAt: now, failureReason: 'Closed: not a fit' },
  })
  return true
}

/** ENotFit to the prospect (and parent for 17 and under) plus a short heads-up to the inviter. Never throws. */
export async function afterNotAFitEmails(p: { firstName: string; lastName: string; email: string; ageRange: string | null; parentEmail: string | null; invitedById: string | null }) {
  try {
    const m = mail.notAFitEmail({ firstName: p.firstName, eventsUrl: process.env.COMMUNITY_EVENTS_URL || null })
    await sendEmail({ to: p.email, ...m })
    if (p.ageRange === 'UNDER_18' && p.parentEmail) await sendEmail({ to: p.parentEmail, ...m })
  } catch (e) {
    console.error('[GET-INVOLVED] not-a-fit email failed', e)
  }
  await emailInviter(p.invitedById, `${p.firstName} ${p.lastName}`, "won't be moving forward right now. Thank you for inviting them")
}

// ---------- choosing / changing the role ----------

/**
 * Set or change the prospect's role inside the caller's transaction: stores the role, who/when, a
 * snapshot of the role's current settings, clears any progress from a previous role (answers,
 * orientation, reminders), refreshes the journey link and moves to ASSESSMENT_PENDING
 * (DONATION_HANDOFF for SPONSOR). Returns the token and config for the follow-up email, or an error
 * if canChooseRole() says no or the role isn't open to the prospect's age range.
 * The caller sends the email after the transaction and then sets assessmentSentAt (see contract).
 */
export async function chooseRole(tx: Prisma.TransactionClient, prospectId: string, role: GetInvolvedRoleValue, byUserId: string):
  Promise<{ ok: true; token: string; config: RoleConfig; status: 'ASSESSMENT_PENDING' | 'DONATION_HANDOFF' } | { ok: false; error: string }> {
  const p = await tx.prospect.findUnique({ where: { id: prospectId }, select: { status: true, ageRange: true, roleTermsAcceptedAt: true } })
  if (!p) return { ok: false, error: 'Prospect not found.' }
  if (!canChooseRole(p.status, !!p.roleTermsAcceptedAt)) return { ok: false, error: 'The role can no longer be changed at this step.' }
  const config = await getRoleConfig(role, tx)
  if (!rolesForAge([config], p.ageRange).length) return { ok: false, error: `${config.label} is not open to this age range.` }
  const status = statusAfterRoleChosen(role)
  const CHANGED = 'Someone else just updated this person. Please reload and try again.'
  // DISCOVERY_BOOKED (recording the call now) passes through DISCOVERY_COMPLETED so history shows the call was kept.
  // Every move is guarded on the status read above and on the terms still being open, so a concurrent
  // Not a fit, terms acceptance or second role change can't be overwritten.
  let from = p.status
  if (from === 'DISCOVERY_BOOKED') {
    if (!(await transitionStatus(tx, prospectId, from, 'DISCOVERY_COMPLETED', byUserId, 'Discovery call kept', { where: { roleTermsAcceptedAt: null } }))) return { ok: false, error: CHANGED }
    from = 'DISCOVERY_COMPLETED'
  }
  const moved = await transitionStatus(tx, prospectId, from, status, byUserId, `Role chosen: ${config.label}`, {
    where: { roleTermsAcceptedAt: null },
    data: {
      journeyRole: role, journeyRoleChosenAt: new Date(), journeyRoleChosenById: byUserId,
      roleConfigSnapshot: roleConfigSnapshot(config) as Prisma.InputJsonValue,
      assessmentAnswers: Prisma.DbNull, assessmentSentAt: null, assessmentSubmittedAt: null, assessmentReminderSentAt: null,
      orientationWatchedAt: null, orientationRemindAt: null, orientationReminderSentAt: null, orientationCheckAnswer: null,
    },
  })
  if (!moved) {
    // Nothing else was written yet unless the call step above ran; roll that back too.
    if (from !== p.status) throw new StatusConflictError(from, status)
    return { ok: false, error: CHANGED }
  }
  // A new token: any link sent for the previous role stops working.
  const token = await refreshJourneyToken(tx, prospectId)
  return { ok: true, token, config, status }
}
