/**
 * Portfolio hand-in (server only, NOT 'use server': called by the upload route,
 * which takes files bigger than the 2 MB server-action limit).
 */
import { randomBytes } from 'crypto'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { saveFile } from '@/lib/storage'
import { checkPortfolioFile } from './portfolio-file'

export const handInSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  weekNo: z.coerce.number().int().min(1, 'Please pick a week.').max(52, 'Please pick a week.'),
  title: z.string().trim().min(1, 'Please give your piece a title.').max(200, 'That title is a bit long. Please keep it under 200 characters.'),
  body: z.string().max(20000, 'Your writing is very long. Please keep it under 20,000 characters.').optional(),
})

/** The group an ambassador is in right now (still a member, group active), newest first. */
export async function activeGroupFor(ambassadorId: string) {
  const m = await prisma.ambassadorGroupMember.findFirst({
    where: { ambassadorId, leftAt: null, group: { isActive: true } },
    orderBy: { joinedAt: 'desc' },
    include: { group: { select: { id: true, name: true, startDate: true, weeks: true } } },
  })
  return m?.group ?? null
}

export type HandInResult = { ok: true; id: string } | { error: string }

export async function handInPortfolio(
  ambassadorId: string,
  input: { id?: string; weekNo: unknown; title: unknown; body?: unknown },
  file: { name: string; data: Buffer } | null,
): Promise<HandInResult> {
  const parsed = handInSchema.safeParse({
    id: input.id || undefined,
    weekNo: input.weekNo,
    title: input.title,
    body: typeof input.body === 'string' ? input.body : undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Please check your piece and try again.' }
  const { id, weekNo, title } = parsed.data
  const body = parsed.data.body?.trim() || null

  let existing: { id: string; status: string; fileUrl: string | null; fileType: string | null } | null = null
  if (id) {
    existing = await prisma.portfolioSubmission.findFirst({
      where: { id, ambassadorId },
      select: { id: true, status: true, fileUrl: true, fileType: true },
    })
    if (!existing) return { error: "We couldn't find that piece. Please reload the page." }
    if (existing.status === 'REVIEWED') return { error: 'Your coach has already replied to this piece, so it can no longer be changed.' }
  }

  if (!body && !file && !existing?.fileUrl) return { error: 'Please write something or add a photo or PDF.' }

  let fileUrl: string | null = null
  let fileType: string | null = null
  if (file) {
    const kind = checkPortfolioFile(file.name, file.data)
    if ('error' in kind) return kind
    const key = `portfolio/${ambassadorId}/${randomBytes(12).toString('hex')}.${kind.ext}`
    fileUrl = await saveFile(key, file.data, kind.contentType)
    fileType = kind.contentType
  }

  const group = await activeGroupFor(ambassadorId)

  // Editing a piece the coach hasn't replied to yet. Conditional, so a reply landing at the same moment wins.
  if (existing && existing.status === 'SUBMITTED') {
    const res = await prisma.portfolioSubmission.updateMany({
      where: { id: existing.id, ambassadorId, status: 'SUBMITTED' },
      data: {
        weekNo, title, body,
        ...(file ? { fileUrl, fileType } : {}),
        submittedAt: new Date(),
      },
    })
    if (res.count === 0) return { error: 'Your coach replied while you were editing. Please reload the page to see what they said.' }
    return { ok: true, id: existing.id }
  }

  // New piece, or handing in again after "Please redo" (keeps the old piece and its feedback).
  const created = await prisma.portfolioSubmission.create({
    data: {
      ambassadorId,
      groupId: group?.id ?? null,
      weekNo,
      title,
      body,
      fileUrl: file ? fileUrl : existing?.fileUrl ?? null,
      fileType: file ? fileType : existing?.fileType ?? null,
      status: 'SUBMITTED',
    },
    select: { id: true },
  })
  return { ok: true, id: created.id }
}
