/**
 * Timing of each spoken paragraph in a lesson's audio ("segments"), and the rules the
 * player uses to find the paragraph being spoken and the section jumps.
 * Pure and browser-safe. Stored on LessonAudio.segments as { v: 1, segments: [...] }.
 */
import { z } from 'zod'

export type SegmentKind = 'title' | 'heading' | 'text'

export interface AudioSegment {
  /** Matches the paragraph's `data-audio-key` on the page ("<blockId>:<paragraph>", or "title"). */
  key: string
  kind: SegmentKind
  /** Heading level (headings only). */
  level?: number
  /** Words shown in the sections list (headings and title). */
  label?: string
  /** Seconds from the start of the MP3. */
  start: number
  duration: number
}

export interface SegmentUnit {
  key: string
  kind: SegmentKind
  level?: number
  label?: string
}

const round3 = (n: number) => Math.round(n * 1000) / 1000

/** Lays the units end to end using each unit's measured duration (seconds). */
export function buildSegments(units: SegmentUnit[], durations: number[]): AudioSegment[] {
  if (units.length !== durations.length) throw new Error('Each unit needs one duration')
  let t = 0
  return units.map((u, i) => {
    const d = Math.max(0, durations[i] || 0)
    const seg: AudioSegment = { key: u.key, kind: u.kind, start: round3(t), duration: round3(d) }
    if (u.level !== undefined) seg.level = u.level
    if (u.label) seg.label = u.label
    t += d
    return seg
  })
}

export const totalDuration = (segs: AudioSegment[]) =>
  segs.length ? segs[segs.length - 1].start + segs[segs.length - 1].duration : 0

/** Index of the segment playing at time t (the last one starting at or before t), or -1. */
export function segmentIndexAt(segs: AudioSegment[], t: number): number {
  let lo = 0
  let hi = segs.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (segs[mid].start <= t + 0.05) {
      found = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return found
}

export interface AudioSection {
  key: string
  label: string
  level: number
  start: number
}

/** The sections list: the title and every heading. */
export function sectionsOf(segs: AudioSegment[]): AudioSection[] {
  return segs
    .filter((s) => (s.kind === 'heading' || s.kind === 'title') && s.label)
    .map((s) => ({ key: s.key, label: s.label as string, level: s.kind === 'title' ? 0 : s.level ?? 2, start: s.start }))
}

/** Points the previous/next buttons jump between: section starts, or every paragraph when there are no headings. */
function jumpPoints(segs: AudioSegment[]): number[] {
  const heads = segs.filter((s) => s.kind === 'heading')
  const pts = (heads.length ? heads : segs).map((s) => s.start)
  return Array.from(new Set([0, ...pts])).sort((a, b) => a - b)
}

/** Previous: back to the start of this section, or to the one before if we're within `grace` seconds of its start. */
export function previousJump(segs: AudioSegment[], t: number, grace = 3): number {
  const pts = jumpPoints(segs)
  let i = -1
  for (let k = 0; k < pts.length; k++) if (pts[k] <= t + 0.25) i = k
  if (i < 0) return 0
  if (t - pts[i] > grace) return pts[i]
  return i > 0 ? pts[i - 1] : 0
}

/** Next: the start of the next section, or null at the last one. */
export function nextJump(segs: AudioSegment[], t: number): number | null {
  for (const p of jumpPoints(segs)) if (p > t + 0.25) return p
  return null
}

const SegmentSchema = z.object({
  key: z.string().min(1).max(200),
  kind: z.enum(['title', 'heading', 'text']),
  level: z.number().int().min(1).max(6).optional(),
  label: z.string().max(500).optional(),
  start: z.number().finite().min(0),
  duration: z.number().finite().min(0),
})
const StoredSchema = z.object({ v: z.literal(1), segments: z.array(SegmentSchema).max(5000) })

/** The JSON stored on LessonAudio.segments. */
export const storeSegments = (segments: AudioSegment[]) => ({ v: 1 as const, segments })

/** Reads LessonAudio.segments; null for old audio (no segments) or anything malformed. */
export function readStoredSegments(json: unknown): AudioSegment[] | null {
  const r = StoredSchema.safeParse(json)
  if (!r.success || !r.data.segments.length) return null
  return [...r.data.segments].sort((a, b) => a.start - b.start)
}
