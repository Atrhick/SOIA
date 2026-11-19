'use server'

/**
 * Program info workflow: server actions for page owners (coach or ambassador) and the team (ADMIN).
 * Rules (BUILD-SPEC):
 * - Owner actions: the signed-in coach/ambassador must own the ROOT program; refused while impersonating
 *   (reads allow it, read-only).
 * - Team actions: ADMIN, not while impersonating (requireAdmin), audited.
 * - Every state change writes a ProgramPageEvent in the same transaction, then calls notifyProgramPage
 *   after it (never throws).
 * Labels and moves: src/lib/program-info/stage.ts. Questions: questions.ts. Reads: server.ts.
 */
import { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { audit, buildSnapshot, requireAdmin, requireProgramUser, revalidateOwnerPages, type ProgramRecord } from '@/lib/program-pages-core'
import { draftWelcomeNoteOnPublish } from '@/lib/get-involved/program-welcome-server'
import { hasProgramOwner, isProgramOwnedBy } from '@/lib/program-owner'
import { slugifyProgramName } from '@/lib/program-question-types'
import {
  answersAsText,
  costToPriceStrings,
  isAnswerKey,
  isAnswered,
  isSharedKey,
  parseAnswer,
  type CostAnswer,
} from '@/lib/program-info/questions'
import { DIFF_KEYS, asAnswers, mergeAnswers, pageProgress, sharedChanged, type MissingAnswer } from '@/lib/program-info/progress'
import { canMoveStage, enterStageData, type InfoStage } from '@/lib/program-info/stage'
import { parseDraftInput, writeDraftVersion } from '@/lib/program-info/drafts'
import { CLOSED_BY_TEAM_TEXT, GROUP_GONE_MESSAGE, publishPageClaimWhere, removableGroupsWhere, sendAnswersClaimWhere } from '@/lib/program-info/claims'
import {
  PAGE_INCLUDE,
  approvedSnapshotOf,
  canRemoveGroup,
  loadPageWithRoot,
  myProgramsForOwner,
  namesOf,
  pageDetail,
  stageFactsFrom,
  teamQueue,
  type OwnerProgramGroup,
  type PageDetail,
  type PageRow,
  type StoredQuestionAnswer,
  type TeamQueue,
} from '@/lib/program-info/server'
import { notifyProgramPage, storedAnswerText, type ProgramPageNotifyEvent, type NotifyExtra } from '@/lib/program-info/notify'
import { TEAM_QUEUE_PATH, programsHome, teamPagePath, type OwnerRole } from '@/lib/program-info/paths'

// ============================================
// Shared
// ============================================

export type ActionFail = {
  ok: false
  error: string
  /** sendAnswers: the required answers still empty. */
  missing?: MissingAnswer[]
  /** sendToCoach: open questions exist; resend with confirmOpenQuestions: true. */
  needsConfirm?: boolean
  openQuestionCount?: number
}
export type ActionResult<T extends object = object> = ({ ok: true } & T) | ActionFail

const fail = (error: string, more: Omit<ActionFail, 'ok' | 'error'> = {}): ActionFail => ({ ok: false, error, ...more })
const Id = z.string().min(1).max(100)
const GENERIC = 'Something went wrong. Please try again.'

class Conflict extends Error {}
/** The page left READY_TO_CHECK (question or changes asked) before the owner's approval landed. */
class NotReady extends Error {}
/** A group page to remove went live or got a sign-up after it was read. */
class GroupGone extends Error {}
const CONFLICT = 'This page just changed. Please reload and try again.'
const OUT_OF_DATE = 'This version is out of date. Reload the page.'

type Tx = Prisma.TransactionClient
type EventKind =
  | 'ANSWERS_SENT' | 'QUESTION_ASKED' | 'QUESTION_ANSWERED' | 'DRAFT_SAVED' | 'SENT_TO_CHECK' | 'CHANGES_ASKED' | 'APPROVED'
  | 'PUBLISHED_ON_BEHALF' | 'TAKEN_OFFLINE' | 'BACK_ONLINE' | 'GROUP_ADDED' | 'NAMES_CHANGED' | 'REMINDER_SENT' | 'STALLED' | 'MIGRATED' | 'SUGGESTIONS_ADDED' | 'EDITED_FOR_OWNER'

function logEvent(tx: Tx, programId: string, actorId: string | null, kind: EventKind, detail?: Record<string, unknown>) {
  return tx.programPageEvent.create({ data: { programId, actorId, kind, detail: (detail ?? undefined) as Prisma.InputJsonValue | undefined } })
}

/**
 * An admin viewing as the owner changed answers: one history row per admin and page per 30 minutes,
 * listing the questions touched (autosave would otherwise write a row per keystroke pause).
 */
async function logSupportEdit(programId: string, actorId: string, keys: string[]) {
  try {
    const since = new Date(Date.now() - 30 * 60 * 1000)
    const last = await prisma.programPageEvent.findFirst({
      where: { programId, actorId, kind: 'EDITED_FOR_OWNER', createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, detail: true },
    })
    if (last) {
      const prev = (last.detail as { keys?: unknown } | null)?.keys
      const had = Array.isArray(prev) ? prev.filter((k): k is string => typeof k === 'string') : []
      const all = Array.from(new Set([...had, ...keys]))
      if (all.length !== had.length) await prisma.programPageEvent.update({ where: { id: last.id }, data: { detail: { keys: all } } })
      return
    }
    await prisma.programPageEvent.create({ data: { programId, actorId, kind: 'EDITED_FOR_OWNER', detail: { keys } } })
  } catch (e) {
    console.error('[PROGRAM-INFO] support edit log failed', e)
  }
}

async function notify(event: ProgramPageNotifyEvent, programId: string, actorId: string | null, extra?: NotifyExtra) {
  await notifyProgramPage(event, { programId, actorId, extra })
}

/** Owner screens (both roles, every sub-route), the team queue and the page's team screen. */
function revalidateInfo(...pageIds: string[]) {
  for (const id of pageIds) revalidateOwnerPages(id)
  revalidatePath(programsHome('COACH'), 'layout')
  revalidatePath(programsHome('AMBASSADOR'), 'layout')
  revalidatePath(TEAM_QUEUE_PATH, 'layout')
  for (const id of pageIds) revalidatePath(teamPagePath(id))
}

function revalidatePublic(slug: string) {
  revalidatePath(`/p/${slug}`)
  revalidatePath('/join', 'layout')
}

/** Atomic merge of keys into a Json object column (two autosaves never overwrite each other). */
async function mergeJsonColumn(db: Tx | typeof prisma, column: 'infoAnswers' | 'sharedAnswers', id: string, patch: Record<string, unknown>) {
  const col = Prisma.raw(column === 'infoAnswers' ? '"infoAnswers"' : '"sharedAnswers"')
  await db.$executeRaw`UPDATE "coach_programs" SET ${col} = (CASE WHEN jsonb_typeof(${col}) = 'object' THEN ${col} ELSE '{}'::jsonb END) || ${JSON.stringify(patch)}::jsonb, "updatedAt" = NOW() WHERE "id" = ${id}`
}

// ---------- guards ----------

/** The signed-in owner of this page's ROOT program. */
async function requirePageOwner(programId: string, opts: { allowImpersonation?: boolean; allowSupport?: boolean } = {}) {
  if (!Id.safeParse(programId).success) return { ok: false as const, error: 'Page not found' }
  const ctx = await requireProgramUser(opts)
  if (!ctx.ok) return { ok: false as const, error: ctx.error }
  const loaded = await loadPageWithRoot(programId)
  if (!loaded || !isProgramOwnedBy(loaded.root, ctx.owner)) return { ok: false as const, error: 'Page not found' }
  return { ok: true as const, session: ctx.session, owner: ctx.owner, readOnly: ctx.readOnly, actorId: ctx.actorId, page: loaded.page, root: loaded.root, programOwner: loaded.owner }
}

// ---------- answers ----------

/**
 * Writes one validated answer: shared keys onto the root's sharedAnswers, the rest onto the page's
 * infoAnswers; `cost` also into the price columns, `zoomUrl` into the zoomUrl column.
 * Never touches the live page (publishedSnapshot / offerPage).
 */
async function writeAnswer(tx: Tx, page: PageRow, root: PageRow, key: string, value: unknown, actorId: string, now: Date) {
  if (isSharedKey(key)) {
    await mergeJsonColumn(tx, 'sharedAnswers', root.id, { [key]: value })
    // A shared answer changes every page that was already sent (each one is checked again).
    await tx.coachProgram.updateMany({
      where: { OR: [{ id: page.id }, { AND: [{ OR: [{ id: root.id }, { parentProgramId: root.id }] }, { infoAnswersSentAt: { not: null } }] }] },
      data: { infoAnswersEditedAt: now },
    })
    return
  }
  await mergeJsonColumn(tx, 'infoAnswers', page.id, { [key]: value })
  const data: Prisma.CoachProgramUpdateInput = { infoAnswersEditedAt: now }
  if (key === 'zoomUrl') data.zoomUrl = typeof value === 'string' && value ? value : null
  if (key === 'cost') {
    const { offerFullPrice, offerSponsoredPrice } = costToPriceStrings(value as CostAnswer)
    // An empty box while typing never wipes a saved price; sponsorships on = keep a sponsored price.
    const full = offerFullPrice ?? page.offerFullPrice
    const sponsored = offerSponsoredPrice ?? ((page.sponsoredSeatsPerMonth ?? 0) > 0 ? page.offerSponsoredPrice : null)
    if (full !== page.offerFullPrice || sponsored !== page.offerSponsoredPrice) {
      Object.assign(data, { offerFullPrice: full, offerSponsoredPrice: sponsored, offerPricesUpdatedAt: now, offerPricesUpdatedById: actorId })
    }
  }
  await tx.coachProgram.update({ where: { id: page.id }, data })
}

// ---------- publishing (approve / publish on behalf) ----------

/**
 * Puts a version live, the one way a page goes live in this workflow. Single transaction: the version is
 * claimed (conditional), earlier DRAFT/SENT versions are superseded, the program gets the version's page,
 * welcome email paragraph (approved, MANUAL) and invitation line, the names from Names and groups, the
 * existing snapshot (buildSnapshot), status PUBLISHED, offline cleared, stage DONE.
 */
async function publishVersion(
  versionId: string,
  actorId: string,
  opts: {
    onBehalf: boolean
    reason?: string
    allowed: ('DRAFT' | 'SENT' | 'CHANGES_ASKED')[]
    ownerCheck?: (root: PageRow) => boolean
    /** Only the latest SENT version may be approved (A9). */
    latestSentOnly?: boolean
    /** Draft an AI welcome paragraph when the version has none (publish on behalf only; A9: never on the owner's approval). */
    draftWelcome: boolean
  },
): Promise<ActionResult<{ programId: string }>> {
  const v = await prisma.programPageVersion.findUnique({ where: { id: versionId } })
  if (!v) return fail('Version not found')
  const loaded = await loadPageWithRoot(v.programId)
  if (!loaded) return fail('Page not found')
  const { page, root } = loaded
  if (opts.ownerCheck && !opts.ownerCheck(root)) return fail('Version not found')
  if (!hasProgramOwner(root)) return fail('Assign a coach or ambassador before publishing')
  if (!(opts.allowed as string[]).includes(v.status)) {
    return fail(v.status === 'APPROVED' ? 'This version is already approved.' : OUT_OF_DATE)
  }
  if (opts.latestSentOnly && page.pageVersions.find((x) => x.status === 'SENT')?.id !== v.id) return fail(OUT_OF_DATE)
  // The owner approves only what they were asked to check: a question or changes asked since then moved
  // the page out of READY_TO_CHECK, so that SENT version is out of date (re-checked in the claim below).
  if (!opts.onBehalf && page.infoStage !== 'READY_TO_CHECK') return fail(OUT_OF_DATE)
  const program = await prisma.coachProgram.findUnique({ where: { id: page.id } })
  if (!program) return fail('Page not found')

  const now = new Date()
  const names = namesOf(root)
  const fields: Prisma.CoachProgramUpdateInput = {
    pageTitle: names.programName,
    organization: names.companyName,
    ...(v.offerPage !== null ? { offerPage: v.offerPage as Prisma.InputJsonValue } : {}),
    ...(v.messageLine ? { messageLine: v.messageLine } : {}),
    ...(v.welcomeNote
      ? { welcomeNote: v.welcomeNote, welcomeNoteSource: 'MANUAL', welcomeNoteApprovedAt: now, welcomeNoteApprovedBy: actorId }
      : {}),
  }
  const snapshot = buildSnapshot({ ...(program as unknown as ProgramRecord), pageTitle: names.programName, organization: names.companyName })

  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.programPageVersion.updateMany({
        where: { id: v.id, status: { in: opts.allowed } },
        data: { status: 'APPROVED', approvedAt: now, approvedById: actorId, approvedOnBehalf: opts.onBehalf },
      })
      if (claimed.count !== 1) throw new Conflict()
      await tx.programPageVersion.updateMany({
        where: { programId: page.id, id: { not: v.id }, number: { lt: v.number }, status: { in: ['DRAFT', 'SENT'] } },
        data: { status: 'SUPERSEDED' },
      })
      const pageClaim = await tx.coachProgram.updateMany({
        where: publishPageClaimWhere(page.id, opts.onBehalf),
        data: {
          ...fields,
          status: 'PUBLISHED',
          publishedSnapshot: snapshot as Prisma.InputJsonValue,
          reviewedAt: now,
          reviewedBy: actorId,
          reviewNotes: null,
          offlineAt: null,
          offlineById: null,
          offlineReason: null,
          ...enterStageData('DONE', now),
        },
      })
      if (pageClaim.count !== 1) throw new NotReady()
      // Publish on behalf may come from any stage: open questions are closed by the team so none is left
      // waiting on a page that is now DONE.
      if (opts.onBehalf) {
        await tx.programInfoQuestion.updateMany({
          where: { programId: page.id, answeredAt: null },
          data: { answer: { text: CLOSED_BY_TEAM_TEXT } as Prisma.InputJsonValue, answeredAt: now, answeredById: actorId },
        })
      }
      await logEvent(tx, page.id, actorId, opts.onBehalf ? 'PUBLISHED_ON_BEHALF' : 'APPROVED', {
        versionId: v.id, number: v.number, ...(opts.reason ? { reason: opts.reason } : {}),
      })
    })
  } catch (e) {
    if (e instanceof Conflict) return fail(CONFLICT)
    if (e instanceof NotReady) return fail(OUT_OF_DATE)
    console.error('[PROGRAM-INFO] publish failed', e)
    return fail(GENERIC)
  }

  await audit(actorId, opts.onBehalf ? 'PROGRAM_PAGE_PUBLISHED_ON_BEHALF' : 'PROGRAM_PAGE_APPROVED', page.id, {
    versionId: v.id, number: v.number, slug: page.slug, ...(opts.reason ? { reason: opts.reason } : {}),
  })
  // Publish on behalf: like approveProgram, an AI paragraph is drafted only when none was approved (never
  // fails the publish). Not on the owner's approval: they just approved the welcome email they saw (A9).
  if (opts.draftWelcome && !v.welcomeNote) await draftWelcomeNoteOnPublish(page.id)
  revalidateInfo(page.id)
  revalidatePath('/admin/programs')
  revalidatePublic(page.slug)
  return { ok: true, programId: page.id }
}

