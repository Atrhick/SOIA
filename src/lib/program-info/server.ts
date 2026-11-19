/**
 * Program info workflow: server-only reads (My programs, one page's detail, the team queue).
 * NOT 'use server': nothing here is an endpoint and nothing here checks the session. The actions in
 * src/lib/actions/program-info.ts check who is asking and then call these.
 * Every value returned is serializable (dates as ISO strings).
 */
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { seatsLeftOf, seatsUsedThisMonth } from '@/lib/get-involved/offer'
import { programOwnerRole } from '@/lib/program-owner'
import { costText, questionById, type CostAnswer } from './questions'
import {
  asAnswers,
  changedSinceLive,
  changedSinceSent,
  mergeAnswers,
  pageProgress,
  sectionProgress,
  type AnswerChange,
  type Answers,
  type MissingAnswer,
  type SectionProgress,
} from './progress'
import {
  compareQueue,
  coachView,
  teamView,
  waitingSinceDate,
  wholeDaysBetween,
  type CoachTone,
  type InfoStage,
  type NextAction,
  type StageFacts,
  type TeamBucket,
  TEAM_BUCKETS,
} from './stage'
import { groupName, pageName, publicPagePath, type OwnerRole } from './paths'

// ---------- loading ----------

const PERSON = { select: { userId: true, firstName: true, lastName: true, user: { select: { inviteSlug: true, status: true, email: true } } } } as const

/** One page row with what every screen needs. */
export const PAGE_INCLUDE = {
  coach: PERSON,
  ambassador: PERSON,
  pageVersions: { select: { id: true, number: true, status: true, approvedAt: true, approvedOnBehalf: true, changeRequest: true, answers: true }, orderBy: { number: 'desc' as const } },
  infoQuestions: { where: { answeredAt: null }, select: { id: true, createdAt: true }, orderBy: { createdAt: 'asc' as const } },
  /** The events the labels and diffs need (newest first): last answers sent (with its snapshot), change rounds. */
  pageEvents: {
    where: { kind: { in: ['ANSWERS_SENT', 'CHANGES_ASKED', 'APPROVED', 'PUBLISHED_ON_BEHALF'] } },
    select: { kind: true, detail: true, createdAt: true },
    orderBy: { createdAt: 'desc' as const },
    take: 40,
  },
  _count: { select: { leads: true, prospects: true } },
} satisfies Prisma.CoachProgramInclude

export type PageRow = Prisma.CoachProgramGetPayload<{ include: typeof PAGE_INCLUDE }>

export interface ProgramOwner {
  role: OwnerRole
  userId: string
  firstName: string
  fullName: string
  email: string
  inviteSlug: string | null
  active: boolean
}

/** The owner of a program, read from the ROOT row (the one ownership that counts). */
export function ownerOfRow(root: Pick<PageRow, 'coachId' | 'ambassadorId' | 'coach' | 'ambassador'>): ProgramOwner | null {
  const role = programOwnerRole(root)
  const person = role === 'COACH' ? root.coach : role === 'AMBASSADOR' ? root.ambassador : null
  if (!role || !person?.userId || !person.user) return null
  return {
    role,
    userId: person.userId,
    firstName: person.firstName,
    fullName: `${person.firstName} ${person.lastName}`.trim(),
    email: person.user.email,
    inviteSlug: person.user.status === 'ACTIVE' ? person.user.inviteSlug : null,
    active: person.user.status === 'ACTIVE',
  }
}

export const rootIdOf = (p: { id: string; parentProgramId: string | null }) => p.parentProgramId ?? p.id

/** A page and its root (the same row for a root page). Null when the page does not exist. */
export async function loadPageWithRoot(programId: string): Promise<{ page: PageRow; root: PageRow; owner: ProgramOwner | null } | null> {
  const page = await prisma.coachProgram.findUnique({ where: { id: programId }, include: PAGE_INCLUDE })
  if (!page) return null
  const root = page.parentProgramId ? await prisma.coachProgram.findUnique({ where: { id: page.parentProgramId }, include: PAGE_INCLUDE }) : page
  if (!root) return { page, root: page, owner: ownerOfRow(page) }
  return { page, root, owner: ownerOfRow(root) }
}

