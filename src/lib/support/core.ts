/**
 * Support messages ("Get help"): the pure rules. Who can see and do what, how the status moves, the words
 * shown for each status, and the paths. No database, no session: tested in core.test.ts.
 *
 * People:
 * - Senders: coaches, ambassadors and associates (the role VIEW they are in). They see only their own
 *   messages and never a team member's name ("the NowTRANSFORMED team").
 * - Team: ADMIN (the leads) and SUB_ADMIN. Admins see and do everything, and are the only ones who assign.
 *   A sub-admin sees what is assigned to them plus every New (unassigned) message; New ones are read-only
 *   for them until an admin assigns one to them.
 */

export const SUPPORT_CATEGORIES = [
  { key: 'PROGRAM_PAGE', label: 'Program page' },
  { key: 'SIGNING_IN', label: 'Signing in' },
  { key: 'ONE_A_DAY', label: 'One-A-Day and invites' },
  { key: 'DISCOVERY_CALLS', label: 'Discovery calls' },
  { key: 'PAYMENTS', label: 'Payments' },
  { key: 'OTHER', label: 'Something else' },
] as const

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number]['key']
export const SUPPORT_CATEGORY_KEYS = SUPPORT_CATEGORIES.map((c) => c.key) as [SupportCategory, ...SupportCategory[]]

export function categoryLabel(key: string): string {
  return SUPPORT_CATEGORIES.find((c) => c.key === key)?.label ?? 'Something else'
}

export const SUBJECT_MAX = 120
export const BODY_MAX = 4000

export const SUPPORT_STATUSES = ['NEW', 'ASSIGNED', 'WAITING_ON_SENDER', 'DONE'] as const
export type SupportStatus = (typeof SUPPORT_STATUSES)[number]

/** What the sender reads. The assignee is never named. */
export const SENDER_STATUS_LABEL: Record<SupportStatus, string> = {
  NEW: 'New',
  ASSIGNED: 'With the NowTRANSFORMED team',
  WAITING_ON_SENDER: 'Waiting on you',
  DONE: 'Done',
}

/** What the team reads. */
export const TEAM_STATUS_LABEL: Record<SupportStatus, string> = {
  NEW: 'New',
  ASSIGNED: 'Assigned',
  WAITING_ON_SENDER: 'Waiting on sender',
  DONE: 'Done',
}

export const TEAM_NAME = 'the NowTRANSFORMED team'

// ---------- roles ----------

export const TEAM_ROLES = ['ADMIN', 'SUB_ADMIN'] as const
export const SENDER_ROLES = ['COACH', 'AMBASSADOR', 'SERVICE_PROVIDER', 'BUSINESS_AFFILIATE', 'VOLUNTEER'] as const
export type SenderRole = (typeof SENDER_ROLES)[number]

export const isTeamRole = (role: string | null | undefined): boolean => role === 'ADMIN' || role === 'SUB_ADMIN'
export const isSenderRole = (role: string | null | undefined): role is SenderRole =>
  typeof role === 'string' && (SENDER_ROLES as readonly string[]).includes(role)

export interface Viewer {
  id: string
  /** The session role (the view they are in). */
  role: string
}

export interface MessageFacts {
  senderId: string
  assignedToId: string | null
  status: SupportStatus
}

/** The team inbox and thread: may this team member open the message? */
export function teamCanView(v: Viewer, m: MessageFacts): boolean {
  if (v.role === 'ADMIN') return true
  if (v.role === 'SUB_ADMIN') return m.assignedToId === v.id || (m.status === 'NEW' && !m.assignedToId)
  return false
}

/** Reply as the team or change the status. Admins on anything; a sub-admin only on what is assigned to them. */
export function teamCanAct(v: Viewer, m: MessageFacts): boolean {
  if (v.role === 'ADMIN') return true
  if (v.role === 'SUB_ADMIN') return m.assignedToId === v.id
  return false
}

/** Assign or reassign: admins only. */
export const canAssign = (v: Viewer): boolean => v.role === 'ADMIN'

/** Who can be picked as assignee: active ADMIN and SUB_ADMIN logins. */
export const canBeAssigned = (u: { role: string; status: string }): boolean => isTeamRole(u.role) && u.status === 'ACTIVE'

