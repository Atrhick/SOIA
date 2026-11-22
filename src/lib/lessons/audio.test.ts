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
const saveFile = vi.hoisted(() => vi.fn(async (key: string) => `/uploads/${key}`))
vi.mock('@/lib/storage', () => ({ saveFile }))

import { generateLessonAudio } from './audio'
import { buildLessonSpeech, speechHash } from './audio-text'

const lesson = {
  title: 'Day one',
  contentBlocks: [{ type: 'TEXT', sortOrder: 0, content: { content: 'Hello there.', format: 'markdown' } }],
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

  it('makes and saves the MP3, then marks READY', async () => {
    fetchMock.mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200 }))
    const r = await generateLessonAudio('L1')
    expect(r.status).toBe('READY')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body).toMatchObject({ model: 'gpt-4o-mini-tts', voice: 'alloy', response_format: 'mp3' })
    expect(saveFile.mock.calls[0][0]).toMatch(/^lesson-audio\/L1-[0-9a-f]{8}\.mp3$/)
    expect(db.upserts.at(-1)?.update.status).toBe('READY')
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
    fetchMock.mockResolvedValue(new Response('no', { status: 429 }))
    const r = await generateLessonAudio('L1')
    expect(r.status).toBe('FAILED')
    expect(r.error).toMatch(/busy/)
    expect(saveFile).not.toHaveBeenCalled()
  })
})
