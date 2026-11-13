'use server'

/**
 * One-A-Day v2 message editors.
 * - Program owners rewrite their program's messages and "How to pitch" guide (Playbook page). Saved =
 *   live at once, but only when every scriptChecks() check passes (checked again here).
 * - Admins edit the GENERAL message for each situation (/admin/outreach-templates), stored in
 *   OutreachTemplate with key `${scenario}:${variant}`, audience ALL, LIVE or DRAFT.
 * Nobody writes while impersonating.
 */
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { isProgramOwnedBy, type ProgramOwnerIdentity } from '@/lib/program-owner'
import { SCENARIO_KEYS, scenarioOf, scriptChecks, type ScenarioKey, type ScriptVariant } from '@/lib/get-involved/scripts'
import { generalKey, guideProblem } from '@/components/get-involved/playbook/helpers'

type Result = { ok: true } | { ok: false; error: string }

function revalidateAll() {
  for (const base of ['/coach', '/ambassador']) {
    revalidatePath(`${base}/one-a-day/playbook`)
    revalidatePath(`${base}/one-a-day`)
    revalidatePath(`${base}/one-a-day/follow-ups`)
  }
}

async function audit(userId: string, action: string, entityType: string, entityId: string | null, details: Record<string, unknown>) {
  try {
    await prisma.auditLog.create({ data: { userId, action, entityType, entityId, details: JSON.stringify(details) } })
  } catch (e) {
    console.error('[PLAYBOOK] audit log failed', e)
  }
}

/** The signed-in program owner of `programId`, or an error in plain words. */
async function owner(programId: string): Promise<{ userId: string } | { error: string }> {
  const session = await auth()
  if (!session?.user) return { error: 'Please sign in again.' }
  if (session.user.isImpersonating) return { error: 'Switch back to your admin account first. Changes are not saved while viewing as someone else.' }
  let who: ProgramOwnerIdentity | null = null
  if (session.user.role === 'COACH' && session.user.coachId) who = { role: 'COACH', coachId: session.user.coachId }
  if (session.user.role === 'AMBASSADOR' && session.user.ambassadorId) who = { role: 'AMBASSADOR', ambassadorId: session.user.ambassadorId }
  if (!who) return { error: 'Only the program owner can change these messages.' }
  const p = await prisma.coachProgram.findUnique({ where: { id: programId }, select: { coachId: true, ambassadorId: true } })
  if (!p || !isProgramOwnedBy(p, who)) return { error: 'Only the program owner can change these messages.' }
  return { userId: session.user.id }
}

async function admin(): Promise<{ userId: string } | { error: string }> {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') return { error: 'Unauthorized' }
  if (session.user.isImpersonating) return { error: 'Switch back to your admin account first.' }
  return { userId: session.user.id }
}

const scenarioSchema = z.enum(SCENARIO_KEYS as [ScenarioKey, ...ScenarioKey[]])
const variantSchema = z.enum(['SHORT', 'EMAIL', 'POST'])
const target = { scenario: scenarioSchema, variant: variantSchema }
const text = {
  subject: z.string().max(120, 'Keep the subject under 120 characters.').optional().nullable(),
  body: z.string().max(3000, 'Keep the message under 3,000 characters.'),
}

/** Same rules as the editor shows: the variant must exist for the situation, and every check must pass. */
function checkScript(scenario: ScenarioKey, variant: ScriptVariant, subject: string | null, body: string): string | null {
  if (!(scenarioOf(scenario).variants as readonly string[]).includes(variant)) return 'That kind of message is not used for this situation.'
  const failed = scriptChecks(scenario, variant, { subject, body }).filter((c) => !c.ok)
  return failed.length ? `Fix this first: ${failed.map((c) => c.label).join('; ')}.` : null
}

// ---------- program owners: messages ----------

const ownerSave = z.object({ programId: z.string().min(1).max(60), ...target, ...text })

export async function saveProgramScript(input: unknown): Promise<Result> {
  const parsed = ownerSave.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Please check the message.' }
  const { programId, scenario, variant } = parsed.data
  const me = await owner(programId)
  if ('error' in me) return { ok: false, error: me.error }
  const body = parsed.data.body.replace(/\r\n/g, '\n').trim()
  const subject = variant === 'EMAIL' ? parsed.data.subject?.trim() || null : null
  const problem = checkScript(scenario, variant, subject, body)
  if (problem) return { ok: false, error: problem }
  try {
    const data = { ownerSubject: subject, ownerBody: body, ownerUpdatedAt: new Date(), ownerUpdatedById: me.userId }
    const row = await prisma.programScript.upsert({
      where: { programId_scenario_variant: { programId, scenario, variant } },
      create: { programId, scenario, variant, ...data },
      update: data,
      select: { id: true },
    })
    await audit(me.userId, 'PROGRAM_SCRIPT_UPDATED', 'ProgramScript', row.id, { programId, scenario, variant })
    revalidateAll()
    return { ok: true }
  } catch (e) {
    console.error('[PLAYBOOK] save script failed', e)
    return { ok: false, error: "That didn't save. Check your connection and try again." }
  }
}

const ownerReset = z.object({ programId: z.string().min(1).max(60), ...target })

