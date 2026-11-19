'use server'

/**
 * Support messages ("Get help"): every change goes through here. Rules live in src/lib/support/core.ts.
 * - Senders (coach, ambassador, associate view): send, reply on their own. Refused while an admin is
 *   viewing as them.
 * - Team (ADMIN, SUB_ADMIN): reply, change status (admins on anything, sub-admins on what's assigned to
 *   them); assign/reassign (admins only).
 * Each move is a conditional update on the state the person saw, so two people acting at once can't
 * silently overwrite each other. Notifications go out after the transaction (notify.ts).
 */
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  BODY_MAX, IMPERSONATION_REFUSAL, SUBJECT_MAX, SUPPORT_CATEGORY_KEYS, TEAM_STATUS_CHOICES, canAssign, canBeAssigned,
  cleanText, isSenderRole, isTeamRole, senderBase, statusAfterAssign, statusAfterSenderReply, takesOnReply,
  teamCanAct, teamStatusProblem, type SupportStatus, type TeamStatusChoice,
} from '@/lib/support/core'
import { notifySupport } from '@/lib/support/notify'

type Result = { ok: true; id?: string } | { ok: false; error: string }

const CHANGED = 'This message just changed. Reload the page to see the latest, then try again.'
const NOT_FOUND = "We couldn't find that message."
const DAILY_LIMIT = 10

const id = z.string().min(1).max(64)
const text = (max: number, what: string) =>
  z.string().transform(cleanText).pipe(z.string().min(1, `Please write ${what}.`).max(max, `Please keep ${what} under ${max} characters.`))

const sendSchema = z.object({
  category: z.enum(SUPPORT_CATEGORY_KEYS, { message: 'Please choose what it’s about.' }),
  subject: text(SUBJECT_MAX, 'a subject'),
  body: text(BODY_MAX, 'your message'),
})

function refreshAll(messageId?: string) {
  for (const base of ['/admin/support', '/team/support', '/coach/support', '/ambassador/support', '/associate/support']) {
    revalidatePath(base)
    if (messageId) revalidatePath(`${base}/${messageId}`)
  }
}

async function senderSession() {
  const session = await auth()
  if (!session || !isSenderRole(session.user.role)) return { error: 'Please sign in again.' } as const
  if (session.user.isImpersonating) return { error: IMPERSONATION_REFUSAL } as const
  return { session } as const
}

async function teamSession() {
  const session = await auth()
  if (!session || !isTeamRole(session.user.role) || session.user.isImpersonating) return { error: 'Only the admin team can do that.' } as const
  return { session, viewer: { id: session.user.id, role: session.user.role as string } } as const
}

// ---------- sender ----------

export async function sendSupportMessage(input: { category: string; subject: string; body: string }): Promise<Result> {
  const s = await senderSession()
  if ('error' in s) return { ok: false, error: s.error as string }
  const p = sendSchema.safeParse(input)
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? 'Please check the form.' }
  const userId = s.session.user.id

  const today = await prisma.supportMessage.count({ where: { senderId: userId, createdAt: { gte: new Date(Date.now() - 24 * 3600_000) } } })
  if (today >= DAILY_LIMIT) return { ok: false, error: "You've sent a lot of messages today. Please add to one you already sent, or try again tomorrow." }

  const m = await prisma.supportMessage.create({
    data: { senderId: userId, senderRole: s.session.user.role, category: p.data.category, subject: p.data.subject, body: p.data.body },
    select: { id: true },
  })
  await notifySupport('NEW_MESSAGE', { messageId: m.id, actorId: userId })
  revalidatePath(senderBase(s.session.user.role))
  refreshAll()
  return { ok: true, id: m.id }
}