// ---------- offline / online ----------

async function setOffline(page: PageRow, actorId: string, reason: string | null, by: 'owner' | 'team'): Promise<ActionResult> {
  if (page.status !== 'PUBLISHED' || page.publishedSnapshot === null) return fail('This page is not live.')
  const now = new Date()
  try {
    await prisma.$transaction(async (tx) => {
      // The snapshot is kept, so "back online" shows exactly what was approved.
      const r = await tx.coachProgram.updateMany({
        where: { id: page.id, status: 'PUBLISHED' },
        data: { status: 'DRAFT', offlineAt: now, offlineById: actorId, offlineReason: reason },
      })
      if (r.count !== 1) throw new Conflict()
      await logEvent(tx, page.id, actorId, 'TAKEN_OFFLINE', { by, ...(reason ? { reason } : {}) })
    })
  } catch (e) {
    if (e instanceof Conflict) return fail(CONFLICT)
    console.error('[PROGRAM-INFO] offline failed', e)
    return fail(GENERIC)
  }
  revalidateInfo(page.id)
  revalidatePath('/admin/programs')
  revalidatePublic(page.slug)
  return { ok: true }
}

async function setOnline(page: PageRow, actorId: string, by: 'owner' | 'team', reason: string | null = null): Promise<ActionResult> {
  if (page.status === 'PUBLISHED' && page.publishedSnapshot !== null) return fail('This page is already live.')
  if (!page.offlineAt) return fail('This page has not been approved yet.')
  if (!page.pageVersions.some((v) => v.status === 'APPROVED')) return fail('This page has no approved version yet.')
  let snapshot = page.publishedSnapshot
  if (snapshot === null) {
    const program = await prisma.coachProgram.findUnique({ where: { id: page.id } })
    if (!program) return fail('Page not found')
    snapshot = buildSnapshot(program as unknown as ProgramRecord) as Prisma.JsonValue
  }
  try {
    await prisma.$transaction(async (tx) => {
      const r = await tx.coachProgram.updateMany({
        where: { id: page.id, offlineAt: { not: null } },
        data: { status: 'PUBLISHED', publishedSnapshot: snapshot as Prisma.InputJsonValue, offlineAt: null, offlineById: null, offlineReason: null },
      })
      if (r.count !== 1) throw new Conflict()
      await logEvent(tx, page.id, actorId, 'BACK_ONLINE', { by, ...(reason ? { reason } : {}) })
    })
  } catch (e) {
    if (e instanceof Conflict) return fail(CONFLICT)
    console.error('[PROGRAM-INFO] online failed', e)
    return fail(GENERIC)
  }
  revalidateInfo(page.id)
  revalidatePath('/admin/programs')
  revalidatePublic(page.slug)
  return { ok: true }
}

