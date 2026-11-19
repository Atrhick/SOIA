/**
 * Program info workflow: what each stage means to the coach and to the team, the next step, the allowed
 * moves, reminders and stalls. PURE (tested in stage.test.ts).
 *
 * Public visibility is NOT the stage: `CoachProgram.status === 'PUBLISHED'` (with a snapshot) is live.
 * A live page can be in WITH_TEAM etc. while a new version is prepared.
 */

export const PROGRAM_INFO_STAGES = ['ANSWERING', 'WITH_TEAM', 'QUESTION_OPEN', 'READY_TO_CHECK', 'CHANGES_ASKED', 'DONE'] as const
export type InfoStage = (typeof PROGRAM_INFO_STAGES)[number]

export const TEAM_BUCKETS = ['OUR_MOVE', 'STALLED', 'WAITING_ON_COACH', 'OFFLINE', 'LIVE'] as const
export type TeamBucket = (typeof TEAM_BUCKETS)[number]
export const TEAM_BUCKET_LABELS: Record<TeamBucket, string> = {
  OUR_MOVE: 'Our move',
  STALLED: 'Stalled',
  WAITING_ON_COACH: 'Waiting on coach',
  OFFLINE: 'Offline',
  LIVE: 'Live',
}

export const REMINDER_DAYS = [3, 7] as const
export const STALL_DAY = 10
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Allowed stage moves, and the action that makes each one. Any move not listed is refused
 * (`canMoveStage`). Staying in the same stage is always allowed (e.g. a second question).
 */
export const STAGE_TRANSITIONS: Record<InfoStage, Partial<Record<InfoStage, string>>> = {
  ANSWERING: {
    WITH_TEAM: 'sendAnswers',
    READY_TO_CHECK: 'sendToCoach (team wrote from existing content)',
    DONE: 'publishOnBehalf',
  },
  WITH_TEAM: {
    QUESTION_OPEN: 'askQuestion',
    CHANGES_ASKED: 'requestChanges on the live (APPROVED) version',
    READY_TO_CHECK: 'sendToCoach',
    DONE: 'publishOnBehalf',
  },
  QUESTION_OPEN: {
    WITH_TEAM: 'answerQuestion (last open question) / sendAnswers',
    READY_TO_CHECK: 'sendToCoach (confirmOpenQuestions)',
    DONE: 'publishOnBehalf',
  },
  READY_TO_CHECK: {
    DONE: 'approveVersion / publishOnBehalf',
    CHANGES_ASKED: 'requestChanges',
    QUESTION_OPEN: 'askQuestion',
    WITH_TEAM: 'sendAnswers (coach changed answers)',
  },
  CHANGES_ASKED: {
    READY_TO_CHECK: 'sendToCoach',
    QUESTION_OPEN: 'askQuestion',
    WITH_TEAM: 'sendAnswers (coach changed answers)',
    DONE: 'publishOnBehalf',
  },
  DONE: {
    WITH_TEAM: 'sendAnswers (changes to a live page)',
    QUESTION_OPEN: 'askQuestion',
    READY_TO_CHECK: 'sendToCoach (team-made update)',
    CHANGES_ASKED: 'requestChanges on the live (APPROVED) version',
  },
}

export function canMoveStage(from: InfoStage, to: InfoStage): boolean {
  return from === to || Boolean(STAGE_TRANSITIONS[from]?.[to])
}

/** What the screens need to know about one page to label it. Build with stageFactsFrom() in server.ts. */
export interface StageFacts {
  stage: InfoStage
  /** status PUBLISHED with a published snapshot. */
  isLive: boolean
  /** offlineAt set and not live. */
  offline: boolean
  /** Taken offline by the team (not the owner): only the team can put it back. */
  offlineByTeam: boolean
  /** The owner has typed something (infoAnswersEditedAt or answers sent). */
  started: boolean
  sectionsDone: number
  sectionsTotal: number
  nextSectionTitle: string | null
  openQuestionId: string | null
  /** The version waiting for the owner's OK (status SENT). */
  readyVersionId: string | null
  /** A DRAFT version exists (team side). */
  hasDraft: boolean
  /** Answers edited after they were last sent. */
  hasUnsentChanges: boolean
  /** Some version was ever approved. */
  everApproved: boolean
  /** infoStalledAt set (claimed by the cron). */
  stalled: boolean
  /** A1: the program's root has no groupsConfirmedAt yet (Names and groups never saved). */
  needsSetup: boolean
  /** A14: the program has no owner (team screen says "No owner"; nothing is sent). */
  noOwner?: boolean
}

