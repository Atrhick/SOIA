/**
 * Loads one Get Involved prospect for the admin record page and turns it into plain, serialisable
 * data (dates as ISO strings, Decimal as number). Server only; the page checks ADMIN first.
 */
import prisma from '@/lib/prisma'
import {
  ASSESSMENT_REMINDER_DAYS, JourneyStage, STAGE_LABELS, StoredAnswer, ageRangeLabel, canAnswerAssessment, canChooseRole, canMarkNotAFit,
  isGetInvolvedRole, isPaidRole, journeyPosition, journeyStages, priceLabel, roleLabel, rolesForAge, stagePath, LINK_VALID_DAYS,
} from '@/lib/get-involved/core'
import { journeyFactsFor, journeyLinkUsable } from '@/lib/get-involved/journey'
import { listRoleConfigs, prospectRoleConfig } from '@/lib/get-involved/roles'
import { userDisplayName } from '@/lib/get-involved/server'
import { adminCallWhen } from './admin-time'
import { appUrl } from '@/lib/get-involved/emails'
import { listStageFor, stageBadgeClass, stageBadgeLabel } from '../journey-list'

export interface ActivityItem { at: string; text: string; by: string | null; kind: 'status' | 'email' | 'call' | 'note' | 'action' }
export interface StepItem { stage: JourneyStage; label: string; state: 'done' | 'current' | 'todo' | 'stopped' }
export interface CallItem {
  id: string; startsAt: string; status: string; host: string | null; notes: string | null; topics: string[]
  parentAttended: boolean | null; parentAttendee: string | null; cancelReason: string | null
}

export interface RecordData {
  id: string
  name: string
  initials: string
  email: string
  phone: string | null
  city: string | null
  ageLabel: string
  minor: boolean
  parent: { name: string | null; email: string | null; phone: string | null; relationship: string | null; consentAt: string | null } | null
  role: string | null
  roleLabel: string | null
  rolePrice: string | null
  stageLabel: string
  stageClass: string
  nextStep: string
  waitingOn: string
  closedNote: string | null
  steps: StepItem[]
  activity: ActivityItem[]
  inviter: { name: string; roleLabel: string; source: string | null; note: string | null; credit: string } | null
  calls: CallItem[]
  assessment: {
    sentAt: string | null; submittedAt: string | null; reminderSentAt: string | null; reminderDueAt: string | null
    answers: StoredAnswer[] | null; questions: string[]
  }
  orientation: { watchedAt: string | null; remindAt: string | null; reminderSentAt: string | null; checkAnswer: string | null }
  terms: { acceptedAt: string | null; version: number | null }
  payment: { status: string; amount: number; method: string; paidAt: string | null; billing: string | null; failure: string | null } | null
  login: { joinedAt: string | null; email: string | null } | null
  link: { url: string; label: string; expiresAt: string | null; usable: boolean } | null
  can: { resend: boolean; changeRole: boolean; changeRoleBlockedReason: string | null; notAFit: boolean; assignCoach: boolean }
  /** Active coaches, only filled when can.assignCoach. */
  coachOptions: { id: string; name: string }[]
  roleOptions: { value: string; label: string; price: string }[]
  createdAt: string
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null)

const STATUS_PHRASE: Record<string, string> = {
  FORM_SUBMITTED: 'Back to booking a call',
  AWAITING_PARENT_CONSENT: 'Waiting for parent consent',
  DISCOVERY_BOOKED: 'Discovery call booked',
  DISCOVERY_COMPLETED: 'Discovery call kept',
  ASSESSMENT_PENDING: 'Assessment sent',
  ASSESSMENT_COMPLETED: 'Assessment answered',
  ORIENTATION_SCHEDULED: 'Chose to watch the orientation later',
  ORIENTATION_COMPLETED: 'Orientation watched',
  PAYMENT_PENDING: 'Terms accepted, waiting for payment',
  PAYMENT_COMPLETED: 'Payment received',
  ACCOUNT_CREATED: 'Login created: joined',
  DONATION_HANDOFF: 'Sent to the donation page',
  NOT_A_FIT: 'Marked not a fit',
  PAUSED: 'Paused after missed calls',
}

const USER_ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Admin', SUB_ADMIN: 'Sub-admin', COACH: 'Coach', AMBASSADOR: 'Ambassador', PARENT: 'Parent',
  SERVICE_PROVIDER: 'Service provider', BUSINESS_AFFILIATE: 'Business affiliate', VOLUNTEER: 'Volunteer',
}

