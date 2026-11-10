/**
 * Role Settings: per-role configuration and versioned terms. Server only, not 'use server'
 * (nothing here is a public endpoint; callers check auth first).
 *
 * No row in get_involved_role_configs = the built-in defaults (DEFAULT_ROLE_CONFIGS in core.ts),
 * so nothing has to be seeded. Terms are append-only versions; the live one is the highest version.
 */
import { z } from 'zod'
import { GetInvolvedRole, Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import {
  GET_INVOLVED_ROLES, GetInvolvedRoleValue, QUESTION_COUNT, RoleConfig, defaultTermsBody, isGetInvolvedRole, roleConfigFromRow,
} from './core'

type Db = Prisma.TransactionClient | typeof prisma

export async function getRoleConfig(role: GetInvolvedRoleValue, db: Db = prisma): Promise<RoleConfig> {
  const row = await db.getInvolvedRoleConfig.findUnique({ where: { role: role as GetInvolvedRole } })
  return roleConfigFromRow(role, row as unknown as Record<string, unknown> | null)
}

/** All nine roles in display order, saved or default. */
export async function listRoleConfigs(db: Db = prisma): Promise<RoleConfig[]> {
  const rows = await db.getInvolvedRoleConfig.findMany()
  return GET_INVOLVED_ROLES.map((r) => roleConfigFromRow(r, (rows.find((x) => x.role === r) ?? null) as unknown as Record<string, unknown> | null))
}

/**
 * The settings that apply to this prospect: the snapshot taken when the role was chosen, else the
 * live settings. null when no role has been chosen.
 */
export async function prospectRoleConfig(p: { journeyRole: string | null; roleConfigSnapshot: Prisma.JsonValue | null }, db: Db = prisma): Promise<RoleConfig | null> {
  if (!isGetInvolvedRole(p.journeyRole)) return null
  if (p.roleConfigSnapshot && typeof p.roleConfigSnapshot === 'object' && !Array.isArray(p.roleConfigSnapshot)) {
    return roleConfigFromRow(p.journeyRole, p.roleConfigSnapshot as Record<string, unknown>)
  }
  return getRoleConfig(p.journeyRole, db)
}

// ---------- terms ----------

export interface LiveTerms {
  /** null = never saved (the default placeholder, version 0). Use ensureLiveTerms before binding a prospect. */
  id: string | null
  role: GetInvolvedRoleValue
  version: number
  body: string
  createdAt: Date | null
}

export async function getLiveTerms(role: GetInvolvedRoleValue, db: Db = prisma): Promise<LiveTerms> {
  const row = await db.getInvolvedRoleTerms.findFirst({ where: { role: role as GetInvolvedRole }, orderBy: { version: 'desc' } })
  if (!row) return { id: null, role, version: 0, body: defaultTermsBody(role), createdAt: null }
  return { id: row.id, role, version: row.version, body: row.body, createdAt: row.createdAt }
}

/** The live terms as a real row (creates version 1 from the default text if none exists). Use when a prospect accepts. */
export async function ensureLiveTerms(tx: Prisma.TransactionClient, role: GetInvolvedRoleValue): Promise<LiveTerms & { id: string }> {
  const live = await getLiveTerms(role, tx)
  if (live.id) return live as LiveTerms & { id: string }
  try {
    const row = await tx.getInvolvedRoleTerms.create({ data: { role: role as GetInvolvedRole, version: 1, body: live.body } })
    return { id: row.id, role, version: 1, body: row.body, createdAt: row.createdAt }
  } catch (e) {
    // Someone else created version 1 at the same moment.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return (await getLiveTerms(role, tx)) as LiveTerms & { id: string }
    throw e
  }
}

/** One saved version, e.g. the one a prospect accepted (Prospect.acceptedTermsId). */
export async function termsById(id: string, db: Db = prisma) {
  return db.getInvolvedRoleTerms.findUnique({ where: { id } })
}

/** Saves a new version only when the text changed. Returns the live version afterwards. */
export async function saveTermsVersion(tx: Prisma.TransactionClient, role: GetInvolvedRoleValue, body: string, byUserId: string | null): Promise<LiveTerms> {
  const live = await getLiveTerms(role, tx)
  const clean = body.replace(/\r\n/g, '\n').trim()
  if (live.id && live.body === clean) return live
  if (!live.id && clean === live.body) return live // still the default text: nothing to save
  const row = await tx.getInvolvedRoleTerms.create({ data: { role: role as GetInvolvedRole, version: live.version + 1, body: clean, createdById: byUserId } })
  return { id: row.id, role, version: row.version, body: row.body, createdAt: row.createdAt }
}

// ---------- saving Role Settings ----------

const AGE = z.enum(['UNDER_18', 'AGE_18_24', 'AGE_25_55', 'AGE_56_PLUS'])
const httpsUrl = z.string().trim().max(500).refine((v) => v === '' || /^https:\/\//i.test(v), 'Links must start with https://')

export const questionInputSchema = z.object({
  text: z.string().trim().min(1, 'Enter the question').max(500),
  type: z.enum(['SHORT_TEXT', 'CHOICE', 'SCALE_1_5']),
  choices: z.array(z.string().trim().min(1).max(200)).max(8).default([]),
}).superRefine((q, ctx) => {
  if (q.type === 'CHOICE' && q.choices.length < 2) ctx.addIssue({ code: 'custom', path: ['choices'], message: 'A choice question needs at least 2 options' })
})

/** What the Role Settings form submits for one role. Field paths match the form so errors can sit next to fields. */
export const roleConfigInputSchema = z.object({
  role: z.enum(GET_INVOLVED_ROLES as unknown as [GetInvolvedRoleValue, ...GetInvolvedRoleValue[]]),
  label: z.string().trim().min(1, 'Enter a name').max(80),
  whoFor: z.string().trim().max(500).default(''),
  ageRanges: z.array(AGE).min(1, 'Pick at least one age range'),
  active: z.boolean(),
  priceCents: z.number().int().min(0, 'Price cannot be negative').max(10_000_000),
  priceNote: z.string().trim().max(40).default(''),
  billing: z.enum(['ONE_TIME', 'MONTHLY', 'YEARLY', 'FREE', 'GIFT']),
  questions: z.array(questionInputSchema).length(QUESTION_COUNT, `Each role has exactly ${QUESTION_COUNT} questions`),
  orientationUrl: httpsUrl.default(''),
  orientationMinutes: z.number().int().min(1).max(600).nullable().default(null),
  orientationPoints: z.array(z.string().trim().max(300)).max(10).default([]),
  comprehensionCheck: z.boolean().default(false),
  comprehensionQuestion: z.string().trim().max(500).default(''),
  handoffUrl: httpsUrl.default(''),
  terms: z.string().max(50_000).default(''),
}).superRefine((d, ctx) => {
  const paidBilling = d.billing === 'ONE_TIME' || d.billing === 'MONTHLY' || d.billing === 'YEARLY'
  if (paidBilling && d.priceCents === 0) ctx.addIssue({ code: 'custom', path: ['priceCents'], message: 'Enter a price, or set billing to Free' })
  if (d.comprehensionCheck && !d.comprehensionQuestion) ctx.addIssue({ code: 'custom', path: ['comprehensionQuestion'], message: 'Enter the check question, or turn the check off' })
})
export type RoleConfigInput = z.input<typeof roleConfigInputSchema>

/**
 * Validate and save one role's settings plus (if changed) a new terms version, in one transaction,
 * with an audit log row. The caller must already have checked ADMIN and not impersonating.
 * Returns field errors keyed by dotted path (e.g. "questions.1.text") so the form can show them inline.
 */
export async function saveRoleConfig(input: unknown, byUserId: string):
  Promise<{ ok: true; config: RoleConfig; terms: LiveTerms } | { ok: false; error: string; fieldErrors: Record<string, string> }> {
  const parsed = roleConfigInputSchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const i of parsed.error.issues) { const k = i.path.join('.'); if (!fieldErrors[k]) fieldErrors[k] = i.message }
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Please check the form', fieldErrors }
  }
  const { terms, role, ...d } = parsed.data
  const data = {
    label: d.label,
    whoFor: d.whoFor || null,
    ageRanges: d.ageRanges,
    active: d.active,
    priceCents: d.billing === 'FREE' || d.billing === 'GIFT' ? 0 : d.priceCents,
    priceNote: d.priceNote || null,
    billing: d.billing,
    questions: d.questions.map((q) => ({ text: q.text, type: q.type, choices: q.type === 'CHOICE' ? q.choices : [] })),
    orientationUrl: d.orientationUrl || null,
    orientationMinutes: d.orientationMinutes,
    orientationPoints: d.orientationPoints.filter(Boolean),
    comprehensionCheck: d.comprehensionCheck,
    comprehensionQuestion: d.comprehensionQuestion || null,
    handoffUrl: d.handoffUrl || null,
    updatedById: byUserId,
  }
  const result = await prisma.$transaction(async (tx) => {
    const row = await tx.getInvolvedRoleConfig.upsert({ where: { role }, create: { role, ...data }, update: data })
    const live = terms.trim() ? await saveTermsVersion(tx, role, terms, byUserId) : await getLiveTerms(role, tx)
    await tx.auditLog.create({ data: { userId: byUserId, action: 'SAVE_ROLE_SETTINGS', entityType: 'GetInvolvedRoleConfig', entityId: row.id, details: JSON.stringify({ role, termsVersion: live.version }) } })
    return { row, live }
  })
  return { ok: true, config: roleConfigFromRow(role, result.row as unknown as Record<string, unknown>), terms: result.live }
}
