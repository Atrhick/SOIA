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