/** Program name and company as the owner set them on "Names and groups" (else the current columns). */
export function namesOf(root: Pick<PageRow, 'sharedAnswers' | 'pageTitle' | 'name' | 'organization'>): { programName: string; companyName: string } {
  const shared = asAnswers(root.sharedAnswers)
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  return {
    programName: str(shared.programName) || root.pageTitle?.trim() || root.name,
    companyName: str(shared.companyName) || root.organization,
  }
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null)

export function isLiveRow(p: Pick<PageRow, 'status' | 'publishedSnapshot'>): boolean {
  return p.status === 'PUBLISHED' && p.publishedSnapshot !== null
}

/** Answers snapshot of the latest APPROVED version (what is live), or null. */
export function approvedSnapshotOf(page: Pick<PageRow, 'pageVersions'>): Answers | null {
  const v = page.pageVersions.find((x) => x.status === 'APPROVED')
  return v ? asAnswers(v.answers) : null
}

/** Answers snapshot stored on the latest ANSWERS_SENT event, and its note. */
export function lastSentOf(page: Pick<PageRow, 'pageEvents'>): { answers: Answers | null; note: string | null; at: string | null } {
  const e = page.pageEvents.find((x) => x.kind === 'ANSWERS_SENT')
  const d = asAnswers(e?.detail)
  return { answers: d.answers ? asAnswers(d.answers) : null, note: typeof d.note === 'string' ? d.note : null, at: e ? e.createdAt.toISOString() : null }
}

/** A17: change-request rounds since the page was last approved (1 = first request). */
export function changeRoundOf(page: Pick<PageRow, 'pageEvents'>): number {
  let n = 0
  for (const e of page.pageEvents) {
    if (e.kind === 'APPROVED' || e.kind === 'PUBLISHED_ON_BEHALF') break
    if (e.kind === 'CHANGES_ASKED') n++
  }
  return n
}

/** A3: a group page can be removed only when it was never live and has no sign-ups. The root never. */
export function canRemoveGroup(p: Pick<PageRow, 'parentProgramId' | 'status' | 'publishedSnapshot' | 'offlineAt' | 'pageVersions' | '_count'>): boolean {
  return Boolean(p.parentProgramId) && p.status !== 'PUBLISHED' && p.publishedSnapshot === null && p.offlineAt === null
    && !p.pageVersions.some((v) => v.status === 'APPROVED') && p._count.leads === 0 && p._count.prospects === 0
}

/** The facts stage.ts labels a page from, plus the diffs (A6/A17). */
export function stageFactsFrom(page: PageRow, root: PageRow, owner: ProgramOwner | null): StageFacts & {
  progress: ReturnType<typeof pageProgress>
  changedSinceSent: AnswerChange[]
  changedSinceLive: AnswerChange[]
} {
  const answers = mergeAnswers(page.infoAnswers, root.sharedAnswers)
  const progress = pageProgress(answers)
  const isLive = isLiveRow(page)
  const offline = !isLive && page.offlineAt !== null
  const edited = page.infoAnswersEditedAt
  const sent = page.infoAnswersSentAt
  const sinceSent = changedSinceSent(lastSentOf(page).answers, answers, page.infoStage)
  const sinceLive = changedSinceLive(approvedSnapshotOf(page), answers)
  return {
    stage: page.infoStage as InfoStage,
    isLive,
    offline,
    offlineByTeam: offline && (!owner || page.offlineById !== owner.userId),
    started: edited !== null || sent !== null,
    sectionsDone: progress.sectionsDone,
    sectionsTotal: progress.sectionsTotal,
    nextSectionTitle: progress.nextSectionTitle,
    openQuestionId: page.infoQuestions[0]?.id ?? null,
    readyVersionId: page.pageVersions.find((v) => v.status === 'SENT')?.id ?? null,
    hasDraft: page.pageVersions.some((v) => v.status === 'DRAFT'),
    // A6: on a live (DONE) page "changed" = differs from the approved version; otherwise from the last send.
    hasUnsentChanges: page.infoStage === 'DONE' ? sinceLive.length > 0 : sent !== null && sinceSent.length > 0,
    everApproved: page.pageVersions.some((v) => v.status === 'APPROVED'),
    stalled: page.infoStalledAt !== null,
    needsSetup: root.groupsConfirmedAt === null,
    noOwner: owner === null,
    progress,
    changedSinceSent: sinceSent,
    changedSinceLive: sinceLive,
  }
}

