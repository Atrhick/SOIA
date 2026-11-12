import { describe, expect, it } from 'vitest'
import { computeOutreachStreak } from './outreach-streak'

/** Noon Central on a yyyy-mm-dd (UTC-6 in November, UTC-5 in summer; 18:00Z is safely midday either way). */
const day = (k: string) => new Date(`${k}T18:00:00Z`)
const days = (...ks: string[]) => ks.map(day)

describe('computeOutreachStreak', () => {
  it('is empty with no activity', () => {
    const s = computeOutreachStreak([], day('2026-11-12'))
    expect(s.streak).toBe(0)
    expect(s.doneToday).toBe(false)
    expect(s.freeMissesLeft).toBe(2)
    expect(s.last14).toHaveLength(14)
    expect(s.last14[13]).toEqual({ day: '2026-11-12', state: 'today' })
    expect(s.last14.slice(0, 13).every((d) => d.state === 'missed')).toBe(true)
  })

  it('counts consecutive days, and today not done yet does not break it', () => {
    const s = computeOutreachStreak(days('2026-11-09', '2026-11-10', '2026-11-11'), day('2026-11-12'))
    expect(s.streak).toBe(3)
    expect(s.doneToday).toBe(false)
    expect(s.last14[13].state).toBe('today')
  })

  it('counts today when done', () => {
    const s = computeOutreachStreak(days('2026-11-11', '2026-11-12'), day('2026-11-12'))
    expect(s.streak).toBe(2)
    expect(s.doneToday).toBe(true)
    expect(s.last14[13].state).toBe('sent')
  })

  it('uses a free miss automatically and keeps the streak (free days do not add)', () => {
    const s = computeOutreachStreak(days('2026-11-08', '2026-11-09', '2026-11-11'), day('2026-11-12'))
    expect(s.streak).toBe(3)
    expect(s.freeMissesLeft).toBe(1)
    expect(s.last14.find((d) => d.day === '2026-11-10')?.state).toBe('free')
  })

  it('resets on the 3rd miss in a month', () => {
    // misses on 3, 5, 7 -> third resets; then 8..11 sent
    const s = computeOutreachStreak(days('2026-11-02', '2026-11-04', '2026-11-06', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11'), day('2026-11-12'))
    expect(s.streak).toBe(4)
    expect(s.freeMissesLeft).toBe(0)
    const st = (k: string) => s.last14.find((d) => d.day === k)?.state
    expect(st('2026-11-03')).toBe('free')
    expect(st('2026-11-05')).toBe('free')
    expect(st('2026-11-07')).toBe('missed')
  })

  it('gives 2 new free misses each calendar month', () => {
    const s = computeOutreachStreak(
      days('2026-10-27', '2026-10-29', '2026-10-31', '2026-11-01', '2026-11-03', '2026-11-04'),
      day('2026-11-04'),
    )
    // Oct 28, Oct 30 free (October), Nov 2 free (November)
    expect(s.streak).toBe(6)
    expect(s.freeMissesLeft).toBe(1)
  })

  it('does not spend free misses when no streak is running', () => {
    const s = computeOutreachStreak(days('2026-11-01'), day('2026-11-12'))
    // Nov 2, 3 free; Nov 4 resets; Nov 5..11 missed without using anything more
    expect(s.streak).toBe(0)
    expect(s.freeMissesLeft).toBe(0)
    const s2 = computeOutreachStreak(days('2026-11-11'), day('2026-11-12'))
    expect(s2.freeMissesLeft).toBe(2)
    expect(s2.streak).toBe(1)
  })

  it('uses Central time for the day', () => {
    // 2026-11-12 03:00Z is still Nov 11 in Chicago
    const s = computeOutreachStreak([new Date('2026-11-12T03:00:00Z')], day('2026-11-12'))
    expect(s.doneToday).toBe(false)
    expect(s.streak).toBe(1)
  })

  it('ignores activity after now', () => {
    const s = computeOutreachStreak(days('2026-11-13'), day('2026-11-12'))
    expect(s.streak).toBe(0)
  })
})