export interface NextAction {
  label: string
  /** Appended to `${programsBasePath(role)}/${pageId}`; '' = the page hub. */
  hrefSuffix: string
}

export type CoachTone = 'action' | 'waiting' | 'live' | 'offline' | 'neutral'

export interface CoachView {
  /** "Ready for you to check", "3 of 5 sections done", "Live", ... */
  label: string
  /** A short second line, e.g. "Next: What you offer." / "Nothing to do". */
  detail: string | null
  tone: CoachTone
  nextAction: NextAction | null
}

const NOTHING = 'Nothing to do'

/** The row on "My programs": where the page stands and the one next step. */
export function coachView(f: StageFacts): CoachView {
  // A1: first run. Setup is on the ROOT id, which is this page (group pages only exist after setup).
  if (f.needsSetup && !f.isLive && f.stage === 'ANSWERING') {
    return { label: 'Not started', detail: null, tone: 'action', nextAction: { label: 'Set up my program', hrefSuffix: '/setup' } }
  }
  if (f.stage === 'QUESTION_OPEN' && f.openQuestionId) {
    return { label: 'Question from the team', detail: null, tone: 'action', nextAction: { label: 'Answer the question', hrefSuffix: `/question/${f.openQuestionId}` } }
  }
  if (f.stage === 'READY_TO_CHECK' && f.readyVersionId) {
    return {
      label: 'Ready for you to check',
      detail: 'We built your page from your answers. Nothing goes live until you say it looks good.',
      tone: 'action',
      nextAction: { label: 'Check my page', hrefSuffix: '/check' },
    }
  }
  if (f.offline) {
    return f.offlineByTeam
      ? { label: 'Offline', detail: 'The team took this page offline. They will be in touch.', tone: 'offline', nextAction: null }
      : { label: 'Offline', detail: null, tone: 'offline', nextAction: { label: 'Put it back online', hrefSuffix: '/live' } }
  }
  switch (f.stage) {
    case 'ANSWERING': {
      if (f.isLive) {
        return { label: 'Live', detail: 'Your new page needs your answers.', tone: 'live', nextAction: { label: f.started ? 'Continue my answers' : 'Start my answers', hrefSuffix: '' } }
      }
      if (!f.started) return { label: 'Not started', detail: null, tone: 'action', nextAction: { label: 'Start my answers', hrefSuffix: '' } }
      if (f.sectionsDone >= f.sectionsTotal) {
        return { label: 'All sections done', detail: 'Send your answers when you are ready.', tone: 'action', nextAction: { label: 'Send my answers', hrefSuffix: '' } }
      }
      return {
        label: `${f.sectionsDone} of ${f.sectionsTotal} sections done`,
        detail: f.nextSectionTitle ? `Next: ${f.nextSectionTitle}.` : null,
        tone: 'action',
        nextAction: { label: 'Continue my answers', hrefSuffix: '' },
      }
    }
    case 'WITH_TEAM':
    case 'QUESTION_OPEN': // no open question id: treat as being written
      return { label: f.isLive ? 'Live, new version being written' : 'Answers sent, page being written', detail: NOTHING, tone: 'waiting', nextAction: null }
    case 'READY_TO_CHECK': // no SENT version (should not happen): being written
      return { label: 'Being written', detail: NOTHING, tone: 'waiting', nextAction: null }
    case 'CHANGES_ASKED':
      return { label: 'Changes asked for, being fixed', detail: NOTHING, tone: 'waiting', nextAction: null }
    case 'DONE':
      if (!f.isLive) return { label: 'Offline', detail: null, tone: 'offline', nextAction: null }
      if (f.hasUnsentChanges) return { label: 'Live, changes not sent', detail: 'Your live page stays as it is until you send and approve the changes.', tone: 'live', nextAction: { label: 'Send my changes', hrefSuffix: '/update' } }
      return { label: 'Live', detail: null, tone: 'live', nextAction: { label: 'Copy my link', hrefSuffix: '/live' } }
  }
}

/** True while the owner is the one who has to act (reminders and stalls apply). */
export function coachMustAct(f: Pick<StageFacts, 'stage' | 'started' | 'openQuestionId' | 'readyVersionId'>): boolean {
  if (f.stage === 'ANSWERING') return f.started
  if (f.stage === 'QUESTION_OPEN') return Boolean(f.openQuestionId)
  if (f.stage === 'READY_TO_CHECK') return Boolean(f.readyVersionId)
  return false
}

