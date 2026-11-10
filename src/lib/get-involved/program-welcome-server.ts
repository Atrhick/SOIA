/**
 * Server helpers for program welcome emails. Not 'use server': nothing here is a public endpoint.
 * - Which program a Get Involved sign-up came through (per-program share links).
 * - Which note the welcome email uses (approved notes only).
 * - Drafting a note with AI when a program page is published.
 */
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { aiDraftingAvailable, draftWelcomeNoteWithAI } from '@/lib/ai/welcome-note-ai'

/** Programs a user owns, as a coach or as an ambassador. */
export const ownedByUser = (userId: string): Prisma.CoachProgramWhereInput => ({
  OR: [{ coach: { userId } }, { ambassador: { userId } }],
})

/** Live on /p/[slug]: published, with a snapshot (unpublishing sets it to SQL NULL). */
const LIVE: Prisma.CoachProgramWhereInput = { status: 'PUBLISHED', NOT: { publishedSnapshot: { equals: Prisma.DbNull } } }

export interface InviteProgram {
  id: string
  slug: string
  name: string
  /** The approved program paragraph, or null if none is approved yet (standard welcome email). */
  note: string | null
}

const SELECT = { id: true, slug: true, name: true, welcomeNote: true, welcomeNoteApprovedAt: true } as const
const toInvite = (p: { id: string; slug: string; name: string; welcomeNote: string | null; welcomeNoteApprovedAt: Date | null }): InviteProgram => ({
  id: p.id, slug: p.slug, name: p.name, note: p.welcomeNoteApprovedAt && p.welcomeNote ? p.welcomeNote : null,
})

/** A program share link (/join/[slug]/[program]): the program must be live and owned by the inviter. */
export async function inviterProgramBySlug(inviterId: string, programSlug: string): Promise<InviteProgram | null> {
  if (!programSlug || programSlug.length > 120) return null
  const p = await prisma.coachProgram.findFirst({ where: { AND: [{ slug: programSlug }, LIVE, ownedByUser(inviterId)] }, select: SELECT })
  return p ? toInvite(p) : null
}

/**
 * The program for a sign-up. With a program link, that program; otherwise (the inviter's main link,
 * or "Add someone") the inviter's most recently published program that has an approved note.
 */
export async function programForSignup(inviterId: string | null, programSlug?: string | null): Promise<InviteProgram | null> {
  if (!inviterId) return null
  if (programSlug) {
    const p = await inviterProgramBySlug(inviterId, programSlug)
    if (p) return p
  }
  const p = await prisma.coachProgram.findFirst({
    where: { AND: [LIVE, ownedByUser(inviterId), { welcomeNoteApprovedAt: { not: null } }, { welcomeNote: { not: null } }] },
    orderBy: { reviewedAt: 'desc' },
    select: SELECT,
  })
  return p ? toInvite(p) : null
}

/** The inviter's live programs, for share links on One-A-Day. */
export async function invitePrograms(userId: string): Promise<InviteProgram[]> {
  const rows = await prisma.coachProgram.findMany({ where: { AND: [LIVE, ownedByUser(userId)] }, orderBy: { reviewedAt: 'desc' }, select: SELECT })
  return rows.map(toInvite)
}

/**
 * Called after a program page is approved and published. Drafts a note with AI from the published
 * page unless the owner already has an approved note (their own work is never overwritten).
 * Never throws: publishing must not fail because the AI is unavailable.
 */
export async function draftWelcomeNoteOnPublish(programId: string): Promise<void> {
  try {
    if (!aiDraftingAvailable()) return
    const p = await prisma.coachProgram.findUnique({
      where: { id: programId },
      select: {
        id: true, name: true, organization: true, pageTitle: true, headline: true, targetMarket: true, servicesDescription: true, programDescription: true, coachBio: true,
        welcomeNoteApprovedAt: true, welcomeNoteSource: true, welcomeNote: true, publishedSnapshot: true,
      },
    })
    if (!p || p.welcomeNoteApprovedAt) return
    // A hand-written draft waiting for approval is kept too.
    if (p.welcomeNote && p.welcomeNoteSource === 'MANUAL') return
    const snap = (p.publishedSnapshot ?? {}) as Record<string, string | null>
    const pick = (k: string, live: string | null) => (typeof snap[k] === 'string' ? snap[k] : live)
    const r = await draftWelcomeNoteWithAI({
      name: pick('name', p.name) ?? p.name,
      organization: pick('organization', p.organization) ?? p.organization,
      pageTitle: pick('pageTitle', p.pageTitle),
      headline: pick('headline', p.headline),
      targetMarket: pick('targetMarket', p.targetMarket),
      servicesDescription: pick('servicesDescription', p.servicesDescription),
      programDescription: pick('programDescription', p.programDescription),
      ownerBio: pick('coachBio', p.coachBio),
    })
    if (!r.ok) return
    await prisma.coachProgram.updateMany({
      // Only if nobody approved or hand-wrote one meanwhile.
      where: { id: p.id, welcomeNoteApprovedAt: null, OR: [{ welcomeNoteSource: null }, { welcomeNoteSource: 'AI' }] },
      data: { welcomeNote: r.note, welcomeNoteSource: 'AI', welcomeNoteDraftedAt: new Date() },
    })
  } catch (e) {
    console.error('[WELCOME-NOTE] draft on publish failed', e)
  }
}
