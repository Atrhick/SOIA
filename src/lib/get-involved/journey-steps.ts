/**
 * Assessment and orientation emails (server only, not 'use server': nothing here is a public endpoint).
 * - sendAssessmentInvite(prospectId): call after chooseRole()'s transaction (the call-outcome code does).
 * - runJourneyReminders(): called by the cron route; each reminder is claimed with a conditional
 *   update before it is sent, so two runs at once never send twice.
 */
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { ASSESSMENT_REMINDER_DAYS, ORIENTATION_REPEAT_DAYS, RoleConfig } from './core'
import { journeyLink, refreshJourneyToken } from './journey'
import { prospectRoleConfig } from './roles'
import { assessmentInviteEmail, assessmentReminderEmail } from './emails/assessment'
import { orientationReminderEmail } from './emails/orientation'
import { primeEmailFooter } from './emails/footer-settings'

const DAY = 86400_000

interface Recipient { firstName: string; email: string; ageRange: string | null; parentEmail: string | null; parentName: string | null }

/** Send to the prospect, and a parent copy (with a short note) for 17 and under. */
async function toProspectAndParent(p: Recipient, build: (parentFirst: string | null) => { subject: string; html: string }) {
  await sendEmail({ to: p.email, ...build(null) })
  if (p.ageRange === 'UNDER_18' && p.parentEmail) {
    await sendEmail({ to: p.parentEmail, ...build((p.parentName ?? '').split(' ')[0] || 'there') })
  }
}

const questionTexts = (cfg: RoleConfig) => cfg.questions.map((q) => q.text)

/**
 * E8: email the role's 3 questions (parent copied for 17 and under), then set assessmentSentAt.
 * Only acts while the prospect is ASSESSMENT_PENDING with a role that has an assessment.
 * Refreshes the 14-day link first, so it is also safe for a resend. Never throws.
 */
export async function sendAssessmentInvite(prospectId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const p = await prisma.prospect.findUnique({ where: { id: prospectId } })
    if (!p || !p.journeyToken) return { ok: false, error: 'Prospect not found.' }
    if (p.status !== 'ASSESSMENT_PENDING' || !p.journeyRole || p.journeyRole === 'SPONSOR') return { ok: false, error: 'This prospect is not waiting for an assessment.' }
    const cfg = await prospectRoleConfig(p)
    if (!cfg) return { ok: false, error: 'No role chosen.' }
    // A (re)sent link gets a new token, so any older link stops working.
    await primeEmailFooter()
    const token = await refreshJourneyToken(prisma, p.id)
    const url = journeyLink(token, 'assessment')
    await toProspectAndParent(p, (parentFirst) => assessmentInviteEmail({ firstName: p.firstName, roleLabel: cfg.label, questions: questionTexts(cfg), url, parentFirst, prospectId: p.id }))
    await prisma.prospect.update({ where: { id: p.id }, data: { assessmentSentAt: new Date(), assessmentReminderSentAt: null } })
    return { ok: true }
  } catch (e) {
    console.error('[GET-INVOLVED] assessment email failed', e)
    return { ok: false, error: 'The email could not be sent.' }
  }
}

/**
 * One reminder ASSESSMENT_REMINDER_DAYS after the questions were sent. Reminders keep the current
 * token (only the 14-day clock restarts): they are sent by the system on a schedule, not on request,
 * and a new token would throw away the prospect's draft answers (stored per link on their device).
 */
