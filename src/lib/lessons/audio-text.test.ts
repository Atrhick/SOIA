import { describe, it, expect } from 'vitest'
import {
  buildLessonSpeech,
  buildSpeechUnits,
  chunkSpeech,
  speechHash,
  markdownToSpeakable,
  markdownSpeechUnits,
  htmlToSpeakable,
  estimateDurationSec,
  EXERCISE_CUE,
  DEFAULT_TTS_INSTRUCTIONS,
  ttsInstructions,
} from './audio-text'

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

describe('workbook speech rules', () => {
  it('drops [Write here] / [Choose one] placeholder lines and underscores', () => {
    const md = 'What do you value most?\n\n[Write here]\n\n**My answer:** [Write here]\n\n- [Choose one]\n- ________\n\nNext idea.'
    const out = markdownToSpeakable(md)
    expect(out).not.toMatch(/write here|choose one|_/i)
    expect(out).toContain('What do you value most?')
    expect(out).toContain('My answer:')
    expect(out).toContain('Next idea.')
  })
  it('strips markdown symbols, tables and checkboxes', () => {
    const out = markdownToSpeakable('> **Tip:** stay *calm*\n\n| Day | Goal |\n|---|---|\n| Mon | Call #1 |\n\n- [ ] Ask a friend\n\n~~old~~ `code`')
    expect(out).not.toMatch(/[*#|>`~[\]]/)
    expect(out).toContain('Tip. stay calm')
    expect(out).toContain('Day, Goal. Mon, Call number 1.')
    expect(out).toContain('Ask a friend.')
  })
  it('exercise heading: says "Exercise." then the prompt, and the pause cue after the prompt', () => {
    const md = '### Exercise: Your three values\n\nList three values that guide you.\n\n[Write here]\n\n## Next part\n\nMore text.'
    const units = markdownSpeechUnits(md, 'b1')
    expect(units[0]).toMatchObject({ key: 'b1:0', kind: 'heading', level: 3, label: 'Exercise: Your three values', text: 'Exercise. Your three values.' })
    expect(units[1].text).toBe(`List three values that guide you. ${EXERCISE_CUE}`)
    expect(units[2]).toMatchObject({ kind: 'heading', text: 'Next part.' })
    expect(units[3].text).toBe('More text.')
  })
  it('exercise with only a placeholder puts the cue on the heading; one at the end of the block still gets it', () => {
    expect(markdownSpeechUnits('### Exercise:\n\n[Write here]', 'b')[0].text).toBe(`Exercise. ${EXERCISE_CUE}`)
    const u = markdownSpeechUnits('### Exercise 2 - Reflect\n\nHow did it go?', 'b')
    expect(u.at(-1)?.text).toBe(`How did it go? ${EXERCISE_CUE}`)
  })
  it('keys match the parser paragraph numbers (blank/placeholder paragraphs are skipped, not renumbered)', () => {
    const units = buildSpeechUnits([{ id: 'blk', type: 'TEXT', sortOrder: 0, content: { content: '# A\n\n[Write here]\n\nB text', format: 'markdown' } }], 'Title')
    expect(units.map((u) => u.key)).toEqual(['title', 'blk:0', 'blk:2'])
    expect(units[0]).toMatchObject({ kind: 'title', label: 'Title', text: 'Title.' })
  })
})

describe('voice instructions', () => {
  it('sends the default to gpt-*-tts models only', () => {
    expect(ttsInstructions('gpt-4o-mini-tts', undefined)).toBe(DEFAULT_TTS_INSTRUCTIONS)
    expect(ttsInstructions('gpt-4o-mini-tts', 'Be calm.')).toBe('Be calm.')
    expect(ttsInstructions('gpt-4o-mini-tts', '  ')).toBeUndefined()
    expect(ttsInstructions('tts-1', undefined)).toBeUndefined()
    expect(ttsInstructions('tts-1-hd', 'Be calm.')).toBeUndefined()
  })
})
