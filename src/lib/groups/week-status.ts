/**
 * The five things an ambassador does each course week, and whether each is done.
 * Pure logic only (no database) so it can be tested; week-status-server.ts loads the data.
 *
 * Rules:
 * - A course week N runs from startDate + (N-1)*7 days up to (not including) startDate + N*7 days.
 * - Learn: done if they finished any LMS lesson (LMSLessonProgress.completedAt) or finished
 *   listening to any lesson (LessonListen.completedAt) inside that week's window.
 * - Meet: the group's meeting for that week. Done when the coach marked them PRESENT or EXCUSED.
 *   Only counts as missing when marked ABSENT.
 * - Show: their portfolio piece for that week number (latest one wins).
 *   none / handed in / coach replied / please redo. Done when handed in or replied.
 * - Do: not tracked yet (stage 2). Never done, never counted as missing.
 * - Invite: done if at least one One-A-Day invitation (OutreachInvite with status SENT) was
 *   sent by them inside that week's window.
 */

const DAY_MS = 24 * 60 * 60 * 1000

export type WeekWindow = { start: Date; end: Date }

export function weekWindow(startDate: Date, weekNo: number): WeekWindow {
  const start = new Date(startDate.getTime() + (weekNo - 1) * 7 * DAY_MS)
  return { start, end: new Date(start.getTime() + 7 * DAY_MS) }
}

export function inWindow(d: Date | null | undefined, w: WeekWindow): boolean {
  if (!d) return false
  const t = d.getTime()
  return t >= w.start.getTime() && t < w.end.getTime()
}

export function learnDone(completedAts: (Date | null | undefined)[], w: WeekWindow): boolean {
  return completedAts.some((d) => inWindow(d, w))
}

export type MeetState = 'NO_MEETING' | 'CANCELLED' | 'NOT_MARKED' | 'PRESENT' | 'ABSENT' | 'EXCUSED'

export type MeetInfo = { state: MeetState; startsAt: Date | null; done: boolean; missing: boolean }

export function meetStatus(
  session: { startsAt: Date; cancelled: boolean } | null,
  attendance: string | null | undefined,
): MeetInfo {
  if (!session) return { state: 'NO_MEETING', startsAt: null, done: false, missing: false }
  if (session.cancelled) return { state: 'CANCELLED', startsAt: session.startsAt, done: false, missing: false }
  const s = attendance === 'PRESENT' || attendance === 'ABSENT' || attendance === 'EXCUSED' ? attendance : 'NOT_MARKED'
  return { state: s, startsAt: session.startsAt, done: s === 'PRESENT' || s === 'EXCUSED', missing: s === 'ABSENT' }
}

export type ShowState = 'NONE' | 'HANDED_IN' | 'REPLIED' | 'REDO'

export function showStatus(pieces: { status: string; submittedAt: Date }[]): { state: ShowState; done: boolean } {
  if (pieces.length === 0) return { state: 'NONE', done: false }
  const latest = [...pieces].sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())[0]
  if (latest.status === 'REDO') return { state: 'REDO', done: false }
  if (latest.status === 'REVIEWED') return { state: 'REPLIED', done: true }
  return { state: 'HANDED_IN', done: true }
}

export function inviteDone(invites: { status: string; sentAt: Date }[], w: WeekWindow): boolean {
  return invites.some((i) => i.status === 'SENT' && inWindow(i.sentAt, w))
}

export type WeekStatus = {
  weekNo: number
  learn: boolean
  meet: MeetInfo
  show: { state: ShowState; done: boolean }
  doTracked: false
  invite: boolean
  doneCount: number // out of 5
  missingCount: number // Learn, Meet (absent only), Show, Invite
}

export function buildWeekStatus(input: {
  weekNo: number
  window: WeekWindow
  lessonCompletedAts: (Date | null | undefined)[]
  session: { startsAt: Date; cancelled: boolean } | null
  attendance: string | null | undefined
  pieces: { status: string; submittedAt: Date }[]
  invites: { status: string; sentAt: Date }[]
}): WeekStatus {
  const learn = learnDone(input.lessonCompletedAts, input.window)
  const meet = meetStatus(input.session, input.attendance)
  const show = showStatus(input.pieces)
  const invite = inviteDone(input.invites, input.window)
  const doneCount = [learn, meet.done, show.done, invite].filter(Boolean).length
  const missingCount = [!learn, meet.missing, !show.done, !invite].filter(Boolean).length
  return { weekNo: input.weekNo, learn, meet, show, doTracked: false, invite, doneCount, missingCount }
}

/** Coach view: 2 or more missing needs attention; those go first, most missing first, then by name. */
export function needsAttention(s: { missingCount: number }): boolean {
  return s.missingCount >= 2
}

export function sortForCoach<T extends { name: string; status: { missingCount: number } }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const na = needsAttention(a.status) ? 1 : 0
    const nb = needsAttention(b.status) ? 1 : 0
    if (na !== nb) return nb - na
    if (na && a.status.missingCount !== b.status.missingCount) return b.status.missingCount - a.status.missingCount
    return a.name.localeCompare(b.name)
  })
}
