'use server'

/**
 * "Don't send me invitations like this" from an "Email them for me" invitation (/email/<istop token>).
 * The token is signed (email-links.ts) and carries the OutreachInvite id; pressing the button adds the
 * invitation's address to EmailSuppression (source INVITE_STOP), so no member can invite it again.
 */
import prisma from '@/lib/prisma'
import { verifyEmailToken } from '@/lib/get-involved/email-links'
import { clientIp, rateLimited } from '@/lib/get-involved/server'

export async function stopInvites(token: string): Promise<{ ok: true; message: string } | { error: string }> {
  if (rateLimited(`emaillink:${await clientIp()}`, 20, 10 * 60_000)) return { error: 'Too many attempts. Please wait a few minutes and try again.' }
  const v = verifyEmailToken(typeof token === 'string' ? token : '')
  if (!v || v.action !== 'istop') return { error: 'This link is not valid.' }
  try {
    const inv = await prisma.outreachInvite.findUnique({ where: { id: v.id }, select: { email: true } })
    if (!inv) return { error: 'This link no longer applies.' }
    await prisma.emailSuppression.upsert({ where: { email: inv.email }, create: { email: inv.email, source: 'INVITE_STOP' }, update: {} })
    return { ok: true, message: "Done. You won't get invitations like this from anyone at NowTransformed again." }
  } catch (e) {
    console.error('[EMAIL-LINK] invite stop failed', e)
    return { error: 'Something went wrong. Please try again.' }
  }
}
