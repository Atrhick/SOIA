/**
 * Pure helpers for the Playbook page and the message editors (owner and admin). No database, no Node
 * APIs: the browser, the server actions and the tests all use them.
 */
import { isPlaybookGuide, isScenarioKey, isScriptVariant, type PlaybookGuide, type ScenarioKey, type ScriptVariant } from '@/lib/get-involved/scripts'

// ---------- general message keys (OutreachTemplate.key for the admin's general messages) ----------

export const generalKey = (scenario: ScenarioKey, variant: ScriptVariant) => `${scenario}:${variant}` as const

/** "KNOW:SHORT" -> { scenario, variant }; anything else (old channel keys like "TEXT") -> null. */
export function parseGeneralKey(key: string): { scenario: ScenarioKey; variant: ScriptVariant } | null {
  const m = /^([A-Z_]+):([A-Z]+)$/.exec(key)
  if (!m || !isScenarioKey(m[1]) || !isScriptVariant(m[2])) return null
  return { scenario: m[1], variant: m[2] }
}

/** An admin's saved general message (OutreachTemplate row), serialised for the admin page. */
export interface GeneralScriptRow {
  key: string
  subject: string | null
  body: string
  status: 'LIVE' | 'DRAFT'
  updatedAt: string
}

// ---------- age ----------

/** Under 18 today. No date of birth = treated as an adult (coaches, older profiles). */
export function isMinorOn(dateOfBirth: Date | string | null | undefined, now = new Date()): boolean {
  if (!dateOfBirth) return false
  const d = new Date(dateOfBirth)
  if (Number.isNaN(d.getTime())) return false
  let age = now.getUTCFullYear() - d.getUTCFullYear()
  const m = now.getUTCMonth() - d.getUTCMonth()
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age--
  return age < 18
}

// ---------- where a message came from ----------

export function sourceLabel(source: 'OWNER' | 'PROGRAM' | 'GENERAL', program: string | null): string {
  if (source === 'OWNER') return 'Written by you'
  if (source === 'PROGRAM' && program) return `Written for ${program}`
  return 'General message'
}

// ---------- the guide editor (summary + sections with one point per line) ----------

export const GUIDE_LIMITS = { summary: 600, sections: 12, title: 80, points: 15, point: 400 } as const

export interface GuideForm {
  summary: string
  sections: { title: string; points: string }[]
}

export function guideToForm(g: PlaybookGuide | null): GuideForm {
  if (!g) return { summary: '', sections: [{ title: '', points: '' }] }
  return { summary: g.summary, sections: g.sections.map((s) => ({ title: s.title, points: s.points.join('\n') })) }
}

/** Form -> guide: trims, one point per non-empty line (a leading "-" or "•" is dropped), empty sections removed. */
export function formToGuide(f: GuideForm): PlaybookGuide {
  return {
    summary: f.summary.trim(),
    sections: f.sections
      .map((s) => ({
        title: s.title.trim(),
        points: s.points.split(/\r?\n/).map((p) => p.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean),
      }))
      .filter((s) => s.title || s.points.length),
  }
}

/** What's wrong with a guide, in plain words (null = fine). The server runs the same check. */
export function guideProblem(g: unknown): string | null {
  if (!isPlaybookGuide(g)) return 'The guide is not in the right shape.'
  const L = GUIDE_LIMITS
  if (!g.summary.trim()) return 'Write a short summary first.'
  if (g.summary.length > L.summary) return `Keep the summary under ${L.summary} characters.`
  if (!g.sections.length) return 'Add at least one section with a title and a point.'
  if (g.sections.length > L.sections) return `Use ${L.sections} sections or fewer.`
  for (let i = 0; i < g.sections.length; i++) {
    const s = g.sections[i]
    const name = s.title.trim() ? `"${s.title.trim().slice(0, 30)}"` : `Section ${i + 1}`
    if (!s.title.trim()) return `${name} needs a title.`
    if (s.title.length > L.title) return `Keep the title of ${name} under ${L.title} characters.`
    if (!s.points.length) return `${name} needs at least one point.`
    if (s.points.length > L.points) return `${name} has too many points (${L.points} at most).`
    if (s.points.some((p) => !p.trim())) return `${name} has an empty point.`
    if (s.points.some((p) => p.length > L.point)) return `A point in ${name} is too long (${L.point} characters at most).`
  }
  return null
}

// ---------- editing ----------

/** Inserts a fill-in at the cursor, adding a space either side where needed. Returns the text and new cursor. */
export function insertAt(text: string, start: number, end: number, token: string): { text: string; cursor: number } {
  const s = Math.max(0, Math.min(start, text.length))
  const e = Math.max(s, Math.min(end, text.length))
  const before = text.slice(0, s)
  const after = text.slice(e)
  const pre = before && !/\s$/.test(before) ? ' ' : ''
  const post = after && !/^[\s.,?!:;]/.test(after) ? ' ' : ''
  const ins = `${pre}${token}${post}`
  return { text: before + ins + after, cursor: before.length + ins.length }
}

/** Which ?via= the copied link carries for each kind of message. */
export const VIA_FOR_VARIANT: Record<ScriptVariant, string> = { SHORT: 'text', EMAIL: 'email', POST: 'post' }

export function linkFor(baseUrl: string, variant: ScriptVariant): string {
  return `${baseUrl.replace(/[?#].*$/, '')}?via=${VIA_FOR_VARIANT[variant]}`
}
