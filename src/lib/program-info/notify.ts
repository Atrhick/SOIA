/**
 * Program info workflow: the notification dispatcher. One call per event:
 *
 *   await notifyProgramPage('C2_READY_FIRST', { programId, actorId })
 *
 * Creates the in-app AdminNotification rows (type PROGRAM_PAGE; prisma middleware also pushes them to
 * phones) and, where the catalog says so, sends an email. Never throws and never notifies the person who
 * did the action (except receipts meant for them: C5, C10, C10_REQUEST_RECEIVED), nor anyone while the
 * action was an impersonated one. Call it AFTER the transaction.
 *
 * Catalog: BUILD-SPEC "Notifications". C* go to the page owner (coach or ambassador, read from the ROOT
 * row); T* go to every ACTIVE ADMIN (there is no sub-admin permission for program pages).
 * Server only. NOT 'use server'.
 */
import prisma, { withPushTag } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { loadPageWithRoot, namesOf } from './server'
import { TEAM_QUEUE_PATH, coachPagePath, groupName, programsHome, publicPagePath, teamPagePath } from './paths'
import { programPageEmail, programPageText } from './emails'
import { costText, questionById, type AnswerKey, type CostAnswer } from './questions'

export const PROGRAM_PAGE_EVENTS = [
  'C1_QUESTION', // team asked a question
  'C2_READY_FIRST', // draft sent to check, first time
  'C3_CHANGES_MADE', // draft re-sent after changes were asked for
  'C4_UPDATE_READY', // new version after a live page's answers changed
  'C5_LIVE', // owner approved: live
  'C6_PUBLISHED_ON_BEHALF', // team published for the owner (+ reason)
  'C7_OFFLINE', // team took the page offline (+ reason)
  'C7_BACK_ONLINE', // team put it back online
  'C8_TELL_US', // team added a group page, or a new program was assigned
  'C9_REMINDER', // automatic reminder, day 3 / day 7 (cron)
  'C10_ANSWERS_RECEIVED', // receipt after the owner sent answers (in-app only)
  'C10_REQUEST_RECEIVED', // A15 receipt: "Need another program?" sent (in-app only; no programId)
  'T1_ANSWERS_SENT', // owner sent answers (new or changed)
  'T2_QUESTION_ANSWERED',
  'T3_CHANGES_ASKED', // includes the request text
  'T4_APPROVED', // owner approved, page live (in-app only)
  'T5_OWNER_OFFLINE', // owner took a page offline
  'T5_OWNER_BACK_ONLINE', // owner put it back online (in-app only)
  'T6_NAMES_CHANGED', // owner changed names or groups (in-app only)
  'T7_STALLED', // day 10 without the owner acting (in-app only, once; cron)
  'T8_ANOTHER_PROGRAM', // A15: an owner asked for another program (in-app + email; no programId)
] as const
export type ProgramPageNotifyEvent = (typeof PROGRAM_PAGE_EVENTS)[number]

export interface NotifyExtra {
  /** Offline / publish-on-behalf reason. */
  reason?: string | null
  /** T3: what the owner asked to change. */
  changeRequest?: string | null
  /** C1: the question text and id (the link opens it). */
  question?: string | null
  questionId?: string | null
  /** T1: answers were sent before (this is a change). */
  changed?: boolean
  /** C9: which reminder (3 or 7) and, for the batched reminder, how many pages need the owner. */
  reminderDay?: 3 | 7
  pageCount?: number
  /** The action was done while impersonating: nothing is sent. */
  impersonated?: boolean
  /** T6: what changed, e.g. "added Business owners". */
  summary?: string | null
  /** T8: the request text. */
  requestText?: string | null
  /** T2: the owner's answer as text (filled in by the dispatcher when the caller leaves it out). */
  answerText?: string | null
  /** T1: the owner's note sent with the answers (filled in from the ANSWERS_SENT event when left out). */
  note?: string | null
  /** C9 while ANSWERING: how many sections are still missing ("2 sections to go"). */
  sectionsLeft?: number | null
}

export interface NotifyInput {
  /** The page. Null only for the program-less events (T8_ANOTHER_PROGRAM, C10_REQUEST_RECEIVED), which use actorId as the owner. */
  programId: string | null
  /** Who did it (never notified). Null for the cron. */
  actorId: string | null
  extra?: NotifyExtra
}

