/**
 * Who may see, change and comment on a learner's exercise answers. Pure, unit tested.
 * Only the learner, the learner's own coach (for ambassadors) and admins can read answers.
 */

export interface AnswerViewer {
  userId: string
  /** The role the person is currently viewing as (session.user.role). */
  role: string
  isImpersonating?: boolean
}

export interface AnswerLearner {
  userId: string
  /** User id of the ambassador's coach; null for coaches or ambassadors without a coach. */
  coachUserId: string | null
}

export function isLearnerCoach(viewer: AnswerViewer, learner: AnswerLearner): boolean {
  return viewer.role === 'COACH' && !!learner.coachUserId && learner.coachUserId === viewer.userId && viewer.userId !== learner.userId
}

export function canReadAnswers(viewer: AnswerViewer, learner: AnswerLearner): boolean {
  if (!viewer.userId || !learner.userId) return false
  if (viewer.userId === learner.userId) return true
  if (viewer.role === 'ADMIN') return true
  return isLearnerCoach(viewer, learner)
}

/** Only the learner, signed in as themselves. An admin viewing as them can read but not change. */
export function canEditAnswers(viewer: AnswerViewer, learner: AnswerLearner): boolean {
  return !!viewer.userId && viewer.userId === learner.userId && !viewer.isImpersonating
}

/** The learner's coach or an admin, never the learner, never while viewing as someone. */
export function canCommentOnAnswers(viewer: AnswerViewer, learner: AnswerLearner): boolean {
  if (viewer.isImpersonating) return false
  if (viewer.userId === learner.userId) return false
  return viewer.role === 'ADMIN' || isLearnerCoach(viewer, learner)
}
