'use client'

import { Fragment, useMemo } from 'react'
import { Info, Lightbulb, AlertTriangle } from 'lucide-react'
import { parseInline, parseMarkdown, type Inline, type MdBlock } from '@/lib/lms/markdown'

/**
 * Reading view for lesson markdown. Built from parsed data (never raw HTML).
 * Each top-level block carries data-md-block={index} so other features (for example audio
 * highlighting) can find paragraphs without depending on this component's markup.
 */
export function LessonMarkdown({ content, className = '' }: { content: string; className?: string }) {
  const blocks = useMemo(() => parseMarkdown(content), [content])
  return (
    <div className={`lesson-prose text-[17px] leading-[1.7] text-gray-800 ${className}`}>
      {blocks.map((b, i) => (
        <MdBlockView key={i} block={b} index={i} />
      ))}
    </div>
  )
}

export function InlineText({ text }: { text: string }) {
  const nodes = useMemo(() => parseInline(text), [text])
  return <InlineNodes nodes={nodes} />
}

function InlineNodes({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.t) {
          case 'text':
            return <Fragment key={i}>{n.v}</Fragment>
          case 'br':
            return <br key={i} />
          case 'strong':
            return (
              <strong key={i} className="font-semibold text-gray-900">
                <InlineNodes nodes={n.c} />
              </strong>
            )
          case 'em':
            return (
              <em key={i}>
                <InlineNodes nodes={n.c} />
              </em>
            )
          case 'code':
            return (
              <code key={i} className="rounded bg-gray-100 px-1 py-0.5 text-[0.9em] text-gray-900">
                {n.v}
              </code>
            )
          case 'link': {
            const external = /^https?:/i.test(n.href)
            return (
              <a
                key={i}
                href={n.href}
                className="font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900"
                {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              >
                <InlineNodes nodes={n.c} />
              </a>
            )
          }
        }
      })}
    </>
  )
}

const CALLOUTS: Record<string, { box: string; icon: typeof Info }> = {
  tip: { box: 'border-emerald-300 bg-emerald-50', icon: Lightbulb },
  important: { box: 'border-amber-300 bg-amber-50', icon: AlertTriangle },
  warning: { box: 'border-amber-300 bg-amber-50', icon: AlertTriangle },
  caution: { box: 'border-amber-300 bg-amber-50', icon: AlertTriangle },
}

function MdBlockView({ block, index }: { block: MdBlock; index: number }) {
  const data = { 'data-md-block': index }
  switch (block.type) {
    case 'heading': {
      const text = <InlineText text={block.text} />
      if (block.level <= 2)
        return (
          <h2 {...data} className="mt-8 mb-3 text-[1.35rem] font-bold leading-snug text-gray-900 first:mt-0">
            {text}
          </h2>
        )
      if (block.level === 3)
        return (
          <h3 {...data} className="mt-6 mb-2 text-[1.15rem] font-semibold leading-snug text-gray-900 first:mt-0">
            {text}
          </h3>
        )
      return (
        <h4 {...data} className="mt-5 mb-2 font-semibold text-gray-900 first:mt-0">
          {text}
        </h4>
      )
    }
    case 'paragraph':
      return (
        <p {...data} className="my-4 first:mt-0">
          <InlineText text={block.text} />
        </p>
      )
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul'
      return (
        <Tag {...data} className={`my-4 space-y-2 pl-6 ${block.ordered ? 'list-decimal' : 'list-disc'} marker:text-gray-500`}>
          {block.items.map((it, i) => (
            <li key={i} className="pl-1">
              <InlineText text={it} />
            </li>
          ))}
        </Tag>
      )
    }
    case 'quote': {
      if (block.label) {
        const style = CALLOUTS[block.label.toLowerCase()] ?? { box: 'border-blue-300 bg-blue-50', icon: Info }
        const Icon = style.icon
        return (
          <aside {...data} className={`my-5 rounded-lg border-l-4 p-4 ${style.box}`}>
            <p className="mb-1 flex items-center gap-2 font-semibold text-gray-900">
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {block.label}
            </p>
            <div className="text-gray-800">
              <InlineText text={block.text} />
            </div>
          </aside>
        )
      }
      return (
        <blockquote {...data} className="my-5 border-l-4 border-gray-300 pl-4 italic text-gray-700">
          <InlineText text={block.text} />
        </blockquote>
      )
    }
    case 'table':
      return (
        <div {...data} className="relative my-5 overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[480px] text-left text-[15px]">
            <thead className="bg-gray-50">
              <tr>
                {block.header.map((h, i) => (
                  <th key={i} scope="col" className="border-b px-3 py-2 font-semibold text-gray-900">
                    <InlineText text={h} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((r, ri) => (
                <tr key={ri} className="border-b last:border-b-0">
                  {r.map((c, ci) => (
                    <td key={ci} className="px-3 py-2 align-top text-gray-800">
                      <InlineText text={c} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'image':
      return (
        <figure {...data} className="my-5">
          {/* eslint-disable-next-line @next/next/no-img-element -- lesson images come from any host */}
          <img src={block.src} alt={block.alt} loading="lazy" className="h-auto max-w-full rounded-lg border" />
          {block.alt && <figcaption className="mt-2 text-sm text-gray-600">{block.alt}</figcaption>}
        </figure>
      )
    case 'hr':
      return <hr {...data} className="my-8 border-gray-200" />
    case 'code':
      return (
        <pre {...data} className="my-4 overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100">
          <code>{block.text}</code>
        </pre>
      )
  }
}
