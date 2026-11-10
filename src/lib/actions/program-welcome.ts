'use server'

/**
 * The welcome-email note on a program page: read, edit, draft with AI, approve.
 * The owner (coach or ambassador) or an admin can do this. Impersonating admins can look but not change.
 * Emails use the note only while it is approved; any edit clears the approval.
 */
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { aiDraftingAvailable, draftWelcomeNoteWithAI } from '@/lib/ai/welcome-note-ai'
import { checkWelcomeNote, cleanWelcomeNote } from '@/lib/get-involved/program-welcome'
import { rateLimited, userDisplayName } from '@/lib/get-involved/server'

export interface WelcomePanelData {
  programId: string
  programName: string
  companyName: string
  ownerName: string | null
  note: string
  source: 'AI' | 'MANUAL' | null
  draftedAt: string | null
  approvedAt: string | null
  live: boolean
  aiAvailable: boolean
  readOnly: boolean
}

type Access = { ok: false; error: string } | { ok: true; userId: string; readOnly: boolean; program: NonNullable<Awaited<ReturnType<typeof loadProgram>>> }

const loadProgram = (id: string) =>
  prisma.coachProgram.findUnique({
    where: { id },
    select: {
      id: true, name: true, organization: true, pageTitle: true, headline: true, targetMarket: true, servicesDescription: true, programDescription: true, coachBio: true,
      status: true, publishedSnapshot: true, welcomeNote: true, welcomeNoteSource: true, welcomeNoteDraftedAt: true, welcomeNoteApprovedAt: true,
      coach: { select: { userId: true } }, ambassador: { select: { userId: true } },
    },
  })

async function access(programId: string, write: boolean): Promise<Access> {
  const session = await auth()
  if (!session) return { ok: false, error: 'Unauthorized' }
  const program = await loadProgram(String(programId ?? ''))
  if (!program) return { ok: false, error: 'Program not found' }
  const role = session.user.role
  const ownerUserId = program.coach?.userId ?? program.ambassador?.userId ?? null
  const isOwner = (role === 'COACH' || role === 'AMBASSADOR') && ownerUserId === session.user.id
  if (role !== 'ADMIN' && !isOwner) return { ok: false, error: 'Program not found' }
  const impersonating = Boolean(session.user.isImpersonating)
  if (write && impersonating) return { ok: false, error: 'Not available while impersonating another user' }
  return { ok: true, userId: session.user.id, readOnly: impersonating, program }
}

function refresh(programId: string) {
  revalidatePath(`/coach/programs/${programId}`)
  revalidatePath(`/ambassador/programs/${programId}`)
  revalidatePath('/admin/programs')
  revalidatePath('/coach/one-a-day')
  revalidatePath('/ambassador/one-a-day')
}

export async function getWelcomePanel(programId: string): Promise<WelcomePanelData | { error: string }> {
  const a = await access(programId, false)
  if (!a.ok) return { error: a.error }
  const p = a.program
  const ownerId = p.coach?.userId ?? p.ambassador?.userId ?? null
  const owner = ownerId ? await userDisplayName(ownerId) : null
  return {
    programId: p.id,
    programName: p.name,
    companyName: p.organization,
    ownerName: owner?.full ?? null,
    note: p.welcomeNote ?? '',
    source: p.welcomeNoteSource === 'AI' || p.welcomeNoteSource === 'MANUAL' ? p.welcomeNoteSource : null,
    draftedAt: p.welcomeNoteDraftedAt?.toISOString() ?? null,
    approvedAt: p.welcomeNoteApprovedAt?.toISOString() ?? null,
    live: p.status === 'PUBLISHED' && p.publishedSnapshot !== null,
    aiAvailable: aiDraftingAvailable(),
    readOnly: a.readOnly,
  }
}

// aiDraft: the AI text the person started from in this editing session, only used to label the source.
const saveSchema = z.object({ note: z.string().max(5000), approve: z.boolean(), aiDraft: z.string().max(5000).optional() })

