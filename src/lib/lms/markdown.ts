/**
 * A small, safe markdown parser for lesson text. Produces plain data (no HTML strings), so the
 * renderer never uses dangerouslySetInnerHTML. Pure, unit tested.
 * Supports: # headings, paragraphs, - / * / 1. lists, > quotes (a leading **Label:** makes a callout),
 * | tables |, ![images](url), --- rules, ``` code, **bold**, *italic*, `code`, [links](url).
 */

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'strong'; c: Inline[] }
  | { t: 'em'; c: Inline[] }
  | { t: 'code'; v: string }
  | { t: 'link'; href: string; c: Inline[] }
  | { t: 'br' }

export type MdBlock = (
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'quote'; label: string | null; text: string }
  | { type: 'table'; header: string[]; rows: string[][] }
  | { type: 'image'; alt: string; src: string }
  | { type: 'hr' }
  | { type: 'code'; text: string }
) & {
  /** Inside <!-- page-only --> ... <!-- /page-only -->: shown on the page, left out of the audio. */
  pageOnly?: boolean
}

const COMMENT_LINE = /^\s*<!--([\s\S]*?)-->\s*$/
const PAGE_ONLY_OPEN = /^\s*page-only\s*$/i
const PAGE_ONLY_CLOSE = /^\s*\/\s*page-only\s*$/i

/** Whether a page-only section is still open at the end of `md`, given whether one was open at its start. */
export function pageOnlyOpenAfter(md: string, openAtStart = false): boolean {
  let open = openAtStart
  for (const line of md.replace(/\r\n?/g, '\n').split('\n')) {
    const m = line.match(COMMENT_LINE)
    if (!m) continue
    if (PAGE_ONLY_OPEN.test(m[1])) open = true
    else if (PAGE_ONLY_CLOSE.test(m[1])) open = false
  }
  return open
}

const isTableRow = (l: string) => /^\s*\|.*\|\s*$/.test(l)
const isTableSep = (l: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l)
const splitRow = (l: string) =>
  l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())
const listItem = (l: string) => l.match(/^\s*(?:([-*+])|(\d+)[.)])\s+(.*)$/)

/** Only http(s), mailto, site-relative and in-page links are allowed; anything else is dropped. */
export function safeHref(href: string): string | null {
  const h = href.trim()
  if (/^(https?:\/\/|mailto:)/i.test(h)) return h
  if (h.startsWith('/') && !h.startsWith('//')) return h
  if (h.startsWith('#')) return h
  return null
}

export function parseMarkdown(md: string): MdBlock[] {
  const lines = md.replace(/\r\n?/g, '\n').split('\n')
  const out: MdBlock[] = []
  let pageOnly = false
  const push = (b: MdBlock) => out.push(pageOnly ? { ...b, pageOnly: true } : b)
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
      continue
    }
    // HTML comments are never shown; <!-- page-only --> / <!-- /page-only --> mark text kept out of the audio.
    const comment = line.match(COMMENT_LINE)
    if (comment) {
      if (PAGE_ONLY_OPEN.test(comment[1])) pageOnly = true
      else if (PAGE_ONLY_CLOSE.test(comment[1])) pageOnly = false
      i++
      continue
    }
    if (/^\s*<!--/.test(line)) {
      while (i < lines.length && !lines[i].includes('-->')) i++
      i++
      continue
    }
    if (/^\s*```/.test(line)) {
      const buf: string[] = []
      i++
      while (i < lines.length && !/^\s*```/.test(lines[i])) buf.push(lines[i++])
      i++
      push({ type: 'code', text: buf.join('\n') })
      continue
    }
    const h = line.match(/^\s*(#{1,6})\s+(.*?)\s*#*\s*$/)
    if (h) {
      push({ type: 'heading', level: h[1].length, text: h[2] })
      i++
      continue
    }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      push({ type: 'hr' })
      i++
      continue
    }
    const img = line.match(/^\s*!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)\s*$/)
    if (img) {
      const src = safeHref(img[2])
      if (src) push({ type: 'image', alt: img[1], src })
      i++
      continue
    }
    if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const header = splitRow(line)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && isTableRow(lines[i])) rows.push(splitRow(lines[i++]))
      push({ type: 'table', header, rows })
      continue
    }
    if (/^\s*>/.test(line)) {
      const buf: string[] = []
      while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''))
      let text = buf.join('\n').trim()
      let label: string | null = null
      const gh = text.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i)
      const bold = text.match(/^\*\*([^*]{1,40}?):?\*\*:?\s*/)
      if (gh) {
        label = gh[1][0].toUpperCase() + gh[1].slice(1).toLowerCase()
        text = text.slice(gh[0].length)
      } else if (bold) {
        label = bold[1].replace(/:$/, '')
        text = text.slice(bold[0].length)
      }
      push({ type: 'quote', label, text })
      continue
    }
    const li = listItem(line)
    if (li) {
      const ordered = !li[1]
      const items: string[] = []
      while (i < lines.length) {
        const m = listItem(lines[i])
        if (m && !m[1] === ordered) {
          items.push(m[3])
          i++
        } else if (lines[i].trim() && /^\s{2,}\S/.test(lines[i]) && items.length) {
          items[items.length - 1] += ' ' + lines[i].trim()
          i++
        } else break
      }
      push({ type: 'list', ordered, items })
      continue
    }
    const buf: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*(#{1,6}\s|>|```|<!--)/.test(lines[i]) &&
      !listItem(lines[i]) &&
      !/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i]) &&
      !(isTableRow(lines[i]) && i + 1 < lines.length && isTableSep(lines[i + 1]))
    ) {
      buf.push(lines[i++])
    }
    push({ type: 'paragraph', text: buf.join('\n') })
  }
  return out
}

export function parseInline(src: string): Inline[] {
  const out: Inline[] = []
  let text = ''
  const flush = () => {
    if (text) out.push({ t: 'text', v: text })
    text = ''
  }
  let i = 0
  while (i < src.length) {
    const rest = src.slice(i)
    let m: RegExpMatchArray | null
    if (rest[0] === '\n') {
      flush()
      out.push({ t: 'br' })
      i++
    } else if ((m = rest.match(/^`([^`]+)`/))) {
      flush()
      out.push({ t: 'code', v: m[1] })
      i += m[0].length
    } else if ((m = rest.match(/^\*\*([\s\S]+?)\*\*/)) || (m = rest.match(/^__([\s\S]+?)__/))) {
      flush()
      out.push({ t: 'strong', c: parseInline(m[1]) })
      i += m[0].length
    } else if ((m = rest.match(/^\*(?!\s)([\s\S]+?)\*/)) || (m = rest.match(/^_(?!\s)([\s\S]+?)_(?![A-Za-z0-9])/))) {
      flush()
      out.push({ t: 'em', c: parseInline(m[1]) })
      i += m[0].length
    } else if ((m = rest.match(/^\[([^\]]+)\]\(([^)\s]+)\)/))) {
      flush()
      const href = safeHref(m[2])
      if (href) out.push({ t: 'link', href, c: parseInline(m[1]) })
      else out.push({ t: 'text', v: m[1] })
      i += m[0].length
    } else {
      text += src[i]
      i++
    }
  }
  flush()
  return out
}

/** Plain words (markdown marks removed), for reading time and search. */
export function markdownWords(md: string): number {
  const plain = md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`|-]/g, ' ')
  return plain.split(/\s+/).filter(Boolean).length
}

/** Minutes to read at about 200 words a minute (at least 1 when there is any text). */
export function readingMinutes(words: number): number {
  if (words <= 0) return 0
  return Math.max(1, Math.round(words / 200))
}
