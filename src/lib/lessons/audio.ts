/**
 * Makes the spoken (MP3) version of a text lesson with OpenAI's speech API.
 * Server only. Never throws: failures are stored on LessonAudio as FAILED with a plain reason.
 */
import prisma from '@/lib/prisma'
import { saveFile } from '@/lib/storage'
import { buildLessonSpeech, chunkSpeech, estimateDurationSec, speechHash } from './audio-text'

export type LessonAudioResult = { status: 'READY' | 'FAILED' | 'UNCHANGED' | 'EMPTY'; error?: string }

async function markFailed(lessonId: string, textHash: string, error: string) {
  try {
    await prisma.lessonAudio.upsert({
      where: { lessonId },
      create: { lessonId, textHash, status: 'FAILED', error },
      update: { textHash, status: 'FAILED', error },
    })
  } catch (e) {
    console.error('Could not record lesson audio failure:', e)
  }
}

export async function generateLessonAudio(lessonId: string): Promise<LessonAudioResult> {
  let hash = ''
  try {
    const lesson = await prisma.lMSLesson.findUnique({
      where: { id: lessonId },
      select: {
        title: true,
        contentBlocks: { select: { type: true, sortOrder: true, content: true } },
      },
    })
    if (!lesson) return { status: 'EMPTY', error: 'Lesson not found' }

    const blocks = lesson.contentBlocks.map((b) => ({ type: String(b.type), sortOrder: b.sortOrder, content: b.content }))
    const bodyOnly = buildLessonSpeech(blocks)
    if (!bodyOnly.trim()) return { status: 'EMPTY' }
    const text = buildLessonSpeech(blocks, lesson.title)
    hash = speechHash(text)

    const existing = await prisma.lessonAudio.findUnique({ where: { lessonId } })
    if (existing && existing.status === 'READY' && existing.textHash === hash) return { status: 'UNCHANGED' }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      const error = 'Audio is not set up yet: the OpenAI key is missing on the server.'
      await markFailed(lessonId, hash, error)
      return { status: 'FAILED', error }
    }

    await prisma.lessonAudio.upsert({
      where: { lessonId },
      create: { lessonId, textHash: hash, status: 'PENDING' },
      update: { textHash: hash, status: 'PENDING', error: null },
    })

    const model = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts'
    const voice = process.env.OPENAI_TTS_VOICE || 'alloy'
    const parts: Buffer[] = []
    for (const input of chunkSpeech(text)) {
      const res = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, voice, input, response_format: 'mp3' }),
      })
      if (!res.ok) {
        const error =
          res.status === 401
            ? 'The OpenAI key was not accepted.'
            : res.status === 429
              ? 'OpenAI is busy or the account is out of credit. Try again later.'
              : `OpenAI could not read the lesson aloud (error ${res.status}).`
        await markFailed(lessonId, hash, error)
        return { status: 'FAILED', error }
      }
      parts.push(Buffer.from(await res.arrayBuffer()))
    }

    const url = await saveFile(`lesson-audio/${lessonId}-${hash.slice(0, 8)}.mp3`, Buffer.concat(parts), 'audio/mpeg')
    await prisma.lessonAudio.upsert({
      where: { lessonId },
      create: { lessonId, textHash: hash, url, voice, durationSec: estimateDurationSec(text), status: 'READY' },
      update: { textHash: hash, url, voice, durationSec: estimateDurationSec(text), status: 'READY', error: null },
    })
    return { status: 'READY' }
  } catch (e) {
    console.error('Lesson audio failed:', e)
    const error = 'Something went wrong while making the audio. Try again.'
    await markFailed(lessonId, hash, error)
    return { status: 'FAILED', error }
  }
}

/** Start making audio without waiting. Never throws into the caller. */
export function queueLessonAudio(lessonId: string): void {
  void generateLessonAudio(lessonId).catch((e) => console.error('Lesson audio failed:', e))
}
