/**
 * Admin notifications to the team: database side. Server only (not 'use server'):
 * the actions in src/lib/actions/broadcasts.ts check the admin first.
 */
import type { Prisma, UserRole } from '@prisma/client'
import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { sendPushToUser } from '@/lib/push'
import { userDisplayName } from '@/lib/get-involved/server'
import {
  BATCH_SIZE, MAX_RECIPIENTS, broadcastEmail, countsFrom, deliveryPlan, isAudienceGroup, linkFor, pushBody, rolesForGroups,
  type Audience, type BroadcastCounts,
} from './core'

/** Email provider allows only a few sends a second. */
const EMAIL_GAP_MS = 550
const STUCK_AFTER_MS = 5 * 60_000

export function audienceWhere(a: Audience): Prisma.UserWhereInput {
  if ('userIds' in a) return { id: { in: a.userIds.slice(0, MAX_RECIPIENTS) }, status: 'ACTIVE' }
  const roles = rolesForGroups(a.groups.filter(isAudienceGroup)) as UserRole[]
  if (!roles.length) return { id: { in: [] } }
  return { status: 'ACTIVE', OR: [{ role: { in: roles } }, { extraRoles: { hasSome: roles } }] }
}

export async function audienceCounts(a: Audience): Promise<{ people: number; withDevice: number }> {
  const where = audienceWhere(a)
  const [people, withDevice] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.count({ where: { AND: [where, { pushSubscriptions: { some: {} } }] } }),
  ])
  return { people, withDevice }
}

export async function broadcastCounts(broadcastId: string): Promise<BroadcastCounts> {
  const rows = await prisma.broadcastDelivery.groupBy({ by: ['status'], where: { broadcastId }, _count: true })
  return countsFrom(rows)
}

type B = { id: string; title: string; body: string; link: string; emailFallback: boolean; createdById: string }

/** Sends to one person. Returns whether an email went out (the caller spaces emails). */
async function deliverOne(b: B, d: { id: string; userId: string }, replyTo: string | undefined): Promise<{ emailed: boolean }> {
  const now = new Date()
  // Claim the row so two open tabs never send the same person the message twice.
  const claimed = await prisma.broadcastDelivery.updateMany({
    where: { id: d.id, OR: [{ status: 'PENDING' }, { status: 'SENDING', claimedAt: { lt: new Date(now.getTime() - STUCK_AFTER_MS) } }] },
    data: { status: 'SENDING', claimedAt: now },
  })
  if (claimed.count === 0) return { emailed: false }
  const finish = (status: string) => prisma.broadcastDelivery.update({ where: { id: d.id }, data: { status, sentAt: status === 'FAILED' || status === 'NO_DEVICE' ? null : new Date() } })

  try {
    const user = await prisma.user.findUnique({ where: { id: d.userId }, select: { role: true, extraRoles: true, status: true, _count: { select: { pushSubscriptions: true } } } })
    if (!user || user.status !== 'ACTIVE') { await finish('FAILED'); return { emailed: false } }
    const url = linkFor(b.link, user)
    let plan = deliveryPlan(user._count.pushSubscriptions, b.emailFallback)
    if (plan === 'push') {
      const sent = await sendPushToUser(d.userId, { title: b.title, body: pushBody(b.body), url, tag: `broadcast-${b.id}` })
      if (sent > 0) { await finish('PUSH'); return { emailed: false } }
      // Every device failed (phone changed, app removed): fall back like someone with none.
      plan = deliveryPlan(0, b.emailFallback)
    }
    if (plan === 'none') { await finish('NO_DEVICE'); return { emailed: false } }
    const name = await userDisplayName(d.userId)
    if (!name) { await finish('FAILED'); return { emailed: false } }
    const mail = broadcastEmail(b, name.first, url)
    const r = await sendEmail({ to: name.email, ...mail, replyTo })
    await finish(r.sent ? 'EMAIL' : 'FAILED')
    return { emailed: true }
  } catch (e) {
    console.error('[BROADCAST] delivery failed', e)
    await finish('FAILED').catch(() => {})
    return { emailed: false }
  }
}

/** Sends the next batch. Returns the counts after it; finishedAt is set once nobody is left. */
export async function runBroadcastBatch(broadcastId: string): Promise<BroadcastCounts | null> {
  const b = await prisma.broadcast.findUnique({ where: { id: broadcastId }, select: { id: true, title: true, body: true, link: true, emailFallback: true, createdById: true, finishedAt: true } })
  if (!b) return null
  if (!b.finishedAt) {
    const sender = await prisma.user.findUnique({ where: { id: b.createdById }, select: { email: true } })
    const stuckBefore = new Date(Date.now() - STUCK_AFTER_MS)
    const batch = await prisma.broadcastDelivery.findMany({
      where: { broadcastId, OR: [{ status: 'PENDING' }, { status: 'SENDING', claimedAt: { lt: stuckBefore } }] },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      select: { id: true, userId: true },
    })
    for (const d of batch) {
      const { emailed } = await deliverOne(b, d, sender?.email)
      if (emailed) await new Promise((ok) => setTimeout(ok, EMAIL_GAP_MS))
    }
  }
  const counts = await broadcastCounts(broadcastId)
  if (counts.pending === 0 && !b.finishedAt) {
    await prisma.broadcast.updateMany({ where: { id: broadcastId, finishedAt: null }, data: { finishedAt: new Date() } })
  }
  return counts
}
