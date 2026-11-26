/**
 * Ties lesson audio to the lesson text on the page. Both the audio maker and the renderer use
 * the LMS markdown parser (`parseMarkdown` in src/lib/lms/markdown.ts); paragraph N of a block is
 * the Nth MdBlock it returns. A renderer that wants follow-along highlighting puts
 * `data-audio-key={paragraphKey(blockId, N)}` on the element it draws for that MdBlock.
 * Pure and browser-safe.
 */
import { parseInline, type Inline } from '@/lib/lms/markdown'

/** The DOM/segment key for paragraph `index` of a block. */
export const paragraphKey = (blockId: string, index: number) => `${blockId}:${index}`

function inlineToText(nodes: Inline[]): string {
  return nodes
    .map((n) => {
      switch (n.t) {
        case 'text':
        case 'code':
          return n.v
        case 'br':
          return ' '
        default:
          return inlineToText(n.c)
      }
    })
    .join('')
}

/** Inline markdown to plain words: images dropped, links keep their words, emphasis/code marks removed. */
export function stripInlineMarkdown(s: string): string {
  return inlineToText(parseInline(s.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')))
}
