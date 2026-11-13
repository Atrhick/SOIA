/**
 * One-A-Day v2: server-only loaders for program messages and playbooks. Not 'use server' (nothing here
 * is a public endpoint); callers check the session first.
 */
import prisma from '@/lib/prisma'
import { GENERAL_SCRIPTS } from './scripts-defaults'
import { SCENARIOS, isPlaybookGuide, isScenarioKey, isScriptVariant, lineFromHeadline, type GeneralScripts, type LineIdeas, type PlaybookGuide, type Scenario, type ScriptRow } from './scripts'

export interface ProgramPitch {
  programId: string
  /** How messages name the business ("DreamIt LiveIt"); falls back to the program name. */
  business: string
  program: string
  /** {program line}: CoachProgram.messageLine, else the published headline, else a plain fallback. */
  programLine: string
  rows: ScriptRow[]
  /** The guide to show: the owner's version if they edited it, else NowTransformed's. Null = none written yet. */
  guide: PlaybookGuide | null
  guideSource: 'OWNER' | 'PROGRAM' | null
  /** NowTransformed's version (what "Reset" goes back to). */
  defaultGuide: PlaybookGuide | null
  /** Ideas for the personal line: the owner's if their guide has them, else NowTransformed's. */
  lineIdeas: LineIdeas | null
}

/** Pitch data for several programs at once (one query per table). */
export async function loadProgramPitches(programIds: string[]): Promise<Map<string, ProgramPitch>> {
  const ids = Array.from(new Set(programIds.filter(Boolean)))
  const out = new Map<string, ProgramPitch>()
  if (!ids.length) return out
  const [programs, scripts, books] = await Promise.all([
    prisma.coachProgram.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, organization: true, headline: true, messageLine: true, publishedSnapshot: true } }),
    prisma.programScript.findMany({ where: { programId: { in: ids } }, select: { programId: true, scenario: true, variant: true, defaultSubject: true, defaultBody: true, ownerSubject: true, ownerBody: true } }),
    prisma.programPlaybook.findMany({ where: { programId: { in: ids } }, select: { programId: true, businessName: true, defaultGuide: true, ownerGuide: true } }),
  ])
  for (const p of programs) {
    const snap = (p.publishedSnapshot ?? {}) as Record<string, unknown>
    // A published program uses ONLY its approved snapshot (edits waiting for review must never reach messages).
    const published = p.publishedSnapshot != null
    const pick = (k: string, live: string | null) => (typeof snap[k] === 'string' ? (snap[k] as string) : published ? null : live)
    const book = books.find((b) => b.programId === p.id)
    const def = isPlaybookGuide(book?.defaultGuide) ? book!.defaultGuide as unknown as PlaybookGuide : null
    const own = isPlaybookGuide(book?.ownerGuide) ? book!.ownerGuide as unknown as PlaybookGuide : null
    const name = pick('name', p.name) ?? p.name
    out.set(p.id, {
      programId: p.id,
      business: book?.businessName?.trim() || name,
      program: name,
      programLine: p.messageLine?.trim() || lineFromHeadline(pick('headline', p.headline)) || 'a NowTransformed program',
      rows: scripts.filter((s) => s.programId === p.id),
      guide: own ?? def,
      guideSource: own ? 'OWNER' : def ? 'PROGRAM' : null,
      defaultGuide: def,
      lineIdeas: own?.lineIdeas ?? def?.lineIdeas ?? null,
    })
  }
  return out
}

export { GENERAL_SCRIPTS }

/**
 * The general messages members see: GENERAL_SCRIPTS overlaid with the admin's LIVE overrides
 * (OutreachTemplate rows keyed `${scenario}:${variant}`, audience ALL, edited at /admin/outreach-templates).
 * Old channel-keyed rows (TEXT, EMAIL, ...) don't match the key shape and are ignored.
 */
export async function getGeneralScripts(): Promise<GeneralScripts> {
  const rows = await prisma.outreachTemplate.findMany({
    where: { audience: 'ALL', status: 'LIVE', key: { contains: ':' } },
    select: { key: true, subject: true, body: true },
  })
  const out: GeneralScripts = { ...GENERAL_SCRIPTS }
  for (const r of rows) {
    const [scenario, variant] = r.key.split(':')
    if (!isScenarioKey(scenario) || !isScriptVariant(variant) || !r.body.trim()) continue
    if (!(SCENARIOS as readonly Scenario[]).find((s) => s.key === scenario)?.variants.includes(variant)) continue
    out[`${scenario}:${variant}`] = { subject: variant === 'EMAIL' ? r.subject : null, body: r.body }
  }
  return out
}
