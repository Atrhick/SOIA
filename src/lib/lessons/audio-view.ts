/** Server-only loader: the lesson's READY audio and this person's saved place. */
import prisma from '@/lib/prisma'
import type { LessonAudioInfo } from '@/components/learning/lesson-audio-player'
import { readStoredSegments } from './audio-segments'

export async function loadLessonAudioView(lessonId: string, userId: string): Promise<{
  audio: LessonAudioInfo | null
  listen: { positionSec: number; completed: boolean }
}> {
  try {
    const [audio, listen, lesson] = await Promise.all([
      prisma.lessonAudio.findUnique({ where: { lessonId }, select: { status: true, url: true, durationSec: true, segments: true } }),
      prisma.lessonListen.findUnique({
        where: { userId_lessonId: { userId, lessonId } },
        select: { positionSec: true, completedAt: true },
      }),
      prisma.lMSLesson.findUnique({
        where: { id: lessonId },
        select: { title: true, module: { select: { course: { select: { title: true } } } } },
      }),
    ])
    return {
      audio:
        audio?.status === 'READY' && audio.url
          ? {
              url: audio.url,
              durationSec: audio.durationSec,
              segments: readStoredSegments(audio.segments),
              title: lesson?.title,
              album: lesson?.module.course.title,
              listenerId: userId,
            }
          : null,
      listen: { positionSec: listen?.positionSec ?? 0, completed: Boolean(listen?.completedAt) },
    }
  } catch (e) {
    console.error('Could not load lesson audio:', e)
    return { audio: null, listen: { positionSec: 0, completed: false } }
  }
}