export async function replyAsSender(messageId: string, body: string): Promise<Result> {
  const s = await senderSession()
  if ('error' in s) return { ok: false, error: s.error as string }
  const p = z.object({ messageId: id, body: text(BODY_MAX, 'your reply') }).safeParse({ messageId, body })
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? 'Please check your reply.' }
  const userId = s.session.user.id

  const m = await prisma.supportMessage.findFirst({ where: { id: p.data.messageId, senderId: userId }, select: { id: true, status: true, assignedToId: true } })
  if (!m) return { ok: false, error: NOT_FOUND }
  const next = statusAfterSenderReply(m.status, !!m.assignedToId)
  try {
    await prisma.$transaction(async (tx) => {
      const now = new Date()
      const u = await tx.supportMessage.updateMany({
        where: { id: m.id, status: m.status, assignedToId: m.assignedToId },
        data: { status: next, lastActivityAt: now, ...(m.status === 'DONE' ? { closedAt: null } : {}) },
      })
      if (u.count !== 1) throw new Error('CHANGED')
      await tx.supportReply.create({ data: { messageId: m.id, authorId: userId, body: p.data.body, fromTeam: false } })
    })
  } catch (e) {
    if (e instanceof Error && e.message === 'CHANGED') return { ok: false, error: CHANGED }
    console.error('[SUPPORT] sender reply failed', e)
    return { ok: false, error: "We couldn't send your reply. Please try again." }
  }
  await notifySupport('SENDER_REPLY', { messageId: m.id, actorId: userId, extra: { text: p.data.body } })
  refreshAll(m.id)
  return { ok: true }
}

// ---------- team ----------

export async function assignSupportMessage(messageId: string, assigneeId: string): Promise<Result> {
  const t = await teamSession()
  if ('error' in t) return { ok: false, error: t.error as string }
  if (!canAssign(t.viewer)) return { ok: false, error: 'Only admins can assign messages.' }
  const p = z.object({ messageId: id, assigneeId: id }).safeParse({ messageId, assigneeId })
  if (!p.success) return { ok: false, error: 'Please choose someone.' }

  const [m, who] = await Promise.all([
    prisma.supportMessage.findUnique({ where: { id: p.data.messageId }, select: { id: true, status: true, assignedToId: true } }),
    prisma.user.findUnique({ where: { id: p.data.assigneeId }, select: { id: true, role: true, status: true } }),
  ])
  if (!m) return { ok: false, error: NOT_FOUND }
  if (!who || !canBeAssigned(who)) return { ok: false, error: 'That person is not an active admin or sub-admin.' }
  if (m.assignedToId === who.id) return { ok: false, error: 'It is already assigned to them.' }

  const next = statusAfterAssign(m.status)
  try {
    await prisma.$transaction(async (tx) => {
      const now = new Date()
      const u = await tx.supportMessage.updateMany({
        where: { id: m.id, status: m.status, assignedToId: m.assignedToId },
        data: { assignedToId: who.id, assignedById: t.viewer.id, assignedAt: now, status: next, lastActivityAt: now },
      })
      if (u.count !== 1) throw new Error('CHANGED')
      await tx.auditLog.create({
        data: {
          userId: t.viewer.id, action: m.assignedToId ? 'SUPPORT_REASSIGNED' : 'SUPPORT_ASSIGNED', entityType: 'SupportMessage', entityId: m.id,
          details: JSON.stringify({ from: m.assignedToId, to: who.id, status: { from: m.status, to: next } }),
        },
      })
    })
  } catch (e) {
    if (e instanceof Error && e.message === 'CHANGED') return { ok: false, error: CHANGED }
    console.error('[SUPPORT] assign failed', e)
    return { ok: false, error: "We couldn't assign it. Please try again." }
  }
  await notifySupport('ASSIGNED', { messageId: m.id, actorId: t.viewer.id, extra: { wasNew: m.status === 'NEW' } })
  refreshAll(m.id)
  return { ok: true }
}

