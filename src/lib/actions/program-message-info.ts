'use server'

/**
 * "How your program appears in messages" on the program editor: the business name (ProgramPlaybook.businessName)
 * and one line about the program (CoachProgram.messageLine). Used by the One-A-Day messages at once:
 * no review. Owner only (program-owner.ts), never while impersonating.
 */
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { isProgramOwnedBy, type ProgramOwnerIdentity } from '@/lib/program-owner'
import { BUSINESS_NAME_MAX, MESSAGE_LINE_MAX } from '@/components/program-pages/message-preview'

export interface ProgramMessageInfo {
  programId: string
  programName: string
  /** The company name on the program page, the fallback when no business name is set. */
  organization: string
  businessName: string
  messageLine: string
  readOnly: boolean
}

async function ownerContext(programId: string) {
  const session = await auth()
  const role = session?.user.role
  if (!session || (role !== 'COACH' && role !== 'AMBASSADOR')) return null
  let who: ProgramOwnerIdentity | null = null
  if (role === 'COACH') {
    const c = await prisma.coachProfile.findUnique({ where: { userId: session.user.id }, select: { id: true } })
    if (c) who = { role: 'COACH', coachId: c.id }
  } else {
    const a = await prisma.ambassador.findUnique({ where: { userId: session.user.id }, select: { id: true } })
    if (a) who = { role: 'AMBASSADOR', ambassadorId: a.id }
  }
  if (!who) return null
  const program = await prisma.coachProgram.findUnique({
    where: { id: programId },
    select: { id: true, name: true, organization: true, coachId: true, ambassadorId: true, messageLine: true, playbook: { select: { businessName: true } } },
  })
  if (!program || !isProgramOwnedBy(program, who)) return null
  return { session, program }
}

export async function getProgramMessageInfo(programId: string): Promise<ProgramMessageInfo | null> {
  if (typeof programId !== 'string' || !programId || programId.length > 100) return null
  const ctx = await ownerContext(programId)
  if (!ctx) return null
  const p = ctx.program
  return {
    programId: p.id,
    programName: p.name,
    organization: p.organization ?? '',
    businessName: p.playbook?.businessName ?? '',
    messageLine: p.messageLine ?? '',
    readOnly: !!ctx.session.user.isImpersonating,
  }
}

const oneLine = (max: number, label: string) =>
  z.string().max(max * 4).transform((s) => s.replace(/\s+/g, ' ').trim()).refine((s) => s.length <= max, `${label}: at most ${max} characters`)

const schema = z.object({
  programId: z.string().min(1).max(100),
  businessName: oneLine(BUSINESS_NAME_MAX, 'Business name'),
  // A trailing period is dropped: the line sits inside a sentence.
  messageLine: oneLine(MESSAGE_LINE_MAX, 'One line about the program').transform((s) => s.replace(/[.\s]+$/, '')),
})

export async function saveProgramMessageInfo(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the form' }
  const ctx = await ownerContext(parsed.data.programId)
  if (!ctx) return { ok: false, error: 'Program not found' }
  if (ctx.session.user.isImpersonating) return { ok: false, error: 'Not available while viewing as someone else.' }
  const { programId, businessName, messageLine } = parsed.data
  try {
    await prisma.$transaction([
      prisma.coachProgram.update({ where: { id: programId }, data: { messageLine: messageLine || null } }),
      prisma.programPlaybook.upsert({
        where: { programId },
        create: { programId, businessName: businessName || null },
        update: { businessName: businessName || null },
      }),
    ])
    for (const base of ['/coach', '/ambassador']) {
      revalidatePath(`${base}/programs/${programId}`)
      revalidatePath(`${base}/one-a-day`)
      revalidatePath(`${base}/one-a-day/playbook`)
    }
    return { ok: true }
  } catch (e) {
    console.error('saveProgramMessageInfo failed', e)
    return { ok: false, error: 'Could not save. Please try again.' }
  }
}
