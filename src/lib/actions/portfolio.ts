'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { sendPushToUser } from '@/lib/push'

const replySchema = z.object({
  id: z.string().min(1).max(64),
  feedback: z.string().trim().min(1, 'Please write a few words for them.').max(5000, 'Please keep your reply under 5,000 characters.'),
  decision: z.enum(['REVIEWED', 'REDO']),
})

/** Coach (own ambassadors only) or admin replies to a handed-in piece. */
export async function replyToPortfolio(input: { id: string; feedback: string; decision: 'REVIEWED' | 'REDO' }) {
  const session = await auth()
  if (!session || (session.user.role !== 'COACH' && session.user.role !== 'ADMIN')) return { error: 'Please sign in again.' }
  if (session.user.isImpersonating) return { error: "You're viewing as someone else, so you can't reply for them." }

  const parsed = replySchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Please check your reply.' }
  const { id, feedback, decision } = parsed.data

  const piece = await prisma.portfolioSubmission.findUnique({
    where: { id },
    select: { id: true, status: true, title: true, ambassador: { select: { coachId: true, userId: true } } },
  })
  if (!piece) return { error: "We couldn't find that piece. Please reload the page." }

  if (session.user.role === 'COACH') {
    const coach = await prisma.coachProfile.findUnique({ where: { userId: session.user.id }, select: { id: true } })
    if (!coach || coach.id !== piece.ambassador.coachId) return { error: "You can only reply to your own ambassadors' work." }
  }

  // Only a piece that is waiting for a reply; the ambassador can't be editing it at the same time.
  const res = await prisma.portfolioSubmission.updateMany({
    where: { id, status: 'SUBMITTED' },
    data: { status: decision, feedback, feedbackById: session.user.id, feedbackAt: new Date() },
  })
  if (res.count === 0) return { error: 'Someone already replied to this piece, or it changed. Please reload the page.' }

  if (piece.ambassador.userId) {
    try {
      await sendPushToUser(piece.ambassador.userId, {
        title: decision === 'REDO' ? 'Your coach asked you to redo a piece' : 'Your coach replied to your work',
        body: `"${piece.title.slice(0, 80)}": tap to read what they said.`,
        url: '/ambassador/portfolio',
        tag: `portfolio-${piece.id}`,
      })
    } catch (e) {
      console.error('Portfolio push failed', e)
    }
  }

  revalidatePath('/coach/portfolio')
  revalidatePath('/ambassador/portfolio')
  return { success: true }
}