// ---------- My programs ----------

/** One page row on "My programs". */
export interface ProgramPageSummary {
  id: string
  rootId: string
  isRoot: boolean
  slug: string
  programName: string
  companyName: string
  audienceLabel: string | null
  /** "Families page" */
  pageName: string
  stage: InfoStage
  coachStatusLabel: string
  coachStatusDetail: string | null
  coachTone: CoachTone
  /** hrefSuffix is appended to coachPagePath(role, id). */
  nextAction: NextAction | null
  sectionsDone: number
  sectionsTotal: number
  isLive: boolean
  /** Path of the public page (/join/<invite>/<slug> or /p/<slug>) while live, else null. */
  liveUrl: string | null
  offline: boolean
  waitingSince: string
  openQuestionId: string | null
  readyVersionId: string | null
  leadCount: number
  /** A1: the program still needs "Names and groups" (nextAction is then Set up my program, hrefSuffix '/setup' on the root id). */
  needsSetup: boolean
  /** A3: this group page may be removed by the owner (never live, no sign-ups; never the root). */
  canRemove: boolean
}

export interface OwnerProgramGroup {
  rootId: string
  programName: string
  companyName: string
  /** A1: when Names and groups was first saved; null = show "Not started · Set up my program". */
  groupsConfirmedAt: string | null
  /** Root page first, then the other groups in the order they were added. */
  pages: ProgramPageSummary[]
}

export function summarize(page: PageRow, root: PageRow, owner: ProgramOwner | null): ProgramPageSummary {
  const facts = stageFactsFrom(page, root, owner)
  const view = coachView(facts)
  const names = namesOf(root)
  return {
    id: page.id,
    rootId: root.id,
    isRoot: page.id === root.id,
    slug: page.slug,
    programName: names.programName,
    companyName: names.companyName,
    audienceLabel: page.audienceLabel,
    pageName: pageName(page.audienceLabel, names.programName),
    stage: facts.stage,
    coachStatusLabel: view.label,
    coachStatusDetail: view.detail,
    coachTone: view.tone,
    nextAction: view.nextAction,
    sectionsDone: facts.sectionsDone,
    sectionsTotal: facts.sectionsTotal,
    isLive: facts.isLive,
    liveUrl: facts.isLive ? publicPagePath(page.slug, owner?.inviteSlug) : null,
    offline: facts.offline,
    waitingSince: waitingSinceDate({ stage: facts.stage, infoStageAt: page.infoStageAt, infoAnswersEditedAt: page.infoAnswersEditedAt, createdAt: page.createdAt }).toISOString(),
    openQuestionId: facts.openQuestionId,
    readyVersionId: facts.readyVersionId,
    leadCount: page._count.leads,
    needsSetup: facts.needsSetup,
    canRemove: canRemoveGroup(page),
  }
}

const byCreated = (a: PageRow, b: PageRow) => a.createdAt.getTime() - b.createdAt.getTime()

/**
 * Every page the user owns, grouped by program (root). Ownership is read from the root row. `role`
 * limits it to the coach or the ambassador view of a person who holds both.
 */
