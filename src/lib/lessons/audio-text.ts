/**
 * Turns a lesson's TEXT blocks into plain speakable text for the "Listen" player.
 * Pure functions only, so they can be unit tested without a database.
 */
import { createHash } from 'crypto'
import { parseMarkdown } from '@/lib/lms/markdown'
import { paragraphKey, stripInlineMarkdown } from './lesson-paragraphs'

export interface AudioTextBlock {
  /** Block id: ties each spoken paragraph to the paragraph on the page. */
  id?: string
  type: string
  sortOrder: number
  content: unknown
}

export const MAX_CHUNK_CHARS = 4000

const decodeEntities = (s: string) =>
  s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))

/** End a heading or list line with a full stop so the voice pauses. */
const asSentence = (line: string) => {
  const t = line.trim()
  if (!t) return ''
  return /[.!?:;]$/.test(t) ? t : `${t}.`
}

export function htmlToSpeakable(html: string): string {
  let s = html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<img[^>]*>/gi, ' ')
    .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, (_, inner) => `\n\n${asSentence(inner.replace(/<[^>]+>/g, ''))}\n\n`)
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, inner) => `\n${asSentence(inner.replace(/<[^>]+>/g, ''))}\n`)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|blockquote|ul|ol|tr)>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
  s = decodeEntities(s)
  s = s.replace(/https?:\/\/\S+/g, ' ')
  return tidy(s)
}

/** Placeholder answer spots in the workbook ("[Write here]", "[Choose one]"): never read aloud. */
const PLACEHOLDER = /\[(?:write|choose|type|fill|add|your|enter|circle|pick|list|answer|insert)\b[^\]]*\]/gi
const CHECKBOX = /\[\s?[xX]?\s?\]/g

/** Said at the end of an exercise, after its prompt has been read. */
export const EXERCISE_CUE = 'Pause the audio here and write your answer.'
const EXERCISE_HEADING = /^exercise(?:\s+\d+[a-z]?)?\s*(?:[:.\-–—]\s*|$)/i

