/**
 * Makes the spoken (MP3) version of a text lesson with OpenAI's speech API.
 * Each paragraph/heading is spoken separately and its real length is measured from the MP3
 * frames, so the player can follow along (LessonAudio.segments).
 * Server only. Never throws: failures are stored on LessonAudio as FAILED with a plain reason.
 */
import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { saveFile } from '@/lib/storage'
import { buildSpeechUnits, chunkSpeech, estimateDurationSec, speechHash } from './audio-text'
import { buildSegments, storeSegments } from './audio-segments'
import { parseMp3 } from './mp3'
import { DEFAULT_TTS_VOICE, ttsInstructions } from './tts-voice'

export type LessonAudioResult = { status: 'READY' | 'FAILED' | 'UNCHANGED' | 'EMPTY'; error?: string }

/** How many speech requests run at once. */
const PARALLEL = 4

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

export interface SpeechSettings {
  apiKey: string
  model: string
  voice: string
  instructions?: string
}

export class SpeechError extends Error {
  constructor(public status: number) {
    super(`speech ${status}`)
  }
}

/**
 * One piece of text to MP3 bytes. The ONLY place that calls the speech provider:
 * gpt-4o-mini-tts shuts down on 6 January 2027 and its replacement runs on the Realtime API,
 * so swap this function when that happens. Stored MP3s keep playing either way.
 */
export async function synthesizeChunk(input: string, s: SpeechSettings): Promise<Uint8Array> {
  const body: Record<string, unknown> = { model: s.model, voice: s.voice, input, response_format: 'mp3' }
  if (s.instructions) body.instructions = s.instructions
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${s.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new SpeechError(res.status)
  return new Uint8Array(await res.arrayBuffer())
}

const speechErrorText = (status: number) =>
  status === 401
    ? 'The OpenAI key was not accepted.'
    : status === 429
      ? 'OpenAI is busy or the account is out of credit. Try again later.'
      : `OpenAI could not read the lesson aloud (error ${status}).`

/** Runs `fn` over items, at most `limit` at a time, results in order. Stops starting new work after a failure. */
async function mapLimited<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  let failed = false
  const worker = async () => {
    while (!failed && next < items.length) {
      const i = next++
      try {
        out[i] = await fn(items[i])
      } catch (e) {
        failed = true
        throw e
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

export async function generateLessonAudio(lessonId: string): Promise<LessonAudioResult> {
  let hash = ''
  try {
    const lesson = await prisma.lMSLesson.findUnique({
      where: { id: lessonId },
      select: {
        title: true,
        contentBlocks: { select: { id: true, type: true, sortOrder: true, content: true } },
      },
    })
    if (!lesson) return { status: 'EMPTY', error: 'Lesson not found' }

    const blocks = lesson.contentBlocks.map((b) => ({ id: b.id, type: String(b.type), sortOrder: b.sortOrder, content: b.content }))
    if (!buildSpeechUnits(blocks).length) return { status: 'EMPTY' }
    const units = buildSpeechUnits(blocks, lesson.title)
    const text = units.map((u) => u.text).join('\n\n')
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
    const voice = process.env.OPENAI_TTS_VOICE || DEFAULT_TTS_VOICE
    const settings: SpeechSettings = { apiKey, model, voice, instructions: ttsInstructions(model, process.env.OPENAI_TTS_INSTRUCTIONS) }

    // Every unit becomes one or more requests (a very long paragraph is split).
    const jobs = units.flatMap((u, unit) => chunkSpeech(u.text).map((input) => ({ unit, input })))
    let audioParts: Array<{ unit: number; bytes: Uint8Array; seconds: number }>
    try {
      audioParts = await mapLimited(jobs, PARALLEL, async ({ unit, input }) => {
        const raw = await synthesizeChunk(input, settings)
        const mp3 = parseMp3(raw)
        // Tags and the Xing/Info frame are dropped so the joined file reports one true length.
        return mp3
          ? { unit, bytes: mp3.audio, seconds: mp3.durationSec }
          : { unit, bytes: raw, seconds: estimateDurationSec(input) }
      })
    } catch (e) {
      if (!(e instanceof SpeechError)) throw e
      const error = speechErrorText(e.status)
      await markFailed(lessonId, hash, error)
      return { status: 'FAILED', error }
    }

    const durations = units.map(() => 0)
    for (const p of audioParts) durations[p.unit] += p.seconds
    const segments = buildSegments(units, durations)
    const total = durations.reduce((a, b) => a + b, 0)
    const file = Buffer.concat(audioParts.map((p) => Buffer.from(p.bytes.buffer, p.bytes.byteOffset, p.bytes.byteLength)))

    const url = await saveFile(`lesson-audio/${lessonId}-${hash.slice(0, 8)}.mp3`, file, 'audio/mpeg')
    const data = {
      textHash: hash,
      url,
      voice,
      durationSec: Math.max(1, Math.round(total)),
      segments: storeSegments(segments) as unknown as Prisma.InputJsonValue,
      status: 'READY',
      error: null,
    }
    await prisma.lessonAudio.upsert({ where: { lessonId }, create: { lessonId, ...data }, update: data })
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
