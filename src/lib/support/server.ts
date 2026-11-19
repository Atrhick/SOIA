/**
 * Support messages: page loaders (server only, NOT 'use server', so nothing here is a public endpoint).
 * Everything returned is serialised (ISO dates) and shaped for one audience: the sender's shapes never
 * carry a team member's name or id.
 */
import prisma from '@/lib/prisma'
import { categoryLabel, inboxWhere, teamCanAct, teamCanView, type InboxFilter, type SupportStatus, type Viewer } from './core'
import { namesOf, roleLabel } from './notify'

export const INBOX_PAGE_SIZE = 25

const nameSelect = {
  email: true,
  coachProfile: { select: { firstName: true, lastName: true } },
  ambassadorProfile: { select: { firstName: true, lastName: true } },
  associateProfile: { select: { firstName: true, lastName: true } },
} as const

// ---------- sender ----------

export interface SenderRow { id: string; subject: string; category: string; status: SupportStatus; createdAt: string; lastActivityAt: string; replies: number }

export async function loadSenderList(userId: string): Promise<SenderRow[]> {
  const rows = await prisma.supportMessage.findMany({
    where: { senderId: userId },
    orderBy: { lastActivityAt: 'desc' },
    take: 100,
    select: { id: true, subject: true, category: true, status: true, createdAt: true, lastActivityAt: true, _count: { select: { replies: true } } },
  })
  return rows.map((r) => ({
    id: r.id, subject: r.subject, category: categoryLabel(r.category), status: r.status,
    createdAt: r.createdAt.toISOString(), lastActivityAt: r.lastActivityAt.toISOString(), replies: r._count.replies,
  }))
}

export interface ThreadEntry { id: string; body: string; createdAt: string; fromTeam: boolean; author: string }
export interface SenderThread { id: string; subject: string; category: string; status: SupportStatus; body: string; createdAt: string; replies: ThreadEntry[] }

/** The sender's own message, or null (someone else's or missing). Team replies are signed by the team, never a name. */
export async function loadSenderThread(userId: string, id: string): Promise<SenderThread | null> {
  const m = await prisma.supportMessage.findFirst({
    where: { id, senderId: userId },
    select: { id: true, subject: true, category: true, status: true, body: true, createdAt: true, replies: { orderBy: { createdAt: 'asc' }, select: { id: true, body: true, createdAt: true, fromTeam: true } } },
  })
  if (!m) return null
  return {
    id: m.id, subject: m.subject, category: categoryLabel(m.category), status: m.status, body: m.body, createdAt: m.createdAt.toISOString(),
    replies: m.replies.map((r) => ({ id: r.id, body: r.body, createdAt: r.createdAt.toISOString(), fromTeam: r.fromTeam, author: r.fromTeam ? 'NowTRANSFORMED team' : 'You' })),
  }
}

// ---------- team ----------

export interface InboxRow {
  id: string; subject: string; category: string; status: SupportStatus; senderName: string; senderRole: string
  assignee: string | null; lastActivityAt: string; createdAt: string; replies: number
}

function searchWhere(q: string): Record<string, unknown> | null {
  const s = q.trim().slice(0, 100)
  if (!s) return null
  const c = { contains: s, mode: 'insensitive' as const }
  const nameOr = (rel: string) => [{ [rel]: { firstName: c } }, { [rel]: { lastName: c } }]
  return {
    OR: [
      { subject: c }, { body: c },
      { sender: { email: c } },
      ...['coachProfile', 'ambassadorProfile', 'associateProfile'].flatMap((rel) => nameOr(rel).map((w) => ({ sender: w }))),
    ],
  }
}