// ---------- group pages ----------

const GROUP_COPY_FIELDS = [
  'name', 'organization', 'targetMarket', 'internshipOffering', 'servicesDescription', 'weeklyEngagement1', 'weeklyEngagement2',
  'monthlyGrowthGoal', 'monthlyImpactGoal', 'monthlyGrowthGoalValue', 'monthlyGrowthGoalUnit', 'monthlyImpactGoalValue', 'monthlyImpactGoalUnit',
  'coachId', 'ambassadorId', 'assignedAt', 'assignedBy', 'showCoachBio', 'coachBio',
] as const

/** A new group page under the root: grant fields + owner copied, its own slug, stage ANSWERING. */
async function createGroupPage(tx: Tx, rootId: string, label: string, actorId: string, now: Date): Promise<{ id: string; slug: string }> {
  const root = await tx.coachProgram.findUnique({ where: { id: rootId } })
  if (!root) throw new Error('Root not found')
  const base = `${root.slug}-${slugifyProgramName(label) || 'group'}`.slice(0, 90)
  let slug = base
  for (let n = 2; n < 100; n++) {
    const taken = await tx.coachProgram.findUnique({ where: { slug }, select: { id: true } })
    if (!taken) break
    slug = `${base}-${n}`
  }
  const copy: Record<string, unknown> = {}
  for (const f of GROUP_COPY_FIELDS) copy[f] = (root as Record<string, unknown>)[f]
  const child = await tx.coachProgram.create({
    data: {
      ...(copy as Prisma.CoachProgramUncheckedCreateInput),
      slug,
      parentProgramId: root.id,
      audienceLabel: label,
      infoStage: 'ANSWERING',
      infoStageAt: now,
    },
    select: { id: true, slug: true },
  })
  await logEvent(tx, child.id, actorId, 'GROUP_ADDED', { label, rootId: root.id })
  return child
}

const Label = z.string().trim().min(1, 'Give each group a name').max(60, 'Group names: at most 60 characters')

// ============================================
// Owner reads (coach or ambassador; allowed read-only while impersonating)
// ============================================

export async function getMyProgramPages(): Promise<ActionResult<{ readOnly: boolean; ownerRole: OwnerRole; groups: OwnerProgramGroup[] }>> {
  const ctx = await requireProgramUser({ allowImpersonation: true })
  if (!ctx.ok) return fail(ctx.error)
  const groups = await myProgramsForOwner(ctx.session.user.id, ctx.owner.role)
  return { ok: true, readOnly: ctx.readOnly, ownerRole: ctx.owner.role, groups }
}

/** One page for its owner. DRAFT versions (the team's work in progress) are left out. */
export async function getMyPageDetail(programId: string): Promise<ActionResult<{ readOnly: boolean; ownerRole: OwnerRole; detail: PageDetail }>> {
  const ctx = await requirePageOwner(programId, { allowImpersonation: true })
  if (!ctx.ok) return fail(ctx.error)
  const detail = await pageDetail(ctx.page.id)
  if (!detail) return fail('Page not found')
  return { ok: true, readOnly: ctx.readOnly, ownerRole: ctx.owner.role, detail: { ...detail, versions: detail.versions.filter((v) => v.status !== 'DRAFT') } }
}

// ============================================
// Owner actions (refused while impersonating)
// ============================================

const NamesSchema = z.object({
  programName: z.string().trim().min(1, 'Please enter the program name').max(150),
  companyName: z.string().trim().max(150).default(''),
  groups: z.array(z.union([Label, z.object({ id: Id.optional(), label: Label })])).max(6, 'Up to 6 groups'),
})

/**
 * "Names and groups". `groups[i]` is a label or `{ id, label }` (send ids so a rename keeps the page).
 * The root page is the entry with the root's id, else the first one. New labels make new group pages;
 * a group left out is removed only if it never had sign-ups, was never live and has no versions (else
 * refused: only the team can remove it). One group = no audience label. Names go into the root's
 * sharedAnswers and reach the live page only when a version is approved.
 */
