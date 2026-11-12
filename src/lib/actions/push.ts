'use server'

import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { pushEnabled, pushPublicKey, sendPushToUser } from '@/lib/push'

/** The public key the browser needs to subscribe; null when push isn't set up on this server. */
export async function getPushConfig(): Promise<{ publicKey: string | null }> {
  const session = await auth()
  if (!session?.user?.id || !pushEnabled()) return { publicKey: null }
  return { publicKey: pushPublicKey() }
}

const SubSchema = z.object({
  endpoint: z.string().url().max(2000).refine((u) => u.startsWith('https://'), 'https only'),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
})

export async function savePushSubscription(sub: unknown, userAgent?: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not signed in' }
  if (session.user.isImpersonating) return { error: 'Not while viewing as someone else' }
  const parsed = SubSchema.safeParse(sub)
  if (!parsed.success) return { error: 'Invalid subscription' }
  const { endpoint, keys } = parsed.data
  // One row per device; if someone else signs in on the same phone, it moves to them.
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: session.user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: userAgent?.slice(0, 300) },
    update: { userId: session.user.id, p256dh: keys.p256dh, auth: keys.auth, userAgent: userAgent?.slice(0, 300) },
  })
  return { success: true }
}

export async function removePushSubscription(endpoint: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not signed in' }
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: session.user.id } })
  return { success: true }
}

export async function sendTestPush() {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not signed in' }
  const sent = await sendPushToUser(session.user.id, { title: 'Notifications are on', body: "You'll get alerts like this on this device.", url: '/', tag: 'test' })
  return sent > 0 ? { success: true } : { error: 'Could not reach this device' }
}
