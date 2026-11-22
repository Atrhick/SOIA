/**
 * Turns a lesson's TEXT blocks into plain speakable text for the "Listen" player.
 * Pure functions only, so they can be unit tested without a database.
 */
import { createHash } from 'crypto'

export interface AudioTextBlock {
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

export function markdownToSpeakable(md: string): string {
  const lines = md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .split(/\r?\n/)
  const out: string[] = []
  for (const raw of lines) {
    let line = raw
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links keep their words
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/`([^`]*)`/g, '$1')
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/(\*|_)(.*?)\1/g, '$2')
      .replace(/~~(.*?)~~/g, '$1')
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      out.push('')
      continue
    }
    const heading = line.match(/^\s*#{1,6}\s+(.*)$/)
    if (heading) {
      out.push('', asSentence(heading[1].replace(/#+\s*$/, '')), '')
      continue
    }
    const listItem = line.match(/^\s*(?:[-*+]|\d+[.)])\s+(.*)$/)
    if (listItem) {
      out.push(asSentence(listItem[1]))
      continue
    }
    line = line.replace(/^\s*>\s?/, '')
    out.push(line)
  }
  return tidy(decodeEntities(out.join('\n')))
}

function tidy(s: string): string {
  return s
    .split(/\n{2,}/)
    .map((p) => p.replace(/[ \t]*\n[ \t]*/g, ' ').replace(/[ \t]+/g, ' ').replace(/ ([.,!?;:])/g, '$1').trim())
    .filter(Boolean)
    .join('\n\n')
}

/** All TEXT blocks in sortOrder, as one speakable string (paragraphs separated by blank lines). */
export function buildLessonSpeech(blocks: AudioTextBlock[], title?: string): string {
  const parts: string[] = []
  if (title?.trim()) parts.push(asSentence(title))
  for (const b of [...blocks].sort((a, z) => a.sortOrder - z.sortOrder)) {
    if (b.type !== 'TEXT' || !b.content || typeof b.content !== 'object') continue
    const c = b.content as { content?: unknown; format?: unknown }
    if (typeof c.content !== 'string') continue
    const text = c.format === 'html' ? htmlToSpeakable(c.content) : markdownToSpeakable(c.content)
    if (text) parts.push(text)
  }
  return parts.join('\n\n')
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