/** The sender's own page: only their messages. */
export const senderCanView = (v: Viewer, m: Pick<MessageFacts, 'senderId'>): boolean => m.senderId === v.id

// ---------- status moves ----------

/** After an assign or reassign. A New message becomes Assigned; anything else keeps its status. */
export function statusAfterAssign(status: SupportStatus): SupportStatus {
  return status === 'NEW' ? 'ASSIGNED' : status
}

/** Where a message goes when its sender replies: back to the team (reopened if it was Done). */
export function statusAfterSenderReply(status: SupportStatus, hasAssignee: boolean): SupportStatus {
  if (status === 'NEW') return 'NEW'
  return hasAssignee ? 'ASSIGNED' : 'NEW'
}

/** Statuses a team member can choose on a message (NEW only comes from "not assigned"). */
export const TEAM_STATUS_CHOICES = ['ASSIGNED', 'WAITING_ON_SENDER', 'DONE'] as const
export type TeamStatusChoice = (typeof TEAM_STATUS_CHOICES)[number]

/** Null when the team may move the message from `from` to `to`; otherwise the reason, in plain words. */
export function teamStatusProblem(from: SupportStatus, to: TeamStatusChoice, hasAssignee: boolean): string | null {
  if (from === to) return 'It already has that status.'
  if ((to === 'ASSIGNED' || to === 'WAITING_ON_SENDER') && !hasAssignee) return 'Assign it to someone first.'
  return null
}

/**
 * A team reply on a New (unassigned) message: the person replying takes it, so the New list only holds
 * messages nobody has picked up. Only admins can reply to New ones (sub-admins can't act on them).
 */
export function takesOnReply(m: Pick<MessageFacts, 'assignedToId' | 'status'>): boolean {
  return !m.assignedToId && m.status === 'NEW'
}

// ---------- inbox ----------

export const INBOX_FILTERS = ['new', 'mine', 'open', 'done'] as const
export type InboxFilter = (typeof INBOX_FILTERS)[number]

export const INBOX_FILTER_LABEL: Record<InboxFilter, string> = {
  new: 'New',
  mine: 'Mine',
  open: 'All open',
  done: 'Done',
}

export function parseFilter(v: string | null | undefined): InboxFilter {
  return (INBOX_FILTERS as readonly string[]).includes(v ?? '') ? (v as InboxFilter) : 'new'
}

/** The inbox filter as a Prisma `where` on SupportMessage (plain object, so it's tested here). */
export function inboxWhere(v: Viewer, filter: InboxFilter): Record<string, unknown> {
  const byFilter: Record<InboxFilter, Record<string, unknown>> = {
    new: { status: 'NEW', assignedToId: null },
    mine: { assignedToId: v.id, status: { not: 'DONE' } },
    open: { status: { not: 'DONE' } },
    done: { status: 'DONE' },
  }
  const where = byFilter[filter]
  if (v.role === 'ADMIN') return where
  // Sub-admins: only what's assigned to them, plus unassigned New ones.
  const visible = { OR: [{ assignedToId: v.id }, { status: 'NEW', assignedToId: null }] }
  return { AND: [where, visible] }
}

// ---------- paths ----------

/** The team's area: admins use /admin/support, sub-admins /team/support. */
export function teamBase(role: string): string {
  return role === 'SUB_ADMIN' ? '/team/support' : '/admin/support'
}
export const teamMessagePath = (role: string, id: string) => `${teamBase(role)}/${encodeURIComponent(id)}`

/** The sender's area for the view they sent from. */
export function senderBase(role: string): string {
  if (role === 'COACH') return '/coach/support'
  if (role === 'AMBASSADOR') return '/ambassador/support'
  return '/associate/support'
}
export const senderMessagePath = (role: string, id: string) => `${senderBase(role)}/${encodeURIComponent(id)}`

/** Text a person typed: trimmed, Windows line ends made plain, runs of 3+ blank lines cut to one. */
export function cleanText(s: string): string {
  return s.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

export const IMPERSONATION_REFUSAL =
  "You're viewing the app as this person, so you can't send a message for them. Switch back to send one as yourself."