export async function saveNamesAndGroups(rootId: string, input: unknown): Promise<ActionResult<{ groups: { id: string; label: string | null }[] }>> {
  const ctx = await requirePageOwner(rootId, { allowSupport: true })
  if (!ctx.ok) return fail(ctx.error)
  if (ctx.page.id !== ctx.root.id) return fail('Open Names and groups from the main program.')
  const parsed = NamesSchema.safeParse(input)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Check the form')
  const { programName, companyName } = parsed.data
  const entries = parsed.data.groups.map((g) => (typeof g === 'string' ? { id: undefined as string | undefined, label: g } : g))
  const lower = entries.map((e) => e.label.toLowerCase())
  if (new Set(lower).size !== lower.length) return fail('Two groups have the same name.')

  const root = ctx.root
  const children = await prisma.coachProgram.findMany({ where: { parentProgramId: root.id }, include: PAGE_INCLUDE, orderBy: { createdAt: 'asc' } })
  const all = [{ id: root.id, audienceLabel: root.audienceLabel }, ...children]
  const matchLabel = (label: string) => all.find((p) => (p.audienceLabel ?? '').toLowerCase() === label.toLowerCase())?.id

  // Resolve each entry to an existing page id (or none = new).
  const used = new Set<string>()
  const resolved = entries.map((e) => {
    let id = e.id && all.some((p) => p.id === e.id) ? e.id : matchLabel(e.label)
    if (id && used.has(id)) id = undefined
    if (id) used.add(id)
    return { id, label: e.label }
  })
  let rootIdx = resolved.findIndex((r) => r.id === root.id)
  if (rootIdx < 0 && resolved.length > 0) {
    rootIdx = resolved.findIndex((r) => !r.id)
    if (rootIdx < 0) rootIdx = 0
    if (resolved[rootIdx].id) used.delete(resolved[rootIdx].id!)
    resolved[rootIdx] = { id: root.id, label: resolved[rootIdx].label }
    used.add(root.id)
  }
  const removed = children.filter((c) => !used.has(c.id))
  // A3: only pages that were never live and have no sign-ups can be removed by the owner.
  const blocked = removed.filter((c) => !canRemoveGroup(c))
  if (blocked.length) {
    return fail(`${blocked.map((b) => b.audienceLabel ?? 'A group').join(', ')} has been live or has sign-ups, so only the team can remove it. Ask the team to remove it.`)
  }

  const single = resolved.length <= 1
  const rootLabel = single ? null : resolved[rootIdx]?.label ?? null
  const now = new Date()
  const actorId = ctx.actorId
  const oldNames = namesOf(root)
  const summary: string[] = []
  const namesChanged = root.groupsConfirmedAt !== null && (oldNames.programName !== programName || oldNames.companyName !== companyName)
  if (namesChanged) summary.push(`names: ${programName}${companyName ? ` · ${companyName}` : ''}`)
  // A4: new names must be rewritten into every approved page and checked again.
  const donePages = namesChanged ? [root, ...children].filter((p) => p.infoStage === 'DONE' && !removed.some((r) => r.id === p.id)) : []

  let added: { id: string; slug: string; label: string }[] = []
  try {
    added = await prisma.$transaction(async (tx) => {
      await mergeJsonColumn(tx, 'sharedAnswers', root.id, { programName, companyName })
      if (!root.groupsConfirmedAt) await tx.coachProgram.update({ where: { id: root.id }, data: { groupsConfirmedAt: now } })
      for (const d of donePages) {
        const r = await tx.coachProgram.updateMany({ where: { id: d.id, infoStage: 'DONE' }, data: enterStageData('WITH_TEAM', now) })
        if (r.count === 1) await logEvent(tx, d.id, actorId, 'NAMES_CHANGED', { summary: [`names: ${programName}${companyName ? ` · ${companyName}` : ''}`], programName, companyName, movedToTeam: true })
      }
      if ((root.audienceLabel ?? null) !== rootLabel) {
        await tx.coachProgram.update({ where: { id: root.id }, data: { audienceLabel: rootLabel } })
        summary.push(`main page group: ${rootLabel ?? '(one group)'}`)
      }
      const made: { id: string; slug: string; label: string }[] = []
      for (let i = 0; i < resolved.length; i++) {
        const r = resolved[i]
        if (i === rootIdx) continue
        if (r.id) {
          const before = children.find((c) => c.id === r.id)
          if (before && before.audienceLabel !== r.label) {
            await tx.coachProgram.update({ where: { id: r.id }, data: { audienceLabel: r.label } })
            summary.push(`renamed ${before.audienceLabel ?? 'a group'} to ${r.label}`)
          }
        } else {
          const c = await createGroupPage(tx, root.id, r.label, actorId, now)
          made.push({ ...c, label: r.label })
          summary.push(`added ${r.label}`)
        }
      }
      if (removed.length) {
        const del = await tx.coachProgram.deleteMany({ where: removableGroupsWhere(root.id, removed.map((r) => r.id)) })
        if (del.count !== removed.length) throw new GroupGone()
        summary.push(`removed ${removed.map((r) => r.audienceLabel ?? 'a group').join(', ')}`)
      }
      if (summary.length && !donePages.some((d) => d.id === root.id)) await logEvent(tx, root.id, actorId, 'NAMES_CHANGED', { summary, programName, companyName })
      return made
    })
  } catch (e) {
    if (e instanceof GroupGone) return fail(GROUP_GONE_MESSAGE)
    console.error('[PROGRAM-INFO] saveNamesAndGroups failed', e)
    return fail(GENERIC)
  }

  if (summary.length) await notify('T6_NAMES_CHANGED', root.id, actorId, { summary: summary.join('; ') })
  for (const d of donePages) await notify('T1_ANSWERS_SENT', d.id, actorId, { changed: true })
  revalidateInfo(root.id, ...added.map((a) => a.id), ...donePages.map((d) => d.id))
  const pages = await prisma.coachProgram.findMany({ where: { OR: [{ id: root.id }, { parentProgramId: root.id }] }, select: { id: true, audienceLabel: true, parentProgramId: true, createdAt: true }, orderBy: { createdAt: 'asc' } })
  const ordered = [...pages.filter((p) => p.id === root.id), ...pages.filter((p) => p.id !== root.id)]
  return { ok: true, groups: ordered.map((p) => ({ id: p.id, label: p.audienceLabel })) }
}

/**
 * Autosave of one answer. Shared keys (About you) go to the root and count for every page; `cost` also
 * writes the price columns. Editing a live page never changes what is live.
 */
export async function saveAnswer(programId: string, key: string, value: unknown): Promise<ActionResult<{ savedAt: string; sectionsDone: number; sectionsTotal: number; missingText: string }>> {
  const ctx = await requirePageOwner(programId, { allowSupport: true })
  if (!ctx.ok) return fail(ctx.error)
  // A5: while a version waits for the owner's check, answers are read-only.
  if (ctx.page.infoStage === 'READY_TO_CHECK') return fail('Your page is ready to check. To change something, use Ask for these changes.')
  const parsed = parseAnswer(key, value)
  if (!parsed.ok) return fail(parsed.error)
  const now = new Date()
  try {
    await prisma.$transaction((tx) => writeAnswer(tx, ctx.page, ctx.root, parsed.key, parsed.value, ctx.actorId, now))
  } catch (e) {
    console.error('[PROGRAM-INFO] saveAnswer failed', e)
    return fail('Could not save. Please try again.')
  }
  if (ctx.readOnly) await logSupportEdit(ctx.page.id, ctx.actorId, [parsed.key])
  const after = await loadPageWithRoot(ctx.page.id)
  const progress = pageProgress(mergeAnswers(after?.page.infoAnswers, after?.root.sharedAnswers))
  revalidateInfo(ctx.page.id)
  return { ok: true, savedAt: now.toISOString(), sectionsDone: progress.sectionsDone, sectionsTotal: progress.sectionsTotal, missingText: progress.missingText }
}

