'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { generateLessonAudio } from '@/lib/lessons/audio'

const idSchema = z.string().min(1).max(100)

export type LessonAudioStatus = {
  lessonId: string
  status: 'PENDING' | 'READY' | 'FAILED'
  error: string | null
  url: string | null
  /** Made with paragraph timings (sections + follow-along). False = older audio: remake to add them. */
  followAlong: boolean
}

type AudioRow = { lessonId: string; status: string; error: string | null; url: string | null; segments: unknown }
const toStatus = (r: AudioRow): LessonAudioStatus => ({
  lessonId: r.lessonId,
  status: r.status as LessonAudioStatus['status'],
  error: r.error,
  url: r.url,
  followAlong: r.segments !== null && r.segments !== undefined,
})

/** Admin: status of the audio for these lessons (missing = never made). */
export async function getLessonAudioStatuses(lessonIds: string[]) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') return { error: 'Unauthorized - Admin only' }
  const ids = z.array(idSchema).max(500).safeParse(lessonIds)
  if (!ids.success) return { error: 'Invalid lessons' }
  const rows = await prisma.lessonAudio.findMany({
    where: { lessonId: { in: ids.data } },
    select: { lessonId: true, status: true, error: true, url: true, segments: true },
  })
  return { audio: rows.map(toStatus) }
}

/** Admin: make (or remake) the audio now and wait for the result. */
export async function makeLessonAudio(lessonId: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') return { error: 'Unauthorized - Admin only' }
  if (session.user.isImpersonating) return { error: 'Switch back to your own account to make audio.' }
  const id = idSchema.safeParse(lessonId)
  if (!id.success) return { error: 'Invalid lesson' }

  // A remake request always regenerates, even if the text has not changed.
  await prisma.lessonAudio.updateMany({ where: { lessonId: id.data, status: 'READY' }, data: { textHash: '' } })
  const result = await generateLessonAudio(id.data)
  if (result.status === 'EMPTY') return { error: 'This lesson has no text to read aloud yet.' }
  const lesson = await prisma.lMSLesson.findUnique({ where: { id: id.data }, select: { module: { select: { courseId: true } } } })
  if (lesson) revalidatePath(`/admin/lms/${lesson.module.courseId}`)
  const row = await prisma.lessonAudio.findUnique({
    where: { lessonId: id.data },
    select: { lessonId: true, status: true, error: true, url: true, segments: true },
  })
  return { success: true, audio: row ? toStatus(row) : null }
}

/** Learner: save where they are in the lesson audio. */
export async function saveListenPosition(lessonId: string, positionSec: number, completed = false) {
  const session = await auth()
  if (!session) return { error: 'Unauthorized' }
  const parsed = z
    .object({ lessonId: idSchema, positionSec: z.number().finite().min(0).max(60 * 60 * 10), completed: z.boolean() })
    .safeParse({ lessonId, positionSec, completed })
  if (!parsed.success) return { error: 'Invalid position' }

  try {
    const pos = Math.floor(parsed.data.positionSec)
    const existing = await prisma.lessonListen.findUnique({
      where: { userId_lessonId: { userId: session.user.id, lessonId: parsed.data.lessonId } },
      select: { completedAt: true },
    })
    const completedAt = existing?.completedAt ?? (parsed.data.completed ? new Date() : null)
    await prisma.lessonListen.upsert({
      where: { userId_lessonId: { userId: session.user.id, lessonId: parsed.data.lessonId } },
      create: { userId: session.user.id, lessonId: parsed.data.lessonId, positionSec: pos, completedAt },
      update: { positionSec: pos, completedAt },
    })
    return { success: true, newlyCompleted: !existing?.completedAt && Boolean(completedAt) }
  } catch (e) {
    console.error('Error saving listen position:', e)
    return { error: 'Could not save your place.' }
  }
}