/** Save the paragraph. With approve, emails start using it now; without, it is a draft (not used). */
export async function saveWelcomeNote(programId: string, input: z.input<typeof saveSchema>): Promise<{ success: true; message: string } | { error: string }> {
  const a = await access(programId, true)
  if (!a.ok) return { error: a.error }
  const parsed = saveSchema.safeParse(input)
  if (!parsed.success) return { error: 'Please check the text.' }
  const note = cleanWelcomeNote(parsed.data.note)
  const problem = checkWelcomeNote(note)
  if (problem) return { error: problem }
  const p = a.program
  // Unchanged AI text keeps its AI label; anything a person changed is theirs.
  const unchangedAi = (p.welcomeNoteSource === 'AI' && p.welcomeNote && cleanWelcomeNote(p.welcomeNote) === note) || (parsed.data.aiDraft && cleanWelcomeNote(parsed.data.aiDraft) === note)
  const source = unchangedAi ? 'AI' : 'MANUAL'
  const now = new Date()
  await prisma.$transaction([
    prisma.coachProgram.update({
      where: { id: p.id },
      data: {
        welcomeNote: note,
        welcomeNoteSource: source,
        welcomeNoteApprovedAt: parsed.data.approve ? now : null,
        welcomeNoteApprovedBy: parsed.data.approve ? a.userId : null,
      },
    }),
    prisma.auditLog.create({ data: { userId: a.userId, action: parsed.data.approve ? 'APPROVE_WELCOME_NOTE' : 'SAVE_WELCOME_NOTE', entityType: 'CoachProgram', entityId: p.id, details: JSON.stringify({ source, length: note.length }) } }),
  ])
  refresh(p.id)
  return { success: true, message: parsed.data.approve ? 'Saved. New sign-ups get this email from now on.' : 'Draft saved. People still get the standard email until you click "Use this email".' }
}

/** Stop using the program email (back to the standard welcome). The text is kept. */
export async function stopWelcomeNote(programId: string): Promise<{ success: true } | { error: string }> {
  const a = await access(programId, true)
  if (!a.ok) return { error: a.error }
  await prisma.$transaction([
    prisma.coachProgram.update({ where: { id: a.program.id }, data: { welcomeNoteApprovedAt: null, welcomeNoteApprovedBy: null } }),
    prisma.auditLog.create({ data: { userId: a.userId, action: 'STOP_WELCOME_NOTE', entityType: 'CoachProgram', entityId: a.program.id } }),
  ])
  refresh(a.program.id)
  return { success: true }
}

/** Ask AI for a fresh draft from the program page as it is now. Returns the text; nothing is saved. */
export async function draftWelcomeNote(programId: string): Promise<{ note: string } | { error: string }> {
  const a = await access(programId, true)
  if (!a.ok) return { error: a.error }
  if (!aiDraftingAvailable()) return { error: 'AI drafting is not switched on yet. You can write the paragraph yourself.' }
  if (rateLimited(`wn-draft:${a.userId}`, 20, 24 * 60 * 60_000) || rateLimited(`wn-draft-p:${a.program.id}`, 1, 15_000)) {
    return { error: 'Please wait a moment before asking for another draft.' }
  }
  const p = a.program
  const r = await draftWelcomeNoteWithAI({
    name: p.name, organization: p.organization, pageTitle: p.pageTitle, headline: p.headline, targetMarket: p.targetMarket,
    servicesDescription: p.servicesDescription, programDescription: p.programDescription, ownerBio: p.coachBio,
  })
  if (!r.ok) return { error: r.reason === 'empty' ? 'The program page needs a bit more detail (description, who it is for) before AI can draft this.' : 'AI drafting is not available right now. Please try again, or write it yourself.' }
  await prisma.coachProgram.update({ where: { id: p.id }, data: { welcomeNoteDraftedAt: new Date() } })
  return { note: r.note }
}
