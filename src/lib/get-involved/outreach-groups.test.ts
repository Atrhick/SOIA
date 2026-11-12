import { describe, expect, it } from 'vitest'
import { groupSizes, planGroups, shuffle } from './outreach-groups'

function seeded(seed: number) {
  let s = seed
  return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
}

describe('groupSizes', () => {
  it('makes groups of 5 with every group 4-6 from 8 members up', () => {
    for (let n = 8; n <= 200; n++) {
      const sizes = groupSizes(n)
      expect(sizes.reduce((a, b) => a + b, 0)).toBe(n)
      expect(sizes.every((s) => s >= 4 && s <= 6)).toBe(true)
      expect(sizes.filter((s) => s !== 5).length).toBeLessThanOrEqual(2)
    }
  })
  it('handles tiny numbers with one group', () => {
    expect(groupSizes(0)).toEqual([])
    expect(groupSizes(3)).toEqual([3])
    expect(groupSizes(6)).toEqual([6])
    expect(groupSizes(7)).toEqual([7])
  })
  it('examples', () => {
    expect(groupSizes(10)).toEqual([5, 5])
    expect(groupSizes(11)).toEqual([5, 6])
    expect(groupSizes(12)).toEqual([6, 6])
    expect(groupSizes(13)).toEqual([5, 4, 4])
    expect(groupSizes(14)).toEqual([5, 5, 4])
  })
})

describe('shuffle', () => {
  it('keeps every item', () => {
    expect(shuffle([1, 2, 3, 4, 5], seeded(1)).sort()).toEqual([1, 2, 3, 4, 5])
  })
})

describe('planGroups', () => {
  const members = (exp: number, fresh: number) => [
    ...Array.from({ length: exp }, (_, i) => ({ userId: `e${i}`, experienced: true })),
    ...Array.from({ length: fresh }, (_, i) => ({ userId: `n${i}`, experienced: false })),
  ]

  it('places everyone exactly once with the planned sizes', () => {
    const groups = planGroups(members(7, 16), seeded(3))
    expect(groups.map((g) => g.length)).toEqual(groupSizes(23))
    const all = groups.flat()
    expect(new Set(all).size).toBe(23)
  })

  it('spreads experienced members evenly', () => {
    const groups = planGroups(members(8, 17), seeded(7)) // 25 -> five groups
    const exp = groups.map((g) => g.filter((id) => id.startsWith('e')).length)
    expect(Math.max(...exp) - Math.min(...exp)).toBeLessThanOrEqual(1)
  })

  it('shuffles differently with a different seed', () => {
    const a = planGroups(members(0, 20), seeded(1)).flat().join()
    const b = planGroups(members(0, 20), seeded(2)).flat().join()
    expect(a).not.toBe(b)
  })

  it('returns no groups for no members', () => {
    expect(planGroups([])).toEqual([])
  })
})