export async function myProgramsForOwner(userId: string, role?: OwnerRole): Promise<OwnerProgramGroup[]> {
  const owned: Prisma.CoachProgramWhereInput =
    role === 'COACH' ? { coach: { userId }, ambassadorId: null }
      : role === 'AMBASSADOR' ? { ambassador: { userId }, coachId: null }
        : { OR: [{ coach: { userId }, ambassadorId: null }, { ambassador: { userId }, coachId: null }] }
  const roots = await prisma.coachProgram.findMany({ where: { parentProgramId: null, ...owned }, select: { id: true } })
  if (roots.length === 0) return []
  const rootIds = roots.map((r) => r.id)
  const rows = await prisma.coachProgram.findMany({
    where: { OR: [{ id: { in: rootIds } }, { parentProgramId: { in: rootIds } }] },
    include: PAGE_INCLUDE,
  })
  const byRoot = new Map<string, PageRow[]>()
  for (const r of rows) {
    const k = rootIdOf(r)
    byRoot.set(k, [...(byRoot.get(k) ?? []), r])
  }
  const groups: OwnerProgramGroup[] = []
  for (const rootId of rootIds) {
    const list = byRoot.get(rootId) ?? []
    const root = list.find((r) => r.id === rootId)
    if (!root) continue
    const owner = ownerOfRow(root)
    const names = namesOf(root)
    const pages = [root, ...list.filter((r) => r.id !== rootId).sort(byCreated)].map((p) => summarize(p, root, owner))
    groups.push({ rootId, ...names, groupsConfirmedAt: iso(root.groupsConfirmedAt), pages })
  }
  return groups.sort((a, b) => a.programName.localeCompare(b.programName))
}

// ---------- one page ----------

export interface VersionItem {
  id: string
  number: number
  status: 'DRAFT' | 'SENT' | 'APPROVED' | 'CHANGES_ASKED' | 'SUPERSEDED'
  /** The OfferPage JSON (check with parseOfferPage before rendering). */
  offerPage: unknown
  welcomeNote: string | null
  messageLine: string | null
  /** The answers this version was written from. */
  answers: Answers
  createdAt: string
  updatedAt: string
  sentAt: string | null
  approvedAt: string | null
  approvedOnBehalf: boolean
  changeRequest: string | null
  changeRequestAt: string | null
}

export interface QuestionItem {
  id: string
  question: string
  answerKey: string | null
  /** The question it fills, e.g. "What does it cost?". */
  answerKeyLabel: string | null
  answer: unknown
  /** The answer as text (cost answers read "$30 to $50 a month"). */
  answerText: string | null
  askedByName: string
  createdAt: string
  answeredAt: string | null
}

export interface EventItem {
  id: string
  kind: string
  actorId: string | null
  actorName: string | null
  detail: unknown
  createdAt: string
}

export interface PageDetail extends ProgramPageSummary {
  ownerRole: OwnerRole | null
  ownerUserId: string | null
  ownerName: string | null
  ownerFirstName: string | null
  status: string
  /** The page's answers with the shared answers merged in (what the screens edit). */
  answers: Answers
  pageAnswers: Answers
  sharedAnswers: Answers
  sections: (SectionProgress & { sharedWith: string[] })[]
  missing: MissingAnswer[]
  missingText: string
  /** Every page of this program, root first. */
  groups: { id: string; audienceLabel: string | null; pageName: string; isRoot: boolean; isLive: boolean; leadCount: number; canRemove: boolean }[]
  versions: VersionItem[]
  questions: QuestionItem[]
  openQuestions: QuestionItem[]
  events: EventItem[]
  prices: { fullPrice: string | null; sponsoredPrice: string | null; sponsorshipsPerMonth: number | null; sponsorshipsUsedThisMonth: number; sponsorshipsLeftThisMonth: number }
  /** What is on the program row now (the live content once approved). */
  current: { offerPage: unknown; welcomeNote: string | null; welcomeNoteApproved: boolean; messageLine: string | null; zoomUrl: string | null }
  offlineInfo: { at: string; reason: string | null; byTeam: boolean } | null
  stageAt: string | null
  answersSentAt: string | null
  answersEditedAt: string | null
  hasUnsentChanges: boolean
  lastApproved: { versionId: string; number: number; approvedAt: string | null; approvedOnBehalf: boolean } | null
  teamBucket: TeamBucket
  teamLabel: string
  waitingDays: number
  /** A17: answer-by-answer changes since the answers were last sent / since the live version (cost and names excluded). */
  changedSinceSent: AnswerChange[]
  changedSinceLive: AnswerChange[]
  /** A17: change-request rounds since the last approval (0 = none). */
  changeRound: number
  /** A7/A17: the owner's note sent with the latest answers ("Anything else we should know?"). */
  lastSentNote: string | null
  lastSentAt: string | null
  groupsConfirmedAt: string | null
}

