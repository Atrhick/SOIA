/**
 * Program info workflow: writing a DRAFT version (team action saveDraft and scripts/program-info/save-draft.ts).
 * Takes the database client as a parameter and uses relative imports only, so the script can run it with
 * its own PrismaClient. Not 'use server'.
 */
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { OfferPageSchema, type OfferPage } from '../get-involved/offer-page'
import { checkWelcomeNote, cleanWelcomeNote } from '../get-involved/program-welcome'
import { mergeAnswers } from './progress'

export const MESSAGE_LINE_MAX = 160

export interface DraftInput {
  /** undefined = keep what the current draft has; null = no page in this version (the live one is kept). */
  offerPage?: OfferPage | null
  welcomeNote?: string | null
  messageLine?: string | null
}

const RawDraft = z.object({
  offerPage: z.unknown().optional(),
  welcomeNote: z.string().max(5000).nullable().optional(),
  messageLine: z.string().max(1000).nullable().optional(),
})

/** Checks a draft: the page against OfferPageSchema, the welcome paragraph and the invitation line. */
export function parseDraftInput(input: unknown): { ok: true; data: DraftInput } | { ok: false; error: string } {
  const raw = RawDraft.safeParse(input)
  if (!raw.success) return { ok: false, error: raw.error.issues[0]?.message ?? 'Check the draft' }
  const out: DraftInput = {}
  if (raw.data.offerPage !== undefined) {
    if (raw.data.offerPage === null) out.offerPage = null
    else {
      const p = OfferPageSchema.safeParse(raw.data.offerPage)
      if (!p.success) {
        const i = p.error.issues[0]
        return { ok: false, error: `Page: ${i ? `${i.path.join('.')}: ${i.message}` : 'does not match the page format'}` }
      }
      out.offerPage = p.data
    }
  }
  if (raw.data.welcomeNote !== undefined) {
    if (raw.data.welcomeNote === null || !raw.data.welcomeNote.trim()) out.welcomeNote = null
    else {
      const note = cleanWelcomeNote(raw.data.welcomeNote)
      const problem = checkWelcomeNote(note)
      if (problem) return { ok: false, error: `Welcome email paragraph: ${problem}` }
      out.welcomeNote = note
    }
  }
  if (raw.data.messageLine !== undefined) {
    const line = (raw.data.messageLine ?? '').replace(/\s+/g, ' ').trim().replace(/[.\s]+$/, '')
    if (line.length > MESSAGE_LINE_MAX) return { ok: false, error: `Invitation line: at most ${MESSAGE_LINE_MAX} characters` }
    out.messageLine = line || null
  }
  if (out.offerPage === undefined && out.welcomeNote === undefined && out.messageLine === undefined) {
    return { ok: false, error: 'The draft is empty' }
  }
  return { ok: true, data: out }
}

type Db = Prisma.TransactionClient

/**
 * Creates the page's DRAFT version, or updates the one that exists (there is at most one). A new draft
 * starts from the latest version's content, so a team member can change only the welcome paragraph.
 * Snapshots the answers (page + shared) as they are now. Run it inside a transaction.
 */
export async function writeDraftVersion(db: Db, programId: string, data: DraftInput, actorId: string | null): Promise<{ versionId: string; number: number; created: boolean }> {
  const program = await db.coachProgram.findUnique({ where: { id: programId }, select: { id: true, infoAnswers: true, parentProgramId: true } })
  if (!program) throw new Error('Program not found')
  const root = program.parentProgramId
    ? await db.coachProgram.findUnique({ where: { id: program.parentProgramId }, select: { sharedAnswers: true } })
    : await db.coachProgram.findUnique({ where: { id: programId }, select: { sharedAnswers: true } })
  const answers = mergeAnswers(program.infoAnswers, root?.sharedAnswers) as Prisma.InputJsonValue

  const pageJson = (v: OfferPage | null) => (v === null ? Prisma.DbNull : (v as unknown as Prisma.InputJsonValue))
  const existing = await db.programPageVersion.findFirst({ where: { programId, status: 'DRAFT' }, orderBy: { number: 'desc' } })
  if (existing) {
    await db.programPageVersion.update({
      where: { id: existing.id },
      data: {
        answers,
        ...(data.offerPage !== undefined ? { offerPage: pageJson(data.offerPage) } : {}),
        ...(data.welcomeNote !== undefined ? { welcomeNote: data.welcomeNote } : {}),
        ...(data.messageLine !== undefined ? { messageLine: data.messageLine } : {}),
        createdById: actorId ?? existing.createdById,
      },
    })
    return { versionId: existing.id, number: existing.number, created: false }
  }
  const latest = await db.programPageVersion.findFirst({ where: { programId }, orderBy: { number: 'desc' } })
  const number = (latest?.number ?? 0) + 1
  const pick = <T,>(given: T | undefined, prev: T | null | undefined): T | null => (given !== undefined ? given : (prev ?? null))
  const offerPage = pick(data.offerPage, (latest?.offerPage as OfferPage | null | undefined) ?? null)
  const created = await db.programPageVersion.create({
    data: {
      programId,
      number,
      answers,
      offerPage: pageJson(offerPage),
      welcomeNote: pick(data.welcomeNote, latest?.welcomeNote),
      messageLine: pick(data.messageLine, latest?.messageLine),
      status: 'DRAFT',
      createdById: actorId,
    },
  })
  return { versionId: created.id, number, created: true }
}
