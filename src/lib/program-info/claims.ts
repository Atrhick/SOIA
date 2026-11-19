/**
 * Program info workflow: the conditions of the conditional writes ("claims") that keep two clicks or two
 * people from both winning. Pure (no database), so the rules are tested in claims.test.ts.
 */
import { Prisma } from '@prisma/client'
import type { InfoStage } from '@/lib/program-info/stage'

/**
 * sendAnswers: the page must still be in the stage read AND still carry the infoAnswersSentAt read
 * (null-safe: null matches only a page never sent). The first call sets a new infoAnswersSentAt, so a
 * second call made from the same read (double click) matches nothing and sends no second T1 email.
 */
export function sendAnswersClaimWhere(pageId: string, from: InfoStage, sentAtRead: Date | null) {
  return { id: pageId, infoStage: from, infoAnswersSentAt: sentAtRead } satisfies Prisma.CoachProgramWhereInput
}

/**
 * publishVersion: the owner approves only while the page is READY_TO_CHECK (a question asked or changes
 * asked since then make the SENT version out of date). The team's publish on behalf works from any stage.
 */
export function publishPageClaimWhere(pageId: string, onBehalf: boolean) {
  return (onBehalf ? { id: pageId } : { id: pageId, infoStage: 'READY_TO_CHECK' }) satisfies Prisma.CoachProgramWhereInput
}

/** What a question closed by the team's publish on behalf stores as its answer. */
export const CLOSED_BY_TEAM_TEXT = 'Closed by the team when the page was published.'

/**
 * saveNamesAndGroups: the A3 removal rule (canRemoveGroup) inside the delete itself, so a page that went
 * live or got a sign-up after it was read is never deleted.
 */
export function removableGroupsWhere(rootId: string, ids: string[]) {
  return {
    id: { in: ids },
    parentProgramId: rootId,
    status: { not: 'PUBLISHED' },
    publishedSnapshot: { equals: Prisma.DbNull },
    offlineAt: null,
    pageVersions: { none: { status: 'APPROVED' } },
    leads: { none: {} },
    prospects: { none: {} },
  } satisfies Prisma.CoachProgramWhereInput
}

export const GROUP_GONE_MESSAGE = "That page can't be removed any more."