/** Display names for user ids (profile name, else the email's first part). */
export async function namesForUsers(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.filter((x): x is string => Boolean(x))))
  if (unique.length === 0) return new Map()
  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, email: true, coachProfile: { select: { firstName: true, lastName: true } }, ambassadorProfile: { select: { firstName: true, lastName: true } } },
  })
  return new Map(users.map((u) => {
    const p = u.coachProfile ?? u.ambassadorProfile
    return [u.id, p ? `${p.firstName} ${p.lastName}`.trim() : u.email.split('@')[0]]
  }))
}

/** A question's stored answer: `{ value }` (fills answerKey) and/or `{ text }` (free text or a note). */
export interface StoredQuestionAnswer {
  value?: unknown
  text?: string
}

function answerTextOf(key: string | null, answer: unknown): string | null {
  if (!answer || typeof answer !== 'object') return typeof answer === 'string' ? answer : null
  const a = answer as StoredQuestionAnswer
  const def = key ? questionById(key) : undefined
  let main = ''
  if (a.value !== undefined && a.value !== null) {
    if (def?.kind === 'cost') main = costText(a.value as CostAnswer)
    else if (typeof a.value === 'boolean') main = a.value ? 'Yes' : 'No'
    else if (typeof a.value === 'string') main = a.value
  }
  const note = typeof a.text === 'string' ? a.text.trim() : ''
  return [main, note].filter(Boolean).join('. ') || null
}