/**
 * "Send my <Group> answers". Blocked with the list of missing required answers. Moves the page to
 * WITH_TEAM (a page with an open question stays QUESTION_OPEN). Also used for changes to a live page.
 */
export async function sendAnswers(programId: string, note?: string): Promise<ActionResult<{ changed: boolean; alsoSentPageIds: string[] }>> {
  const ctx = await requirePageOwner(programId, { allowSupport: true })
  if (!ctx.ok) return fail(ctx.error)
  const noteParsed = z.string().trim().max(2000, 'At most 2000 characters').optional().safeParse(note)
  if (!noteParsed.success) return fail(noteParsed.error.issues[0]?.message ?? 'Check the note')
  const { page, root } = ctx
  const facts = stageFactsFrom(page, root, null)
  if (!facts.progress.complete) {
    return fail(`Almost there. Still to do: ${facts.progress.missingText}.`, { missing: facts.progress.missing })
  }
  const changed = page.infoAnswersSentAt !== null
  if (changed && !facts.hasUnsentChanges && !noteParsed.data) return fail('Nothing has changed since you last sent these answers.')
  const from = page.infoStage as InfoStage
  const to: InfoStage = from === 'QUESTION_OPEN' ? 'QUESTION_OPEN' : 'WITH_TEAM'
  if (!canMoveStage(from, to)) return fail('These answers cannot be sent right now.')

  const answers = mergeAnswers(page.infoAnswers, root.sharedAnswers)
  const changes = (from === 'DONE' ? facts.changedSinceLive : facts.changedSinceSent).map((c) => c.key)
  // A7: a changed shared answer (About you) also sends every other live (DONE) page of the program.
  const siblings = await prisma.coachProgram.findMany({
    where: { OR: [{ id: root.id }, { parentProgramId: root.id }], id: { not: page.id }, infoStage: 'DONE' },
    include: PAGE_INCLUDE,
  })
  const movedSiblings = siblings.filter((sib) => {
    const snap = approvedSnapshotOf(sib)
    return snap !== null && sharedChanged(snap, mergeAnswers(sib.infoAnswers, root.sharedAnswers))
  })
  const now = new Date()
  const actorId = ctx.actorId
  try {
    await prisma.$transaction(async (tx) => {
      const r = await tx.coachProgram.updateMany({
        where: sendAnswersClaimWhere(page.id, from, page.infoAnswersSentAt),
        data: { infoAnswersSentAt: now, ...(to !== from ? enterStageData(to, now) : {}) },
      })
      if (r.count !== 1) throw new Conflict()
      // The snapshot on the event is what "Changed since sent" compares against.
      await logEvent(tx, page.id, actorId, 'ANSWERS_SENT', {
        changed, changedKeys: changes, answers, ...(noteParsed.data ? { note: noteParsed.data } : {}),
      })
      for (const sib of movedSiblings) {
        const m = await tx.coachProgram.updateMany({ where: { id: sib.id, infoStage: 'DONE' }, data: { infoAnswersSentAt: now, ...enterStageData('WITH_TEAM', now) } })
        if (m.count === 1) {
          await logEvent(tx, sib.id, actorId, 'ANSWERS_SENT', {
            changed: true, sharedFrom: page.id, answers: mergeAnswers(sib.infoAnswers, root.sharedAnswers), ...(noteParsed.data ? { note: noteParsed.data } : {}),
          })
        }
      }
    })
  } catch (e) {
    if (e instanceof Conflict) return fail(CONFLICT)
    console.error('[PROGRAM-INFO] sendAnswers failed', e)
    return fail(GENERIC)
  }
  // The owner's note goes in as given (null = no note), so notify does not look it up again.
  const sentNote = noteParsed.data || null
  await notify('T1_ANSWERS_SENT', page.id, actorId, { changed, note: sentNote })
  for (const sib of movedSiblings) await notify('T1_ANSWERS_SENT', sib.id, actorId, { changed: true, note: sentNote })
  await notify('C10_ANSWERS_RECEIVED', page.id, actorId)
  revalidateInfo(page.id, ...movedSiblings.map((x) => x.id))
  return { ok: true, changed, alsoSentPageIds: movedSiblings.map((x) => x.id) }
}

const AnswerItemSchema = z.object({
  questionId: Id,
  /** The answer for the question's answerKey (validated like saveAnswer). */
  value: z.unknown().optional(),
  /** Free text: the whole answer for a question with no answerKey, or "Anything to add?". */
  text: z.string().trim().max(4000).optional(),
})

/**
 * A11: answers one or more open questions of ONE page in one go (the Question screen lists them all).
 * A question with an answerKey also writes that answer (so the owner is not asked again). When no question
 * is left open, QUESTION_OPEN goes back to WITH_TEAM.
 */
export async function answerQuestions(programId: string, items: unknown): Promise<ActionResult<{ answered: number; stillOpen: number }>> {
  const ctx = await requirePageOwner(programId, { allowSupport: true })
  if (!ctx.ok) return fail(ctx.error)
  const parsed = z.array(AnswerItemSchema).min(1, 'Please answer the question.').max(20).safeParse(items)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Check your answers')
  const { page, root } = ctx
  const questions = await prisma.programInfoQuestion.findMany({ where: { id: { in: parsed.data.map((i) => i.questionId) }, programId: page.id } })
  const byId = new Map(questions.map((q) => [q.id, q]))

  const work: { id: string; question: string; answerKey: string | null; stored: StoredQuestionAnswer; keyed: { key: string; value: unknown } | null }[] = []
  for (const item of parsed.data) {
    const q = byId.get(item.questionId)
    if (!q) return fail('Question not found')
    if (q.answeredAt) return fail('This question is already answered.')
    const stored: StoredQuestionAnswer = {}
    let keyed: { key: string; value: unknown } | null = null
    if (q.answerKey && isAnswerKey(q.answerKey) && item.value !== undefined) {
      const a = parseAnswer(q.answerKey, item.value)
      if (!a.ok) return fail(a.error)
      if (!isAnswered(a.key, a.value)) return fail('Please fill in your answer.')
      stored.value = a.value
      keyed = { key: a.key, value: a.value }
    }
    if (item.text) stored.text = item.text
    if (stored.value === undefined && !stored.text) return fail('Please write your answer.')
    work.push({ id: q.id, question: q.question, answerKey: q.answerKey, stored, keyed })
  }

  const now = new Date()
  const actorId = ctx.actorId
  let stillOpen = 0
  try {
    await prisma.$transaction(async (tx) => {
      for (const w of work) {
        const r = await tx.programInfoQuestion.updateMany({
          where: { id: w.id, answeredAt: null },
          data: { answer: w.stored as Prisma.InputJsonValue, answeredAt: now, answeredById: actorId },
        })
        if (r.count !== 1) throw new Conflict()
        if (w.keyed) await writeAnswer(tx, page, root, w.keyed.key, w.keyed.value, actorId, now)
        await logEvent(tx, page.id, actorId, 'QUESTION_ANSWERED', { questionId: w.id, answerKey: w.answerKey })
      }
      stillOpen = await tx.programInfoQuestion.count({ where: { programId: page.id, answeredAt: null } })
      if (stillOpen === 0 && page.infoStage === 'QUESTION_OPEN') {
        await tx.coachProgram.updateMany({ where: { id: page.id, infoStage: 'QUESTION_OPEN' }, data: enterStageData('WITH_TEAM', now) })
      }
    })
  } catch (e) {
    if (e instanceof Conflict) return fail('This question is already answered.')
    console.error('[PROGRAM-INFO] answerQuestions failed', e)
    return fail(GENERIC)
  }
  // The team email quotes the owner's words: one question with its answer, or each question with its answer.
  const answerText = work.length === 1
    ? storedAnswerText(work[0].answerKey, work[0].stored)
    : work.map((w) => `${w.question.trim()}\n${storedAnswerText(w.answerKey, w.stored) || '(no answer)'}`).join('\n\n')
  await notify('T2_QUESTION_ANSWERED', page.id, actorId, {
    question: work.length === 1 ? work[0].question : null,
    answerText,
  })
  revalidateInfo(page.id)
  return { ok: true, answered: work.length, stillOpen }
}

