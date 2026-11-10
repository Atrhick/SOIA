/** Pure helpers for editing a host's weekly times (the Availability page). Times are minutes from midnight. */

export interface Win { dayOfWeek: number; startMinute: number; endMinute: number }

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
/** Monday first. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]
export const WEEKDAYS = [1, 2, 3, 4, 5]
export const DAY_END = 24 * 60
export const MIN_BLOCK = 30

export function timeLabel(m: number): string {
  if (m === DAY_END) return '12:00 AM (midnight)'
  const h = Math.floor(m / 60), mm = m % 60
  return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

const sortKey = (a: Win, b: Win) => a.dayOfWeek - b.dayOfWeek || a.startMinute - b.startMinute

/** Keyed by the window's index in `list`: a message for each block that can't be saved. */
export function windowErrors(list: Win[]): Record<number, string> {
  const errors: Record<number, string> = {}
  list.forEach((w, i) => {
    if (w.endMinute - w.startMinute < MIN_BLOCK) errors[i] = 'Must end at least 30 minutes after it starts.'
  })
  for (const day of Array.from(new Set(list.map((w) => w.dayOfWeek)))) {
    const rows = list.map((w, i) => ({ w, i })).filter((x) => x.w.dayOfWeek === day).sort((a, b) => a.w.startMinute - b.w.startMinute)
    for (let k = 1; k < rows.length; k++) {
      if (rows[k].w.startMinute < rows[k - 1].w.endMinute && !errors[rows[k].i]) errors[rows[k].i] = `Overlaps ${timeLabel(rows[k - 1].w.startMinute)}–${timeLabel(rows[k - 1].w.endMinute)}.`
    }
  }
  return errors
}

/** The next block to add on a day: right after the latest one, 2 hours long; null when the day is full. */
export function nextBlock(list: Win[], day: number): Win | null {
  const rows = list.filter((w) => w.dayOfWeek === day)
  if (rows.length === 0) return { dayOfWeek: day, startMinute: 9 * 60, endMinute: 17 * 60 }
  const start = Math.max(...rows.map((w) => w.endMinute))
  if (start + MIN_BLOCK > DAY_END) return null
  return { dayOfWeek: day, startMinute: start, endMinute: Math.min(start + 120, DAY_END) }
}

/** Replace the blocks on `targets` with copies of `from`'s blocks. */
export function copyDay(list: Win[], from: number, targets: number[]): Win[] {
  const src = list.filter((w) => w.dayOfWeek === from)
  const kept = list.filter((w) => !targets.includes(w.dayOfWeek) || w.dayOfWeek === from)
  const copies = targets.filter((d) => d !== from).flatMap((d) => src.map((w) => ({ ...w, dayOfWeek: d })))
  return [...kept, ...copies].sort(sortKey)
}

/** The same blocks on the given days (a quick-start preset). */
export function preset(days: number[], startMinute: number, endMinute: number): Win[] {
  return days.map((d) => ({ dayOfWeek: d, startMinute, endMinute }))
}

/** Bookable 30-minute slots per week (overlaps counted once). */
export function weeklySlots(list: Win[]): number {
  let n = 0
  for (const day of Array.from(new Set(list.map((w) => w.dayOfWeek)))) {
    const covered = new Set<number>()
    for (const w of list.filter((x) => x.dayOfWeek === day)) for (let t = w.startMinute; t + MIN_BLOCK <= w.endMinute; t += MIN_BLOCK) covered.add(t)
    n += covered.size
  }
  return n
}

/** Order-insensitive equality, for "unsaved changes". */
export function sameWindows(a: Win[], b: Win[]): boolean {
  const f = (l: Win[]) => [...l].sort(sortKey).map((w) => `${w.dayOfWeek}:${w.startMinute}-${w.endMinute}`).join()
  return f(a) === f(b)
}

const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Which days have times, Monday first, runs joined: "Mon–Fri", "Mon, Wed, Fri", "Mon–Wed, Sat–Sun". */
export function daysSummary(list: Win[]): string {
  const on = WEEK_ORDER.filter((d) => list.some((w) => w.dayOfWeek === d))
  const runs: number[][] = []
  for (const d of on) {
    const last = runs[runs.length - 1]
    if (last && WEEK_ORDER.indexOf(d) === WEEK_ORDER.indexOf(last[last.length - 1]) + 1) last.push(d)
    else runs.push([d])
  }
  return runs.map((r) => (r.length >= 3 ? `${SHORT[r[0]]}–${SHORT[r[r.length - 1]]}` : r.map((d) => SHORT[d]).join(', '))).join(', ')
}

/** One line for a host list: "Mon–Fri · 40 h a week", or null with no times. */
export function weekSummary(list: Win[]): string | null {
  if (!list.length) return null
  const h = weeklySlots(list) / 2
  return `${daysSummary(list)} · ${Number.isInteger(h) ? h : h.toFixed(1)} h a week`
}
