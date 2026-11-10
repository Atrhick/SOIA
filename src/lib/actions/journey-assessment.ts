'use server'

/**
 * Public journey steps after the discovery call: the role assessment and the orientation.
 * Called by prospects without a login, so every export validates the token (prospectForJourney +
 * journeyLinkUsable), checks the step's predicate, is rate limited, validates input with Zod, and
 * never reveals whether an email is in the system.
 */
import { z } from 'zod'
import { GetInvolvedRole, Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import {
  JourneyStage, RoleConfig, assessmentMarkerMatches, canAnswerAssessment, canDoOrientation, journeyPosition, stagePath, validateAnswers,
} from '@/lib/get-involved/core'
import { journeyFactsFor, journeyLinkUsable, prospectForJourney, sendFreshJourneyLink } from '@/lib/get-involved/journey'
import { prospectRoleConfig } from '@/lib/get-involved/roles'
import { clientIp, notifyAdmins, rateLimited, transitionStatus } from '@/lib/get-involved/server'
import { DayPart, checkRemindChoice } from '@/lib/get-involved/orientation-rules'

type Fail = { ok: false; error: string; fieldErrors?: Record<string, string>; expired?: boolean; stale?: boolean }

const tokenSchema = z.string().min(16).max(100)
const LINK_GONE = 'This link has expired or is no longer valid.'
const MOVED_ON = "This step is already done. We'll take you to your next step."

/** The prospect for a token, if the link still works. Never says why it doesn't. */
async function usableProspect(token: unknown) {
  const t = tokenSchema.safeParse(token)
  if (!t.success) return null
  const p = await prospectForJourney(t.data)
  if (!p || !journeyLinkUsable(p)) return null
  return p
}

/** Where the prospect should go next (app-relative), from their current fields. */
function nextPath(p: Parameters<typeof journeyFactsFor>[0] & { journeyToken: string | null }, cfg: RoleConfig | null): string | null {
  const stage: JourneyStage = journeyPosition(journeyFactsFor(p, cfg)).stage
  return p.journeyToken ? stagePath(stage, p.journeyToken) : null
}

// ---------- assessment ----------

const answersSchema = z.array(z.union([z.string().max(4000), z.number()])).max(10)

/** Which role choice the form was shown for (see assessmentMarkerMatches). */
const markerSchema = z.object({
  role: z.string().min(1).max(40),
  chosenAt: z.string().datetime().nullable(),
})

const QUESTIONS_CHANGED = 'Your questions were just updated. Please reload the page to see the new ones.'

export async function submitAssessment(token: string, answers: unknown, marker: unknown):
  Promise<{ ok: true; next: string } | Fail> {
  if (rateLimited(`assess:${await clientIp()}`, 20, 10 * 60_000)) return { ok: false, error: 'Too many attempts. Please wait a few minutes and try again.' }
  const p = await usableProspect(token)
  if (!p) return { ok: false, error: LINK_GONE, expired: true }
  const cfg = await prospectRoleConfig(p)
  if (!cfg || !canAnswerAssessment(p.status)) {
    const next = nextPath(p, cfg)
    return next ? { ok: true, next } : { ok: false, error: MOVED_ON }
  }
  const m = markerSchema.safeParse(marker)
  // The answers must be for the questions that were shown: staff may have changed the role since.
  if (!m.success || !assessmentMarkerMatches(p, m.data)) return { ok: false, error: QUESTIONS_CHANGED, stale: true }
  const parsed = answersSchema.safeParse(answers)
  if (!parsed.success) return { ok: false, error: 'Please check your answers and try again.' }
  const checked = validateAnswers(cfg.questions, parsed.data)
  if (!checked.ok) {
    const fieldErrors = Object.fromEntries(Object.entries(checked.errors).map(([i, m]) => [`q${i}`, m]))
    return { ok: false, error: 'Please answer every question.', fieldErrors }
  }
  const done = await prisma.$transaction((tx) => transitionStatus(tx, p.id, 'ASSESSMENT_PENDING', 'ASSESSMENT_COMPLETED', null, 'Assessment answers submitted', {
    // Same role choice as the one the form was built for, checked again in the write itself.
    where: { assessmentSubmittedAt: null, journeyRole: p.journeyRole as GetInvolvedRole, journeyRoleChosenAt: p.journeyRoleChosenAt },
    data: { assessmentAnswers: checked.answers as unknown as Prisma.InputJsonValue, assessmentSubmittedAt: new Date() },
  }))
  if (!done) {
    // A role change in between keeps ASSESSMENT_PENDING but with new questions.
    const now = await prisma.prospect.findUnique({ where: { id: p.id }, select: { status: true, assessmentSubmittedAt: true } })
    if (now?.status === 'ASSESSMENT_PENDING' && !now.assessmentSubmittedAt) return { ok: false, error: QUESTIONS_CHANGED, stale: true }
  }
  if (done) await notifyAdmins('Assessment answered', `${p.firstName} ${p.lastName} answered the ${cfg.label} questions.`, p.id).catch(() => {})
  return { ok: true, next: `/journey/${p.journeyToken}/orientation` }
}

// ---------- orientation ----------

const watchedSchema = z.object({ checkAnswer: z.string().trim().max(2000).optional().default('') })

export async function markOrientationWatched(token: string, input: unknown):
  Promise<{ ok: true; next: string } | Fail> {
  if (rateLimited(`orient:${await clientIp()}`, 20, 10 * 60_000)) return { ok: false, error: 'Too many attempts. Please wait a few minutes and try again.' }
  const p = await usableProspect(token)
  if (!p) return { ok: false, error: LINK_GONE, expired: true }
  const cfg = await prospectRoleConfig(p)
  if (!cfg || !canDoOrientation(p.status)) {
    const next = nextPath(p, cfg)
    return next ? { ok: true, next } : { ok: false, error: MOVED_ON }
  }
  const parsed = watchedSchema.safeParse(input ?? {})
  if (!parsed.success) return { ok: false, error: 'Please keep your answer under 2000 characters.', fieldErrors: { checkAnswer: 'Please keep your answer under 2000 characters' } }
  const answer = parsed.data.checkAnswer
  if (cfg.comprehensionCheck && cfg.comprehensionQuestion && !answer) {
    return { ok: false, error: 'Please answer the question about the recording.', fieldErrors: { checkAnswer: 'Please answer this question' } }
  }
  const from = p.status
  const done = await prisma.$transaction((tx) => transitionStatus(tx, p.id, from, 'ORIENTATION_COMPLETED', null, 'Orientation watched', {
    where: { orientationWatchedAt: null },
    data: { orientationWatchedAt: new Date(), orientationCheckAnswer: cfg.comprehensionCheck && answer ? answer : null, orientationRemindAt: null },
  }))
  if (done) await notifyAdmins('Orientation watched', `${p.firstName} ${p.lastName} watched the ${cfg.label} orientation.`, p.id).catch(() => {})
  return { ok: true, next: `/journey/${p.journeyToken}/join` }
}

const laterSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Please pick a day'),
  part: z.enum(['MORNING', 'AFTERNOON', 'EVENING'], { message: 'Please pick a time of day' }),
  timezone: z.string().min(1).max(64),
})