/** Everything a template needs. Also the input of the styled templates (emails.ts). */
export interface NotifyContext {
  event: ProgramPageNotifyEvent
  programId: string
  rootId: string
  programName: string
  companyName: string
  /** "Families", or the program name on a one-group program. */
  group: string
  ownerFirstName: string
  ownerName: string
  ownerRole: 'COACH' | 'AMBASSADOR'
  stage: string
  /** Paths (not absolute): the owner's screen and the team screen. */
  ownerPath: string
  teamPath: string
  /** The page's public link path (/join/<invite>/<slug>), for C5. */
  publicPath?: string
  extra: NotifyExtra
}

type Audience = 'OWNER' | 'TEAM'
interface CatalogEntry {
  to: Audience
  email: boolean
  /** A receipt for the person who acted (sent even though they are the actor). */
  toActor?: boolean
  /** No page: the context comes from the actor (A15). */
  noProgram?: boolean
  title: (c: NotifyContext) => string
  message: (c: NotifyContext) => string
  /** Suffix for the owner's link (owner events only). */
  ownerSuffix?: (c: NotifyContext) => string
}

const text = (c: NotifyContext) => programPageText(c)
const entry = (to: Audience, email: boolean, more: Partial<CatalogEntry> = {}): CatalogEntry => ({
  to, email, title: (c) => text(c).title, message: (c) => text(c).message, ...more,
})
const toCheck = () => '/check'
const toLive = () => '/live'
const toQuestion = (c: NotifyContext) => (c.extra.questionId ? `/question/${encodeURIComponent(c.extra.questionId)}` : '')

/**
 * The catalog: who gets it, whether it emails, and the owner's link. The words live in emails.ts
 * (title = in-app title; the email subject comes from the same template).
 */
export const NOTIFY_CATALOG: Record<ProgramPageNotifyEvent, CatalogEntry> = {
  C1_QUESTION: entry('OWNER', true, { ownerSuffix: toQuestion }),
  C2_READY_FIRST: entry('OWNER', true, { ownerSuffix: toCheck }),
  C3_CHANGES_MADE: entry('OWNER', true, { ownerSuffix: toCheck }),
  C4_UPDATE_READY: entry('OWNER', true, { ownerSuffix: toCheck }),
  C5_LIVE: entry('OWNER', true, { toActor: true, ownerSuffix: toLive }),
  C6_PUBLISHED_ON_BEHALF: entry('OWNER', true, { ownerSuffix: toLive }),
  C7_OFFLINE: entry('OWNER', true, { ownerSuffix: toLive }),
  C7_BACK_ONLINE: entry('OWNER', true, { ownerSuffix: toLive }),
  C8_TELL_US: entry('OWNER', true, { ownerSuffix: () => '' }),
  C9_REMINDER: entry('OWNER', true, {
    ownerSuffix: (c) => (c.stage === 'READY_TO_CHECK' ? '/check' : c.stage === 'QUESTION_OPEN' ? toQuestion(c) : ''),
  }),
  C10_ANSWERS_RECEIVED: entry('OWNER', false, { toActor: true, ownerSuffix: () => '/sent' }),
  C10_REQUEST_RECEIVED: entry('OWNER', false, { toActor: true, noProgram: true }),
  T1_ANSWERS_SENT: entry('TEAM', true),
  T2_QUESTION_ANSWERED: entry('TEAM', true),
  T3_CHANGES_ASKED: entry('TEAM', true),
  T4_APPROVED: entry('TEAM', false),
  T5_OWNER_OFFLINE: entry('TEAM', true),
  T5_OWNER_BACK_ONLINE: entry('TEAM', false),
  T6_NAMES_CHANGED: entry('TEAM', false),
  T7_STALLED: entry('TEAM', false),
  T8_ANOTHER_PROGRAM: entry('TEAM', true, { noProgram: true }),
}