/** null = not a Get Involved prospect (no journeyToken) or not found. */
export async function loadRecord(id: string): Promise<RecordData | null> {
  const p = await prisma.prospect.findUnique({
    where: { id },
    include: {
      payment: true,
      acceptedTerms: { select: { version: true } },
      user: { select: { email: true } },
      invitedBy: { select: { id: true, role: true } },
      statusHistory: { orderBy: { createdAt: 'asc' } },
      discoveryCalls: { orderBy: { startsAt: 'desc' } },
      notes: { orderBy: { createdAt: 'desc' }, take: 200 },
    },
  })
  if (!p || !p.journeyToken) return null
  const now = new Date()
  // A free ambassador role stops after the terms when the inviter has no coach (see login.ts).
  const needsCoach = (p.journeyRole === 'AMBASSADOR' || p.journeyRole === 'YOUTH_AMBASSADOR') && !p.userId && !!p.roleTermsAcceptedAt && p.status === 'ORIENTATION_COMPLETED'
  const coachOptions = needsCoach
    ? (await prisma.coachProfile.findMany({ where: { user: { status: 'ACTIVE' } }, orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }], select: { id: true, firstName: true, lastName: true } }))
        .map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}`.trim() }))
    : []

  const audits = await prisma.auditLog.findMany({
    where: { entityType: 'Prospect', entityId: p.id, action: { in: ['RESEND_ASSESSMENT', 'CHANGE_PROSPECT_ROLE'] } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  // Names for everyone mentioned.
  const ids = new Set<string>()
  for (const h of p.statusHistory) if (h.changedBy) ids.add(h.changedBy)
  for (const c of p.discoveryCalls) { if (c.hostId) ids.add(c.hostId); if (c.outcomeById) ids.add(c.outcomeById) }
  for (const n of p.notes) if (n.authorId) ids.add(n.authorId)
  for (const a of audits) if (a.userId) ids.add(a.userId)
  if (p.invitedById) ids.add(p.invitedById)
  const names = new Map<string, { first: string; full: string }>()
  await Promise.all(Array.from(ids).map(async (uid) => { const n = await userDisplayName(uid); if (n) names.set(uid, n) }))
  const nameOf = (uid: string | null | undefined) => (uid ? names.get(uid)?.full ?? null : null)

  const cfg = await prospectRoleConfig(p)
  const facts = journeyFactsFor(p, cfg)
  const pos = journeyPosition(facts)
  const minor = p.ageRange === 'UNDER_18'
  const paid = cfg ? isPaidRole(cfg) : false
  const listStage = listStageFor(p)

  // ----- progress steps (Book a call is folded into Discovery call, as in the mockup) -----
  let current: JourneyStage = pos.stage === 'BOOK_CALL' ? 'DISCOVERY_CALL' : pos.stage
  let closedNote: string | null = null
  if (pos.stage === 'CLOSED') {
    const closing = [...p.statusHistory].reverse().find((h) => ['NOT_A_FIT', 'PAUSED', 'REJECTED'].includes(h.toStatus))
    const before = journeyPosition({ ...facts, status: closing?.fromStatus ?? 'FORM_SUBMITTED' }).stage
    current = before === 'BOOK_CALL' ? 'DISCOVERY_CALL' : before
    closedNote = pos.nextStep
  }
  const stages = journeyStages(isGetInvolvedRole(p.journeyRole) ? p.journeyRole : null, { minor, paid }).filter((s) => s !== 'BOOK_CALL')
  const curIdx = stages.indexOf(current)
  const steps: StepItem[] = stages.map((s, i) => ({
    stage: s,
    label: STAGE_LABELS[s],
    state: current === 'DONE' ? 'done' : i < curIdx ? 'done' : i === curIdx ? (pos.stage === 'CLOSED' ? 'stopped' : 'current') : 'todo',
  }))
  if (current === 'DONATION' && p.status === 'DONATION_HANDOFF') steps[steps.length - 1].state = 'done'

  // ----- activity -----
  const activity: ActivityItem[] = []
  const inviterFirst = p.invitedById ? names.get(p.invitedById)?.first ?? null : null
  for (const h of p.statusHistory) {
    if (h.toStatus === 'DISCOVERY_BOOKED') continue // the call entry below says more
    if (!h.fromStatus) {
      const how = p.inviteSource === 'INVITER_ADDED' && inviterFirst ? `Added by ${inviterFirst}` : inviterFirst ? `Get Involved form submitted from ${inviterFirst}'s link` : 'Get Involved form submitted'
      activity.push({ at: h.createdAt.toISOString(), text: `${how}.${h.toStatus === 'AWAITING_PARENT_CONSENT' ? ' Parent consent requested.' : ''}`, by: null, kind: 'status' })
      continue
    }
    const text = h.notes?.trim() ? h.notes.trim() : STATUS_PHRASE[h.toStatus] ?? h.toStatus
    activity.push({ at: h.createdAt.toISOString(), text: /[.!?]$/.test(text) ? text : `${text}.`, by: nameOf(h.changedBy), kind: 'status' })
  }
  if (!p.statusHistory.some((h) => !h.fromStatus)) activity.push({ at: p.createdAt.toISOString(), text: 'Get Involved form submitted.', by: null, kind: 'status' })
  for (const c of p.discoveryCalls) {
    const host = nameOf(c.hostId)
    activity.push({ at: c.createdAt.toISOString(), text: `Call booked for ${adminCallWhen(c.startsAt)}${host ? ` with ${host}` : ''}${c.rescheduleCount ? ` (moved ${c.rescheduleCount}×)` : ''}.`, by: null, kind: 'call' })
    if (c.reminder24hSentAt) activity.push({ at: c.reminder24hSentAt.toISOString(), text: 'Reminder sent (24 hours).', by: 'automatic', kind: 'email' })
    if (c.reminder1hSentAt) activity.push({ at: c.reminder1hSentAt.toISOString(), text: 'Reminder sent (1 hour).', by: 'automatic', kind: 'email' })
    if (c.cancelledAt) activity.push({ at: c.cancelledAt.toISOString(), text: `Call cancelled${c.cancelledBy === 'PROSPECT' ? ' by the prospect' : c.cancelledBy ? ' by staff' : ''}${c.cancelReason ? `: ${c.cancelReason}` : ''}.`, by: null, kind: 'call' })
  }
  if (p.parentConsentRequestedAt) activity.push({ at: p.parentConsentRequestedAt.toISOString(), text: `Parent consent email sent${p.parentEmail ? ` to ${p.parentEmail}` : ''}.`, by: 'automatic', kind: 'email' })
  if (p.assessmentSentAt) activity.push({ at: p.assessmentSentAt.toISOString(), text: `${cfg?.label ?? 'Role'} assessment emailed.${p.assessmentSubmittedAt ? '' : ' Not answered yet.'}`, by: null, kind: 'email' })
  if (p.assessmentReminderSentAt) activity.push({ at: p.assessmentReminderSentAt.toISOString(), text: 'Assessment reminder sent.', by: 'automatic', kind: 'email' })
  if (p.orientationReminderSentAt) activity.push({ at: p.orientationReminderSentAt.toISOString(), text: 'Orientation reminder sent.', by: 'automatic', kind: 'email' })
  if (p.roleTermsAcceptedAt) activity.push({ at: p.roleTermsAcceptedAt.toISOString(), text: `Accepted the ${cfg?.label ?? ''} terms${p.acceptedTerms ? ` (version ${p.acceptedTerms.version})` : ''}.`.replace('the  terms', 'the terms'), by: null, kind: 'status' })
  for (const a of audits) {
    if (a.action === 'RESEND_ASSESSMENT') activity.push({ at: a.createdAt.toISOString(), text: 'Assessment questions resent.', by: nameOf(a.userId), kind: 'action' })
    if (a.action === 'CHANGE_PROSPECT_ROLE') {
      let reason: string | null = null
      try { reason = (JSON.parse(a.details ?? '{}') as { reason?: string | null }).reason ?? null } catch { /* old row */ }
      if (reason) activity.push({ at: a.createdAt.toISOString(), text: `Reason for the role change: ${reason}`, by: nameOf(a.userId), kind: 'action' })
    }
  }
  for (const n of p.notes) activity.push({ at: n.createdAt.toISOString(), text: n.body, by: nameOf(n.authorId), kind: 'note' })
  activity.sort((a, b) => b.at.localeCompare(a.at))

  // ----- cards -----
  const calls: CallItem[] = p.discoveryCalls.map((c) => ({
    id: c.id, startsAt: c.startsAt.toISOString(), status: c.status, host: nameOf(c.hostId), notes: c.notes, topics: c.topicsCovered,
    parentAttended: c.parentAttended,
    parentAttendee: c.parentAttendeeName ? `${c.parentAttendeeName}${c.parentAttendeeRelationship ? ` (${c.parentAttendeeRelationship})` : ''}` : null,
    cancelReason: c.cancelReason,
  }))

  const answers = Array.isArray(p.assessmentAnswers) ? (p.assessmentAnswers as unknown as StoredAnswer[]).filter((a) => a && typeof a === 'object' && typeof a.question === 'string') : null
  const reminderDueAt = p.assessmentSentAt && !p.assessmentReminderSentAt && !p.assessmentSubmittedAt && canAnswerAssessment(p.status)
    ? new Date(p.assessmentSentAt.getTime() + ASSESSMENT_REMINDER_DAYS * 86400_000).toISOString() : null

  const path = stagePath(pos.stage, p.journeyToken)
  const linkBase = pos.stage === 'BOOK_CALL' || pos.stage === 'DISCOVERY_CALL'
  const expiresAt = p.journeyTokenIssuedAt ? new Date(p.journeyTokenIssuedAt.getTime() + LINK_VALID_DAYS * 86400_000) : null

  const configs = await listRoleConfigs()
  const roleOptions = rolesForAge(configs, p.ageRange).map((c) => ({ value: c.role, label: c.label, price: priceLabel(c) }))
  const termsAccepted = !!p.roleTermsAcceptedAt
  const changeRole = canChooseRole(p.status, termsAccepted) && p.status !== 'DISCOVERY_BOOKED'

  return {
    id: p.id,
    name: `${p.firstName} ${p.lastName}`.trim(),
    initials: `${(p.firstName?.[0] || '?').toUpperCase()}${(p.lastName?.[0] || '').toUpperCase()}`,
    email: p.email,
    phone: p.phone,
    city: p.city,
    ageLabel: ageRangeLabel(p.ageRange),
    minor,
    parent: minor || p.parentName ? { name: p.parentName, email: p.parentEmail, phone: p.parentPhone, relationship: p.parentRelationship, consentAt: iso(p.parentConsentAt) } : null,
    role: p.journeyRole,
    roleLabel: cfg?.label ?? (p.journeyRole ? roleLabel(p.journeyRole) : null),
    rolePrice: cfg ? priceLabel(cfg) : null,
    stageLabel: stageBadgeLabel(listStage, p.status),
    stageClass: stageBadgeClass(listStage, p.status),
    nextStep: pos.nextStep,
    waitingOn: pos.waitingOn,
    closedNote,
    steps,
    activity,
    inviter: p.invitedById ? {
      name: nameOf(p.invitedById) ?? 'Unknown',
      roleLabel: USER_ROLE_LABEL[p.invitedBy?.role ?? ''] ?? 'Member',
      source: p.inviteSource === 'INVITER_ADDED' ? 'Added them on One-A-Day' : p.inviteSource === 'INVITE_LINK' ? 'Shared their invite link' : null,
      note: p.inviterNote,
      credit: p.status === 'ACCOUNT_CREATED' ? 'Counted as joined on the leaderboard' : p.status === 'NOT_A_FIT' ? 'Credited for the form only' : 'Gets credit when they join',
    } : null,
    calls,
    assessment: {
      sentAt: iso(p.assessmentSentAt), submittedAt: iso(p.assessmentSubmittedAt), reminderSentAt: iso(p.assessmentReminderSentAt), reminderDueAt,
      answers: answers && answers.length ? answers : null,
      questions: cfg && cfg.role !== 'SPONSOR' ? cfg.questions.map((q) => q.text) : [],
    },
    orientation: { watchedAt: iso(p.orientationWatchedAt), remindAt: iso(p.orientationRemindAt), reminderSentAt: iso(p.orientationReminderSentAt), checkAnswer: p.orientationCheckAnswer },
    terms: { acceptedAt: iso(p.roleTermsAcceptedAt), version: p.acceptedTerms?.version ?? null },
    payment: p.payment && p.payment.journeyRole ? {
      status: p.payment.status, amount: p.payment.amount.toNumber(), method: p.payment.method, paidAt: iso(p.payment.paidAt),
      billing: p.payment.billing, failure: p.payment.failureReason,
    } : null,
    login: p.userId || p.joinedAt ? { joinedAt: iso(p.joinedAt), email: p.user?.email ?? null } : null,
    link: path && pos.stage !== 'CLOSED' ? {
      url: appUrl(path),
      label: linkBase ? 'Booking page' : `${STAGE_LABELS[pos.stage]} page`,
      expiresAt: iso(expiresAt),
      // Booking links stay open while a call is upcoming; journey links follow the 14-day rule.
      usable: linkBase ? true : journeyLinkUsable(p, now),
    } : null,
    can: {
      resend: canAnswerAssessment(p.status) && isGetInvolvedRole(p.journeyRole) && p.journeyRole !== 'SPONSOR',
      changeRole,
      changeRoleBlockedReason: p.status === 'DISCOVERY_BOOKED' ? 'Record the call on the Discovery Calls page first.' : termsAccepted ? 'They have accepted the terms, so the role is fixed.' : null,
      notAFit: canMarkNotAFit(p.status),
      assignCoach: needsCoach,
    },
    coachOptions,
    roleOptions,
    createdAt: p.createdAt.toISOString(),
  }
}
