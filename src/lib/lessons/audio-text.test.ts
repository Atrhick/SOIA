import { describe, it, expect } from 'vitest'
import { buildLessonSpeech, chunkSpeech, speechHash, markdownToSpeakable, htmlToSpeakable, estimateDurationSec } from './audio-text'

describe('markdownToSpeakable', () => {
  it('keeps headings as sentences and strips formatting, links and images', () => {
    const md = '# Welcome\n\nThis is **bold** and [a link](https://x.com).\n\n![pic](https://x.com/a.png)\n\n- first\n- second!\n\nSee https://example.com now'
    const out = markdownToSpeakable(md)
    expect(out).toContain('Welcome.')
    expect(out).toContain('This is bold and a link.')
    expect(out).toContain('first.')
    expect(out).toContain('second!')
    expect(out).not.toMatch(/https?:|\*|\[|!\[|#/)
  })
})

describe('htmlToSpeakable', () => {
  it('strips tags, decodes entities, keeps headings as sentences', () => {
    const out = htmlToSpeakable('<h2>Your week</h2><p>Tom &amp; Ana <a href="https://x.com">met</a>.</p><img src="a.png"><ul><li>One</li></ul>')
    expect(out).toBe('Your week.\n\nTom & Ana met.\n\nOne.')
  })
})

describe('buildLessonSpeech', () => {
  it('uses TEXT blocks only, in sortOrder', () => {
    const text = buildLessonSpeech([
      { type: 'TEXT', sortOrder: 2, content: { content: 'Second.', format: 'markdown' } },
      { type: 'VIDEO', sortOrder: 0, content: { url: 'https://v' } },
      { type: 'TEXT', sortOrder: 1, content: { content: '<p>First.</p>', format: 'html' } },
    ])
    expect(text).toBe('First.\n\nSecond.')
  })
  it('hash is stable and changes with text', () => {
    expect(speechHash('a')).toBe(speechHash('a'))
    expect(speechHash('a')).not.toBe(speechHash('b'))
  })
})

describe('chunkSpeech', () => {
  it('keeps every chunk under the limit and loses no words', () => {
    const sentence = 'This is a sentence about leadership. '
    const para = sentence.repeat(200).trim()
    const text = [para, 'Short one.', para].join('\n\n')
    const chunks = chunkSpeech(text, 1000)
    expect(chunks.length).toBeGreaterThan(1)
    for (const c of chunks) expect(c.length).toBeLessThan(1000)
    const words = (s: string) => s.split(/\s+/).filter(Boolean)
    expect(words(chunks.join(' '))).toEqual(words(text))
    for (const c of chunks) expect(c.trim().endsWith('.')).toBe(true)
  })
  it('returns one chunk for short text and none for empty', () => {
    expect(chunkSpeech('Hi there.')).toEqual(['Hi there.'])
    expect(chunkSpeech('')).toEqual([])
  })
  it('estimates duration', () => {
    expect(estimateDurationSec('word '.repeat(150))).toBe(60)
  })
})
