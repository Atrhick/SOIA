'use server'

/**
 * Admin > Send a notification. ADMIN only, never while viewing as someone else.
 * Creating a message saves who it goes to; the page then calls continueBroadcast()
 * until everyone has been reached (push where notifications are on, else email).
 * Every message is audit-logged.
 */
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { BODY_MAX, MAX_RECIPIENTS, TITLE_MAX, isAudienceGroup, normalizeCustomLink, type Audience, type BroadcastCounts } from '@/lib/broadcast/core'
import { audienceCounts, audienceWhere, runBroadcastBatch } from '@/lib/broadcast/server'

const PATH = '/admin/notifications'

async function requireAdmin() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN' || session.user.isImpersonating) return null
  return session
}
const DENIED = { error: 'Only admins can send notifications (and not while viewing as someone else).' } as const

const AudienceSchema = z.union([
  z.object({ groups: z.array(z.string()).min(1).max(10) }),
  z.object({ userIds: z.array(z.string().min(1).max(64)).min(1).max(MAX_RECIPIENTS) }),
])

function cleanAudience(raw: unknown): Audience | null {
  const p = AudienceSchema.safeParse(raw)
  if (!p.success) return null
  if ('groups' in p.data) {
    const groups = Array.from(new Set(p.data.groups.filter(isAudienceGroup)))
    return groups.length ? { groups } : null
  }
  return { userIds: Array.from(new Set(p.data.userIds)) }
}

export async function previewBroadcastAudience(raw: unknown): Promise<{ people: number; withDevice: number } | { error: string }> {
  if (!(await requireAdmin())) return DENIED
  const a = cleanAudience(raw)
  if (!a) return { people: 0, withDevice: 0 }
  return audienceCounts(a)
}

export type PersonHit = { id: string; name: string; email: string; roles: string; hasDevice: boolean }

/** Up to 10 active people whose name or email matches. */
export async function searchBroadcastPeople(q: string): Promise<PersonHit[] | { error: string }> {
  if (!(await requireAdmin())) return DENIED
  const words = String(q ?? '').trim().slice(0, 80).split(/\s+/).filter(Boolean).slice(0, 3)
  if (!words.length) return []
  const name = (w: string) => ({ OR: [{ firstName: { contains: w, mode: 'insensitive' as const } }, { lastName: { contains: w, mode: 'insensitive' as const } }] })
  const users = await prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      role: { not: 'PARENT' },
      AND: words.map((w) => ({
        OR: [
          { email: { contains: w, mode: 'insensitive' as const } },
          { coachProfile: name(w) },
          { ambassadorProfile: name(w) },
          { associateProfile: name(w) },
        ],
      })),
    },
    take: 10,
    orderBy: { email: 'asc' },
    select: {
      id: true, email: true, role: true, extraRoles: true,
      coachProfile: { select: { firstName: true, lastName: true } },
      ambassadorProfile: { select: { firstName: true, lastName: true } },
      associateProfile: { select: { firstName: true, lastName: true } },
      _count: { select: { pushSubscriptions: true } },
    },
  })
  const label = (r: string) => r.toLowerCase().replace(/_/g, ' ')
  return users.map((u) => {
    const p = u.coachProfile ?? u.ambassadorProfile ?? u.associateProfile
    return {
      id: u.id,
      name: p ? `${p.firstName} ${p.lastName}`.trim() : u.email.split('@')[0],
      email: u.email,
      roles: Array.from(new Set([u.role, ...u.extraRoles])).map(label).join(', '),
      hasDevice: u._count.pushSubscriptions > 0,
    }
  })
}

const CreateSchema = z.object({
  title: z.string().trim().min(1, 'Add a title.').max(TITLE_MAX, `Keep the title under ${TITLE_MAX} characters.`),
  body: z.string().trim().min(1, 'Write the message.').max(BODY_MAX, `Keep the message under ${BODY_MAX} characters.`),
  link: z.enum(['home', 'one-a-day', 'custom']),
  customLink: z.string().max(300).optional(),
  emailFallback: z.boolean(),
  audience: z.unknown(),
})

export async function createBroadcast(raw: unknown): Promise<{ ok: true; id: string; total: number } | { error: string }> {
  const session = await requireAdmin()
  if (!session) return DENIED
  const p = CreateSchema.safeParse(raw)
  if (!p.success) return { error: p.error.issues[0]?.message ?? 'Check the form.' }
  const audience = cleanAudience(p.data.audience)
  if (!audience) return { error: 'Choose who gets it.' }
  let link: string = p.data.link
  if (link === 'custom') {
    const path = normalizeCustomLink(p.data.customLink ?? '')
    if (!path) return { error: 'The page link must be a page in this app, like /coach/learning.' }
    link = path
  }
  const users = await prisma.user.findMany({ where: audienceWhere(audience), select: { id: true }, take: MAX_RECIPIENTS + 1 })
  if (users.length === 0) return { error: 'Nobody matches. Choose other groups or people.' }
  if (users.length > MAX_RECIPIENTS) return { error: `That's more than ${MAX_RECIPIENTS} people. Choose fewer groups.` }

  const b = await prisma.$transaction(async (tx) => {
    const created = await tx.broadcast.create({
      data: { createdById: session.user.id, title: p.data.title, body: p.data.body, link, audience: audience as object, emailFallback: p.data.emailFallback },
    })
    await tx.broadcastDelivery.createMany({ data: users.map((u) => ({ broadcastId: created.id, userId: u.id })) })
    await tx.auditLog.create({
      data: {
        userId: session.user.id, action: 'BROADCAST_SENT', entityType: 'Broadcast', entityId: created.id,
        details: JSON.stringify({ title: p.data.title, people: users.length, audience, link, emailFallback: p.data.emailFallback }),
      },
    })
    return created
  })
  return { ok: true, id: b.id, total: users.length }
}

/** Sends the next batch of one message. Call again while `pending` is above 0. */
export async function continueBroadcast(id: string): Promise<{ ok: true; counts: BroadcastCounts } | { error: string }> {
  if (!(await requireAdmin())) return DENIED
  const parsed = z.string().min(1).max(64).safeParse(id)
  if (!parsed.success) return { error: 'Unknown message.' }
  const counts = await runBroadcastBatch(parsed.data)
  if (!counts) return { error: 'Unknown message.' }
  if (counts.pending === 0) revalidatePath(PATH)
  return { ok: true, counts }
}