export async function loadInbox(v: Viewer, filter: InboxFilter, q: string, page: number): Promise<{ rows: InboxRow[]; total: number }> {
  const base = inboxWhere(v, filter)
  const search = searchWhere(q)
  const where = (search ? { AND: [base, search] } : base) as object
  const [rows, total] = await Promise.all([
    prisma.supportMessage.findMany({
      where,
      orderBy: filter === 'done' ? { closedAt: 'desc' } : { lastActivityAt: 'desc' },
      skip: (page - 1) * INBOX_PAGE_SIZE,
      take: INBOX_PAGE_SIZE,
      select: {
        id: true, subject: true, category: true, status: true, senderRole: true, lastActivityAt: true, createdAt: true,
        sender: { select: nameSelect }, assignedTo: { select: nameSelect }, _count: { select: { replies: true } },
      },
    }),
    prisma.supportMessage.count({ where }),
  ])
  return {
    total,
    rows: rows.map((r) => ({
      id: r.id, subject: r.subject, category: categoryLabel(r.category), status: r.status,
      senderName: namesOf(r.sender, r.senderRole).full, senderRole: roleLabel(r.senderRole),
      assignee: r.assignedTo ? namesOf(r.assignedTo).full : null,
      lastActivityAt: r.lastActivityAt.toISOString(), createdAt: r.createdAt.toISOString(), replies: r._count.replies,
    })),
  }
}

/** Counts for the filter tabs (and the sidebar badge: New). */
export async function inboxCounts(v: Viewer): Promise<Record<InboxFilter, number>> {
  const [n, mine, open, done] = await Promise.all((['new', 'mine', 'open', 'done'] as const).map((f) => prisma.supportMessage.count({ where: inboxWhere(v, f) as object })))
  return { new: n, mine, open, done }
}

/** Only the New count: cheap enough for the sidebar on every page. */
export async function newSupportCount(v: Viewer): Promise<number> {
  try {
    return await prisma.supportMessage.count({ where: inboxWhere(v, 'new') as object })
  } catch {
    return 0
  }
}

export interface TeamThread {
  id: string; subject: string; category: string; status: SupportStatus; body: string; createdAt: string
  sender: { name: string; email: string; role: string }
  assignee: { id: string; name: string } | null
  assignedAt: string | null
  canAct: boolean
  replies: ThreadEntry[]
}

export async function loadTeamThread(v: Viewer, id: string): Promise<TeamThread | null> {
  const m = await prisma.supportMessage.findUnique({
    where: { id },
    select: {
      id: true, subject: true, category: true, status: true, body: true, createdAt: true, senderId: true, senderRole: true, assignedToId: true, assignedAt: true,
      sender: { select: nameSelect }, assignedTo: { select: { id: true, ...nameSelect } },
      replies: { orderBy: { createdAt: 'asc' }, select: { id: true, body: true, createdAt: true, fromTeam: true, author: { select: nameSelect } } },
    },
  })
  if (!m || !teamCanView(v, m)) return null
  const senderName = namesOf(m.sender, m.senderRole).full
  return {
    id: m.id, subject: m.subject, category: categoryLabel(m.category), status: m.status, body: m.body, createdAt: m.createdAt.toISOString(),
    sender: { name: senderName, email: m.sender.email, role: roleLabel(m.senderRole) },
    assignee: m.assignedTo ? { id: m.assignedTo.id, name: namesOf(m.assignedTo).full } : null,
    assignedAt: m.assignedAt?.toISOString() ?? null,
    canAct: teamCanAct(v, m),
    replies: m.replies.map((r) => ({
      id: r.id, body: r.body, createdAt: r.createdAt.toISOString(), fromTeam: r.fromTeam,
      author: r.author ? namesOf(r.author, r.fromTeam ? undefined : m.senderRole).full : r.fromTeam ? 'A former team member' : senderName,
    })),
  }
}

export interface Assignee { id: string; name: string; email: string; role: 'ADMIN' | 'SUB_ADMIN' }

/** The assign picker: active ADMIN and SUB_ADMIN logins. */
export async function loadAssignees(): Promise<Assignee[]> {
  const rows = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'SUB_ADMIN'] }, status: 'ACTIVE' },
    select: { id: true, role: true, ...nameSelect },
    orderBy: { email: 'asc' },
  })
  return rows
    .map((u) => ({ id: u.id, name: namesOf(u).full, email: u.email, role: u.role as 'ADMIN' | 'SUB_ADMIN' }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
