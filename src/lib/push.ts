import webpush from 'web-push'
import { prisma } from '@/lib/prisma'

// Web Push ("notifications on this phone"). Works on Android/desktop browsers and,
// on iPhone/iPad (iOS 16.4+), only after the app is added to the home screen.
// Needs env VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY (make a pair with `npx web-push generate-vapid-keys`);
// without them everything here is a no-op and the "turn on notifications" options stay hidden.

export type PushPayload = { title: string; body: string; url?: string; tag?: string }

let configured: boolean | null = null

export function pushPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY?.trim() || null
}

export function pushEnabled(): boolean {
  if (configured !== null) return configured
  const pub = pushPublicKey()
  const priv = process.env.VAPID_PRIVATE_KEY?.trim()
  if (!pub || !priv) return (configured = false)
  try {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT?.trim() || 'mailto:noreply@updates.nowtransformed.org', pub, priv)
    configured = true
  } catch (e) {
    console.error('[PUSH] bad VAPID keys', e)
    configured = false
  }
  return configured
}

const SEND_TIMEOUT_MS = 4000

/** Send to every device these users turned notifications on for. Never throws. */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<number> {
  if (!pushEnabled() || userIds.length === 0) return 0
  try {
    const subs = await prisma.pushSubscription.findMany({ where: { userId: { in: Array.from(new Set(userIds)) } } })
    if (subs.length === 0) return 0
    // Short text only; the full detail stays behind the login.
    const body = JSON.stringify({ title: payload.title.slice(0, 120), body: payload.body.slice(0, 240), url: payload.url || '/', tag: payload.tag })
    let sent = 0
    await Promise.allSettled(subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 24 * 60 * 60, urgency: 'normal', timeout: SEND_TIMEOUT_MS })
        sent++
        await prisma.pushSubscription.update({ where: { id: s.id }, data: { lastSentAt: new Date() } }).catch(() => {})
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode
        // 404/410: the browser unsubscribed or the app was removed. Forget the device.
        if (code === 404 || code === 410) await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {})
        else console.error('[PUSH] send failed', code ?? e)
      }
    }))
    return sent
  } catch (e) {
    console.error('[PUSH] failed', e)
    return 0
  }
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  return sendPushToUsers([userId], payload)
}