/** One line of lesson text as the voice should say it; '' when nothing is left to say. */
export function speakableLine(raw: string): string {
  let s = stripInlineMarkdown(raw)
    .replace(/<[^>]+>/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(PLACEHOLDER, ' ')
    .replace(CHECKBOX, ' ')
    .replace(/_{2,}/g, ' ')
  s = decodeEntities(s)
    .replace(/#(?=\d)/g, 'number ')
    .replace(/[*#|~`>\\]/g, ' ')
    .replace(/(^|\s)_+|_+(?=\s|$)/g, '$1')
    .replace(/\s+/g, ' ')
    .replace(/ ([.,!?;:])/g, '$1')
    .replace(/^[\s.,;:!?\-–—]+/, '')
    .trim()
  return /[A-Za-z0-9À-￿]/.test(s) ? s : ''
}

export type SpeechUnitKind = 'title' | 'heading' | 'text'

/** One paragraph (or heading) of speech, tied by `key` to the paragraph it reads on the page. */
export interface SpeechUnit {
  key: string
  kind: SpeechUnitKind
  level?: number
  label?: string
  text: string
}

/** Speech units for one markdown TEXT block, keyed `${keyPrefix}:${paragraph}`. */
export function markdownSpeechUnits(md: string, keyPrefix: string): SpeechUnit[] {
  const units: SpeechUnit[] = []
  let exerciseOpen = false
  const closeExercise = () => {
    if (!exerciseOpen) return
    exerciseOpen = false
    const last = units[units.length - 1]
    if (last) last.text = `${asSentence(last.text)} ${EXERCISE_CUE}`
  }
  parseMarkdown(md).forEach((p, index) => {
    if (p.pageOnly) return // shown on the page only (tables of times, rating lists, references)
    const key = paragraphKey(keyPrefix, index)
    if (p.type === 'heading') {
      closeExercise()
      const words = speakableLine(p.text)
      if (!words) return
      const label = stripInlineMarkdown(p.text).replace(/[*#]/g, '').trim() || words
      let text = asSentence(words)
      if (EXERCISE_HEADING.test(words)) {
        const rest = words.replace(EXERCISE_HEADING, '').trim()
        text = rest ? `Exercise. ${asSentence(rest)}` : 'Exercise.'
        exerciseOpen = true
      }
      units.push({ key, kind: 'heading', level: p.level, label, text })
      return
    }
    let text = ''
    const lines = (t: string) => t.split('\n').map(speakableLine).filter(Boolean)
    if (p.type === 'paragraph') {
      text = lines(p.text).join(' ')
    } else if (p.type === 'quote') {
      const body = lines(p.text).join(' ')
      text = body && p.label ? `${asSentence(speakableLine(p.label))} ${body}` : body
    } else if (p.type === 'list') {
      text = p.items.map(speakableLine).filter(Boolean).map(asSentence).join(' ')
    } else if (p.type === 'table') {
      text = [p.header, ...p.rows]
        .map((row) => row.map(speakableLine).filter(Boolean).join(', '))
        .filter(Boolean)
        .map(asSentence)
        .join(' ')
    }
    if (text) units.push({ key, kind: 'text', text })
  })
  closeExercise()
  return units
}

export function markdownToSpeakable(md: string): string {
  return markdownSpeechUnits(md, 'md')
    .map((u) => u.text)
    .join('\n\n')
}

function tidy(s: string): string {
  return s
    .split(/\n{2,}/)
    .map((p) => p.replace(/[ \t]*\n[ \t]*/g, ' ').replace(/[ \t]+/g, ' ').replace(/ ([.,!?;:])/g, '$1').trim())
    .filter(Boolean)
    .join('\n\n')
}

/** Every spoken unit of the lesson: the title, then each TEXT block's paragraphs in sortOrder. */
export function buildSpeechUnits(blocks: AudioTextBlock[], title?: string): SpeechUnit[] {
  const units: SpeechUnit[] = []
  const t = title?.trim()
  if (t) units.push({ key: 'title', kind: 'title', label: t, text: asSentence(speakableLine(t) || t) })
  const sorted = [...blocks].sort((a, z) => a.sortOrder - z.sortOrder)
  sorted.forEach((b, i) => {
    if (b.type !== 'TEXT' || !b.content || typeof b.content !== 'object') return
    const c = b.content as { content?: unknown; format?: unknown }
    if (typeof c.content !== 'string') return
    const prefix = b.id ?? `block${i}`
    if (c.format === 'html') {
      htmlToSpeakable(c.content)
        .split(/\n{2,}/)
        .filter(Boolean)
        .forEach((text, j) => units.push({ key: `${prefix}:html${j}`, kind: 'text', text }))
    } else {
      units.push(...markdownSpeechUnits(c.content, prefix))
    }
  })
  return units
}

/** All TEXT blocks in sortOrder, as one speakable string (paragraphs separated by blank lines). */
export function buildLessonSpeech(blocks: AudioTextBlock[], title?: string): string {
  return buildSpeechUnits(blocks, title)
    .map((u) => u.text)
    .join('\n\n')
}

export function speechHash(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

/** Split into chunks under maxChars, preferring paragraph, then sentence, then word boundaries. */
export function chunkSpeech(text: string, maxChars = MAX_CHUNK_CHARS): string[] {
  const pieces: string[] = []
  for (const para of text.split(/\n{2,}/)) {
    if (para.length < maxChars) {
      pieces.push(para)
      continue
    }
    const sentences = para.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [para]
    for (const sent of sentences) {
      if (sent.length < maxChars) {
        pieces.push(sent.trim())
        continue
      }
      let cur = ''
      for (const word of sent.split(/\s+/)) {
        if (cur && cur.length + 1 + word.length >= maxChars) {
          pieces.push(cur)
          cur = ''
        }
        cur = cur ? `${cur} ${word}` : word.slice(0, maxChars - 1)
      }
      if (cur) pieces.push(cur)
    }
  }
  const chunks: string[] = []
  let cur = ''
  for (const p of pieces.filter(Boolean)) {
    const joined = cur ? `${cur}\n\n${p}` : p
    if (joined.length < maxChars) cur = joined
    else {
      if (cur) chunks.push(cur)
      cur = p
    }
  }
  if (cur) chunks.push(cur)
  return chunks
}

/** Rough listening length: about 150 spoken words a minute. */
export function estimateDurationSec(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round((words / 150) * 60))
}

export { DEFAULT_TTS_INSTRUCTIONS, DEFAULT_TTS_VOICE, supportsTtsInstructions, ttsInstructions } from './tts-voice'
