/**
 * Program info workflow: the automatic reminders (C9) and stalls (T7), run by the 15-minute cron
 * (/api/cron/discovery-reminders). Safe to run twice at once.
 *
 * - C9: day 3 and day 7 (stage.ts reminderDue) while the owner must act: ANSWERING with something
 *   started, QUESTION_OPEN, READY_TO_CHECK. Only 9:00-19:00 US Central. At most ONE reminder email per
 *   owner per Central day: several due pages go into one email ("2 of your pages need you"). Each page
 *   is claimed with a conditional update (stage, stage time and reminder count unchanged), under an
 *   advisory lock that also guards the once-a-day check.
 * - T7: day 10 (stallDue) once per stage period, claimed with infoStalledAt. Any hour.
 * Owners who are not ACTIVE and pages without an owner get nothing.
 * Server only. NOT 'use server'. The planner is pure and tested in reminders.test.ts.
 */
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { centralDayAndHour } from '@/lib/get-involved/admin-digest'
import { reminderMessage, type ReminderPage } from './emails'
import { NOTIFY_CATALOG, notifyProgramPage, type NotifyContext } from './notify'
import { PAGE_INCLUDE, namesOf, ownerOfRow, rootIdOf, stageFactsFrom, type PageRow, type ProgramOwner } from './server'
import { coachPagePath, groupName, teamPagePath } from './paths'
import { reminderDue, stallDue, waitingSinceDate, wholeDaysBetween, type InfoStage, type StageFacts } from './stage'

export const REMINDER_FROM_HOUR = 9
export const REMINDER_UNTIL_HOUR = 19
const WAITING_STAGES: InfoStage[] = ['ANSWERING', 'QUESTION_OPEN', 'READY_TO_CHECK']
const LOCK_KEY = 4210978
const DAY_MS = 86400_000

/** 9:00 up to (not including) 19:00 US Central. */
export function inReminderHours(now: Date): boolean {
  const { hour } = centralDayAndHour(now)
  return hour >= REMINDER_FROM_HOUR && hour < REMINDER_UNTIL_HOUR
}

export const sameCentralDay = (a: Date, b: Date) => centralDayAndHour(a).day === centralDayAndHour(b).day

// ---------- the pure planner ----------

export interface ReminderCandidate {
  pageId: string
  ownerId: string | null
  ownerActive: boolean
  facts: Pick<StageFacts, 'stage' | 'started' | 'openQuestionId' | 'readyVersionId'>
  remindersSent: number
  stalledAt: Date | null
  waitingSince: Date
  /** infoStageAt as read: the claim only wins while it is unchanged. */
  stageAt: Date | null
}

export interface ReminderClaimItem {
  pageId: string
  day: 3 | 7
  stage: InfoStage
  stageAt: Date | null
  remindersSent: number
}

export interface ReminderPlan {
  /** One email per owner, listing every page due today. */
  batches: { ownerId: string; items: ReminderClaimItem[] }[]
  stalls: { pageId: string; stage: InfoStage; stageAt: Date | null }[]
}

/**
 * What to send now. `lastReminderAt` = the last reminder each owner got (any page); an owner already
 * reminded this Central day gets nothing more today (their pages stay due and go out tomorrow).
 */
export function planReminders(cands: ReminderCandidate[], now: Date, lastReminderAt: Map<string, Date>): ReminderPlan {
  const hoursOk = inReminderHours(now)
  const byOwner = new Map<string, ReminderClaimItem[]>()
  const stalls: ReminderPlan['stalls'] = []
  for (const c of cands) {
    if (!c.ownerId || !c.ownerActive) continue
    if (stallDue({ facts: c.facts, stalledAt: c.stalledAt, waitingSince: c.waitingSince }, now)) {
      stalls.push({ pageId: c.pageId, stage: c.facts.stage, stageAt: c.stageAt })
    }
    if (!hoursOk || c.stalledAt) continue
    const last = lastReminderAt.get(c.ownerId)
    if (last && sameCentralDay(last, now)) continue
    const day = reminderDue({ facts: c.facts, remindersSent: c.remindersSent, waitingSince: c.waitingSince }, now)
    if (!day) continue
    const list = byOwner.get(c.ownerId) ?? []
    list.push({ pageId: c.pageId, day, stage: c.facts.stage, stageAt: c.stageAt, remindersSent: c.remindersSent })
    byOwner.set(c.ownerId, list)
  }
  return { batches: Array.from(byOwner, ([ownerId, items]) => ({ ownerId, items })), stalls }
}