/** The owner (and their email) of a program-less event: the actor. */
async function actorAsOwner(userId: string | null): Promise<{ userId: string; email: string; firstName: string; fullName: string; role: 'COACH' | 'AMBASSADOR'; active: boolean } | null> {
  if (!userId) return null
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, status: true, coachProfile: { select: { firstName: true, lastName: true } }, ambassadorProfile: { select: { firstName: true, lastName: true } } },
  })
  if (!u) return null
  const p = u.role === 'AMBASSADOR' ? u.ambassadorProfile ?? u.coachProfile : u.coachProfile ?? u.ambassadorProfile
  const firstName = p?.firstName ?? u.email.split('@')[0]
  return { userId: u.id, email: u.email, firstName, fullName: p ? `${p.firstName} ${p.lastName}`.trim() : firstName, role: u.role === 'AMBASSADOR' ? 'AMBASSADOR' : 'COACH', active: u.status === 'ACTIVE' }
}

/** Builds the context for one event, or null when the page or its owner is missing. */
export async function notifyContext(event: ProgramPageNotifyEvent, input: NotifyInput): Promise<NotifyContext | null> {
  if (NOTIFY_CATALOG[event].noProgram) {
    const o = await actorAsOwner(input.actorId)
    if (!o) return null
    return {
      event, programId: '', rootId: '', programName: '', companyName: '', group: '',
      ownerFirstName: o.firstName, ownerName: o.fullName, ownerRole: o.role, stage: '',
      ownerPath: programsHome(o.role), teamPath: TEAM_QUEUE_PATH, extra: input.extra ?? {},
    }
  }
  if (!input.programId) return null
  const ctx = await loadPageWithRoot(input.programId)
  if (!ctx?.owner) return null
  const names = namesOf(ctx.root)
  const cat = NOTIFY_CATALOG[event]
  const base: Omit<NotifyContext, 'ownerPath'> = {
    event,
    programId: ctx.page.id,
    rootId: ctx.root.id,
    programName: names.programName,
    companyName: names.companyName,
    group: groupName(ctx.page.audienceLabel, names.programName),
    ownerFirstName: ctx.owner.firstName,
    ownerName: ctx.owner.fullName,
    ownerRole: ctx.owner.role,
    stage: ctx.page.infoStage,
    teamPath: teamPagePath(ctx.page.id),
    publicPath: publicPagePath(ctx.page.slug, ctx.owner.inviteSlug),
    extra: input.extra ?? {},
  }
  const suffix = cat.ownerSuffix ? cat.ownerSuffix({ ...base, ownerPath: '' }) : ''
  return { ...base, ownerPath: coachPagePath(ctx.owner.role, ctx.page.id, suffix) }
}

/** The styled email for one event (emails.ts). Kept under its old name for callers of the old seam. */
export function plainEmail(c: NotifyContext, _entry: CatalogEntry, recipientFirst: string): { subject: string; html: string } {
  return programPageEmail(c, recipientFirst)
}

/** A stored question answer ({ value, text }) as one line of text for the team. */
export function storedAnswerText(answerKey: string | null, answer: unknown): string {
  if (typeof answer === 'string') return answer.trim()
  if (!answer || typeof answer !== 'object') return ''
  const a = answer as { value?: unknown; text?: unknown }
  let main = ''
  if (a.value !== undefined && a.value !== null) {
    if (answerKey && questionById(answerKey as AnswerKey)?.kind === 'cost') main = costText(a.value as CostAnswer)
    else if (typeof a.value === 'boolean') main = a.value ? 'Yes' : 'No'
    else if (typeof a.value === 'string') main = a.value.trim()
  }
  const note = typeof a.text === 'string' ? a.text.trim() : ''
  return [main, note].filter(Boolean).join('. ')
}

