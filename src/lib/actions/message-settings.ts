'use server'

import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/** Turn emails about unread direct messages on or off for yourself (bell and phone notices are unchanged). */
export async function setMessageEmails(on: unknown): Promise<{ ok: true; on: boolean } | { ok: false; error: string }> {
  const session = await auth()
  if (!session) return { ok: false, error: 'Please sign in again.' }
  if (session.user.isImpersonating) return { ok: false, error: "You can't change this while viewing as someone." }
  const parsed = z.boolean().safeParse(on)
  if (!parsed.success) return { ok: false, error: 'Something went wrong. Try again.' }
  try {
    await prisma.user.update({ where: { id: session.user.id }, data: { messageEmailsOff: !parsed.data } })
    return { ok: true, on: parsed.data }
  } catch (e) {
    console.error('[MESSAGES] setMessageEmails failed', e)
    return { ok: false, error: "Couldn't save that. Try again." }
  }
}
