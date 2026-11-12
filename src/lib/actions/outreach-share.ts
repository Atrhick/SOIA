'use server'

/**
 * Share kit + follow-ups actions (outreach round 2). COACH or AMBASSADOR only, never while impersonating.
 * Every write is scoped to the caller's own rows (updateMany where { id, userId }).
 */
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { FIRST_KEYS } from '@/lib/get-involved/outreach-templates'
import { FORM_DONE_KIND } from '@/lib/get-involved/follow-ups'
import { userOwnsProgram } from '@/lib/get-involved/program-welcome-server'

type Result = { ok: true } | { ok: false; error: string }
const SHARES_PER_DAY = 50

async function sharer(): Promise<{ id: string; role: 'COACH' | 'AMBASSADOR' } | { error: string }> {
  const session = await auth()
  if (!session || (session.user.role !== 'COACH' && session.user.role !== 'AMBASSADOR')) return { error: 'Unauthorized' }
  if (session.user.isImpersonating) return { error: 'Switch back to your own account to do this.' }
  return { id: session.user.id, role: session.user.role }
}

function revalidate(role: string) {
  const base = role === 'COACH' ? '/coach/one-a-day' : '/ambassador/one-a-day'
  revalidatePath(base)
  revalidatePath(`${base}/follow-ups`)
}

const recordSchema = z.object({
  kind: z.enum(['FIRST', 'AFTER_YES']),
  channel: z.enum(FIRST_KEYS),
  firstName: z.string().trim().max(60).optional().nullable(),
  programId: z.string().trim().min(1).max(40).optional().nullable(),
})

/** "I sent it" / "I posted it" / "I sent the link". AFTER_YES also marks their latest open first message as a yes. */
export async function recordShare(input: unknown): Promise<Result> {
  const me = await sharer()
  if ('error' in me) return { ok: false, error: me.error }
  const parsed = recordSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Please check the message.' }
  const { kind, channel } = parsed.data
  const firstName = parsed.data.firstName?.trim() || null
  if (channel !== 'POST' && !firstName) return { ok: false, error: 'Add the first name of the person you invited.' }
  const programId = parsed.data.programId || null
  if (programId && !(await userOwnsProgram(me.id, programId))) return { ok: false, error: 'That program is not one you can share.' }

  try {
    const today = await prisma.outreachShare.count({ where: { userId: me.id, kind: { in: ['FIRST', 'AFTER_YES'] }, sentAt: { gte: new Date(Date.now() - 86400_000) } } })
    if (today >= SHARES_PER_DAY) return { ok: false, error: `You can log up to ${SHARES_PER_DAY} messages a day. Please try again tomorrow.` }

    await prisma.$transaction(async (tx) => {
      await tx.outreachShare.create({ data: { userId: me.id, kind, channel, firstName: channel === 'POST' ? null : firstName, programId } })
      if (kind === 'AFTER_YES' && firstName) {
        const first = await tx.outreachShare.findFirst({
          where: { userId: me.id, kind: 'FIRST', outcome: null, firstName: { equals: firstName, mode: 'insensitive' }, sentAt: { gte: new Date(Date.now() - 30 * 86400_000) } },
          orderBy: { sentAt: 'desc' },
          select: { id: true },
        })
        if (first) await tx.outreachShare.updateMany({ where: { id: first.id, userId: me.id }, data: { outcome: 'YES', outcomeAt: new Date() } })
      }
    })
    revalidate(me.role)
    return { ok: true }
  } catch (e) {
    console.error('[OUTREACH] recordShare failed', e)
    return { ok: false, error: 'Could not save that. Please try again.' }
  }
}

const idSchema = z.object({ id: z.string().trim().min(1).max(40) })

async function updateOwn(input: unknown, data: Record<string, unknown>, where: Record<string, unknown> = {}): Promise<Result> {
  const me = await sharer()
  if ('error' in me) return { ok: false, error: me.error }
  const parsed = idSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Unknown follow-up.' }
  try {
    const r = await prisma.outreachShare.updateMany({ where: { id: parsed.data.id, userId: me.id, kind: 'FIRST', ...where }, data })
    if (r.count === 0) return { ok: false, error: 'That follow-up is no longer on your list. Reload the page.' }
    revalidate(me.role)
    return { ok: true }
  } catch (e) {
    console.error('[OUTREACH] follow-up update failed', e)
    return { ok: false, error: 'Could not save that. Please try again.' }
  }
}

/** "Copy nudge": the day 3-4 nudge was copied. */
export async function markNudged(input: unknown): Promise<Result> {
  return updateOwn(input, { nudgedAt: new Date() })
}

/** "Copy close": the day 10-14 close was copied. */
export async function markClosed(input: unknown): Promise<Result> {
  return updateOwn(input, { closedAt: new Date() })
}

const outcomeSchema = z.object({ id: z.string().trim().min(1).max(40), outcome: z.enum(['YES', 'NO', 'DONE']) })

/** "Replied yes" / "Said no" (removed for good) / "Done". Only for an open first message. */
export async function setShareOutcome(input: unknown): Promise<Result> {
  const parsed = outcomeSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Unknown follow-up.' }
  return updateOwn({ id: parsed.data.id }, { outcome: parsed.data.outcome, outcomeAt: new Date() }, { outcome: null })
}

/** "Done" on "Filled the form, no call yet": stored as a FORM_DONE share whose firstName holds the prospect id. */
export async function markFormFollowUpDone(input: unknown): Promise<Result> {
  const me = await sharer()
  if ('error' in me) return { ok: false, error: me.error }
  const parsed = idSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Unknown follow-up.' }
  try {
    const p = await prisma.prospect.findFirst({ where: { id: parsed.data.id, invitedById: me.id }, select: { id: true, programId: true, inviteChannel: true } })
    if (!p) return { ok: false, error: 'That person is not on your list.' }
    const exists = await prisma.outreachShare.findFirst({ where: { userId: me.id, kind: FORM_DONE_KIND, firstName: p.id }, select: { id: true } })
    if (!exists) {
      await prisma.outreachShare.create({
        data: { userId: me.id, kind: FORM_DONE_KIND, firstName: p.id, channel: p.inviteChannel && p.inviteChannel !== 'POST' ? p.inviteChannel : 'TEXT', programId: p.programId, outcome: 'DONE', outcomeAt: new Date() },
      })
    }
    revalidate(me.role)
    return { ok: true }
  } catch (e) {
    console.error('[OUTREACH] form done failed', e)
    return { ok: false, error: 'Could not save that. Please try again.' }
  }
}
