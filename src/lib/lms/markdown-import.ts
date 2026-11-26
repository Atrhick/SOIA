/**
 * Turns a folder of markdown files into a course structure (no database here; pure and unit tested).
 *
 * - Optional course file (course.md, _course.md, index.md or README.md): "# Title", description,
 *   "## What you'll learn" list, "## Who it's for" text, "## Details" lines (Category, Tags, Roles, Drip days).
 * - Every other .md file is one module (read in filename order). "# Heading" = module title; the text
 *   before the first "##" = module intro; each "## Heading" starts a lesson.
 * - A "###" section holding "[Write here]", "[Choose one]" or "[Choose all that apply]" lines becomes an
 *   EXERCISE block. The text just above a marker is the question; options are the list lines under a
 *   Choose marker. A section ends at the next heading (level 1-3) or a "---" line.
 */
import { markdownWords, pageOnlyOpenAfter, readingMinutes } from './markdown'
import type { ExerciseContent, ExercisePrompt } from './exercise'

export interface ImportFile {
  name: string
  content: string
}

export type ImportedBlock =
  | { type: 'TEXT'; title: string | null; content: { content: string; format: 'markdown' } }
  | { type: 'EXERCISE'; title: string | null; content: ExerciseContent }

export interface ImportedLesson {
  title: string
  estimatedDuration: number
  blocks: ImportedBlock[]
}

export interface ImportedModule {
  title: string
  description: string | null
  sourceFile: string
  lessons: ImportedLesson[]
}

export interface ImportedCourse {
  title: string
  description: string | null
  outcomes: string[]
  audience: string | null
  category: string | null
  tags: string[]
  allowedRoles: string[]
  dripDays: number | null
  estimatedDuration: number
  modules: ImportedModule[]
  warnings: string[]
}

const COURSE_FILE = /^(_?course|index|readme)\.(md|markdown)$/i
const MD_FILE = /\.(md|markdown)$/i
const TEXT_MARKER = /^\s*\[\s*write here\s*\]\s*$/i
const INLINE_TEXT_MARKER = /^(.*\S)\s+\[\s*write here\s*\]\s*$/i
const BLANK_LINE_MARKER = /^\s*_{5,}\s*$/
const SINGLE_MARKER = /^\s*\[\s*choose one\s*\]\s*$/i
const MULTI_MARKER = /^\s*\[\s*choose (?:all that apply|any|several|one or more)\s*\]\s*$/i
const LIST_LINE = /^\s*(?:[-*+]|\d+[.)])\s+(?:\[\s?\]\s*)?(.*\S)\s*$/
const HEADING = /^\s*(#{1,6})\s+(.*?)\s*#*\s*$/
const RULE = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/

export const baseName = (path: string) => path.split(/[\\/]/).pop() || path

const isMarker = (l: string) =>
  TEXT_MARKER.test(l) || INLINE_TEXT_MARKER.test(l) || BLANK_LINE_MARKER.test(l) || SINGLE_MARKER.test(l) || MULTI_MARKER.test(l)

function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
}

/** "week-01_self-awareness.md" -> "Week 01 self awareness" */
export function titleFromFileName(name: string): string {
  const t = baseName(name).replace(MD_FILE, '').replace(/[-_]+/g, ' ').trim()
  return t ? t[0].toUpperCase() + t.slice(1) : 'Untitled'
}

