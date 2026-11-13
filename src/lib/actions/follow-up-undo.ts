'use server'

/**
 * One-A-Day v2 follow-ups: Undo for "Stop following up" and "They said yes". COACH or AMBASSADOR only,
 * never while impersonating, only the caller's own rows, and only within a day of the change.
 */
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { FORM_DONE_KIND } from '@/lib/get-involved/follow-ups'

type Result = { ok: true } | { ok: false; error: string }
const UNDO_WINDOW_MS = 86400_000
const idSchema = z.object({ id: z.string().trim().min(1).max(40) })

async function member(): Promise<{ id: string; role: 'COACH' | 'AMBASSADOR' } | { error: string }> {
  const session = await auth()
  if (!session || (session.user.role !== 'COACH' && session.user.role !== 'AMBASSADOR')) return { error: 'Unauthorized' }
  if (session.user.isImpersonating) return { error: 'Switch back to your own account to do this.' }
  return { id: session.user.id, role: session.user.role }
}

function revalidate(role: string) {
  const base = role === 'COACH' ? '/coach/one-a-day' : '/ambassador/one-a-day'
  revalidatePath(base)
  revalidatePath(`${base}/follow-ups`)
  revalidatePath(`${base}/results`)
}

/** Clears a YES / NO / DONE outcome set on one of the caller's first messages in the last day. */
export async function undoShareOutcome(input: unknown): Promise<Result> {
  const me = await member()
  if ('error' in me) return { ok: false, error: me.error }
  const parsed = idSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Unknown follow-up.' }
  try {
    const r = await prisma.outreachShare.updateMany({
      where: { id: parsed.data.id, userId: me.id, kind: 'FIRST', outcome: { not: null }, outcomeAt: { gte: new Date(Date.now() - UNDO_WINDOW_MS) } },
      data: { outcome: null, outcomeAt: null },
    })
    if (r.count === 0) return { ok: false, error: 'That can no longer be undone. Reload the page.' }
    revalidate(me.role)
    return { ok: true }
  } catch (e) {
    console.error('[OUTREACH] undo outcome failed', e)
    return { ok: false, error: 'Could not undo that. Please try again.' }
  }
}

/** Puts a "signed up but didn't book" person back on the list (removes the FORM_DONE marker). */
export async function undoFormFollowUpDone(input: unknown): Promise<Result> {
  const me = await member()
  if ('error' in me) return { ok: false, error: me.error }
  const parsed = idSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Unknown follow-up.' }
  try {
    const r = await prisma.outreachShare.deleteMany({
      where: { userId: me.id, kind: FORM_DONE_KIND, firstName: parsed.data.id, sentAt: { gte: new Date(Date.now() - UNDO_WINDOW_MS) } },
    })
    if (r.count === 0) return { ok: false, error: 'That can no longer be undone. Reload the page.' }
    revalidate(me.role)
    return { ok: true }
  } catch (e) {
    console.error('[OUTREACH] undo form done failed', e)
    return { ok: false, error: 'Could not undo that. Please try again.' }
  }
}
