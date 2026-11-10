// Program page ownership rules. Pure, so they can be unit tested and shared by
// server actions and pages. Not 'use server': nothing here is an endpoint.
//
// A CoachProgram is owned by a coach OR an ambassador. At most one of coachId /
// ambassadorId is set; both null means an admin has not assigned it yet.

export type ProgramOwnerRole = 'COACH' | 'AMBASSADOR'

export interface ProgramOwnerColumns {
  coachId: string | null
  ambassadorId: string | null
}

/** The signed-in user, resolved to the profile id that owns programs. */
export type ProgramOwnerIdentity =
  | { role: 'COACH'; coachId: string }
  | { role: 'AMBASSADOR'; ambassadorId: string }

/**
 * Who owns a program, or null when nobody valid does. Both ids set breaks the
 * one-owner rule, so it is treated as unowned (fails closed: the page is not
 * served and no one can edit it until an admin reassigns it).
 */
export function programOwnerRole(p: ProgramOwnerColumns): ProgramOwnerRole | null {
  if (p.coachId && p.ambassadorId) return null
  if (p.coachId) return 'COACH'
  if (p.ambassadorId) return 'AMBASSADOR'
  return null
}

export function hasProgramOwner(p: ProgramOwnerColumns): boolean {
  return programOwnerRole(p) !== null
}

export function isProgramOwnedBy(p: ProgramOwnerColumns, who: ProgramOwnerIdentity): boolean {
  if (programOwnerRole(p) !== who.role) return false
  return who.role === 'COACH' ? p.coachId === who.coachId : p.ambassadorId === who.ambassadorId
}

/** Prisma `where` fragment selecting the programs this user owns. */
export function ownerWhere(who: ProgramOwnerIdentity): ProgramOwnerColumns {
  return who.role === 'COACH'
    ? { coachId: who.coachId, ambassadorId: null }
    : { coachId: null, ambassadorId: who.ambassadorId }
}

/** Where each role edits its programs. */
export function programsBasePath(role: ProgramOwnerRole): string {
  return role === 'COACH' ? '/coach/programs' : '/ambassador/programs'
}

/** The word the public page uses for the owner: "your coach" / "your ambassador". */
export function ownerTerm(role: ProgramOwnerRole | null): 'coach' | 'ambassador' {
  return role === 'AMBASSADOR' ? 'ambassador' : 'coach'
}

// ── Admin owner picker ──────────────────────────────────────────────────────
// The picker is a single <Select>, so each option encodes its role and id.

export type ProgramOwnerChoice = { role: ProgramOwnerRole; id: string }

export const UNASSIGNED_OWNER = '__unassigned__'

export function encodeOwnerChoice(p: ProgramOwnerColumns): string {
  const role = programOwnerRole(p)
  if (role === 'COACH') return `COACH:${p.coachId}`
  if (role === 'AMBASSADOR') return `AMBASSADOR:${p.ambassadorId}`
  return UNASSIGNED_OWNER
}

/** Returns null for "unassigned", undefined for anything malformed. */
export function decodeOwnerChoice(value: string): ProgramOwnerChoice | null | undefined {
  if (value === UNASSIGNED_OWNER) return null
  const match = /^(COACH|AMBASSADOR):(.+)$/.exec(value)
  if (!match) return undefined
  return { role: match[1] as ProgramOwnerRole, id: match[2] }
}

/** The column values for an assignment: sets one owner and clears the other. */
export function ownerAssignment(choice: ProgramOwnerChoice | null): ProgramOwnerColumns {
  if (!choice) return { coachId: null, ambassadorId: null }
  return choice.role === 'COACH'
    ? { coachId: choice.id, ambassadorId: null }
    : { coachId: null, ambassadorId: choice.id }
}