/** One question (same rules as answerQuestions). `input` = { value?, text? }. */
export async function answerQuestion(questionId: string, input: unknown): Promise<ActionResult<{ answered: number; stillOpen: number }>> {
  if (!Id.safeParse(questionId).success) return fail('Question not found')
  const q = await prisma.programInfoQuestion.findUnique({ where: { id: questionId }, select: { programId: true } })
  if (!q) return fail('Question not found')
  const body = input && typeof input === 'object' ? input : {}
  return answerQuestions(q.programId, [{ ...body, questionId }])
}

/**
 * A6: "Undo my changes" on a live page: puts every answer (cost and names excepted) back to the answers
 * of the live (latest APPROVED) version. Shared answers are restored on the root too.
 */
export async function undoAnswerChanges(programId: string): Promise<ActionResult> {
  const ctx = await requirePageOwner(programId, { allowSupport: true })
  if (!ctx.ok) return fail(ctx.error)
  const { page, root } = ctx
  if (page.infoStage !== 'DONE') return fail('There is nothing to undo here.')
  const snap = approvedSnapshotOf(page)
  if (!snap) return fail('This page has no approved version yet.')
  const pageAnswers = asAnswers(page.infoAnswers)
  const sharedPatch: Record<string, unknown> = {}
  for (const k of DIFF_KEYS) {
    if (isSharedKey(k)) sharedPatch[k] = snap[k] ?? ''
    else if (snap[k] === undefined) delete pageAnswers[k]
    else pageAnswers[k] = snap[k]
  }
  const now = new Date()
  try {
    await prisma.$transaction(async (tx) => {
      await tx.coachProgram.update({
        where: { id: page.id },
        data: { infoAnswers: pageAnswers as Prisma.InputJsonValue, infoAnswersEditedAt: now, zoomUrl: typeof snap.zoomUrl === 'string' && snap.zoomUrl ? snap.zoomUrl : page.zoomUrl },
      })
      await mergeJsonColumn(tx, 'sharedAnswers', root.id, sharedPatch)
    })
  } catch (e) {
    console.error('[PROGRAM-INFO] undoAnswerChanges failed', e)
    return fail(GENERIC)
  }
  if (ctx.readOnly) await logSupportEdit(page.id, ctx.actorId, ['undo'])
  revalidateInfo(page.id)
  return { ok: true }
}

/**
 * A15: "Need another program? Ask the team". T8 to the team (in-app + email) and a receipt to the owner.
 */
export async function requestAnotherProgram(text: string): Promise<ActionResult> {
  const ctx = await requireProgramUser({ allowSupport: true })
  if (!ctx.ok) return fail(ctx.error)
  const body = z.string().trim().min(1, 'Tell us a little about the program.').max(2000, 'At most 2000 characters').safeParse(text)
  if (!body.success) return fail(body.error.issues[0]?.message ?? 'Tell us a little about the program.')
  // The notices identify the OWNER from this id (no program yet); the audit row records who pressed it.
  const ownerUserId = ctx.session.user.id
  try {
    await prisma.auditLog.create({ data: { userId: ctx.actorId, action: 'PROGRAM_PAGE_ANOTHER_PROGRAM_ASKED', entityType: 'User', entityId: ownerUserId, details: JSON.stringify({ text: body.data }) } })
  } catch (e) {
    console.error('[PROGRAM-INFO] request audit failed', e)
  }
  await notifyProgramPage('T8_ANOTHER_PROGRAM', { programId: null, actorId: ownerUserId, extra: { requestText: body.data } })
  await notifyProgramPage('C10_REQUEST_RECEIVED', { programId: null, actorId: ownerUserId })
  return { ok: true }
}

/** "Looks good, put it live": approves the SENT version the owner checked. */
export async function approveVersion(versionId: string): Promise<ActionResult<{ programId: string }>> {
  if (!Id.safeParse(versionId).success) return fail('Version not found')
  const v = await prisma.programPageVersion.findUnique({ where: { id: versionId }, select: { programId: true } })
  if (!v) return fail('Version not found')
  const ctx = await requirePageOwner(v.programId)
  if (!ctx.ok) return fail(ctx.error === 'Page not found' ? 'Version not found' : ctx.error)
  const owner = ctx.owner
  const actorId = ctx.session.user.id
  const r = await publishVersion(versionId, actorId, { onBehalf: false, allowed: ['SENT'], latestSentOnly: true, draftWelcome: false, ownerCheck: (root) => isProgramOwnedBy(root, owner) })
  if (!r.ok) return r
  await notify('T4_APPROVED', r.programId, actorId)
  await notify('C5_LIVE', r.programId, actorId)
  return r
}

/**
 * "Ask for these changes". A8: accepts the latest SENT version (being checked) or the current APPROVED
 * version (the live page's welcome email / invitation line). Anything else: out of date.
 */
export async function requestChanges(versionId: string, text: string): Promise<ActionResult> {
  if (!Id.safeParse(versionId).success) return fail('Version not found')
  const body = z.string().trim().min(1, 'Tell us what to change.').max(4000, 'At most 4000 characters').safeParse(text)
  if (!body.success) return fail(body.error.issues[0]?.message ?? 'Tell us what to change.')
  const v = await prisma.programPageVersion.findUnique({ where: { id: versionId }, select: { id: true, programId: true, number: true, status: true } })
  if (!v) return fail('Version not found')
  const ctx = await requirePageOwner(v.programId, { allowSupport: true })
  if (!ctx.ok) return fail(ctx.error === 'Page not found' ? 'Version not found' : ctx.error)
  const latestSent = ctx.page.pageVersions.find((x) => x.status === 'SENT')
  const currentApproved = ctx.page.pageVersions.find((x) => x.status === 'APPROVED')
  const onSent = v.status === 'SENT' && latestSent?.id === v.id
  const onLive = v.status === 'APPROVED' && currentApproved?.id === v.id
  if (!onSent && !onLive) return fail(OUT_OF_DATE)
  const from = ctx.page.infoStage as InfoStage
  const now = new Date()
  const actorId = ctx.actorId
  try {
    await prisma.$transaction(async (tx) => {
      // A SENT version becomes CHANGES_ASKED; the live APPROVED one keeps its status (it is still what is live).
      const r = await tx.programPageVersion.updateMany({
        where: { id: v.id, status: v.status },
        data: { ...(onSent ? { status: 'CHANGES_ASKED' as const } : {}), changeRequest: body.data, changeRequestAt: now },
      })
      if (r.count !== 1) throw new Conflict()
      if (canMoveStage(from, 'CHANGES_ASKED')) await tx.coachProgram.update({ where: { id: v.programId }, data: enterStageData('CHANGES_ASKED', now) })
      await logEvent(tx, v.programId, actorId, 'CHANGES_ASKED', { versionId: v.id, number: v.number, text: body.data, onLive })
    })
  } catch (e) {
    if (e instanceof Conflict) return fail(OUT_OF_DATE)
    console.error('[PROGRAM-INFO] requestChanges failed', e)
    return fail(GENERIC)
  }
  await notify('T3_CHANGES_ASKED', v.programId, actorId, { changeRequest: body.data })
  revalidateInfo(v.programId)
  return { ok: true }
}

