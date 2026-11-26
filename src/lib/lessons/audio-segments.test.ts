import { describe, it, expect } from 'vitest'
import {
  buildSegments,
  nextJump,
  previousJump,
  readStoredSegments,
  sectionsOf,
  segmentIndexAt,
  storeSegments,
  totalDuration,
  type SegmentUnit,
} from './audio-segments'

const units: SegmentUnit[] = [
  { key: 'title', kind: 'title', label: 'Week 1' },
  { key: 'b1:0', kind: 'heading', level: 2, label: 'Why it matters' },
  { key: 'b1:1', kind: 'text' },
  { key: 'b1:2', kind: 'heading', level: 3, label: 'Exercise: Your values' },
  { key: 'b1:3', kind: 'text' },
]
const segs = buildSegments(units, [1.5, 2.25, 10.0004, 3, 4])

describe('buildSegments', () => {
  it('lays units end to end with measured durations', () => {
    expect(segs.map((s) => s.start)).toEqual([0, 1.5, 3.75, 13.75, 16.75])
    expect(segs[2].duration).toBe(10)
    expect(totalDuration(segs)).toBeCloseTo(20.75, 3)
    expect(segs[1]).toMatchObject({ key: 'b1:0', kind: 'heading', level: 2, label: 'Why it matters' })
    expect(segs[2].label).toBeUndefined()
  })
  it('needs one duration per unit', () => {
    expect(() => buildSegments(units, [1])).toThrow()
  })
})

describe('segmentIndexAt', () => {
  it('finds the paragraph playing at a time', () => {
    expect(segmentIndexAt(segs, 0)).toBe(0)
    expect(segmentIndexAt(segs, 3.6)).toBe(1)
    expect(segmentIndexAt(segs, 3.75)).toBe(2)
    expect(segmentIndexAt(segs, 999)).toBe(4)
    expect(segmentIndexAt([], 5)).toBe(-1)
  })
})

describe('sections and jumps', () => {
  it('lists the title and headings', () => {
    expect(sectionsOf(segs).map((s) => [s.label, s.start, s.level])).toEqual([
      ['Week 1', 0, 0],
      ['Why it matters', 1.5, 2],
      ['Exercise: Your values', 13.75, 3],
    ])
  })
  it('previous goes to this section start, or the one before near the start', () => {
    expect(previousJump(segs, 10)).toBe(1.5)
    expect(previousJump(segs, 14.5)).toBe(1.5)
    expect(previousJump(segs, 1)).toBe(0)
  })
  it('next goes to the next section, null at the last', () => {
    expect(nextJump(segs, 0)).toBe(1.5)
    expect(nextJump(segs, 5)).toBe(13.75)
    expect(nextJump(segs, 14)).toBeNull()
  })
  it('without headings, jumps go paragraph by paragraph', () => {
    const plain = buildSegments([{ key: 'a:0', kind: 'text' }, { key: 'a:1', kind: 'text' }], [5, 5])
    expect(nextJump(plain, 1)).toBe(5)
  })
})

describe('stored JSON', () => {
  it('round-trips and rejects old or broken values', () => {
    expect(readStoredSegments(JSON.parse(JSON.stringify(storeSegments(segs))))).toEqual(segs)
    expect(readStoredSegments(null)).toBeNull()
    expect(readStoredSegments({ v: 1, segments: [] })).toBeNull()
    expect(readStoredSegments({ v: 2, segments: segs })).toBeNull()
    expect(readStoredSegments({ v: 1, segments: [{ key: 'x', kind: 'text', start: -1, duration: 1 }] })).toBeNull()
  })
})
