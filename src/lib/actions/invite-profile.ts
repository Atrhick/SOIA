'use server'

/**
 * Invite profile (/coach/invite-profile, /ambassador/invite-profile): the photo, "why I do this" line
 * and the program a coach's or ambassador's main /join link shares. Own profile only; not while impersonating.
 */
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { invitePrograms } from '@/lib/get-involved/program-welcome-server'
import { WHY_MAX, cleanWhy, isValidJpegDataUrl } from '@/components/get-involved/invite-profile/photo-rules'

export type InviteProfileResult = { ok: true } | { ok: false; error: string }

async function inviter(): Promise<{ userId: string } | { error: string }> {
  const session = await auth()
  if (!session || (session.user.role !== 'COACH' && session.user.role !== 'AMBASSADOR')) return { error: 'Unauthorized' }
  if (session.user.isImpersonating) return { error: 'Switch back to your admin account first. People edit their own invite profile.' }
  return { userId: session.user.id }
}

function refresh() {
  revalidatePath('/coach/invite-profile')
  revalidatePath('/ambassador/invite-profile')
}

const profileSchema = z.object({
  why: z.string().max(1000).transform(cleanWhy).refine((s) => s === null || s.length <= WHY_MAX, `Keep it to ${WHY_MAX} characters`),
  programId: z.string().max(100).transform((s) => s.trim() || null),
})

export async function saveInviteProfile(input: unknown): Promise<InviteProfileResult> {
  const me = await inviter()
  if ('error' in me) return { ok: false, error: me.error }
  const parsed = profileSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the form' }
  const { why, programId } = parsed.data

  try {
    if (programId) {
      const live = await invitePrograms(me.userId)
      if (!live.some((p) => p.id === programId)) return { ok: false, error: 'That program is not live any more. Pick another one.' }
    }
    await prisma.user.update({ where: { id: me.userId }, data: { inviteWhy: why, inviteProgramId: programId } })
    refresh()
    return { ok: true }
  } catch (e) {
    console.error('saveInviteProfile failed', e)
    return { ok: false, error: 'Could not save your profile. Please try again.' }
  }
}

export async function saveInvitePhoto(dataUrl: unknown): Promise<InviteProfileResult> {
  const me = await inviter()
  if ('error' in me) return { ok: false, error: me.error }
  if (!isValidJpegDataUrl(dataUrl)) return { ok: false, error: 'That photo could not be used. Try a smaller JPG, PNG or WebP photo.' }
  try {
    await prisma.user.update({ where: { id: me.userId }, data: { invitePhoto: dataUrl } })
    refresh()
    return { ok: true }
  } catch (e) {
    console.error('saveInvitePhoto failed', e)
    return { ok: false, error: 'Could not save your photo. Please try again.' }
  }
}

export async function removeInvitePhoto(): Promise<InviteProfileResult> {
  const me = await inviter()
  if ('error' in me) return { ok: false, error: me.error }
  try {
    await prisma.user.update({ where: { id: me.userId }, data: { invitePhoto: null } })
    refresh()
    return { ok: true }
  } catch (e) {
    console.error('removeInvitePhoto failed', e)
    return { ok: false, error: 'Could not remove your photo. Please try again.' }
  }
}