/** Strips code fences' content from marker detection by tracking fence state line by line. */
function linesOutsideCode(lines: string[]): boolean[] {
  let inCode = false
  return lines.map((l) => {
    if (/^\s*```/.test(l)) {
      inCode = !inCode
      return false
    }
    return !inCode
  })
}

export function exerciseTitle(heading: string): string | null {
  const t = heading.replace(/^(exercise|activity|practice)\s*[:\-–]\s*/i, '').trim()
  return t || null
}

/**
 * Converts the body of an exercise section. Returns null when it has no markers.
 * `after` is any text left after the last question (kept as a normal text block).
 */
export function convertExercise(body: string, warnings: string[] = [], where = ''): { exercise: ExerciseContent; after: string } | null {
  const lines = body.replace(/\r\n?/g, '\n').split('\n')
  if (!lines.some(isMarker)) return null
  const prompts: ExercisePrompt[] = []
  let intro: string | undefined
  let pending: string[] = []
  const nextId = () => `p${prompts.length + 1}`

  const takeLabel = (extra?: string) => {
    const paras = paragraphs([...pending, extra ?? ''].join('\n'))
    pending = []
    if (prompts.length === 0 && paras.length > 1) {
      intro = paras.slice(0, -1).join('\n\n')
      return paras[paras.length - 1]
    }
    return paras.join('\n\n')
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const inline = line.match(INLINE_TEXT_MARKER)
    if (TEXT_MARKER.test(line) || inline || BLANK_LINE_MARKER.test(line)) {
      // A run of blank lines "_____" counts as one writing space.
      if (BLANK_LINE_MARKER.test(line)) {
        for (let j = i + 1; j < lines.length; j++) {
          if (BLANK_LINE_MARKER.test(lines[j])) i = j
          else if (lines[j].trim()) break
        }
      }
      const label = takeLabel(inline ? inline[1] : undefined)
      prompts.push({ id: nextId(), kind: 'text', label: label || 'Your answer' })
      i++
      continue
    }
    if (SINGLE_MARKER.test(line) || MULTI_MARKER.test(line)) {
      const kind = SINGLE_MARKER.test(line) ? 'single' : 'multi'
      const label = takeLabel() || (kind === 'single' ? 'Choose one' : 'Choose all that apply')
      i++
      while (i < lines.length && !lines[i].trim()) i++
      const options: string[] = []
      while (i < lines.length) {
        const m = lines[i].match(LIST_LINE)
        if (!m) break
        options.push(m[1])
        i++
      }
      if (options.length >= 2) {
        prompts.push({ id: nextId(), kind, label, options: Array.from(new Set(options)) })
      } else {
        warnings.push(`${where}: "${label.slice(0, 60)}" has a Choose marker but fewer than two options, so it became a written answer.`)
        prompts.push({ id: nextId(), kind: 'text', label })
      }
      continue
    }
    pending.push(line)
    i++
  }
  const after = pending.join('\n').trim()
  return { exercise: { ...(intro ? { intro } : {}), prompts }, after }
}

/** Splits one lesson's markdown into TEXT and EXERCISE blocks, in order. */
export function lessonBlocks(markdown: string, warnings: string[] = [], where = ''): ImportedBlock[] {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  const live = linesOutsideCode(lines)
  const blocks: ImportedBlock[] = []
  let text: string[] = []
  const pushText = (s?: string) => {
    const body = (s ?? text.join('\n')).trim()
    if (body) blocks.push({ type: 'TEXT', title: null, content: { content: body, format: 'markdown' } })
    if (s === undefined) text = []
  }

  let i = 0
  while (i < lines.length) {
    const h = live[i] ? lines[i].match(HEADING) : null
    if (h && h[1].length === 3) {
      let j = i + 1
      while (j < lines.length) {
        const hh = live[j] ? lines[j].match(HEADING) : null
        if ((hh && hh[1].length <= 3) || (live[j] && RULE.test(lines[j]) && !BLANK_LINE_MARKER.test(lines[j]))) break
        j++
      }
      const body = lines.slice(i + 1, j).join('\n')
      const hasLiveMarker = lines.slice(i + 1, j).some((l, k) => live[i + 1 + k] && isMarker(l))
      const converted = hasLiveMarker ? convertExercise(body, warnings, where) : null
      if (converted) {
        pushText()
        blocks.push({ type: 'EXERCISE', title: exerciseTitle(h[2]), content: converted.exercise })
        if (converted.after) text.push(converted.after)
        i = j
        if (i < lines.length && RULE.test(lines[i]) && !BLANK_LINE_MARKER.test(lines[i])) i++
        continue
      }
    }
    text.push(lines[i])
    i++
  }
  pushText()
  return blocks
}

export function lessonMinutes(blocks: ImportedBlock[]): number {
  let words = 0
  let extra = 0
  for (const b of blocks) {
    if (b.type === 'TEXT') words += markdownWords(b.content.content)
    else {
      words += markdownWords(b.content.intro ?? '')
      for (const p of b.content.prompts) extra += p.kind === 'text' ? 3 : 1
    }
  }
  return Math.max(1, readingMinutes(words) + extra)
}

/**
 * A <!-- page-only --> section can start in one TEXT block (or lesson) and end in a later one. Each block is
 * rendered and read aloud on its own, so reopen the section at the start of every TEXT block it continues into.
 */
export function carryPageOnly(lessons: ImportedLesson[]): void {
  let open = false
  for (const lesson of lessons) {
    for (const block of lesson.blocks) {
      if (block.type !== 'TEXT') continue
      const content = block.content.content
      if (open) block.content = { ...block.content, content: `<!-- page-only -->\n${content}` }
      open = pageOnlyOpenAfter(content, open)
    }
  }
}

export function parseModuleFile(file: ImportFile, warnings: string[] = []): ImportedModule {
  const name = baseName(file.name)
  const lines = file.content.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n')
  const live = linesOutsideCode(lines)
  let title = ''
  const intro: string[] = []
  const lessons: { title: string; lines: string[] }[] = []
  for (let i = 0; i < lines.length; i++) {
    const h = live[i] ? lines[i].match(HEADING) : null
    if (h && h[1].length === 1 && !title && lessons.length === 0) {
      title = h[2]
      continue
    }
    if (h && h[1].length === 2) {
      lessons.push({ title: h[2], lines: [] })
      continue
    }
    if (lessons.length) lessons[lessons.length - 1].lines.push(lines[i])
    else intro.push(lines[i])
  }
  if (!title) title = titleFromFileName(name)

  const introText = intro.join('\n').trim()
  const introParas = paragraphs(introText)
  const firstPara = introParas[0] && !/^\s*(#|>|!\[|\||[-*+]\s|\d+[.)]\s)/.test(introParas[0]) ? introParas[0] : null
  const description = firstPara ? firstPara.replace(/\s*\n\s*/g, ' ').slice(0, 500) : null

  const out: ImportedLesson[] = []
  const introNeedsLesson =
    introText && (introParas.length > 1 || markdownWords(introText) > 80 || intro.some(isMarker) || !firstPara || lessons.length === 0)
  if (introNeedsLesson) {
    const blocks = lessonBlocks(introText, warnings, `${name} (overview)`)
    if (blocks.length) out.push({ title: lessons.length ? 'Overview' : title, estimatedDuration: lessonMinutes(blocks), blocks })
  }
  for (const l of lessons) {
    const blocks = lessonBlocks(l.lines.join('\n'), warnings, `${name} > ${l.title}`)
    if (!blocks.length) {
      warnings.push(`${name}: lesson "${l.title}" is empty and was skipped.`)
      continue
    }
    out.push({ title: l.title.slice(0, 200), estimatedDuration: lessonMinutes(blocks), blocks })
  }
  if (!out.length) warnings.push(`${name}: no lessons found.`)
  carryPageOnly(out)
  return { title: title.slice(0, 200), description, sourceFile: name, lessons: out }
}

const ROLE_WORDS: Record<string, string> = {
  ambassador: 'AMBASSADOR',
  ambassadors: 'AMBASSADOR',
  coach: 'COACH',
  coaches: 'COACH',
}

export function parseCourseFile(content: string) {
  const lines = content.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n')
  let title: string | null = null
  const sections: { heading: string; lines: string[] }[] = [{ heading: '', lines: [] }]
  for (const line of lines) {
    const h = line.match(HEADING)
    if (h && h[1].length === 1 && !title) title = h[2]
    else if (h && h[1].length === 2) sections.push({ heading: h[2], lines: [] })
    else sections[sections.length - 1].lines.push(line)
  }
  const meta = {
    title,
    description: null as string | null,
    outcomes: [] as string[],
    audience: null as string | null,
    category: null as string | null,
    tags: [] as string[],
    allowedRoles: [] as string[],
    dripDays: null as number | null,
  }
  for (const s of sections) {
    const body = s.lines.join('\n').trim()
    if (!s.heading) meta.description = body || null
    else if (/learn|outcome/i.test(s.heading)) {
      meta.outcomes = s.lines.map((l) => l.match(LIST_LINE)?.[1]).filter((x): x is string => !!x)
    } else if (/who|audience/i.test(s.heading)) meta.audience = body || null
    else if (/detail|setting/i.test(s.heading)) {
      for (const l of s.lines) {
        const m = l.replace(/^\s*[-*]\s+/, '').match(/^\s*([A-Za-z ]+?)\s*:\s*(.+?)\s*$/)
        if (!m) continue
        const key = m[1].toLowerCase()
        if (key === 'category') meta.category = m[2]
        else if (key === 'tags') meta.tags = m[2].split(',').map((t) => t.trim()).filter(Boolean)
        else if (key === 'roles' || key === 'for' || key === 'audience')
          meta.allowedRoles = Array.from(new Set(m[2].split(/[,\s]+/).map((r) => ROLE_WORDS[r.toLowerCase()] ?? r.toUpperCase()).filter((r) => r === 'COACH' || r === 'AMBASSADOR')))
        else if (key.startsWith('drip')) {
          const n = parseInt(m[2], 10)
          meta.dripDays = Number.isFinite(n) && n > 0 ? Math.min(n, 60) : null
        }
      }
    }
  }
  return meta
}

export function parseCourseFolder(files: ImportFile[]): ImportedCourse {
  const warnings: string[] = []
  const md = files.filter((f) => MD_FILE.test(baseName(f.name)))
  const skipped = files.length - md.length
  if (skipped) warnings.push(`${skipped} file(s) that are not markdown were skipped.`)
  const courseFile = md.find((f) => COURSE_FILE.test(baseName(f.name)))
  const moduleFiles = md
    .filter((f) => f !== courseFile)
    .sort((a, b) => baseName(a.name).localeCompare(baseName(b.name), undefined, { numeric: true, sensitivity: 'base' }))
  const meta = courseFile ? parseCourseFile(courseFile.content) : null
  if (!courseFile) warnings.push('No course.md found, so the course has no description or outcomes yet. You can add them in Settings.')
  const modules = moduleFiles.map((f) => parseModuleFile(f, warnings)).filter((m) => m.lessons.length > 0)
  const roles = meta?.allowedRoles.length ? meta.allowedRoles : ['COACH', 'AMBASSADOR']
  if (!meta?.allowedRoles.length) warnings.push('No "Roles:" line found, so both coaches and ambassadors can see it. Change this in Settings.')
  const estimatedDuration = modules.reduce((a, m) => a + m.lessons.reduce((b, l) => b + l.estimatedDuration, 0), 0)
  return {
    title: (meta?.title || modules[0]?.title || 'Imported course').slice(0, 200),
    description: meta?.description ?? null,
    outcomes: meta?.outcomes ?? [],
    audience: meta?.audience ?? null,
    category: meta?.category ?? null,
    tags: meta?.tags ?? [],
    allowedRoles: roles,
    dripDays: meta?.dripDays ?? null,
    estimatedDuration,
    modules,
    warnings,
  }
}