/** The owner takes a live page offline (asks to confirm first: `confirm` must be true). */
export async function takeOffline(programId: string, confirm: boolean, reason?: string): Promise<ActionResult> {
  const ctx = await requirePageOwner(programId)
  if (!ctx.ok) return fail(ctx.error)
  if (confirm !== true) return fail('Please confirm you want to take this page offline.')
  const why = z.string().trim().max(1000).optional().safeParse(reason)
  if (!why.success) return fail('At most 1000 characters')
  const actorId = ctx.session.user.id
  const r = await setOffline(ctx.page, actorId, why.data || null, 'owner')
  if (!r.ok) return r
  await notify('T5_OWNER_OFFLINE', ctx.page.id, actorId, { reason: why.data || null })
  return r
}

/** Back online, only when a version was approved and the owner (not the team) took it down. */
export async function putBackOnline(programId: string): Promise<ActionResult> {
  const ctx = await requirePageOwner(programId)
  if (!ctx.ok) return fail(ctx.error)
  const actorId = ctx.session.user.id
  if (ctx.page.offlineAt && ctx.page.offlineById && ctx.page.offlineById !== actorId) {
    return fail('The team took this page offline, so only the team can put it back. Ask the team.')
  }
  const r = await setOnline(ctx.page, actorId, 'owner')
  if (!r.ok) return r
  await notify('T5_OWNER_BACK_ONLINE', ctx.page.id, actorId)
  return r
}

// ============================================
// Team reads and actions (ADMIN)
// ============================================

export async function getProgramPagesQueue(): Promise<ActionResult<{ queue: TeamQueue }>> {
  const ctx = await requireAdmin()
  if (!ctx.ok) return fail(ctx.error)
  return { ok: true, queue: await teamQueue() }
}

export async function getTeamPageDetail(programId: string): Promise<ActionResult<{ detail: PageDetail }>> {
  const ctx = await requireAdmin()
  if (!ctx.ok) return fail(ctx.error)
  if (!Id.safeParse(programId).success) return fail('Page not found')
  const detail = await pageDetail(programId)
  if (!detail) return fail('Page not found')
  return { ok: true, detail }
}

/** Creates or updates the page's DRAFT version ({ offerPage, welcomeNote, messageLine }; the page checked by OfferPageSchema). */
export async function saveDraft(programId: string, input: unknown): Promise<ActionResult<{ versionId: string; number: number }>> {
  const ctx = await requireAdmin()
  if (!ctx.ok) return fail(ctx.error)
  if (!Id.safeParse(programId).success) return fail('Page not found')
  const parsed = parseDraftInput(input)
  if (!parsed.ok) return fail(parsed.error)
  const exists = await prisma.coachProgram.findUnique({ where: { id: programId }, select: { id: true } })
  if (!exists) return fail('Page not found')
  const actorId = ctx.session.user.id
  let out: { versionId: string; number: number; created: boolean }
  try {
    out = await prisma.$transaction(async (tx) => {
      const w = await writeDraftVersion(tx, programId, parsed.data, actorId)
      await logEvent(tx, programId, actorId, 'DRAFT_SAVED', { versionId: w.versionId, number: w.number, created: w.created })
      return w
    })
  } catch (e) {
    console.error('[PROGRAM-INFO] saveDraft failed', e)
    return fail(GENERIC)
  }
  await audit(actorId, 'PROGRAM_PAGE_DRAFT_SAVED', programId, { versionId: out.versionId, number: out.number })
  revalidateInfo(programId)
  return { ok: true, versionId: out.versionId, number: out.number }
}

/** Asks the owner a question (stage QUESTION_OPEN). `answerKey` = the answer it fills, e.g. "cost". */
export async function askQuestion(programId: string, question: string, answerKey?: string | null): Promise<ActionResult<{ questionId: string }>> {
  const ctx = await requireAdmin()
  if (!ctx.ok) return fail(ctx.error)
  if (!Id.safeParse(programId).success) return fail('Page not found')
  const text = z.string().trim().min(1, 'Write the question.').max(2000).safeParse(question)
  if (!text.success) return fail(text.error.issues[0]?.message ?? 'Write the question.')
  if (answerKey && !isAnswerKey(answerKey)) return fail('Unknown answer to fill')
  const page = await prisma.coachProgram.findUnique({ where: { id: programId }, select: { id: true, infoStage: true } })
  if (!page) return fail('Page not found')
  const from = page.infoStage as InfoStage
  if (!canMoveStage(from, 'QUESTION_OPEN')) return fail("The owner hasn't sent these answers yet. Missing answers are caught when they send.")
  const now = new Date()
  const actorId = ctx.session.user.id
  let questionId = ''
  try {
    await prisma.$transaction(async (tx) => {
      const r = await tx.coachProgram.updateMany({ where: { id: page.id, infoStage: from }, data: from === 'QUESTION_OPEN' ? { infoStage: 'QUESTION_OPEN' } : enterStageData('QUESTION_OPEN', now) })
      if (r.count !== 1) throw new Conflict()
      const created = await tx.programInfoQuestion.create({ data: { programId: page.id, askedById: actorId, question: text.data, answerKey: answerKey || null } })
      questionId = created.id
      await logEvent(tx, page.id, actorId, 'QUESTION_ASKED', { questionId, question: text.data, answerKey: answerKey || null })
    })
  } catch (e) {
    if (e instanceof Conflict) return fail(CONFLICT)
    console.error('[PROGRAM-INFO] askQuestion failed', e)
    return fail(GENERIC)
  }
  await audit(actorId, 'PROGRAM_PAGE_QUESTION_ASKED', page.id, { questionId, answerKey: answerKey || null })
  await notify('C1_QUESTION', page.id, actorId, { question: text.data, questionId })
  revalidateInfo(page.id)
  return { ok: true, questionId }
}

/**
 * Sends a DRAFT version to the owner to check (stage READY_TO_CHECK). With open questions it first returns
 * { needsConfirm: true }; call again with confirmOpenQuestions. Notifies C2 (first), C3 (after changes
 * asked) or C4 (update to a page that was approved before).
 */