export async function setSupportStatus(messageId: string, status: string): Promise<Result> {
  const t = await teamSession()
  if ('error' in t) return { ok: false, error: t.error as string }
  const p = z.object({ messageId: id, status: z.enum(TEAM_STATUS_CHOICES) }).safeParse({ messageId, status })
  if (!p.success) return { ok: false, error: 'Please choose a status.' }

  const m = await prisma.supportMessage.findUnique({ where: { id: p.data.messageId }, select: { id: true, senderId: true, status: true, assignedToId: true } })
  if (!m) return { ok: false, error: NOT_FOUND }
  if (!teamCanAct(t.viewer, m)) return { ok: false, error: 'Only the person it is assigned to, or an admin, can change it.' }
  const problem = teamStatusProblem(m.status, p.data.status, !!m.assignedToId)
  if (problem) return { ok: false, error: problem }

  try {
    await prisma.$transaction(async (tx) => {
      await moveStatus(tx, m, p.data.status, t.viewer.id)
    })
  } catch (e) {
    if (e instanceof Error && e.message === 'CHANGED') return { ok: false, error: CHANGED }
    console.error('[SUPPORT] status failed', e)
    return { ok: false, error: "We couldn't change the status. Please try again." }
  }
  await notifySupport('STATUS', { messageId: m.id, actorId: t.viewer.id })
  refreshAll(m.id)
  return { ok: true }
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

/** One conditional status move + audit entry, inside the caller's transaction. */
async function moveStatus(tx: Tx, m: { id: string; status: SupportStatus; assignedToId: string | null }, to: SupportStatus, actorId: string) {
  const now = new Date()
  const u = await tx.supportMessage.updateMany({
    where: { id: m.id, status: m.status, assignedToId: m.assignedToId },
    data: { status: to, lastActivityAt: now, closedAt: to === 'DONE' ? now : null },
  })
  if (u.count !== 1) throw new Error('CHANGED')
  await tx.auditLog.create({
    data: { userId: actorId, action: 'SUPPORT_STATUS', entityType: 'SupportMessage', entityId: m.id, details: JSON.stringify({ from: m.status, to }) },
  })
}

/**
 * A team reply, optionally changing the status in the same step ("then": waiting on them / done), so the
 * sender gets one notice. Replying to a New message assigns it to the person replying (admins only:
 * sub-admins can't act on New ones).
 */
export async function replyAsTeam(messageId: string, body: string, then?: string | null): Promise<Result> {
  const t = await teamSession()
  if ('error' in t) return { ok: false, error: t.error as string }
  const p = z.object({
    messageId: id,
    body: text(BODY_MAX, 'your reply'),
    then: z.enum(['WAITING_ON_SENDER', 'DONE']).nullable().optional(),
  }).safeParse({ messageId, body, then: then || null })
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? 'Please check your reply.' }

  const m = await prisma.supportMessage.findUnique({ where: { id: p.data.messageId }, select: { id: true, senderId: true, status: true, assignedToId: true } })
  if (!m) return { ok: false, error: NOT_FOUND }
  if (!teamCanAct(t.viewer, m)) return { ok: false, error: 'Only the person it is assigned to, or an admin, can reply.' }
  const take = takesOnReply(m)
  const assignedAfter = take ? t.viewer.id : m.assignedToId
  // The status the message has once the reply's own take-over is done; "then" moves it on from there.
  const startStatus: SupportStatus = take ? 'ASSIGNED' : m.status
  let target: TeamStatusChoice | null = p.data.then ?? null
  if (target === startStatus) target = null
  if (target) {
    const problem = teamStatusProblem(startStatus, target, !!assignedAfter)
    if (problem) return { ok: false, error: problem }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const now = new Date()
      let cur = { id: m.id, status: m.status, assignedToId: m.assignedToId }
      if (take) {
        const u = await tx.supportMessage.updateMany({
          where: { id: m.id, status: 'NEW', assignedToId: null },
          data: { assignedToId: t.viewer.id, assignedById: t.viewer.id, assignedAt: now, status: 'ASSIGNED', lastActivityAt: now },
        })
        if (u.count !== 1) throw new Error('CHANGED')
        await tx.auditLog.create({
          data: { userId: t.viewer.id, action: 'SUPPORT_ASSIGNED', entityType: 'SupportMessage', entityId: m.id, details: JSON.stringify({ from: null, to: t.viewer.id, by: 'reply' }) },
        })
        cur = { id: m.id, status: 'ASSIGNED', assignedToId: t.viewer.id }
      }
      if (target) {
        await moveStatus(tx, cur, target, t.viewer.id)
      } else {
        const u = await tx.supportMessage.updateMany({ where: { id: m.id, status: cur.status, assignedToId: cur.assignedToId }, data: { lastActivityAt: now } })
        if (u.count !== 1) throw new Error('CHANGED')
      }
      await tx.supportReply.create({ data: { messageId: m.id, authorId: t.viewer.id, body: p.data.body, fromTeam: true } })
    })
  } catch (e) {
    if (e instanceof Error && e.message === 'CHANGED') return { ok: false, error: CHANGED }
    console.error('[SUPPORT] team reply failed', e)
    return { ok: false, error: "We couldn't send your reply. Please try again." }
  }
  await notifySupport('TEAM_REPLY', { messageId: m.id, actorId: t.viewer.id, extra: { text: p.data.body } })
  refreshAll(m.id)
  return { ok: true }
}