/** Everything about one page, for the owner's screens and the team screen. Null when it does not exist. */
export async function pageDetail(programId: string, now = new Date()): Promise<PageDetail | null> {
  const ctx = await loadPageWithRoot(programId)
  if (!ctx) return null
  const { page, root, owner } = ctx
  const summary = summarize(page, root, owner)
  const facts = stageFactsFrom(page, root, owner)
  const team = teamView(facts)

  const [siblings, versions, questions, events, used] = await Promise.all([
    prisma.coachProgram.findMany({
      where: { OR: [{ id: root.id }, { parentProgramId: root.id }] },
      include: PAGE_INCLUDE,
      orderBy: { createdAt: 'asc' },
    }),
    prisma.programPageVersion.findMany({ where: { programId }, orderBy: { number: 'desc' } }),
    prisma.programInfoQuestion.findMany({ where: { programId }, orderBy: { createdAt: 'desc' } }),
    prisma.programPageEvent.findMany({ where: { programId }, orderBy: { createdAt: 'desc' }, take: 200 }),
    seatsUsedThisMonth(programId, now),
  ])
  const names = await namesForUsers([...questions.map((q) => q.askedById), ...events.map((e) => e.actorId)])

  const answers = mergeAnswers(page.infoAnswers, root.sharedAnswers)
  const groups = [...siblings.filter((s) => s.id === root.id), ...siblings.filter((s) => s.id !== root.id)].map((s) => ({
    id: s.id,
    audienceLabel: s.audienceLabel,
    pageName: pageName(s.audienceLabel, summary.programName),
    isRoot: s.id === root.id,
    isLive: s.status === 'PUBLISHED' && s.publishedSnapshot !== null,
    leadCount: s._count.leads,
    canRemove: canRemoveGroup(s),
  }))
  const otherGroupNames = groups.filter((g) => g.id !== page.id).map((g) => groupName(g.audienceLabel, summary.programName))

  const questionItems: QuestionItem[] = questions.map((q) => ({
    id: q.id,
    question: q.question,
    answerKey: q.answerKey,
    answerKeyLabel: q.answerKey ? questionById(q.answerKey)?.label ?? null : null,
    answer: q.answer,
    answerText: answerTextOf(q.answerKey, q.answer),
    askedByName: names.get(q.askedById) ?? 'NowTRANSFORMED team',
    createdAt: q.createdAt.toISOString(),
    answeredAt: iso(q.answeredAt),
  }))
  const approved = versions.find((v) => v.status === 'APPROVED')

  return {
    ...summary,
    ownerRole: owner?.role ?? null,
    ownerUserId: owner?.userId ?? null,
    ownerName: owner?.fullName ?? null,
    ownerFirstName: owner?.firstName ?? null,
    status: page.status,
    answers,
    pageAnswers: asAnswers(page.infoAnswers),
    sharedAnswers: asAnswers(root.sharedAnswers),
    sections: sectionProgress(answers).map((s) => ({ ...s, sharedWith: s.shared ? otherGroupNames : [] })),
    missing: facts.progress.missing,
    missingText: facts.progress.missingText,
    groups,
    versions: versions.map((v) => ({
      id: v.id,
      number: v.number,
      status: v.status,
      offerPage: v.offerPage,
      welcomeNote: v.welcomeNote,
      messageLine: v.messageLine,
      answers: asAnswers(v.answers),
      createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
      sentAt: iso(v.sentAt),
      approvedAt: iso(v.approvedAt),
      approvedOnBehalf: v.approvedOnBehalf,
      changeRequest: v.changeRequest,
      changeRequestAt: iso(v.changeRequestAt),
    })),
    questions: questionItems,
    openQuestions: questionItems.filter((q) => !q.answeredAt).reverse(),
    events: events.map((e) => ({ id: e.id, kind: e.kind, actorId: e.actorId, actorName: e.actorId ? names.get(e.actorId) ?? null : null, detail: e.detail, createdAt: e.createdAt.toISOString() })),
    prices: {
      fullPrice: page.offerFullPrice,
      sponsoredPrice: page.offerSponsoredPrice,
      sponsorshipsPerMonth: page.sponsoredSeatsPerMonth,
      sponsorshipsUsedThisMonth: used,
      sponsorshipsLeftThisMonth: seatsLeftOf(page.sponsoredSeatsPerMonth, used),
    },
    current: {
      offerPage: page.offerPage,
      welcomeNote: page.welcomeNote,
      welcomeNoteApproved: page.welcomeNoteApprovedAt !== null,
      messageLine: page.messageLine,
      zoomUrl: page.zoomUrl,
    },
    offlineInfo: facts.offline && page.offlineAt ? { at: page.offlineAt.toISOString(), reason: page.offlineReason, byTeam: facts.offlineByTeam } : null,
    stageAt: iso(page.infoStageAt),
    answersSentAt: iso(page.infoAnswersSentAt),
    answersEditedAt: iso(page.infoAnswersEditedAt),
    hasUnsentChanges: facts.hasUnsentChanges,
    lastApproved: approved ? { versionId: approved.id, number: approved.number, approvedAt: iso(approved.approvedAt), approvedOnBehalf: approved.approvedOnBehalf } : null,
    teamBucket: team.bucket,
    teamLabel: team.label,
    waitingDays: wholeDaysBetween(new Date(summary.waitingSince), now),
    changedSinceSent: facts.changedSinceSent,
    changedSinceLive: facts.changedSinceLive,
    changeRound: changeRoundOf(page),
    lastSentNote: lastSentOf(page).note,
    lastSentAt: lastSentOf(page).at,
    groupsConfirmedAt: iso(root.groupsConfirmedAt),
  }
}

