import type { ReactNode } from 'react'
import { parseInline, parseMarkdown, type Inline, type MdBlock } from '@/lib/lms/markdown'
import { paragraphKey } from '@/lib/lessons/lesson-paragraphs'

/**
 * Renders a markdown TEXT block. Each paragraph carries `data-audio-key` (paragraphKey(blockId, N),
 * N = index in parseMarkdown's output, the same numbering the audio maker uses), so the lesson
 * audio player can highlight the paragraph being spoken and "tap to listen from here".
 * Any other renderer gets follow-along by adding the same attribute and the AUDIO_PARAGRAPH classes.
 */

/** Highlight set by the player (data-audio-active) and a pointer while audio is playing on the page. */
export const AUDIO_PARAGRAPH =
  'scroll-mt-28 scroll-mb-28 rounded-md transition-colors duration-300 motion-reduce:transition-none ' +
  'data-[audio-active=true]:bg-amber-50 data-[audio-active=true]:shadow-[inset_3px_0_0_0_theme(colors.amber.400)] ' +
  '[[data-lesson-audio-live]_&]:cursor-pointer'

function renderInline(nodes: Inline[]): ReactNode[] {
  return nodes.map((n, i) => {
    switch (n.t) {
      case 'text':
        return n.v
      case 'br':
        return <br key={i} />
      case 'code':
        return (
          <code key={i} className="rounded bg-gray-100 px-1 text-[0.9em]">
            {n.v}
          </code>
        )
      case 'strong':
        return <strong key={i}>{renderInline(n.c)}</strong>
      case 'em':
        return <em key={i}>{renderInline(n.c)}</em>
      case 'link':
        return (
          <a key={i} href={n.href} target="_blank" rel="noopener noreferrer" className="text-primary-700 underline">
            {renderInline(n.c)}
          </a>
        )
    }
  })
}
const inline = (s: string) => renderInline(parseInline(s))

function Block({ b, audioKey }: { b: MdBlock; audioKey: string }) {
  const attrs = { 'data-audio-key': audioKey }
  switch (b.type) {
    case 'heading': {
      const size = b.level <= 1 ? 'text-2xl mt-6' : b.level === 2 ? 'text-xl mt-6' : 'text-lg mt-5'
      const Tag = `h${Math.min(6, Math.max(2, b.level + 1))}` as 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
      return (
        <Tag {...attrs} className={`${AUDIO_PARAGRAPH} ${size} mb-2 font-bold text-gray-900`}>
          {inline(b.text)}
        </Tag>
      )
    }
    case 'list': {
      const List = b.ordered ? 'ol' : 'ul'
      return (
        <List {...attrs} className={`${AUDIO_PARAGRAPH} mb-4 space-y-1 pl-6 ${b.ordered ? 'list-decimal' : 'list-disc'}`}>
          {b.items.map((l, i) => (
            <li key={i}>{inline(l)}</li>
          ))}
        </List>
      )
    }
    case 'quote':
      return (
        <blockquote {...attrs} className={`${AUDIO_PARAGRAPH} mb-4 border-l-4 border-primary-200 bg-gray-50 px-4 py-2 text-gray-800`}>
          {b.label && <p className="mb-1 text-sm font-semibold text-gray-900">{b.label}</p>}
          <p>{inline(b.text)}</p>
        </blockquote>
      )
    case 'table':
      return (
        <div {...attrs} className={`${AUDIO_PARAGRAPH} relative mb-4 overflow-x-auto`}>
          <table className="min-w-full text-sm">
            <thead>
              <tr>
                {b.header.map((c, j) => (
                  <th key={j} className="px-2 py-1 text-left align-top font-semibold">
                    {inline(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((r, i) => (
                <tr key={i} className="border-t">
                  {r.map((c, j) => (
                    <td key={j} className="px-2 py-1 align-top">
                      {inline(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'image':
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={b.src} alt={b.alt} className="my-4 h-auto max-w-full rounded-md" loading="lazy" />
    case 'hr':
      return <hr className="my-6" />
    case 'code':
      return (
        <pre className="mb-4 overflow-x-auto rounded bg-gray-50 p-3 text-sm">
          <code>{b.text}</code>
        </pre>
      )
    default:
      return (
        <p {...attrs} className={`${AUDIO_PARAGRAPH} mb-4 leading-relaxed text-gray-800`}>
          {inline(b.text)}
        </p>
      )
  }
}

export function LessonText({ blockId, markdown }: { blockId: string; markdown: string }) {
  return (
    <div className="max-w-none text-base">
      {parseMarkdown(markdown).map((b, i) => (
        <Block key={i} b={b} audioKey={paragraphKey(blockId, i)} />
      ))}
    </div>
  )
}