/** "Reset to our version": clears the owner's words, so NowTransformed's program or general message applies. */
export async function resetProgramScript(input: unknown): Promise<Result> {
  const parsed = ownerReset.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Unknown message.' }
  const { programId, scenario, variant } = parsed.data
  const me = await owner(programId)
  if ('error' in me) return { ok: false, error: me.error }
  try {
    await prisma.programScript.updateMany({
      where: { programId, scenario, variant },
      data: { ownerSubject: null, ownerBody: null, ownerUpdatedAt: new Date(), ownerUpdatedById: me.userId },
    })
    await audit(me.userId, 'PROGRAM_SCRIPT_RESET', 'ProgramScript', null, { programId, scenario, variant })
    revalidateAll()
    return { ok: true }
  } catch (e) {
    console.error('[PLAYBOOK] reset script failed', e)
    return { ok: false, error: "That didn't reset. Check your connection and try again." }
  }
}

// ---------- program owners: the "How to pitch" guide ----------

const guideSave = z.object({
  programId: z.string().min(1).max(60),
  guide: z.object({
    summary: z.string().max(2000),
    sections: z.array(z.object({ title: z.string().max(500), points: z.array(z.string().max(2000)).max(50) })).max(50),
  }),
})

export async function saveProgramGuide(input: unknown): Promise<Result> {
  const parsed = guideSave.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'The guide is too long. Shorten it and try again.' }
  const { programId } = parsed.data
  const me = await owner(programId)
  if ('error' in me) return { ok: false, error: me.error }
  const guide = {
    summary: parsed.data.guide.summary.trim(),
    sections: parsed.data.guide.sections.map((s) => ({ title: s.title.trim(), points: s.points.map((p) => p.trim()).filter(Boolean) })),
  }
  const problem = guideProblem(guide)
  if (problem) return { ok: false, error: problem }
  try {
    const data = { ownerGuide: guide as unknown as Prisma.InputJsonValue, ownerUpdatedAt: new Date(), ownerUpdatedById: me.userId }
    const row = await prisma.programPlaybook.upsert({ where: { programId }, create: { programId, ...data }, update: data, select: { id: true } })
    await audit(me.userId, 'PROGRAM_GUIDE_UPDATED', 'ProgramPlaybook', row.id, { programId })
    revalidateAll()
    return { ok: true }
  } catch (e) {
    console.error('[PLAYBOOK] save guide failed', e)
    return { ok: false, error: "That didn't save. Check your connection and try again." }
  }
}

export async function resetProgramGuide(input: unknown): Promise<Result> {
  const parsed = z.object({ programId: z.string().min(1).max(60) }).safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Unknown program.' }
  const { programId } = parsed.data
  const me = await owner(programId)
  if ('error' in me) return { ok: false, error: me.error }
  try {
    await prisma.programPlaybook.updateMany({ where: { programId }, data: { ownerGuide: Prisma.DbNull, ownerUpdatedAt: new Date(), ownerUpdatedById: me.userId } })
    await audit(me.userId, 'PROGRAM_GUIDE_RESET', 'ProgramPlaybook', null, { programId })
    revalidateAll()
    return { ok: true }
  } catch (e) {
    console.error('[PLAYBOOK] reset guide failed', e)
    return { ok: false, error: "That didn't reset. Check your connection and try again." }
  }
}

// ---------- admins: the general messages ----------

const generalSave = z.object({ ...target, ...text, status: z.enum(['LIVE', 'DRAFT']) })

/** LIVE must pass every check; a DRAFT may be saved half-done (members keep seeing the live text). */
export async function saveGeneralScript(input: unknown): Promise<Result> {
  const me = await admin()
  if ('error' in me) return { ok: false, error: me.error }
  const parsed = generalSave.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Please check the message.' }
  const { scenario, variant, status } = parsed.data
  const body = parsed.data.body.replace(/\r\n/g, '\n').trim()
  const subject = variant === 'EMAIL' ? parsed.data.subject?.trim() || null : null
  if (!body) return { ok: false, error: 'Write the message first.' }
  if (!(scenarioOf(scenario).variants as readonly string[]).includes(variant)) return { ok: false, error: 'That kind of message is not used for this situation.' }
  if (status === 'LIVE') {
    const problem = checkScript(scenario, variant, subject, body)
    if (problem) return { ok: false, error: `${problem} You can save it as a draft.` }
  }
  const key = generalKey(scenario, variant)
  try {
    await prisma.outreachTemplate.upsert({
      where: { key_audience: { key, audience: 'ALL' } },
      create: { key, audience: 'ALL', subject, body, status, updatedById: me.userId },
      update: { subject, body, status, updatedById: me.userId },
    })
    await audit(me.userId, 'GENERAL_SCRIPT_UPDATED', 'OutreachTemplate', key, { scenario, variant, status })
    revalidatePath('/admin/outreach-templates')
    revalidateAll()
    return { ok: true }
  } catch (e) {
    console.error('[PLAYBOOK] save general script failed', e)
    return { ok: false, error: "That didn't save. Check your connection and try again." }
  }
}

/** "Reset to our version": deletes the admin's row, so the built-in general message applies again. */
export async function resetGeneralScript(input: unknown): Promise<Result> {
  const me = await admin()
  if ('error' in me) return { ok: false, error: me.error }
  const parsed = z.object(target).safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Unknown message.' }
  const key = generalKey(parsed.data.scenario, parsed.data.variant)
  try {
    await prisma.outreachTemplate.deleteMany({ where: { key, audience: 'ALL' } })
    await audit(me.userId, 'GENERAL_SCRIPT_RESET', 'OutreachTemplate', key, parsed.data)
    revalidatePath('/admin/outreach-templates')
    revalidateAll()
    return { ok: true }
  } catch (e) {
    console.error('[PLAYBOOK] reset general script failed', e)
    return { ok: false, error: "That didn't reset. Check your connection and try again." }
  }
}

