/**
 * The owner's rule: an adult never messages an under-18 ambassador alone. Minors talk with adults only in a
 * group, or in a conversation their parent is part of. Pure functions only (no database), so they are tested
 * in guardians.test.ts; the database side lives in guardians-server.ts.
 */

export type AmbassadorAgeInfo = {
  /** The ambassador's login (Ambassador.userId). */
  userId: string
  dateOfBirth: Date | null
  parentUserId: string | null
  parentFirstName?: string | null
  parentLastName?: string | null
  parentEmail?: string | null
  parentPhone?: string | null
}

export const MINOR_NEEDS_PARENT_LOGIN =
  'This ambassador is under 18. Their parent needs a parent login before you can message them privately. You can talk with them in their group.'

/** Age in whole years on `today`. */
export function ageOn(dateOfBirth: Date, today: Date): number {
  let age = today.getFullYear() - dateOfBirth.getFullYear()
  const m = today.getMonth() - dateOfBirth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dateOfBirth.getDate())) age--
  return age
}

/** Under 18 today. With no date of birth, parent details on file (or a parent login) mean we treat them as a minor. */
export function isMinor(a: AmbassadorAgeInfo, today: Date = new Date()): boolean {
  if (a.dateOfBirth) return ageOn(a.dateOfBirth, today) < 18
  return Boolean(
    a.parentUserId ||
      a.parentFirstName?.trim() ||
      a.parentLastName?.trim() ||
      a.parentEmail?.trim() ||
      a.parentPhone?.trim()
  )
}

export type GuardianCheck =
  | { ok: true; parentIds: string[]; memberIds: string[] }
  | { ok: false; error: string; minorUserIds: string[] }

/**
 * Given everyone in a private conversation, the parent logins that must be added. A minor's parent is required
 * when anyone else in it is an adult: anyone who is not that minor and not their parent (another minor's parent
 * counts as an adult; another minor does not). Fails when a required parent has no login.
 */
export function requiredParents(
  participantIds: string[],
  ambassadors: AmbassadorAgeInfo[],
  today: Date = new Date()
): GuardianCheck {
  const original = Array.from(new Set(participantIds))
  const people = [...original]
  const byUser = new Map(ambassadors.map((a) => [a.userId, a]))
  const minors = original.map((id) => byUser.get(id)).filter((a): a is AmbassadorAgeInfo => !!a && isMinor(a, today))
  const minorIds = new Set(minors.map((m) => m.userId))

  // Repeat until nothing changes: a parent added for one minor is an adult to another minor in the same chat.
  let changed = true
  while (changed) {
    changed = false
    const missing: string[] = []
    for (const minor of minors) {
      const hasAdult = people.some((id) => id !== minor.userId && id !== minor.parentUserId && !minorIds.has(id))
      if (!hasAdult) continue
      if (!minor.parentUserId) missing.push(minor.userId)
      else if (!people.includes(minor.parentUserId)) {
        people.push(minor.parentUserId)
        changed = true
      }
    }
    if (missing.length > 0) return { ok: false, error: MINOR_NEEDS_PARENT_LOGIN, minorUserIds: missing }
  }
  return { ok: true, parentIds: people.filter((id) => !original.includes(id)), memberIds: people }
}
