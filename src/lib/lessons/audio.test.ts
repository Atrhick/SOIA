import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const db = vi.hoisted(() => ({
  lesson: null as unknown,
  audio: null as unknown,
  upserts: [] as Array<{ update: Record<string, unknown> }>,
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    lMSLesson: { findUnique: vi.fn(async () => db.lesson) },
    lessonAudio: {
      findUnique: vi.fn(async () => db.audio),
      upsert: vi.fn(async (args: { update: Record<string, unknown> }) => {
        db.upserts.push(args)
        return {}
      }),
    },
  },
}))
const saveFile = vi.hoisted(() => vi.fn(async (key: string, _data?: Buffer, _type?: string) => `/uploads/${key}`))
vi.mock('@/lib/storage', () => ({ saveFile }))

import { generateLessonAudio } from './audio'
import { buildLessonSpeech, speechHash, DEFAULT_TTS_INSTRUCTIONS } from './audio-text'
import { readStoredSegments } from './audio-segments'
import { parseMp3 } from './mp3'
import { FRAME_SECONDS, makeMp3 } from './mp3-fixture'

const lesson = {
  title: 'Day one',
  contentBlocks: [{ id: 'blk', type: 'TEXT', sortOrder: 0, content: { content: '## Start\n\nHello there.', format: 'markdown' } }],
}

describe('generateLessonAudio', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    db.lesson = lesson
    db.audio = null
    db.upserts = []
    saveFile.mockClear()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    process.env.OPENAI_API_KEY = 'test-key'
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.OPENAI_API_KEY
  })

  it('speaks each paragraph, measures real MP3 length, saves segments and marks READY', async () => {
    // title (8 frames), heading (4 frames), paragraph (20 frames); each reply has tags + an Info frame.
    const replies = [8, 4, 20]
    fetchMock.mockImplementation(async (_url: string, init: { body: string }) => {
      const input = JSON.parse(init.body).input as string
      const n = input.startsWith('Day one') ? replies[0] : input.startsWith('Start') ? replies[1] : replies[2]
      return new Response(Buffer.from(makeMp3(n, { id3: true, info: true })), { status: 200 })
    })
    const r = await generateLessonAudio('L1')
    expect(r.status).toBe('READY')
    expect(fetchMock).toHaveBeenCalledTimes(3)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body).toMatchObject({ model: 'gpt-4o-mini-tts', voice: 'marin', response_format: 'mp3', instructions: DEFAULT_TTS_INSTRUCTIONS })
    expect(saveFile.mock.calls[0][0]).toMatch(/^lesson-audio\/L1-[0-9a-f]{8}\.mp3$/)
    const saved = parseMp3(new Uint8Array(saveFile.mock.calls[0][1] as Buffer))!
    expect(saved.frameCount).toBe(32) // tags and Info frames stripped
    const last = db.upserts.at(-1)!.update
    expect(last.status).toBe('READY')
    expect(last.durationSec).toBe(Math.round(32 * FRAME_SECONDS))
    const segs = readStoredSegments(last.segments)!
    expect(segs.map((s) => s.key)).toEqual(['title', 'blk:0', 'blk:1'])
    expect(segs[1].start).toBeCloseTo(8 * FRAME_SECONDS, 3)
    expect(segs[2].start).toBeCloseTo(12 * FRAME_SECONDS, 3)
    expect(segs[2].duration).toBeCloseTo(20 * FRAME_SECONDS, 3)
  })

  it('leaves out instructions for tts-1 and falls back to estimates for unreadable audio', async () => {
    process.env.OPENAI_TTS_MODEL = 'tts-1'
    fetchMock.mockImplementation(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 }))
    try {
      const r = await generateLessonAudio('L1')
      expect(r.status).toBe('READY')
      expect(JSON.parse(fetchMock.mock.calls[0][1].body).instructions).toBeUndefined()
      expect(readStoredSegments(db.upserts.at(-1)!.update.segments)?.length).toBe(3)
    } finally {
      delete process.env.OPENAI_TTS_MODEL
    }
  })

  it('does nothing when READY audio has the same text', async () => {
    const text = buildLessonSpeech(lesson.contentBlocks, lesson.title)
    db.audio = { status: 'READY', textHash: speechHash(text) }
    const r = await generateLessonAudio('L1')
    expect(r.status).toBe('UNCHANGED')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('records FAILED without a key and does not throw', async () => {
    delete process.env.OPENAI_API_KEY
    const r = await generateLessonAudio('L1')
    expect(r.status).toBe('FAILED')
    expect(db.upserts.at(-1)?.update.status).toBe('FAILED')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('records FAILED when OpenAI refuses', async () => {
    fetchMock.mockImplementation(async () => new Response('no', { status: 429 }))
    const r = await generateLessonAudio('L1')
    expect(r.status).toBe('FAILED')
    expect(r.error).toMatch(/busy/)
    expect(saveFile).not.toHaveBeenCalled()
  })
})