export interface TeamView {
  bucket: TeamBucket
  label: string
}

/** The team queue: which bucket a page is in and its short status. */
export function teamView(f: StageFacts): TeamView {
  const v = teamViewInner(f)
  return f.noOwner ? { bucket: v.bucket, label: 'No owner' } : v
}

function teamViewInner(f: StageFacts): TeamView {
  if (f.stage === 'WITH_TEAM' || (f.stage === 'QUESTION_OPEN' && !f.openQuestionId) || (f.stage === 'READY_TO_CHECK' && !f.readyVersionId)) {
    return { bucket: 'OUR_MOVE', label: f.hasDraft ? 'Draft ready to send' : f.isLive || f.everApproved ? 'New version needed' : 'Answers received' }
  }
  if (f.stage === 'CHANGES_ASKED') return { bucket: 'OUR_MOVE', label: f.hasDraft ? 'Draft ready to send' : 'Changes asked for' }
  if (f.stalled && coachMustAct(f)) return { bucket: 'STALLED', label: 'Stalled' }
  if (f.stage === 'QUESTION_OPEN') return { bucket: 'WAITING_ON_COACH', label: 'Question waiting' }
  if (f.stage === 'READY_TO_CHECK') return { bucket: 'WAITING_ON_COACH', label: 'Sent to check' }
  if (f.stage === 'ANSWERING') return { bucket: 'WAITING_ON_COACH', label: f.started ? 'Waiting on coach' : 'Not started' }
  // DONE
  if (f.offline || !f.isLive) return { bucket: 'OFFLINE', label: 'Offline' }
  return { bucket: 'LIVE', label: f.hasUnsentChanges ? 'Live · changes not sent' : 'Live' }
}

/** Sort order of the queue: who acts next, then longest waiting first. */
export function compareQueue(a: { bucket: TeamBucket; waitingSince: string }, b: { bucket: TeamBucket; waitingSince: string }): number {
  const d = TEAM_BUCKETS.indexOf(a.bucket) - TEAM_BUCKETS.indexOf(b.bucket)
  if (d !== 0) return d
  return a.waitingSince < b.waitingSince ? -1 : a.waitingSince > b.waitingSince ? 1 : 0
}

/** When the current wait started: last edit while answering, else when the stage last changed. */
export function waitingSinceDate(p: { stage: InfoStage; infoStageAt: Date | null; infoAnswersEditedAt: Date | null; createdAt: Date }): Date {
  if (p.stage === 'ANSWERING') return p.infoAnswersEditedAt ?? p.infoStageAt ?? p.createdAt
  return p.infoStageAt ?? p.createdAt
}

export function wholeDaysBetween(from: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - from.getTime()) / DAY_MS))
}

/**
 * Which automatic reminder is due now (3 or 7), or null. One per step: the 3-day one only while none was
 * sent, the 7-day one only while fewer than two were sent. The cron claims it with a conditional update
 * on infoRemindersSent.
 */
export function reminderDue(
  p: { facts: Pick<StageFacts, 'stage' | 'started' | 'openQuestionId' | 'readyVersionId'>; remindersSent: number; waitingSince: Date },
  now: Date,
): 3 | 7 | null {
  if (!coachMustAct(p.facts)) return null
  const days = wholeDaysBetween(p.waitingSince, now)
  if (days >= 7 && p.remindersSent < 2) return 7
  if (days >= 3 && p.remindersSent < 1) return 3
  return null
}

/** Day 10 without the owner acting: the page is stalled (claimed once with infoStalledAt). */
export function stallDue(
  p: { facts: Pick<StageFacts, 'stage' | 'started' | 'openQuestionId' | 'readyVersionId'>; stalledAt: Date | null; waitingSince: Date },
  now: Date,
): boolean {
  return !p.stalledAt && coachMustAct(p.facts) && wholeDaysBetween(p.waitingSince, now) >= STALL_DAY
}

/** Column values for entering a stage: restarts the reminder clock and clears a stall. */
export function enterStageData(stage: InfoStage, now = new Date()) {
  return { infoStage: stage, infoStageAt: now, infoRemindersSent: 0, infoLastReminderAt: null, infoStalledAt: null }
}