async function assessmentReminders(now: Date): Promise<number> {
  const due = await prisma.prospect.findMany({
    where: {
      // Automatic reminder: skipped after "Stop emails about this".
      status: 'ASSESSMENT_PENDING', journeyToken: { not: null }, assessmentSubmittedAt: null, assessmentReminderSentAt: null, emailOptOutAt: null,
      assessmentSentAt: { lte: new Date(now.getTime() - ASSESSMENT_REMINDER_DAYS * DAY) },
    },
    take: 200,
  })
  let sent = 0
  for (const p of due) {
    const claim = await prisma.prospect.updateMany({
      where: { id: p.id, status: 'ASSESSMENT_PENDING', assessmentReminderSentAt: null },
      data: { assessmentReminderSentAt: now, journeyTokenIssuedAt: now },
    })
    if (claim.count === 0) continue
    const cfg = await prospectRoleConfig(p)
    if (!cfg) continue
    const url = journeyLink(p.journeyToken!, 'assessment')
    await toProspectAndParent(p, (parentFirst) => assessmentReminderEmail({ firstName: p.firstName, roleLabel: cfg.label, questions: questionTexts(cfg), url, parentFirst, prospectId: p.id }))
    sent++
  }
  return sent
}

/**
 * Orientation reminders (E10):
 * - planned: at the time they picked ("remind me later"), once per pick;
 * - repeat: ORIENTATION_REPEAT_DAYS after that if still not watched (once; then orientationRemindAt is cleared);
 * - nudge: never picked a time and not watched ORIENTATION_REPEAT_DAYS after the answers (once).
 * Prisma cannot compare two columns, so candidates are filtered here and each send is claimed on the
 * exact orientationReminderSentAt value that was read.
 */
async function orientationReminders(now: Date): Promise<number> {
  const repeatCutoff = new Date(now.getTime() - ORIENTATION_REPEAT_DAYS * DAY)
  const rows = await prisma.prospect.findMany({
    where: {
      status: { in: ['ASSESSMENT_COMPLETED', 'ORIENTATION_SCHEDULED'] }, journeyToken: { not: null }, orientationWatchedAt: null, emailOptOutAt: null,
      OR: [
        { orientationRemindAt: { lte: now } },
        { orientationRemindAt: null, orientationReminderSentAt: null, assessmentSubmittedAt: { lte: repeatCutoff } },
      ],
    },
    take: 200,
  })
  let sent = 0
  for (const p of rows) {
    const last = p.orientationReminderSentAt
    let kind: 'planned' | 'repeat' | 'nudge'
    let data: Prisma.ProspectUpdateManyMutationInput
    if (p.orientationRemindAt) {
      if (!last || last < p.orientationRemindAt) { kind = 'planned'; data = { orientationReminderSentAt: now } }
      else if (last <= repeatCutoff) { kind = 'repeat'; data = { orientationReminderSentAt: now, orientationRemindAt: null } }
      else continue
    } else {
      if (last) continue
      kind = 'nudge'; data = { orientationReminderSentAt: now }
    }
    const claim = await prisma.prospect.updateMany({
      where: { id: p.id, orientationWatchedAt: null, orientationReminderSentAt: last, orientationRemindAt: p.orientationRemindAt, status: { in: ['ASSESSMENT_COMPLETED', 'ORIENTATION_SCHEDULED'] } },
      data: { ...data, journeyTokenIssuedAt: now },
    })
    if (claim.count === 0) continue
    const cfg = await prospectRoleConfig(p)
    if (!cfg) continue
    const watchUrl = journeyLink(p.journeyToken!, 'orientation')
    await toProspectAndParent(p, (parentFirst) => orientationReminderEmail({ firstName: p.firstName, roleLabel: cfg.label, minutes: cfg.orientationMinutes, watchUrl, kind, parentFirst, prospectId: p.id }))
    sent++
  }
  return sent
}

/** Both reminder kinds; errors in one kind do not stop the other. */
export async function runJourneyReminders(now = new Date()): Promise<{ assessment: number; orientation: number }> {
  let assessment = 0, orientation = 0
  await primeEmailFooter()
  try { assessment = await assessmentReminders(now) } catch (e) { console.error('[CRON] assessment reminders failed', e) }
  try { orientation = await orientationReminders(now) } catch (e) { console.error('[CRON] orientation reminders failed', e) }
  return { assessment, orientation }
}
