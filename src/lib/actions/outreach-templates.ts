'use server'

/** Admin template editor (/admin/outreach-templates). ADMIN only, never while impersonating. */
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { AUDIENCES, TEMPLATE_KEYS, templateChecks } from '@/lib/get-involved/outreach-templates'

type Result = { ok: true } | { ok: false; error: string }

async function admin(): Promise<{ id: string } | { error: string }> {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') return { error: 'Unauthorized' }
  if (session.user.isImpersonating) return { error: 'Switch back to your admin account first.' }
  return { id: session.user.id }
}

function revalidateAll() {
  revalidatePath('/admin/outreach-templates')
  revalidatePath('/coach/one-a-day')
  revalidatePath('/ambassador/one-a-day')
}

const saveSchema = z.object({
  key: z.enum(TEMPLATE_KEYS),
  audience: z.enum(AUDIENCES),
  subject: z.string().max(150).optional().nullable(),
  body: z.string().trim().min(1, 'Write the message first.').max(2000, 'Keep the message under 2,000 characters.'),
  status: z.enum(['LIVE', 'DRAFT']),
})

export async function saveOutreachTemplate(input: unknown): Promise<Result> {
  const me = await admin()
  if ('error' in me) return { ok: false, error: me.error }
  const parsed = saveSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Please check the template.' }
  const { key, audience, status, body } = parsed.data
  const subject = key === 'EMAIL' ? parsed.data.subject?.trim() || null : null
  // Live templates must pass every check; drafts may be saved half-done.
  if (status === 'LIVE') {
    const failed = templateChecks(key, { subject, body }).filter((c) => !c.ok)
    if (failed.length) return { ok: false, error: `Fix these before making it live: ${failed.map((c) => c.label).join('; ')}. You can save it as a draft.` }
  }
  try {
    await prisma.outreachTemplate.upsert({
      where: { key_audience: { key, audience } },
      create: { key, audience, subject, body, status, updatedById: me.id },
      update: { subject, body, status, updatedById: me.id },
    })
    revalidateAll()
    return { ok: true }
  } catch (e) {
    console.error('[OUTREACH] save template failed', e)
    return { ok: false, error: 'Could not save the template. Please try again.' }
  }
}

const resetSchema = z.object({ key: z.enum(TEMPLATE_KEYS), audience: z.enum(AUDIENCES) })

/** "Reset to default": deletes the saved row, so the code default (or the ALL row, for a role) applies again. */
export async function resetOutreachTemplate(input: unknown): Promise<Result> {
  const me = await admin()
  if ('error' in me) return { ok: false, error: me.error }
  const parsed = resetSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Unknown template.' }
  try {
    await prisma.outreachTemplate.deleteMany({ where: { key: parsed.data.key, audience: parsed.data.audience } })
    revalidateAll()
    return { ok: true }
  } catch (e) {
    console.error('[OUTREACH] reset template failed', e)
    return { ok: false, error: 'Could not reset the template. Please try again.' }
  }
}
