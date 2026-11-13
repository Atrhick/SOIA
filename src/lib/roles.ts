// Associate role helpers.
// Plain module (no 'use server') so client components can import it too -
// same rationale as feature-names.ts.

export const ASSOCIATE_ROLES = [
  'SERVICE_PROVIDER',
  'BUSINESS_AFFILIATE',
  'VOLUNTEER',
] as const

export type AssociateRole = (typeof ASSOCIATE_ROLES)[number]

export const ASSOCIATE_LABELS: Record<AssociateRole, string> = {
  SERVICE_PROVIDER: 'Service Provider',
  BUSINESS_AFFILIATE: 'Business Affiliate',
  VOLUNTEER: 'Volunteer',
}

export function isAssociateRole(role: string | undefined | null): role is AssociateRole {
  return typeof role === 'string' && (ASSOCIATE_ROLES as readonly string[]).includes(role)
}

/**
 * Roles that are part of the organisation and may see internal staff content
 * (shared documents, channels, calendars).
 *
 * Deliberately excludes PARENT, SUB_ADMIN and the associate roles. Use this
 * instead of "is the user logged in?" — several older checks treated
 * authenticated as equivalent to staff, which was true only while PARENT and
 * SUB_ADMIN could never log in.
 */
export const STAFF_ROLES: readonly string[] = ['ADMIN', 'COACH', 'AMBASSADOR']

export function isStaffRole(role: string | undefined | null): boolean {
  return typeof role === 'string' && STAFF_ROLES.includes(role)
}

// ─── One login, several roles ─────────────────────────────────────────────────
// A person can be an admin, a coach and an ambassador on the same login and switch
// between those views. User.role is the highest role held (so "all admins" queries
// still find them) and User.extraRoles holds the rest. The view they are in now is
// session.user.role.

/** Roles that can be combined on one login, highest first. */
export const SWITCHABLE_ROLES = ['ADMIN', 'COACH', 'AMBASSADOR'] as const
export type SwitchableRole = (typeof SWITCHABLE_ROLES)[number]

export const ROLE_VIEW_NAMES: Record<SwitchableRole, string> = {
  ADMIN: 'Admin',
  COACH: 'Coach',
  AMBASSADOR: 'Ambassador',
}

export function isSwitchableRole(role: string | undefined | null): role is SwitchableRole {
  return typeof role === 'string' && (SWITCHABLE_ROLES as readonly string[]).includes(role)
}

/** Every role a login holds, highest first, without repeats. */
export function rolesOf(user: { role: string; extraRoles?: readonly string[] | null }): string[] {
  const all = [user.role, ...(user.extraRoles ?? [])]
  const switchable = SWITCHABLE_ROLES.filter((r) => all.includes(r))
  const other = all.filter((r, i) => !isSwitchableRole(r) && all.indexOf(r) === i)
  return [...switchable, ...other]
}

/** Splits a set of combinable roles into the stored main role (highest) and the rest. */
export function splitRoles(roles: readonly string[]): { role: SwitchableRole; extraRoles: SwitchableRole[] } | null {
  const held = SWITCHABLE_ROLES.filter((r) => roles.includes(r))
  if (!held.length) return null
  return { role: held[0], extraRoles: held.slice(1) }
}

/** The start page for a view. */
export function homeForRole(role: string): string {
  if (role === 'ADMIN') return '/admin'
  if (role === 'COACH') return '/coach'
  if (role === 'AMBASSADOR') return '/ambassador'
  if (isAssociateRole(role)) return '/associate'
  return '/'
}