// ---------- team queue ----------

/** Text of the latest CHANGES_ASKED event (covers requests on a SENT or on the live APPROVED version). */
function latestChangeRequest(page: Pick<PageRow, 'pageEvents'>): string | null {
  const d = asAnswers(page.pageEvents.find((e) => e.kind === 'CHANGES_ASKED')?.detail)
  return typeof d.text === 'string' ? d.text : null
}

export interface TeamQueueItem {
  id: string
  rootId: string
  programName: string
  companyName: string
  audienceLabel: string | null
  pageName: string
  ownerName: string | null
  ownerRole: OwnerRole | null
  stage: InfoStage
  bucket: TeamBucket
  /** "Draft ready to send", "Changes asked for", "Not started", ... */
  teamLabel: string
  waitingSince: string
  waitingDays: number
  isLive: boolean
  sectionsDone: number
  sectionsTotal: number
  openQuestionCount: number
  hasDraft: boolean
  readyVersionId: string | null
  /** The latest change request while the stage is CHANGES_ASKED. */
  changeRequest: string | null
  /** A17 */
  changeRound: number
  changedSinceSentCount: number
  changedSinceLiveCount: number
  hasNote: boolean
  /** A14: false = "No owner" (nothing is sent). */
  hasOwner: boolean
}

export interface TeamQueue {
  items: TeamQueueItem[]
  counts: Record<TeamBucket, number>
}

/**
 * Every page (unowned ones say "No owner"), sorted by who acts next (Our move, Stalled, Waiting on coach, Offline, Live)
 * then longest waiting first.
 */
export async function teamQueue(now = new Date()): Promise<TeamQueue> {
  const rows = await prisma.coachProgram.findMany({ include: PAGE_INCLUDE })
  const byId = new Map(rows.map((r) => [r.id, r]))
  const items: TeamQueueItem[] = []
  for (const page of rows) {
    const root = byId.get(rootIdOf(page)) ?? page
    const owner = ownerOfRow(root)
    const facts = stageFactsFrom(page, root, owner)
    const team = teamView(facts)
    const names = namesOf(root)
    const since = waitingSinceDate({ stage: facts.stage, infoStageAt: page.infoStageAt, infoAnswersEditedAt: page.infoAnswersEditedAt, createdAt: page.createdAt })
    items.push({
      id: page.id,
      rootId: root.id,
      programName: names.programName,
      companyName: names.companyName,
      audienceLabel: page.audienceLabel,
      pageName: pageName(page.audienceLabel, names.programName),
      ownerName: owner?.fullName ?? null,
      ownerRole: owner?.role ?? null,
      stage: facts.stage,
      bucket: team.bucket,
      teamLabel: team.label,
      waitingSince: since.toISOString(),
      waitingDays: wholeDaysBetween(since, now),
      isLive: facts.isLive,
      sectionsDone: facts.sectionsDone,
      sectionsTotal: facts.sectionsTotal,
      openQuestionCount: page.infoQuestions.length,
      hasDraft: facts.hasDraft,
      readyVersionId: facts.readyVersionId,
      changeRequest: facts.stage === 'CHANGES_ASKED' ? latestChangeRequest(page) : null,
      changeRound: changeRoundOf(page),
      changedSinceSentCount: facts.changedSinceSent.length,
      changedSinceLiveCount: facts.changedSinceLive.length,
      hasNote: Boolean(lastSentOf(page).note),
      hasOwner: owner !== null,
    })
  }
  items.sort(compareQueue)
  const counts = Object.fromEntries(TEAM_BUCKETS.map((b) => [b, 0])) as Record<TeamBucket, number>
  for (const i of items) counts[i.bucket]++
  return { items, counts }
}
