/**
 * Course navigation rules shared by the catalog, course page and lesson page. Pure, unit tested.
 */

export interface RuleLesson {
  id: string
  completed: boolean
}

export interface RuleModule {
  lessons: RuleLesson[]
}

const DAY_MS = 24 * 60 * 60 * 1000

/** When module `index` (0-based) opens. Null = open now (no drip, or the first module). */
export function moduleOpensAt(index: number, enrolledAt: Date | null, dripDays: number | null): Date | null {
  if (!dripDays || dripDays <= 0 || index <= 0 || !enrolledAt) return null
  return new Date(enrolledAt.getTime() + index * dripDays * DAY_MS)
}

export function isModuleOpen(index: number, enrolledAt: Date | null, dripDays: number | null, now = new Date()): boolean {
  const at = moduleOpensAt(index, enrolledAt, dripDays)
  return !at || at.getTime() <= now.getTime()
}

/**
 * The lesson to resume: the first unfinished lesson in an open module. If every open lesson is done,
 * the first lesson (for review). Null when the course has no lessons.
 */
export function nextLessonId(
  modules: RuleModule[],
  opts: { enrolledAt?: Date | null; dripDays?: number | null; now?: Date } = {}
): string | null {
  const now = opts.now ?? new Date()
  for (let i = 0; i < modules.length; i++) {
    if (!isModuleOpen(i, opts.enrolledAt ?? null, opts.dripDays ?? null, now)) break
    const l = modules[i].lessons.find((x) => !x.completed)
    if (l) return l.id
  }
  return modules.find((m) => m.lessons.length)?.lessons[0]?.id ?? null
}

export function progressPercent(completed: number, total: number): number {
  return total > 0 ? Math.round((completed / total) * 100) : 0
}

export function formatMinutes(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} h ${m} min` : `${h} h`
}