/** Team emails quote the owner's words: fill the T1 note and T2 answer from the database when the caller left them out. */
async function enrich(c: NotifyContext, actorId: string | null): Promise<NotifyContext> {
  try {
    if (c.event === 'T1_ANSWERS_SENT' && c.extra.note === undefined && c.programId) {
      const e = await prisma.programPageEvent.findFirst({ where: { programId: c.programId, kind: 'ANSWERS_SENT' }, orderBy: { createdAt: 'desc' }, select: { detail: true } })
      const note = (e?.detail as { note?: unknown } | null)?.note
      if (typeof note === 'string' && note.trim()) return { ...c, extra: { ...c.extra, note } }
    }
    if (c.event === 'T2_QUESTION_ANSWERED' && !c.extra.answerText && c.programId) {
      const since = new Date(Date.now() - 10 * 60_000)
      const qs = await prisma.programInfoQuestion.findMany({
        where: { programId: c.programId, answeredAt: { gte: since }, ...(actorId ? { answeredById: actorId } : {}) },
        orderBy: { answeredAt: 'asc' },
        select: { question: true, answerKey: true, answer: true },
      })
      if (qs.length === 1) {
        const answerText = storedAnswerText(qs[0].answerKey, qs[0].answer)
        if (answerText) return { ...c, extra: { ...c.extra, question: qs[0].question, answerText } }
      } else if (qs.length > 1) {
        // Several questions answered in one go: quote each question with its answer.
        const answerText = qs.map((q) => `${q.question.trim()}\n${storedAnswerText(q.answerKey, q.answer) || '(no answer)'}`).join('\n\n')
        return { ...c, extra: { ...c.extra, question: null, answerText } }
      }
    }
  } catch (e) {
    console.error('[PROGRAM-INFO] notify enrich failed', c.event, e)
  }
  return c
}

async function teamRecipients(): Promise<{ id: string; email: string; first: string }[]> {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', status: 'ACTIVE' },
    select: { id: true, email: true, coachProfile: { select: { firstName: true } } },
  })
  return admins.map((a) => ({ id: a.id, email: a.email, first: a.coachProfile?.firstName ?? 'there' }))
}

/**
 * Sends one event. Never throws; returns how many people it reached (for logs and tests).
 * SMS: not switched on. When it is, add the text here for C1, C2 and C9 only.
 */
export async function notifyProgramPage(event: ProgramPageNotifyEvent, input: NotifyInput): Promise<number> {
  try {
    if (input.extra?.impersonated) return 0
    const found = await notifyContext(event, input)
    if (!found) return 0
    const entry = NOTIFY_CATALOG[event]
    let c = entry.to === 'TEAM' ? await enrich(found, input.actorId) : found
    // An admin helping while viewing as the owner: the team sees who actually did it ("Lina Lopez for Ben Carson").
    if (entry.to === 'TEAM' && !entry.noProgram && input.actorId && input.programId) {
      const owner = (await loadPageWithRoot(input.programId))?.owner
      if (owner && owner.userId !== input.actorId) {
        const helper = await actorAsOwner(input.actorId)
        if (helper) c = { ...c, ownerName: `${helper.fullName} for ${c.ownerName}` }
      }
    }

    let people: { id: string; email: string; first: string }[]
    if (entry.to === 'OWNER') {
      const owner = entry.noProgram ? await actorAsOwner(input.actorId) : input.programId ? (await loadPageWithRoot(input.programId))?.owner : null
      if (!owner || !owner.active) return 0
      people = [{ id: owner.userId, email: owner.email, first: owner.firstName }]
    } else {
      people = await teamRecipients()
    }
    if (!entry.toActor) people = people.filter((p) => p.id !== input.actorId)
    if (people.length === 0) return 0

    const title = entry.title(c)
    const message = entry.message(c)
    const actionUrl = entry.to === 'OWNER' ? c.ownerPath : c.teamPath
    // Push tag per page + event, so one page's notice doesn't replace another's on the phone.
    await withPushTag(`pp-${c.programId || 'none'}-${event}`, async () => {
      await prisma.adminNotification.createMany({
        data: people.map((p) => ({ userId: p.id, type: 'PROGRAM_PAGE' as const, title, message, entityType: 'CoachProgram', entityId: c.programId || null, actionUrl })),
      })
    })

    if (entry.email) {
      await Promise.allSettled(people.map((p) => sendEmail({ to: p.email, ...programPageEmail(c, p.first) })))
    }
    // TODO(sms): text C1 and C2 to the owner once SMS is switched on (smsEnabled() in get-involved/offer.ts), e.g.
    // "NowTransformed: <title>. <link> Reply STOP to opt out." C9 texts belong in reminders.ts (9:00-19:00 Central).
    return people.length
  } catch (e) {
    console.error('[PROGRAM-INFO] notify failed', event, e)
    return 0
  }
}