// ---------- claims ----------

/** The slice of the Prisma transaction client the claims use (a fake in tests). */
export interface ClaimDb {
  $executeRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>
  programPageEvent: {
    findFirst: (args: { where: Prisma.ProgramPageEventWhereInput; orderBy: { createdAt: 'desc' }; select: { createdAt: true } }) => Promise<{ createdAt: Date } | null>
    create: (args: { data: Prisma.ProgramPageEventUncheckedCreateInput }) => Promise<unknown>
  }
  coachProgram: {
    updateMany: (args: { where: Prisma.CoachProgramWhereInput; data: Prisma.CoachProgramUncheckedUpdateManyInput }) => Promise<{ count: number }>
  }
}

/**
 * Inside a transaction: takes the advisory lock, re-checks that this owner got no reminder today, then
 * claims each page (unchanged stage, stage time, reminder count, not stalled) and logs REMINDER_SENT.
 * Returns the pages it won; send only for those.
 */
export async function claimOwnerReminders(tx: ClaimDb, ownerId: string, items: ReminderClaimItem[], now: Date): Promise<ReminderClaimItem[]> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_KEY})`
  const last = await tx.programPageEvent.findFirst({
    where: { kind: 'REMINDER_SENT', createdAt: { gte: new Date(now.getTime() - 2 * DAY_MS) }, detail: { path: ['ownerId'], equals: ownerId } },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  })
  if (last && sameCentralDay(last.createdAt, now)) return []
  const won: ReminderClaimItem[] = []
  for (const it of items) {
    const r = await tx.coachProgram.updateMany({
      where: { id: it.pageId, infoStage: it.stage, infoStageAt: it.stageAt, infoRemindersSent: it.remindersSent, infoStalledAt: null },
      data: { infoRemindersSent: it.day === 7 ? 2 : 1, infoLastReminderAt: now },
    })
    if (r.count === 1) won.push(it)
  }
  for (const it of won) {
    await tx.programPageEvent.create({ data: { programId: it.pageId, actorId: null, kind: 'REMINDER_SENT', detail: { day: it.day, ownerId, pages: won.length, stage: it.stage } } })
  }
  return won
}

/** Claims one stall (once per stage period). True when this run won it. */
export async function claimStall(db: Pick<ClaimDb, 'coachProgram' | 'programPageEvent'>, s: ReminderPlan['stalls'][number], days: number, now: Date): Promise<boolean> {
  const r = await db.coachProgram.updateMany({
    where: { id: s.pageId, infoStage: s.stage, infoStageAt: s.stageAt, infoStalledAt: null },
    data: { infoStalledAt: now },
  })
  if (r.count !== 1) return false
  await db.programPageEvent.create({ data: { programId: s.pageId, actorId: null, kind: 'STALLED', detail: { stage: s.stage, days } } })
  return true
}

// ---------- the runner ----------

interface Loaded { page: PageRow; root: PageRow; owner: ProgramOwner | null; facts: ReturnType<typeof stageFactsFrom>; waitingSince: Date }

async function loadWaitingPages(): Promise<Loaded[]> {
  const pages = await prisma.coachProgram.findMany({ where: { infoStage: { in: WAITING_STAGES } }, include: PAGE_INCLUDE })
  const byId = new Map(pages.map((p) => [p.id, p]))
  const missing = Array.from(new Set(pages.map(rootIdOf).filter((id) => !byId.has(id))))
  if (missing.length) {
    for (const r of await prisma.coachProgram.findMany({ where: { id: { in: missing } }, include: PAGE_INCLUDE })) byId.set(r.id, r)
  }
  return pages.map((page) => {
    const root = byId.get(rootIdOf(page)) ?? page
    const owner = ownerOfRow(root)
    const facts = stageFactsFrom(page, root, owner)
    const waitingSince = waitingSinceDate({ stage: facts.stage, infoStageAt: page.infoStageAt, infoAnswersEditedAt: page.infoAnswersEditedAt, createdAt: page.createdAt })
    return { page, root, owner, facts, waitingSince }
  })
}

async function lastRemindersByOwner(now: Date): Promise<Map<string, Date>> {
  const rows = await prisma.programPageEvent.findMany({
    where: { kind: 'REMINDER_SENT', createdAt: { gte: new Date(now.getTime() - 2 * DAY_MS) } },
    select: { detail: true, createdAt: true },
  })
  const m = new Map<string, Date>()
  for (const r of rows) {
    const id = (r.detail as { ownerId?: unknown } | null)?.ownerId
    if (typeof id !== 'string') continue
    const prev = m.get(id)
    if (!prev || prev < r.createdAt) m.set(id, r.createdAt)
  }
  return m
}

async function reminderContext(l: Loaded, day: 3 | 7): Promise<NotifyContext> {
  const owner = l.owner as ProgramOwner
  const names = namesOf(l.root)
  const q = l.facts.stage === 'QUESTION_OPEN' && l.facts.openQuestionId
    ? await prisma.programInfoQuestion.findUnique({ where: { id: l.facts.openQuestionId }, select: { question: true } })
    : null
  const base: NotifyContext = {
    event: 'C9_REMINDER',
    programId: l.page.id,
    rootId: l.root.id,
    programName: names.programName,
    companyName: names.companyName,
    group: groupName(l.page.audienceLabel, names.programName),
    ownerFirstName: owner.firstName,
    ownerName: owner.fullName,
    ownerRole: owner.role,
    stage: l.facts.stage,
    ownerPath: '',
    teamPath: teamPagePath(l.page.id),
    extra: {
      reminderDay: day,
      questionId: l.facts.openQuestionId,
      question: q?.question ?? null,
      sectionsLeft: Math.max(0, l.facts.sectionsTotal - l.facts.sectionsDone),
    },
  }
  const suffix = NOTIFY_CATALOG.C9_REMINDER.ownerSuffix?.(base) ?? ''
  return { ...base, ownerPath: coachPagePath(owner.role, l.page.id, suffix) }
}

/**
 * One cron pass. Returns counts for the cron's JSON. Never throws for one owner's failure; the cron
 * wraps the whole call too, so a failure here never stops the other jobs.
 */
export async function runProgramPageReminders(now = new Date()): Promise<{ emails: number; pages: number; stalled: number }> {
  const loaded = await loadWaitingPages()
  const byId = new Map(loaded.map((l) => [l.page.id, l]))
  const plan = planReminders(
    loaded.map((l) => ({
      pageId: l.page.id,
      ownerId: l.owner?.userId ?? null,
      ownerActive: l.owner?.active ?? false,
      facts: l.facts,
      remindersSent: l.page.infoRemindersSent,
      stalledAt: l.page.infoStalledAt,
      waitingSince: l.waitingSince,
      stageAt: l.page.infoStageAt,
    })),
    now,
    await lastRemindersByOwner(now),
  )

  let emails = 0, pages = 0, stalled = 0
  for (const b of plan.batches) {
    try {
      const won = await prisma.$transaction((tx) => claimOwnerReminders(tx as unknown as ClaimDb, b.ownerId, b.items, now))
      if (won.length === 0) continue
      const owner = byId.get(won[0].pageId)!.owner!
      const items: ReminderPage[] = []
      for (const w of won) items.push({ c: await reminderContext(byId.get(w.pageId)!, w.day) })
      const m = reminderMessage(items, owner.firstName)
      await prisma.adminNotification.create({
        data: { userId: owner.userId, type: 'PROGRAM_PAGE', title: m.title, message: m.message, entityType: 'CoachProgram', entityId: won.length === 1 ? won[0].pageId : null, actionUrl: m.actionPath },
      })
      const r = await sendEmail({ to: owner.email, subject: m.subject, html: m.html }).catch(() => ({ sent: false }))
      // TODO(sms): once SMS is switched on (smsEnabled() in get-involved/offer.ts), text the same reminder here,
      // still inside 9:00-19:00 Central: "NowTransformed: <title>. <link> Reply STOP to opt out."
      if (r.sent) emails++
      pages += won.length
    } catch (e) {
      console.error('[PROGRAM-INFO] reminder failed', b.ownerId, e)
    }
  }

  for (const s of plan.stalls) {
    try {
      const l = byId.get(s.pageId)!
      if (!(await claimStall(prisma as unknown as ClaimDb, s, wholeDaysBetween(l.waitingSince, now), now))) continue
      stalled++
      await notifyProgramPage('T7_STALLED', { programId: s.pageId, actorId: null })
    } catch (e) {
      console.error('[PROGRAM-INFO] stall failed', s.pageId, e)
    }
  }
  return { emails, pages, stalled }
}