export async function remindOrientationLater(token: string, input: unknown):
  Promise<{ ok: true; remindAt: string } | Fail> {
  if (rateLimited(`orient-later:${await clientIp()}`, 15, 10 * 60_000)) return { ok: false, error: 'Too many attempts. Please wait a few minutes and try again.' }
  const p = await usableProspect(token)
  if (!p) return { ok: false, error: LINK_GONE, expired: true }
  if (!canDoOrientation(p.status)) return { ok: false, error: MOVED_ON }
  const parsed = laterSchema.safeParse(input)
  if (!parsed.success) {
    const i = parsed.error.issues[0]
    const field = String(i?.path[0] ?? 'date')
    return { ok: false, error: i?.message ?? 'Please pick a day and time', fieldErrors: { [field === 'part' ? 'part' : 'date']: i?.message ?? 'Please pick a day' } }
  }
  const choice = checkRemindChoice(parsed.data.date, parsed.data.part as DayPart, parsed.data.timezone, new Date())
  if (!choice.ok) return { ok: false, error: choice.error, fieldErrors: { [choice.field]: choice.error } }
  const from = p.status
  const saved = await prisma.$transaction((tx) => transitionStatus(tx, p.id, from, 'ORIENTATION_SCHEDULED', null, `Will watch the orientation later (reminder ${choice.at.toISOString()})`, {
    where: { orientationWatchedAt: null },
    data: { orientationRemindAt: choice.at, orientationReminderSentAt: null },
  }))
  if (!saved) return { ok: false, error: MOVED_ON }
  return { ok: true, remindAt: choice.at.toISOString() }
}

// ---------- expired links ----------

/**
 * "Email me a new link" from an expired /journey page. Same answer whether or not the email matched.
 * Only prospects with steps left after the call (laterJourneyOpen) get a link, to their current step.
 */
export async function requestJourneyLink(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  if (rateLimited(`journey-relink:${await clientIp()}`, 5, 10 * 60_000)) return { ok: false, error: 'Too many attempts. Please wait a few minutes.' }
  const email = z.string().trim().toLowerCase().email().max(254).safeParse(formData.get('email'))
  if (!email.success) return { ok: false, error: 'Please enter a valid email' }
  if (rateLimited(`journey-relink-to:${email.data}`, 3, 60 * 60_000)) return { ok: true }
  try {
    // New token (old links stop working), link to the current step, only while the journey is open.
    await sendFreshJourneyLink(email.data)
  } catch (e) {
    console.error('[GET-INVOLVED] journey relink failed', e)
  }
  return { ok: true }
}
