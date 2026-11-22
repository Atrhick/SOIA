const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Which course week a group is in right now.
 * Week 1 starts at startDate; each week is 7 days. Returns null before the
 * start or after the last week has ended.
 */
export function currentWeek(startDate: Date, weeks: number, now: Date = new Date()): number | null {
  const elapsed = now.getTime() - startDate.getTime()
  if (!Number.isFinite(elapsed) || elapsed < 0 || weeks < 1) return null
  const week = Math.floor(elapsed / WEEK_MS) + 1
  return week <= weeks ? week : null
}
