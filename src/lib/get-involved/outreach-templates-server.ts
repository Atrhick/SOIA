/**
 * Server-only reads of share-kit templates. Not 'use server': nothing here is a public endpoint.
 * Always read templates through these helpers (no row = the code default in outreach-templates.ts).
 */
import prisma from '@/lib/prisma'
import { TemplateKey, TemplateRow, ResolvedTemplate, resolveAll } from './outreach-templates'

export async function templateRows(): Promise<TemplateRow[]> {
  return prisma.outreachTemplate.findMany({ select: { key: true, audience: true, subject: true, body: true, status: true } })
}

/** Every template as a COACH or AMBASSADOR sees it (LIVE role row > LIVE ALL row > default). */
export async function getOutreachTemplates(role: string): Promise<Record<TemplateKey, ResolvedTemplate>> {
  return resolveAll(await templateRows(), role)
}

/** The admin's saved general messages (live and draft), keyed `${scenario}:${variant}`, for /admin/outreach-templates. */
import type { GeneralScriptRow } from '@/components/get-involved/playbook/helpers'
export type { GeneralScriptRow }

export async function generalScriptRows(): Promise<GeneralScriptRow[]> {
  const rows = await prisma.outreachTemplate.findMany({
    where: { audience: 'ALL', key: { contains: ':' } },
    select: { key: true, subject: true, body: true, status: true, updatedAt: true },
  })
  return rows.map((r) => ({ key: r.key, subject: r.subject, body: r.body, status: r.status === 'DRAFT' ? 'DRAFT' : 'LIVE', updatedAt: r.updatedAt.toISOString() }))
}