export async function sendToCoach(versionId: string, opts?: { confirmOpenQuestions?: boolean }): Promise<ActionResult> {
  const ctx = await requireAdmin()
  if (!ctx.ok) return fail(ctx.error)
  if (!Id.safeParse(versionId).success) return fail('Version not found')
  const v = await prisma.programPageVersion.findUnique({ where: { id: versionId } })
  if (!v) return fail('Version not found')
  if (v.status !== 'DRAFT') return fail('Only a draft can be sent.')
  const loaded = await loadPageWithRoot(v.programId)
  if (!loaded) return fail('Page not found')
  const { page } = loaded
  if (!loaded.owner) return fail('Assign a coach or ambassador first.')
  if (v.offerPage === null && page.offerPage === null) return fail('Add the page to this draft before sending it.')
  const open = page.infoQuestions.length
  if (open > 0 && !opts?.confirmOpenQuestions) {
    return fail(`${open === 1 ? 'A question is' : `${open} questions are`} still waiting for an answer. Send anyway?`, { needsConfirm: true, openQuestionCount: open })
  }
  const from = page.infoStage as InfoStage
  if (!canMoveStage(from, 'READY_TO_CHECK')) return fail('This page cannot be sent to check right now.')
  const event: ProgramPageNotifyEvent = from === 'CHANGES_ASKED' ? 'C3_CHANGES_MADE' : page.pageVersions.some((x) => x.status === 'APPROVED') ? 'C4_UPDATE_READY' : 'C2_READY_FIRST'
  const now = new Date()
  const actorId = ctx.session.user.id
  try {
    await prisma.$transaction(async (tx) => {
      const r = await tx.programPageVersion.updateMany({ where: { id: v.id, status: 'DRAFT' }, data: { status: 'SENT', sentAt: now, sentById: actorId } })
      if (r.count !== 1) throw new Conflict()
      await tx.programPageVersion.updateMany({ where: { programId: page.id, id: { not: v.id }, status: 'SENT' }, data: { status: 'SUPERSEDED' } })
      const s = await tx.coachProgram.updateMany({ where: { id: page.id, infoStage: from }, data: enterStageData('READY_TO_CHECK', now) })
      if (s.count !== 1) throw new Conflict()
      await logEvent(tx, page.id, actorId, 'SENT_TO_CHECK', { versionId: v.id, number: v.number, openQuestions: open })
    })
  } catch (e) {
    if (e instanceof Conflict) return fail(CONFLICT)
    console.error('[PROGRAM-INFO] sendToCoach failed', e)
    return fail(GENERIC)
  }
  await audit(actorId, 'PROGRAM_PAGE_SENT_TO_CHECK', page.id, { versionId: v.id, number: v.number })
  await notify(event, page.id, actorId)
  revalidateInfo(page.id)
  return { ok: true }
}

/** Publishes a version for the owner (owner override). Needs a reason; logged and audited. */
export async function publishOnBehalf(versionId: string, reason: string): Promise<ActionResult<{ programId: string }>> {
  const ctx = await requireAdmin()
  if (!ctx.ok) return fail(ctx.error)
  if (!Id.safeParse(versionId).success) return fail('Version not found')
  const why = z.string().trim().min(1, 'Give a reason; the owner sees it.').max(1000).safeParse(reason)
  if (!why.success) return fail(why.error.issues[0]?.message ?? 'Give a reason.')
  const actorId = ctx.session.user.id
  const r = await publishVersion(versionId, actorId, { onBehalf: true, reason: why.data, allowed: ['DRAFT', 'SENT', 'CHANGES_ASKED'], draftWelcome: true })
  if (!r.ok) return r
  await notify('C6_PUBLISHED_ON_BEHALF', r.programId, actorId, { reason: why.data })
  return r
}

export async function adminTakeOffline(programId: string, reason: string): Promise<ActionResult> {
  const ctx = await requireAdmin()
  if (!ctx.ok) return fail(ctx.error)
  if (!Id.safeParse(programId).success) return fail('Page not found')
  const why = z.string().trim().min(1, 'Give a reason; the owner sees it.').max(1000).safeParse(reason)
  if (!why.success) return fail(why.error.issues[0]?.message ?? 'Give a reason.')
  const loaded = await loadPageWithRoot(programId)
  if (!loaded) return fail('Page not found')
  const actorId = ctx.session.user.id
  const r = await setOffline(loaded.page, actorId, why.data, 'team')
  if (!r.ok) return r
  await audit(actorId, 'PROGRAM_PAGE_TAKEN_OFFLINE', programId, { reason: why.data })
  await notify('C7_OFFLINE', programId, actorId, { reason: why.data })
  return r
}

/** Puts an offline page back online (team). Needs an approved version. `reason` (optional) goes in the event and to the owner. */
export async function adminPutBackOnline(programId: string, reason?: string): Promise<ActionResult> {
  const ctx = await requireAdmin()
  if (!ctx.ok) return fail(ctx.error)
  if (!Id.safeParse(programId).success) return fail('Page not found')
  const why = z.string().trim().max(1000, 'At most 1000 characters').optional().safeParse(reason)
  if (!why.success) return fail(why.error.issues[0]?.message ?? 'Check the reason.')
  const note = why.data || null
  const loaded = await loadPageWithRoot(programId)
  if (!loaded) return fail('Page not found')
  const actorId = ctx.session.user.id
  const r = await setOnline(loaded.page, actorId, 'team', note)
  if (!r.ok) return r
  await audit(actorId, 'PROGRAM_PAGE_BACK_ONLINE', programId, note ? { reason: note } : {})
  await notify('C7_BACK_ONLINE', programId, actorId, { reason: note })
  return r
}

/** Adds a group page under a program (team). The owner gets "Tell us about your <Group> page". */
export async function addGroupPage(rootId: string, label: string): Promise<ActionResult<{ programId: string; slug: string }>> {
  const ctx = await requireAdmin()
  if (!ctx.ok) return fail(ctx.error)
  if (!Id.safeParse(rootId).success) return fail('Program not found')
  const l = Label.safeParse(label)
  if (!l.success) return fail(l.error.issues[0]?.message ?? 'Name the group')
  const root = await prisma.coachProgram.findUnique({ where: { id: rootId }, select: { id: true, parentProgramId: true, audienceLabel: true, groupPages: { select: { audienceLabel: true } } } })
  if (!root) return fail('Program not found')
  if (root.parentProgramId) return fail('Add groups to the main program.')
  const labels = [root.audienceLabel, ...root.groupPages.map((g) => g.audienceLabel)].map((x) => (x ?? '').toLowerCase())
  if (labels.includes(l.data.toLowerCase())) return fail('That group already has a page.')
  const actorId = ctx.session.user.id
  const now = new Date()
  let child: { id: string; slug: string }
  try {
    child = await prisma.$transaction(async (tx) => {
      const c = await createGroupPage(tx, root.id, l.data, actorId, now)
      await logEvent(tx, root.id, actorId, 'GROUP_ADDED', { label: l.data, programId: c.id })
      return c
    })
  } catch (e) {
    console.error('[PROGRAM-INFO] addGroupPage failed', e)
    return fail(GENERIC)
  }
  await audit(actorId, 'PROGRAM_PAGE_GROUP_ADDED', child.id, { rootId: root.id, label: l.data, slug: child.slug })
  await notify('C8_TELL_US', child.id, actorId)
  revalidateInfo(root.id, child.id)
  revalidatePath('/admin/programs')
  return { ok: true, programId: child.id, slug: child.slug }
}

/** Every answer as plain text (for writing the page). */
export async function exportAnswersText(programId: string): Promise<ActionResult<{ text: string }>> {
  const ctx = await requireAdmin()
  if (!ctx.ok) return fail(ctx.error)
  if (!Id.safeParse(programId).success) return fail('Page not found')
  const loaded = await loadPageWithRoot(programId)
  if (!loaded) return fail('Page not found')
  const names = namesOf(loaded.root)
  const text = answersAsText(mergeAnswers(loaded.page.infoAnswers, loaded.root.sharedAnswers), {
    programName: names.programName,
    companyName: names.companyName,
    audienceLabel: loaded.page.audienceLabel,
    ownerName: loaded.owner?.fullName ?? null,
  })
  return { ok: true, text }
}
