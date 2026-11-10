import { describe, expect, it } from 'vitest'
import { copyDay, nextBlock, preset, sameWindows, weeklySlots, windowErrors } from './weekly-times'

const w = (d: number, s: number, e: number) => ({ dayOfWeek: d, startMinute: s * 60, endMinute: e * 60 })

describe('weekly times', () => {
  it('flags overlaps and too-short blocks per row', () => {
    const list = [w(1, 9, 12), w(1, 11, 13), w(2, 9, 9.25), w(3, 9, 10), w(3, 10, 11)]
    const e = windowErrors(list)
    expect(e[1]).toMatch(/Overlaps 9:00 AM–12:00 PM/)
    expect(e[2]).toMatch(/30 minutes/)
    expect(e[0]).toBeUndefined()
    expect(e[3]).toBeUndefined(); expect(e[4]).toBeUndefined() // touching is fine
  })
  it('next block follows the last one, 9-5 on an empty day, null when full', () => {
    expect(nextBlock([], 1)).toEqual(w(1, 9, 17))
    expect(nextBlock([w(1, 9, 12)], 1)).toEqual(w(1, 12, 14))
    expect(nextBlock([w(1, 9, 23)], 1)).toEqual(w(1, 23, 24))
    expect(nextBlock([w(1, 9, 24)], 1)).toBeNull()
  })
  it('copies a day onto others, replacing what they had', () => {
    const out = copyDay([w(1, 9, 12), w(1, 13, 15), w(2, 18, 20), w(6, 10, 11)], 1, [1, 2, 3])
    expect(out.filter((x) => x.dayOfWeek === 2)).toEqual([w(2, 9, 12), w(2, 13, 15)])
    expect(out.filter((x) => x.dayOfWeek === 3)).toHaveLength(2)
    expect(out.filter((x) => x.dayOfWeek === 6)).toEqual([w(6, 10, 11)])
    expect(out.filter((x) => x.dayOfWeek === 1)).toHaveLength(2)
  })
  it('counts slots and compares lists', () => {
    expect(weeklySlots(preset([1, 2, 3, 4, 5], 9 * 60, 17 * 60))).toBe(80)
    expect(weeklySlots([w(1, 9, 12), w(1, 11, 13)])).toBe(8)
    expect(sameWindows([w(1, 9, 12), w(2, 9, 12)], [w(2, 9, 12), w(1, 9, 12)])).toBe(true)
    expect(sameWindows([w(1, 9, 12)], [w(1, 9, 13)])).toBe(false)
  })
})
